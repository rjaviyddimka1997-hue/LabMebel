import { useEffect, useState } from 'react'
import type { Route } from '../types'
import { fetchRoute } from '../lib/api'
import { DIFFICULTY } from '../lib/difficulty'
import { formatDistance, formatDuration } from '../lib/format'
import { downloadGpx } from '../lib/gpx'
import { LazyMap } from '../components/LazyMap'
import { DifficultyBadge, Stats, SurfaceBar, TopBar } from '../components/ui'
import { useSession } from '../session'

export function RouteScreen({
  routeId,
  onBack,
  onCreateRide,
}: {
  routeId: string
  onBack: () => void
  onCreateRide: (routeId: string) => void
}) {
  const { center } = useSession()
  const [route, setRoute] = useState<Route | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRoute(routeId)
      .then((loaded) => {
        if (!cancelled) setRoute(loaded)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Маршрут не загрузился')
      })
    return () => {
      cancelled = true
    }
  }, [routeId])

  if (error) {
    return (
      <>
        <TopBar title="Маршрут" onBack={onBack} />
        <div className="pad">
          <div className="banner banner--error">{error}</div>
        </div>
      </>
    )
  }

  if (!route) {
    return (
      <>
        <TopBar title="Маршрут" onBack={onBack} />
        <div className="loading">Загружаем…</div>
      </>
    )
  }

  const meta = DIFFICULTY[route.difficulty]
  const disputed =
    route.difficultyConfirmed !== null &&
    Math.abs(route.difficultyConfirmed - route.difficulty) >= 1

  return (
    <>
      <TopBar title={route.title} onBack={onBack} />
      <div className="screen">
        <div style={{ position: 'relative', height: 240 }}>
          <LazyMap
            center={center}
            routes={[route]}
            rides={[]}
            userPoint={null}
            fitToRoute={route}
          />
        </div>

        <div className="pad stack">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <DifficultyBadge level={route.difficulty} size="lg" />
            <div className="grow">
              <div style={{ fontWeight: 650, fontSize: 17 }}>{route.title}</div>
              <div className="muted">
                {meta.name} · {route.regionName || 'регион не указан'}
              </div>
              {route.ratingCount > 0 && (
                <div className="faint">
                  ★ {route.ratingAvg.toFixed(1)} · {route.ratingCount} оценок ·{' '}
                  {route.ridesCount} выездов
                </div>
              )}
            </div>
          </div>

          {disputed && (
            <div className="banner">
              Автор поставил {meta.code}, прошедшие голосуют за{' '}
              {DIFFICULTY[route.difficultyConfirmed!].code}. Рассчитывайте на
              более сложный вариант.
            </div>
          )}

          <Stats
            items={[
              { value: formatDistance(route.distanceM), label: 'дистанция' },
              {
                value: route.durationEstMin ? formatDuration(route.durationEstMin) : '—',
                label: 'в пути',
              },
              { value: `${route.elevationGainM} м`, label: 'набор высоты' },
            ]}
          />

          <div className="section-title">Уровень {meta.code} — {meta.name}</div>
          <p className="muted" style={{ margin: 0 }}>
            {meta.description} Рекомендуемый опыт: {meta.experience.toLowerCase()}.
          </p>

          {Object.keys(route.surfaceMix).length > 0 && (
            <>
              <div className="section-title">Покрытие</div>
              <SurfaceBar mix={route.surfaceMix} />
            </>
          )}

          {route.description && (
            <>
              <div className="section-title">Описание</div>
              <p style={{ margin: 0 }}>{route.description}</p>
            </>
          )}

          <div className="banner" style={{ marginTop: 12 }}>
            Трек публикуется обрезанным: первые и последние 500 метров скрыты,
            чтобы маршрут не начинался у чьего-то гаража.
          </div>
        </div>

        <div className="actionbar">
          <button
            className="btn btn--primary grow"
            onClick={() => onCreateRide(route.id)}
          >
            Создать выезд
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => downloadGpx(route.title, route.coordinates)}
          >
            GPX
          </button>
        </div>
      </div>
    </>
  )
}
