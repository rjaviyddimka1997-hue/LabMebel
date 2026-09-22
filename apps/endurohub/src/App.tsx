import { useCallback, useEffect, useState } from 'react'
import { MapScreen } from './screens/MapScreen'
import { RidesScreen } from './screens/RidesScreen'
import { RideScreen } from './screens/RideScreen'
import { RouteScreen } from './screens/RouteScreen'
import { CreateRideScreen } from './screens/CreateRideScreen'
import { ImportRouteScreen } from './screens/ImportRouteScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { Onboarding } from './screens/Onboarding'
import { SessionProvider, useSession } from './session'
import { hideBackButton, setBackButton, startParam } from './lib/telegram'

type Tab = 'map' | 'rides' | 'profile'

type Screen =
  | { name: 'tab'; tab: Tab }
  | { name: 'ride'; id: string }
  | { name: 'route'; id: string }
  | { name: 'create'; routeId: string | null }
  | { name: 'import' }
  | { name: 'onboarding' }

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'map', icon: '🗺', label: 'Карта' },
  { id: 'rides', icon: '🏍', label: 'Выезды' },
  { id: 'profile', icon: '👤', label: 'Профиль' },
]

function Shell() {
  const { isOnboarded } = useSession()
  const [stack, setStack] = useState<Screen[]>([{ name: 'tab', tab: 'map' }])
  const current = stack[stack.length - 1]

  const push = useCallback((screen: Screen) => setStack((prev) => [...prev, screen]), [])
  const pop = useCallback(
    () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
    [],
  )
  const switchTab = useCallback(
    (tab: Tab) => setStack([{ name: 'tab', tab }]),
    [],
  )

  // Deep link из чата: t.me/endurohub_bot/app?startapp=ride_<id>
  useEffect(() => {
    const param = startParam()
    if (!param) return
    const [kind, id] = param.split('_')
    if (kind === 'ride' && id) push({ name: 'ride', id })
    if (kind === 'route' && id) push({ name: 'route', id })
  }, [push])

  // Нативная кнопка «назад» Telegram отражает глубину стека.
  useEffect(() => {
    if (stack.length <= 1) {
      setBackButton(null)
      return
    }
    setBackButton(pop)
    return () => hideBackButton(pop)
  }, [stack.length, pop])

  const requireOnboarding = useCallback(() => {
    if (!isOnboarded) push({ name: 'onboarding' })
  }, [isOnboarded, push])

  const openCreateRide = useCallback(
    (routeId: string | null) => {
      if (!isOnboarded) {
        push({ name: 'onboarding' })
        return
      }
      push({ name: 'create', routeId })
    },
    [isOnboarded, push],
  )

  const body = (() => {
    switch (current.name) {
      case 'tab':
        switch (current.tab) {
          case 'map':
            return (
              <MapScreen
                onOpenRide={(id) => push({ name: 'ride', id })}
                onOpenRoute={(id) => push({ name: 'route', id })}
                onCreateRide={() => openCreateRide(null)}
              />
            )
          case 'rides':
            return (
              <RidesScreen
                onOpenRide={(id) => push({ name: 'ride', id })}
                onCreateRide={() => openCreateRide(null)}
              />
            )
          case 'profile':
            return (
              <ProfileScreen
                onStartOnboarding={() => push({ name: 'onboarding' })}
                onImportRoute={() => push({ name: 'import' })}
              />
            )
        }
        break
      case 'ride':
        return (
          <RideScreen
            rideId={current.id}
            onBack={pop}
            onOpenRoute={(id) => push({ name: 'route', id })}
            onNeedOnboarding={requireOnboarding}
          />
        )
      case 'route':
        return (
          <RouteScreen
            routeId={current.id}
            onBack={pop}
            onCreateRide={(routeId) => openCreateRide(routeId)}
          />
        )
      case 'create':
        return (
          <CreateRideScreen
            presetRouteId={current.routeId}
            onBack={pop}
            onCreated={(ride) => setStack([{ name: 'tab', tab: 'rides' }, { name: 'ride', id: ride.id }])}
          />
        )
      case 'import':
        return (
          <ImportRouteScreen
            onBack={pop}
            onDone={(route) => setStack([{ name: 'tab', tab: 'map' }, { name: 'route', id: route.id }])}
          />
        )
      case 'onboarding':
        return <Onboarding onDone={pop} />
    }
    return null
  })()

  const showTabs = current.name === 'tab'

  return (
    <div className="app">
      {body}
      {showTabs && (
        <nav className="tabbar" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className="tabbar__item"
              role="tab"
              aria-selected={current.tab === tab.id}
              onClick={() => switchTab(tab.id)}
            >
              <span className="tabbar__icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  )
}
