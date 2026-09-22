import { useEffect, useMemo, useState } from 'react'
import type { Difficulty, LngLat, Ride, RideDraft, Route } from '../types'
import { createRide, fetchRoutes, DEFAULT_ROUTE_FILTERS } from '../lib/api'
import { ALL_DIFFICULTIES, DIFFICULTY } from '../lib/difficulty'
import { formatDistance } from '../lib/format'
import { LazyMap } from '../components/LazyMap'
import { DifficultyBadge, Field, TopBar } from '../components/ui'
import { useSession } from '../session'
import { haptic, hapticSuccess } from '../lib/telegram'

const STEP_TITLES = ['Маршрут', 'Когда и где', 'Кто едет', 'Описание']

const BASE_CHECKLIST = [
  'Шлем, очки, перчатки',
  'Защита: черепаха, наколенники',
  'Вода и перекус',
  'Аптечка',
  'Трос или стропа',
  'Ремкомплект и камера',
  'Заряженный телефон, павербанк',
]

const REQUIREMENT_PRESETS = [
  'Защита обязательна',
  'Запас топлива на 150 км',
  'Трос или стропа',
  'Опыт бродов',
  'Резина не дорожная',
  'Рабочий свет',
]

/** Ближайшая суббота в формате YYYY-MM-DD — самый частый выбор. */
function nextWeekend(day: 6 | 0): string {
  const date = new Date()
  const wanted = day === 0 ? 7 : day
  const current = date.getDay() === 0 ? 7 : date.getDay()
  let delta = wanted - current
  if (delta <= 0) delta += 7
  date.setDate(date.getDate() + delta)
  return date.toISOString().slice(0, 10)
}

