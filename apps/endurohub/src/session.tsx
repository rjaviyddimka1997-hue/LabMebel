import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LngLat, Rider } from './types'
import { DEFAULT_CENTER } from './data/seed'
import { store } from './lib/store'
import { initData, isTelegram, telegramUser } from './lib/telegram'
import { hasBackend, signInWithTelegram } from './lib/supabase'
import { saveProfile } from './lib/api'

interface SessionValue {
  rider: Rider | null
  /** Онбординг пройден: уровень и город заданы. */
  isOnboarded: boolean
  center: LngLat
  userPoint: LngLat | null
  locating: boolean
  signIn: (rider: Rider) => void
  updateRider: (patch: Partial<Rider>) => void
  locate: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

/** Анонимный профиль-заготовка: до онбординга человек уже может смотреть выезды. */
function draftRider(): Rider {
  const tgUser = telegramUser()
  return {
    id: tgUser ? `tg-${tgUser.id}` : `guest-${Math.random().toString(36).slice(2, 10)}`,
    username: tgUser?.username ?? 'rider',
    displayName: tgUser
      ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')
      : 'Райдер',
    avatarUrl: tgUser?.photo_url ?? null,
    skillLevel: 1,
    city: '',
    motoText: null,
    bio: null,
    ridesCount: 0,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [rider, setRider] = useState<Rider | null>(() => {
    const id = store.currentUserId
    return id ? store.riders.find((r) => r.id === id) ?? null : null
  })
  const [userPoint, setUserPoint] = useState<LngLat | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!hasBackend || !isTelegram()) return
    // Обмен initData на сессию идёт в фоне: экран выездов не должен его ждать.
    signInWithTelegram(initData()).catch(() => {
      // Без сессии остаётся режим чтения — это лучше, чем пустой экран.
    })
  }, [])

  const locate = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPoint({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    )
  }, [])

  const signIn = useCallback((next: Rider) => {
    store.setCurrentUser(next)
    setRider(next)
  }, [])

  const updateRider = useCallback(
    (patch: Partial<Rider>) => {
      setRider((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...patch }
        store.updateCurrentUser(patch)
        void saveProfile(next).catch(() => {
          // Профиль уже сохранён локально; синхронизация повторится при следующем входе.
        })
        return next
      })
    },
    [],
  )

  const value = useMemo<SessionValue>(
    () => ({
      rider,
      isOnboarded: Boolean(rider && rider.city),
      center: userPoint ?? DEFAULT_CENTER,
      userPoint,
      locating,
      signIn,
      updateRider,
      locate,
    }),
    [rider, userPoint, locating, signIn, updateRider, locate],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession вызван вне SessionProvider')
  return value
}

export { draftRider }
