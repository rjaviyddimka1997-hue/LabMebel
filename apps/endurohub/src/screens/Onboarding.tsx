import { useState } from 'react'
import type { Difficulty } from '../types'
import { ALL_DIFFICULTIES, DIFFICULTY } from '../lib/difficulty'
import { Field } from '../components/ui'
import { draftRider, useSession } from '../session'
import { hapticSuccess } from '../lib/telegram'

const CITIES = [
  'Москва', 'Санкт-Петербург', 'Химки', 'Тверь', 'Владимир',
  'Казань', 'Екатеринбург', 'Новосибирск', 'Краснодар',
]

/**
 * Мини-онбординг из трёх вопросов. Показывается только в момент первого
 * целевого действия — не на входе (см. docs/endurohub/03, принцип 2).
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { signIn } = useSession()
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<Difficulty>(1)
  const [moto, setMoto] = useState('')
  const [city, setCity] = useState('')

  const finish = () => {
    signIn({
      ...draftRider(),
      skillLevel: level,
      motoText: moto.trim() || null,
      city: city.trim() || 'Москва',
    })
    hapticSuccess()
    onDone()
  }

  return (
    <div className="screen screen--flush">
      <div className="pad stack" style={{ gap: 18 }}>
        <div className="steps" style={{ padding: 0 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`steps__dot ${i <= step ? 'steps__dot--done' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h2 style={{ margin: 0 }}>Какой у тебя уровень?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Не уверен — ставь E1. Уровень всегда можно поднять, а вот застрять
              на маршруте не по силам — неприятно и для тебя, и для группы.
            </p>
            <div className="stack">
              {ALL_DIFFICULTIES.map((value) => {
                const meta = DIFFICULTY[value]
                return (
                  <button
                    key={value}
                    type="button"
                    className="card"
                    style={{
                      borderColor: level === value ? meta.color : undefined,
                      borderWidth: level === value ? 2 : 1,
                    }}
                    onClick={() => setLevel(value)}
                  >
                    <div className="row">
                      <span
                        className="diff diff--lg"
                        style={{ background: meta.color, color: meta.ink }}
                      >
                        {meta.code}
                      </span>
                      <div className="grow">
                        <div style={{ fontWeight: 650 }}>{meta.name}</div>
                        <div className="faint">{meta.short}</div>
                        <div className="faint">Опыт: {meta.experience}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={{ margin: 0 }}>Какая техника?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Это видят другие участники выезда. Помогает понять состав группы
              и не звать на болото человека на туристе.
            </p>
            <Field label="Мотоцикл" hint="Например: KTM 350 EXC-F, 2021">
              <input
                className="input"
                value={moto}
                onChange={(event) => setMoto(event.target.value)}
                placeholder="Марка, модель, год"
              />
            </Field>
            <button className="btn btn--ghost btn--block" onClick={() => setStep(2)}>
              Пока нет техники
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ margin: 0 }}>Откуда катаешь?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Показываем только город. Точную геопозицию мы не публикуем никогда.
            </p>
            <Field label="Город">
              <input
                className="input"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Город"
                list="eh-cities"
              />
            </Field>
            <datalist id="eh-cities">
              {CITIES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <div className="chips" style={{ padding: 0 }}>
              {CITIES.slice(0, 5).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  aria-pressed={city === name}
                  onClick={() => setCity(name)}
                >
                  {name}
                </button>
              ))}
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
        {step < 2 ? (
          <button className="btn btn--primary grow" onClick={() => setStep(step + 1)}>
            Далее
          </button>
        ) : (
          <button className="btn btn--primary grow" onClick={finish}>
            Готово
          </button>
        )}
      </div>
    </div>
  )
}
