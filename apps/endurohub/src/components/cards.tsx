import type { Route } from '../types'
import type { RideListItem } from '../lib/api'
import { DIFFICULTY } from '../lib/difficulty'
import {
  formatDistance, formatDuration, formatRideDateShort, formatSlots, relativeDay,
} from '../lib/format'
import { Avatar, DifficultyBadge } from './ui'

/** Компактная плитка для горизонтальной ленты на карте. */
export function RideTile({ ride, onOpen }: { ride: RideListItem; onOpen: () => void }) {
  return (
    <button className="card" onClick={onOpen} type="button">
      <div className="row row--between">
        <DifficultyBadge level={ride.difficulty} />
        <span className="faint">{formatRideDateShort(ride.startsAt)}</span>
      </div>
      <div className="card__title" style={{ fontSize: 14 }}>
        {ride.title}
      </div>
      <div className="meta">
        {ride.routeDistanceM && <span>{formatDistance(ride.routeDistanceM)}</span>}
        <span>{formatSlots(ride.participantsCount, ride.capacity)}</span>
      </div>
      <div className="faint" style={{ marginTop: 4 }}>
        {ride.distanceKm} км от вас
      </div>
    </button>
  )
}

/** Полная строка ленты выездов. */
export function RideRow({
  ride,
  joined,
  onOpen,
}: {
  ride: RideListItem
  joined: boolean
  onOpen: () => void
}) {
  const full = ride.participantsCount >= ride.capacity
  return (
    <button className="card" onClick={onOpen} type="button">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <DifficultyBadge level={ride.difficulty} size="lg" />
        <div className="grow">
          <div className="row row--between">
            <span style={{ fontWeight: 650, fontSize: 13 }}>
              {formatRideDateShort(ride.startsAt)}
            </span>
            <span className="faint">{relativeDay(ride.startsAt)}</span>
          </div>
          <div className="card__title">{ride.title}</div>
          <div className="meta">
            {ride.routeDistanceM && <span>{formatDistance(ride.routeDistanceM)}</span>}
            <span>{ride.distanceKm} км от вас</span>
            <span style={{ color: full ? 'var(--danger)' : undefined }}>
              {formatSlots(ride.participantsCount, ride.capacity)}
            </span>
          </div>
          <div className="faint" style={{ marginTop: 6 }}>
            {ride.organizerName} · {DIFFICULTY[ride.organizerLevel].code}
            {ride.visibility === 'request' && ' · по заявке'}
            {joined && ' · вы участвуете'}
          </div>
        </div>
      </div>
    </button>
  )
}

export function RouteRow({ route, onOpen }: { route: Route; onOpen: () => void }) {
  return (
    <button className="card" onClick={onOpen} type="button">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <DifficultyBadge level={route.difficulty} size="lg" />
        <div className="grow">
          <div className="card__title" style={{ marginTop: 0 }}>
            {route.title}
          </div>
          <div className="meta">
            <span>{formatDistance(route.distanceM)}</span>
            {route.durationEstMin && <span>{formatDuration(route.durationEstMin)}</span>}
            {route.isLoop && <span>петля</span>}
            {route.ratingCount > 0 && (
              <span>
                ★ {route.ratingAvg.toFixed(1)} ({route.ratingCount})
              </span>
            )}
          </div>
          {route.regionName && (
            <div className="faint" style={{ marginTop: 6 }}>
              {route.regionName}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

export function RiderRow({
  rider,
  role,
  onOpen,
}: {
  rider: { id: string; displayName: string; avatarUrl: string | null; skillLevel: 1 | 2 | 3 | 4 | 5; motoText: string | null }
  role?: string
  onOpen?: () => void
}) {
  const content = (
    <div className="row">
      <Avatar rider={rider} />
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{rider.displayName}</div>
        <div className="faint">
          {DIFFICULTY[rider.skillLevel].code}
          {rider.motoText ? ` · ${rider.motoText}` : ''}
          {role ? ` · ${role}` : ''}
        </div>
      </div>
    </div>
  )
  if (!onOpen) return <div className="card card--static">{content}</div>
  return (
    <button className="card" type="button" onClick={onOpen}>
      {content}
    </button>
  )
}
