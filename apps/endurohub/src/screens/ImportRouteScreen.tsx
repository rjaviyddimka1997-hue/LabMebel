import { useRef, useState } from 'react'
import type { Difficulty, Route } from '../types'
import { createRoute } from '../lib/api'
import { ALL_DIFFICULTIES, DIFFICULTY } from '../lib/difficulty'
import { GpxParseError, parseGpx, prepareForPublish, type ParsedGpx } from '../lib/gpx'
import { formatDistance, formatDuration } from '../lib/format'
import { DifficultyBadge, Field, Stats, TopBar } from '../components/ui'
import { useSession } from '../session'
import { hapticSuccess } from '../lib/telegram'

/**
 * Импорт GPX — главный инструмент против холодного старта: карта наполняется
 * треками, которые у райдеров уже лежат в телефоне.
 */
export function ImportRouteScreen({
  onBack,
  onDone,
}: {
  onBack: () => void
  onDone: (route: Route) => void
}) {
  const { rider } = useSession()
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [parsed, setParsed] = useState<ParsedGpx | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>(2)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)
    try {
      const result = parseGpx(await file.text())
      setParsed(result)
      setTitle(result.name ?? file.name.replace(/\.gpx$/i, ''))
    } catch (cause: unknown) {
      setParsed(null)
      setError(
        cause instanceof GpxParseError
          ? cause.message
          : 'Не удалось прочитать файл. Нужен GPX с треком.',
      )
    }
  }

  const publish = async () => {
    if (!parsed || !rider) return
    setBusy(true)
    setError(null)
    try {
      const coordinates = prepareForPublish(parsed.coordinates)
      const route = await createRoute({
        authorId: rider.id,
        title: title.trim() || 'Маршрут без названия',
        description: description.trim() || null,
        difficulty,
        distanceM: parsed.distanceM,
        elevationGainM: parsed.elevationGainM,
        durationEstMin:
          parsed.durationMin ??
          Math.round((parsed.distanceM / 1000) / (32 - difficulty * 4.6) * 60),
        coordinates,
        isLoop: parsed.isLoop,
        surfaceMix: {},
        regionName: rider.city,
      })
      hapticSuccess()
      onDone(route)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить маршрут')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar title="Импорт маршрута" onBack={onBack} />
      <div className="screen">
        <div className="pad stack">
          {!parsed && (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Загрузите GPX-трек из Wikiloc, Garmin, OsmAnd или любого другого
                приложения. Мы посчитаем дистанцию и набор высоты сами.
              </p>
              <button
                className="btn btn--primary btn--block"
                onClick={() => fileInput.current?.click()}
              >
                Выбрать GPX-файл
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFile(file)
                  event.target.value = ''
                }}
              />
            </>
          )}

          {error && <div className="banner banner--error">{error}</div>}

          {parsed && (
            <>
              <Stats
                items={[
                  { value: formatDistance(parsed.distanceM), label: 'дистанция' },
                  { value: `${parsed.elevationGainM} м`, label: 'набор высоты' },
                  {
                    value: parsed.durationMin ? formatDuration(parsed.durationMin) : '—',
                    label: 'по треку',
                  },
                ]}
              />
              <div className="faint">
                {parsed.coordinates.length} точек · {parsed.isLoop ? 'петля' : 'линейный'}
              </div>

              <Field label="Название маршрута">
                <input
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например: Лосиный остров — Клязьма"
                />
              </Field>

              <Field
                label="Уровень сложности"
                hint="Ставьте честно. Завышенный уровень отпугнёт людей, заниженный — сломает новичка."
              >
                <div className="chips" style={{ padding: 0 }}>
                  {ALL_DIFFICULTIES.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="chip"
                      aria-pressed={difficulty === level}
                      onClick={() => setDifficulty(level)}
                    >
                      {DIFFICULTY[level].code}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="card card--static">
                <div className="row">
                  <DifficultyBadge level={difficulty} size="lg" />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{DIFFICULTY[difficulty].name}</div>
                    <div className="faint">{DIFFICULTY[difficulty].description}</div>
                  </div>
                </div>
              </div>

              <Field label="Описание" hint="Броды, заправки, опасные участки, сезонность">
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Что важно знать перед выездом"
                />
              </Field>

              <div className="banner">
                При публикации трек обрежется на 500 метров с каждого конца —
                это защита от определения адреса по точке старта.
              </div>
            </>
          )}
        </div>

        {parsed && (
          <div className="actionbar">
            <button className="btn btn--ghost" onClick={() => setParsed(null)}>
              Другой файл
            </button>
            <button className="btn btn--primary grow" onClick={publish} disabled={busy}>
              {busy ? 'Сохраняем…' : 'Опубликовать маршрут'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
