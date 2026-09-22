import { useEffect, useState } from 'react'
import type { Difficulty, RideFilters } from '../types'
import {
  DEFAULT_RIDE_FILTERS, fetchMyRideIds, fetchRidesNearby, type RideListItem,
} from '../lib/api'
import { ALL_DIFFICULTIES, DIFFICULTY } from '../lib/difficulty'
import { RideRow } from '../components/cards'
import { Empty } from '../components/ui'
import { useSession } from '../session'
import { haptic } from '../lib/telegram'

type Tab = 'nearby' | 'mine'

const WINDOWS: { label: string; days: number }[] = [
  { label: 'Ближайшие выходные', days: 7 },
  { label: '2 недели', days: 14 },
  { label: 'Месяц', days: 30 },
]

export function RidesScreen({
  onOpenRide,
  onCreateRide,
}: {
  onOpenRide: (id: string) => void
  onCreateRide: () => void
}) {
  const { center, rider } = useSession()
  const [tab, setTab] = useState<Tab>('nearby')
  const [filters, setFilters] = useState<RideFilters>(DEFAULT_RIDE_FILTERS)
  const [rides, setRides] = useState<RideListItem[]>([])
  const [myIds, setMyIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchRidesNearby(center, filters)
      .then((loaded) => {
        if (cancelled) return
        setRides(loaded)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить выезды')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [center, filters])

  useEffect(() => {
    if (!rider) {
      setMyIds([])
      return
    }
    let cancelled = false
    fetchMyRideIds(rider.id)
      .then((ids) => {
        if (!cancelled) setMyIds(ids)
      })
      .catch(() => {
        if (!cancelled) setMyIds([])
      })
    return () => {
      cancelled = true
    }
  }, [rider, rides])

  const toggleDifficulty = (level: Difficulty) => {
    haptic()
    setFilters((prev) =>
      prev.difficultyMin === level && prev.difficultyMax === level
        ? { ...prev, difficultyMin: 1, difficultyMax: 5 }
        : { ...prev, difficultyMin: level, difficultyMax: level },
    )
  }

  const visible = tab === 'mine' ? rides.filter((ride) => myIds.includes(ride.id)) : rides

  return (
    <div className="screen screen--flush" style={{ overflowY: 'auto' }}>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={tab === 'nearby'} onClick={() => setTab('nearby')}>
          Рядом
        </button>
        <button type="button" className="chip" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>
          Мои {myIds.length > 0 ? myIds.length : ''}
        </button>
      </div>

      <div className="chips" style={{ paddingTop: 0 }}>
        {WINDOWS.map((option) => (
          <button
            key={option.days}
            type="button"
            className="chip"
            aria-pressed={filters.withinDays === option.days}
            onClick={() => setFilters((prev) => ({ ...prev, withinDays: option.days }))}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          aria-pressed={filters.onlyWithSlots}
          onClick={() => setFilters((prev) => ({ ...prev, onlyWithSlots: !prev.onlyWithSlots }))}
        >
          Есть места
        </button>
      </div>

      <div className="chips" style={{ paddingTop: 0 }}>
        {ALL_DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            className="chip"
            aria-pressed={filters.difficultyMin === level && filters.difficultyMax === level}
            onClick={() => toggleDifficulty(level)}
          >
            {DIFFICULTY[level].code} · {DIFFICULTY[level].name}
          </button>
        ))}
      </div>

      <div className="pad stack">
        {error && <div className="banner banner--error">{error}</div>}
        {loading && <div className="loading">Загружаем выезды…</div>}
        {!loading && visible.length === 0 && tab === 'nearby' && (
          <Empty
            icon="🏍"
            title="Выездов нет"
            text="На выбранный период рядом ничего не запланировано. Создай свой выезд — мы позовём райдеров твоего уровня в радиусе 100 км."
            actionLabel="Создать выезд"
            onAction={onCreateRide}
          />
        )}
        {!loading && visible.length === 0 && tab === 'mine' && (
          <Empty
            icon="📅"
            title="Ты пока никуда не едешь"
            text="Присоединись к выезду на вкладке «Рядом» — или собери свой."
            actionLabel="Смотреть выезды"
            onAction={() => setTab('nearby')}
          />
        )}
        {visible.map((ride) => (
          <RideRow
            key={ride.id}
            ride={ride}
            joined={myIds.includes(ride.id)}
            onOpen={() => onOpenRide(ride.id)}
          />
        ))}
      </div>
    </div>
  )
}
