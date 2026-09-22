import { useEffect, useState } from 'react'
import type { Difficulty } from '../types'
import { backendMode, fetchMyRideIds } from '../lib/api'
import { ALL_DIFFICULTIES, DIFFICULTY } from '../lib/difficulty'
import { store } from '../lib/store'
import { Avatar, DifficultyBadge, Field, Stats } from '../components/ui'
import { useSession } from '../session'
import { isTelegram } from '../lib/telegram'

export function ProfileScreen({
  onStartOnboarding,
  onImportRoute,
}: {
  onStartOnboarding: () => void
  onImportRoute: () => void
}) {
  const { rider, isOnboarded, updateRider } = useSession()
  const [editing, setEditing] = useState(false)
  const [rideCount, setRideCount] = useState(0)

  useEffect(() => {
    if (!rider) return
    let cancelled = false
    fetchMyRideIds(rider.id)
      .then((ids) => {
        if (!cancelled) setRideCount(ids.length)
      })
      .catch(() => {
        if (!cancelled) setRideCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [rider])

  if (!rider || !isOnboarded) {
    return (
      <div className="screen">
        <div className="pad stack" style={{ gap: 16, paddingTop: 40 }}>
          <div style={{ fontSize: 34, textAlign: 'center' }}>👤</div>
          <div style={{ fontWeight: 650, textAlign: 'center' }}>Профиль не заполнен</div>
          <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
            Укажи уровень, технику и город — тогда мы сможем показывать выезды,
            которые тебе по силам, а организаторы будут понимать состав группы.
          </p>
          <button className="btn btn--primary btn--block" onClick={onStartOnboarding}>
            Заполнить за минуту
          </button>
        </div>
      </div>
    )
  }

  const myRoutes = store.routes.filter((route) => route.authorId === rider.id)

  return (
    <div className="screen">
      <div className="pad stack">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Avatar rider={rider} size={64} />
          <div className="grow">
            <div style={{ fontWeight: 650, fontSize: 17 }}>{rider.displayName}</div>
            <div className="muted">
              {DIFFICULTY[rider.skillLevel].code} · {DIFFICULTY[rider.skillLevel].name}
            </div>
            <div className="faint">{rider.city}</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Готово' : 'Изменить'}
          </button>
        </div>

        <Stats
          items={[
            { value: String(rideCount), label: 'выездов' },
            { value: String(myRoutes.length), label: 'маршрутов' },
            { value: DIFFICULTY[rider.skillLevel].code, label: 'уровень' },
          ]}
        />

        {editing && (
          <>
            <div className="section-title">Редактирование</div>

            <Field label="Имя">
              <input
                className="input"
                value={rider.displayName}
                onChange={(event) => updateRider({ displayName: event.target.value })}
              />
            </Field>

            <Field label="Уровень" hint="Меняйте честно — от этого зависит подбор выездов">
              <div className="chips" style={{ padding: 0 }}>
                {ALL_DIFFICULTIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="chip"
                    aria-pressed={rider.skillLevel === level}
                    onClick={() => updateRider({ skillLevel: level as Difficulty })}
                  >
                    {DIFFICULTY[level].code}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Техника">
              <input
                className="input"
                value={rider.motoText ?? ''}
                onChange={(event) => updateRider({ motoText: event.target.value || null })}
                placeholder="KTM 350 EXC-F, 2021"
              />
            </Field>

            <Field label="Город">
              <input
                className="input"
                value={rider.city}
                onChange={(event) => updateRider({ city: event.target.value })}
              />
            </Field>

            <Field label="О себе">
              <textarea
                className="textarea"
                value={rider.bio ?? ''}
                onChange={(event) => updateRider({ bio: event.target.value || null })}
                placeholder="Сколько катаешь, какой темп любишь"
              />
            </Field>
          </>
        )}

        {!editing && rider.bio && (
          <>
            <div className="section-title">О себе</div>
            <p style={{ margin: 0 }}>{rider.bio}</p>
          </>
        )}

        {!editing && rider.motoText && (
          <>
            <div className="section-title">Техника</div>
            <div className="card card--static">{rider.motoText}</div>
          </>
        )}

        <div className="section-title">Мои маршруты</div>
        {myRoutes.length === 0 ? (
          <div className="card card--static">
            <div className="muted">
              Ты ещё не добавил ни одного маршрута. Импортируй GPX — первые треки
              в регионе видят все, кто открывает карту.
            </div>
            <button
              className="btn btn--primary btn--sm btn--block"
              style={{ marginTop: 12 }}
              onClick={onImportRoute}
            >
              Импортировать GPX
            </button>
          </div>
        ) : (
          myRoutes.map((route) => (
            <div key={route.id} className="card card--static">
              <div className="row">
                <DifficultyBadge level={route.difficulty} />
                <div className="grow">{route.title}</div>
              </div>
            </div>
          ))
        )}

        <div className="divider" />

        <div className="section-title">Приватность</div>
        <div className="card card--static">
          <div className="muted" style={{ fontSize: 13 }}>
            Мы показываем только город, никогда — точные координаты. Треки
            публикуются обрезанными на 500 метров с каждого конца.
          </div>
        </div>

        <div className="section-title">О сборке</div>
        <div className="faint">
          Режим данных: {backendMode === 'supabase' ? 'Supabase' : 'демо (локальные данные)'}
          {' · '}
          окружение: {isTelegram() ? 'Telegram Mini App' : 'браузер'}
        </div>
        {backendMode === 'local' && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              store.reset()
              window.location.reload()
            }}
          >
            Сбросить демо-данные
          </button>
        )}
      </div>
    </div>
  )
}
