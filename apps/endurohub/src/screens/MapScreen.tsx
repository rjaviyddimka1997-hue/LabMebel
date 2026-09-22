import { useEffect, useMemo, useState } from 'react'
import type { Difficulty, Route, RouteFilters } from '../types'
import { DEFAULT_RIDE_FILTERS, DEFAULT_ROUTE_FILTERS, fetchRidesNearby, fetchRoutes, type RideListItem } from '../lib/api'
import { ALL_DIFFICULTIES, DIFFICULTY } from '../lib/difficulty'
import { LazyMap } from '../components/LazyMap'
import { DifficultyLegend } from '../components/ui'
import { RideTile } from '../components/cards'
import { useSession } from '../session'
import { haptic } from '../lib/telegram'

type Layer = 'routes' | 'rides'

/**
 * Главный экран — карта, а не лента: эндуро географичен, человек мыслит
 * «куда поехать», а не «что нового».
 */
export function MapScreen({
  onOpenRide,
  onOpenRoute,
  onCreateRide,
}: {
  onOpenRide: (id: string) => void
  onOpenRoute: (id: string) => void
  onCreateRide: () => void
}) {
  const { center, userPoint, locate, locating } = useSession()
  const [layers, setLayers] = useState<Layer[]>(['routes', 'rides'])
  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_ROUTE_FILTERS)
  const [routes, setRoutes] = useState<Route[]>([])
  const [rides, setRides] = useState<RideListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchRoutes(filters),
      fetchRidesNearby(center, { ...DEFAULT_RIDE_FILTERS, radiusKm: 700 }),
    ])
      .then(([loadedRoutes, loadedRides]) => {
        if (cancelled) return
        setRoutes(loadedRoutes)
        setRides(loadedRides)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить карту')
      })
    return () => {
      cancelled = true
    }
  }, [center, filters])

  const toggleLayer = (layer: Layer) => {
    haptic()
    setLayers((prev) =>
      prev.includes(layer) ? prev.filter((item) => item !== layer) : [...prev, layer],
    )
  }

  const toggleDifficulty = (level: Difficulty) => {
    haptic()
    setFilters((prev) =>
      prev.difficultyMin === level && prev.difficultyMax === level
        ? DEFAULT_ROUTE_FILTERS
        : { difficultyMin: level, difficultyMax: level },
    )
  }

  const visibleRoutes = layers.includes('routes') ? routes : []
  const visibleRides = useMemo(
    () =>
      layers.includes('rides')
        ? rides.filter(
            (ride) =>
              ride.difficulty >= filters.difficultyMin &&
              ride.difficulty <= filters.difficultyMax,
          )
        : [],
    [layers, rides, filters],
  )

  return (
    <>
      <div className="chips">
        <button
          type="button"
          className="chip"
          aria-pressed={layers.includes('routes')}
          onClick={() => toggleLayer('routes')}
        >
          🗺 Маршруты {routes.length}
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={layers.includes('rides')}
          onClick={() => toggleLayer('rides')}
        >
          🏍 Выезды {rides.length}
        </button>
        {ALL_DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            className="chip"
            aria-pressed={filters.difficultyMin === level && filters.difficultyMax === level}
            onClick={() => toggleDifficulty(level)}
          >
            {DIFFICULTY[level].code}
          </button>
        ))}
      </div>

      <div className="map-wrap">
        <LazyMap
          center={center}
          routes={visibleRoutes}
          rides={visibleRides}
          userPoint={userPoint}
          onRouteClick={onOpenRoute}
          onRideClick={onOpenRide}
        />
        <DifficultyLegend />

        <button
          className="map-fab map-fab--locate"
          onClick={locate}
          aria-label="Моя геопозиция"
          disabled={locating}
        >
          {locating ? '…' : '⊕'}
        </button>
        <button
          className="map-fab map-fab--create"
          onClick={onCreateRide}
          aria-label="Создать выезд"
        >
          +
        </button>

        <div className="sheet">
          <div className="sheet__grip" />
          {error ? (
            <div className="pad">
              <div className="banner banner--error">{error}</div>
            </div>
          ) : visibleRides.length === 0 ? (
            <div className="pad">
              <div className="banner">
                Выездов рядом нет. Создай свой — мы позовём райдеров твоего уровня.
              </div>
            </div>
          ) : (
            <>
              <div className="sheet__title">🏍 Ближайшие выезды</div>
              <div className="hscroll">
                {visibleRides.slice(0, 10).map((ride) => (
                  <RideTile key={ride.id} ride={ride} onOpen={() => onOpenRide(ride.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
