import { useEffect, useState } from 'react'
import type { Rider, Route } from '../types'
import {
  fetchMyRideIds, fetchRide, fetchRideParticipants, fetchRoute,
  joinRide, leaveRide, type RideListItem,
} from '../lib/api'
import { DIFFICULTY } from '../lib/difficulty'
import {
  formatDistance, formatDuration, formatRideDate, formatSlots, relativeDay,
} from '../lib/format'
import { LazyMap } from '../components/LazyMap'
import { Avatar, DifficultyBadge, Stats, TopBar } from '../components/ui'
import { useSession } from '../session'
import { hapticSuccess, shareRideLink } from '../lib/telegram'

export function RideScreen({
  rideId,
  onBack,
  onOpenRoute,
  onNeedOnboarding,
}: {
  rideId: string
  onBack: () => void
  onOpenRoute: (routeId: string) => void
  onNeedOnboarding: () => void
}) {
  const { center, rider, isOnboarded } = useSession()
  const [ride, setRide] = useState<RideListItem | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [participants, setParticipants] = useState<Rider[]>([])
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRide(rideId, center)
      .then(async (loaded) => {
        if (cancelled || !loaded) return
        setRide(loaded)
        const [people, loadedRoute, myIds] = await Promise.all([
          fetchRideParticipants(rideId),
          loaded.routeId ? fetchRoute(loaded.routeId) : Promise.resolve(null),
          rider ? fetchMyRideIds(rider.id) : Promise.resolve([]),
        ])
        if (cancelled) return
        setParticipants(people)
        setRoute(loadedRoute)
        setJoined(myIds.includes(rideId))
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Выезд не загрузился')
      })
    return () => {
      cancelled = true
    }
  }, [rideId, center, rider])

  const refresh = async () => {
    const [updated, people] = await Promise.all([
      fetchRide(rideId, center),
      fetchRideParticipants(rideId),
    ])
    setRide(updated)
    setParticipants(people)
  }

  const handleJoin = async () => {
    if (!rider || !isOnboarded) {
      onNeedOnboarding()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const status = await joinRide(rideId, rider.id)
      setJoined(true)
      hapticSuccess()
      setNotice(
        status === 'requested'
          ? 'Заявка отправлена. Организатор получит уведомление и подтвердит участие.'
          : 'Вы в группе. За сутки до выезда придёт напоминание с чек-листом.',
      )
      await refresh()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось присоединиться')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!rider) return
    setBusy(true)
    try {
      await leaveRide(rideId, rider.id)
      setJoined(false)
      setNotice(null)
      await refresh()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выйти из выезда')
    } finally {
      setBusy(false)
    }
  }

  if (error && !ride) {
    return (
      <>
        <TopBar title="Выезд" onBack={onBack} />
        <div className="pad">
          <div className="banner banner--error">{error}</div>
        </div>
      </>
    )
  }

  if (!ride) {
    return (
      <>
        <TopBar title="Выезд" onBack={onBack} />
        <div className="loading">Загружаем…</div>
      </>
    )
  }

  const meta = DIFFICULTY[ride.difficulty]
  const full = ride.participantsCount >= ride.capacity
  const isOrganizer = rider?.id === ride.organizerId

  return (
    <>
      <TopBar
        title={meta.code + ' · выезд'}
        onBack={onBack}
        action={
          <button
            className="topbar__action"
            onClick={() => shareRideLink(ride.id, ride.title)}
            aria-label="Поделиться"
          >
            ↗
          </button>
        }
      />

      <div className="screen">
        <div style={{ position: 'relative', height: 200 }}>
          <LazyMap
            center={ride.meetingPoint}
            routes={route ? [route] : []}
            rides={[ride]}
            userPoint={null}
            fitToRoute={route}
          />
        </div>

        <div className="pad stack">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <DifficultyBadge level={ride.difficulty} size="lg" />
            <div className="grow">
              <div style={{ fontWeight: 650, fontSize: 17 }}>{ride.title}</div>
              <div className="muted">{formatRideDate(ride.startsAt)}</div>
              <div className="faint">{relativeDay(ride.startsAt)}</div>
            </div>
          </div>

          {notice && <div className="banner">{notice}</div>}
          {error && <div className="banner banner--error">{error}</div>}

          <Stats
            items={[
              { value: route ? formatDistance(route.distanceM) : '—', label: 'дистанция' },
              {
                value: route?.durationEstMin ? formatDuration(route.durationEstMin) : '—',
                label: 'в пути',
              },
              { value: `${ride.participantsCount}/${ride.capacity}`, label: 'участников' },
            ]}
          />

          <div className="section-title">Точка сбора</div>
          <div className="card card--static">
            <div style={{ fontWeight: 600 }}>📍 {ride.meetingAddress}</div>
            <div className="faint" style={{ marginTop: 4 }}>
              {ride.meetingPoint.lat.toFixed(4)}, {ride.meetingPoint.lng.toFixed(4)}
            </div>
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginTop: 10 }}
              onClick={() =>
                window.open(
                  `https://yandex.ru/maps/?pt=${ride.meetingPoint.lng},${ride.meetingPoint.lat}&z=15&l=map`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Открыть в картах
            </button>
          </div>

          <div className="section-title">Организатор</div>
          <div className="card card--static">
            <div className="row">
              <Avatar
                rider={{
                  displayName: ride.organizerName,
                  avatarUrl: null,
                  skillLevel: ride.organizerLevel,
                }}
              />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{ride.organizerName}</div>
                <div className="faint">{DIFFICULTY[ride.organizerLevel].code}</div>
              </div>
            </div>
          </div>

          <div className="section-title">
            Участники {ride.participantsCount} / {ride.capacity}
          </div>
          <div className="avatar-row">
            {participants.map((person) => (
              <Avatar key={person.id} rider={person} />
            ))}
            {ride.capacity > ride.participantsCount && (
              <span className="avatar" title="Свободные места">
                +{ride.capacity - ride.participantsCount}
              </span>
            )}
          </div>

          {ride.description && (
            <>
              <div className="section-title">Описание</div>
              <p style={{ margin: 0 }}>{ride.description}</p>
            </>
          )}

          {ride.requirements.length > 0 && (
            <>
              <div className="section-title">Требования</div>
              <ul className="checklist">
                {ride.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {ride.checklist.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: 'pointer', padding: '8px 0' }}>
                Чек-лист снаряжения
              </summary>
              <ul className="checklist" style={{ marginTop: 8 }}>
                {ride.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          )}

          {route && (
            <>
              <div className="divider" />
              <button className="btn btn--ghost btn--block" onClick={() => onOpenRoute(route.id)}>
                Маршрут: {route.title}
              </button>
            </>
          )}
        </div>

        <div className="actionbar">
          {isOrganizer ? (
            <button className="btn btn--ghost btn--block" disabled>
              Вы организатор
            </button>
          ) : joined ? (
            <button className="btn btn--danger grow" onClick={handleLeave} disabled={busy}>
              Выйти из выезда
            </button>
          ) : (
            <button
              className="btn btn--primary grow"
              onClick={handleJoin}
              disabled={busy || full}
            >
              {full ? 'Мест нет' : ride.visibility === 'request' ? 'Отправить заявку' : 'Присоединиться'}
            </button>
          )}
          <button
            className="btn btn--ghost"
            onClick={() => shareRideLink(ride.id, ride.title)}
            aria-label="Поделиться в Telegram"
          >
            💬
          </button>
        </div>
        <div className="faint" style={{ padding: '0 14px 20px' }}>
          {formatSlots(ride.participantsCount, ride.capacity)} ·{' '}
          {ride.visibility === 'request' ? 'вступление по заявке' : 'открытый выезд'}
        </div>
      </div>
    </>
  )
}
