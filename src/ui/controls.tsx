import type { ReactNode } from 'react'
import { materialsOf, type Material } from '../domain/materials'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function NumberField({
  label, value, onChange, min = 0, max = 100000, step = 10, suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <Field label={suffix ? `${label}, ${suffix}` : label}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
        }}
      />
    </Field>
  )
}

export function SliderField({
  label, value, onChange, min, max, step = 10, unit = 'мм',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  return (
    <div className="field">
      <label>
        {label} <span style={{ float: 'right', color: 'var(--text)' }}>{value} {unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function TextField({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

export function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      <div className="seg">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === value ? 'on' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MaterialPicker({
  label, group, value, onChange,
}: {
  label: string
  group: Material['group']
  value: string
  onChange: (id: string) => void
}) {
  const options = materialsOf(group)
  return (
    <div className="field">
      <label>{label}</label>
      <div className="swatches">
        {options.map((m) => (
          <button
            key={m.id}
            type="button"
            title={`${m.name}${m.pricePerM2 ? ` — ${m.pricePerM2} ₽/м²` : ''}`}
            className={`swatch ${m.id === value ? 'on' : ''}`}
            onClick={() => onChange(m.id)}
          >
            <span
              className="fill"
              style={{
                background:
                  m.grain === 'none'
                    ? m.color
                    : `repeating-linear-gradient(${m.grain === 'v' ? '180deg' : '90deg'}, ${m.color}, ${m.color} 3px, rgba(0,0,0,0.14) 4px, ${m.color} 6px)`,
              }}
            />
            <span className="cap">{m.short}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