export function CreateRideScreen({
  presetRouteId,
  onBack,
  onCreated,
}: {
  presetRouteId: string | null
  onBack: () => void
  onCreated: (ride: Ride) => void
}) {
  const { rider, center } = useSession()
  const [step, setStep] = useState(0)
  const [routes, setRoutes] = useState<Route[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState<RideDraft>({
    routeId: presetRouteId,
    title: '',
    description: '',
    difficulty: 2,
    date: nextWeekend(6),
    time: '08:30',
    meetingPoint: null,
    meetingAddress: '',
    capacity: 10,
    visibility: 'open',
    requirements: [],
    checklist: BASE_CHECKLIST,
  })

  useEffect(() => {
    fetchRoutes(DEFAULT_ROUTE_FILTERS)
      .then(setRoutes)
      .catch(() => setRoutes([]))
  }, [])

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === draft.routeId) ?? null,
    [routes, draft.routeId],
  )

  // Уровень выезда наследуется от маршрута: организатор редко хочет иной,
  // но может переопределить на шаге 3.
  useEffect(() => {
    if (selectedRoute) {
      setDraft((prev) => ({ ...prev, difficulty: selectedRoute.difficulty }))
    }
  }, [selectedRoute])

  const autoTitle = useMemo(() => {
    const parts = [DIFFICULTY[draft.difficulty].code]
    if (selectedRoute) {
      parts.push(selectedRoute.title, formatDistance(selectedRoute.distanceM))
    }
    const date = new Date(`${draft.date}T${draft.time}:00`)
    parts.push(
      date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' }),
    )
    return parts.join(' · ')
  }, [draft.difficulty, draft.date, draft.time, selectedRoute])

  const patch = (next: Partial<RideDraft>) => setDraft((prev) => ({ ...prev, ...next }))

  const canAdvance = (): boolean => {
    if (step === 1) return Boolean(draft.meetingPoint && draft.date && draft.time)
    return true
  }

  const submit = async () => {
    if (!rider) return
    setBusy(true)
    setError(null)
    try {
      const ride = await createRide({ ...draft, title: draft.title.trim() || autoTitle }, rider)
      hapticSuccess()
      onCreated(ride)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать выезд')
    } finally {
      setBusy(false)
    }
  }

  const pickPoint = (point: LngLat) => {
    haptic()
    patch({
      meetingPoint: point,
      meetingAddress:
        draft.meetingAddress ||
        `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
    })
  }

  const toggleRequirement = (item: string) => {
    patch({
      requirements: draft.requirements.includes(item)
        ? draft.requirements.filter((value) => value !== item)
        : [...draft.requirements, item],
    })
  }

  return (
    <>
      <TopBar
        title={`Новый выезд · ${STEP_TITLES[step]}`}
        onBack={step === 0 ? onBack : () => setStep(step - 1)}
      />
      <div className="steps" style={{ paddingTop: 12 }}>
        {STEP_TITLES.map((label, i) => (
          <span key={label} className={`steps__dot ${i <= step ? 'steps__dot--done' : ''}`} />
        ))}
      </div>

      <div className="screen">
        <div className="pad stack">
          {error && <div className="banner banner--error">{error}</div>}

          {step === 0 && (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Выберите маршрут — уровень сложности и дистанция подставятся сами.
              </p>
              <button
                type="button"
                className="card"
                style={{ borderColor: draft.routeId === null ? 'var(--accent)' : undefined }}
                onClick={() => patch({ routeId: null })}
              >
                <div style={{ fontWeight: 600 }}>Определимся на месте</div>
                <div className="faint">Без привязки к маршруту</div>
              </button>
              {routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  className="card"
                  style={{ borderColor: draft.routeId === route.id ? 'var(--accent)' : undefined }}
                  onClick={() => patch({ routeId: route.id })}
                >
                  <div className="row">
                    <DifficultyBadge level={route.difficulty} />
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{route.title}</div>
                      <div className="faint">
                        {formatDistance(route.distanceM)} · {route.regionName}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Дата">
                <input
                  className="input"
                  type="date"
                  value={draft.date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => patch({ date: event.target.value })}
                />
              </Field>
              <div className="chips" style={{ padding: 0 }}>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={draft.date === nextWeekend(6)}
                  onClick={() => patch({ date: nextWeekend(6) })}
                >
                  Ближайшая суббота
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={draft.date === nextWeekend(0)}
                  onClick={() => patch({ date: nextWeekend(0) })}
                >
                  Ближайшее воскресенье
                </button>
              </div>

              <Field label="Время сбора">
                <input
                  className="input"
                  type="time"
                  value={draft.time}
                  onChange={(event) => patch({ time: event.target.value })}
                />
              </Field>

              <Field label="Точка сбора" hint="Тапните по карте, чтобы поставить метку">
                <input
                  className="input"
                  value={draft.meetingAddress}
                  onChange={(event) => patch({ meetingAddress: event.target.value })}
                  placeholder="АЗС, парковка, съезд с трассы"
                />
              </Field>

              <div style={{ position: 'relative', height: 260, borderRadius: 12, overflow: 'hidden' }}>
                <LazyMap
                  center={draft.meetingPoint ?? center}
                  routes={selectedRoute ? [selectedRoute] : []}
                  rides={[]}
                  userPoint={null}
                  onPickPoint={pickPoint}
                  pickedPoint={draft.meetingPoint}
                  fitToRoute={draft.meetingPoint ? null : selectedRoute}
                />
              </div>
              {!draft.meetingPoint && (
                <div className="banner">Точка сбора обязательна — без неё половина группы не доедет.</div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Уровень сложности">
                <div className="chips" style={{ padding: 0 }}>
                  {ALL_DIFFICULTIES.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="chip"
                      aria-pressed={draft.difficulty === level}
                      onClick={() => patch({ difficulty: level as Difficulty })}
                    >
                      {DIFFICULTY[level].code}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="faint">{DIFFICULTY[draft.difficulty].description}</div>

              <Field label={`Количество мест: ${draft.capacity}`}>
                <input
                  type="range"
                  min={2}
                  max={30}
                  value={draft.capacity}
                  onChange={(event) => patch({ capacity: Number(event.target.value) })}
                />
              </Field>

              <Field label="Кто может присоединиться">
                <select
                  className="select"
                  value={draft.visibility}
                  onChange={(event) =>
                    patch({ visibility: event.target.value as RideDraft['visibility'] })
                  }
                >
                  <option value="open">Открытый — присоединяется любой</option>
                  <option value="request">По заявке — вы подтверждаете участников</option>
                  <option value="link">По ссылке — не показывать в ленте</option>
                </select>
              </Field>

              <div className="section-title">Требования к участникам</div>
              <div className="chips" style={{ padding: 0, flexWrap: 'wrap' }}>
                {REQUIREMENT_PRESETS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="chip"
                    aria-pressed={draft.requirements.includes(item)}
                    onClick={() => toggleRequirement(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Название" hint="Пустое поле — сгенерируем автоматически">
                <input
                  className="input"
                  value={draft.title}
                  onChange={(event) => patch({ title: event.target.value })}
                  placeholder={autoTitle}
                />
              </Field>

              <Field label="Описание" hint="Темп, броды, планы на обед, что взять">
                <textarea
                  className="textarea"
                  value={draft.description}
                  onChange={(event) => patch({ description: event.target.value })}
                  placeholder="Спокойный темп, ждём всех. Два брода по колено, объезд есть."
                />
              </Field>

              <div className="section-title">Предпросмотр</div>
              <div className="card card--static">
                <div className="row">
                  <DifficultyBadge level={draft.difficulty} size="lg" />
                  <div className="grow">
                    <div style={{ fontWeight: 650 }}>{draft.title.trim() || autoTitle}</div>
                    <div className="faint">
                      {draft.meetingAddress || 'точка сбора не указана'} · до {draft.capacity}{' '}
                      участников
                    </div>
                  </div>
                </div>
              </div>

              <div className="banner">
                После публикации бот создаст группу выезда в Telegram и добавит
                туда участников — отдельный чат писать не нужно.
              </div>
            </>
          )}
        </div>

        <div className="actionbar">
          {step > 0 && (
            <button className="btn btn--ghost" onClick={() => setStep(step - 1)}>
              Назад
            </button>
          )}
          {step < 3 ? (
            <button
              className="btn btn--primary grow"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
            >
              Далее
            </button>
          ) : (
            <button className="btn btn--primary grow" onClick={submit} disabled={busy}>
              {busy ? 'Публикуем…' : 'Опубликовать выезд'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
