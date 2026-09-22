import type { ReactNode } from 'react'
import type { Difficulty, Rider } from '../types'
import { DIFFICULTY } from '../lib/difficulty'

export function DifficultyBadge({
  level,
  size = 'md',
  withName = false,
}: {
  level: Difficulty
  size?: 'sm' | 'md' | 'lg'
  withName?: boolean
}) {
  const meta = DIFFICULTY[level]
  const cls = size === 'md' ? 'diff' : `diff diff--${size}`
  return (
    <span
      className={cls}
      style={{ background: meta.color, color: meta.ink }}
      title={`${meta.code} — ${meta.name}: ${meta.description}`}
    >
      {withName ? `${meta.code} · ${meta.name}` : meta.code}
    </span>
  )
}

export function DifficultyLegend() {
  return (
    <div className="legend">
      {([1, 2, 3, 4, 5] as Difficulty[]).map((level) => (
        <span key={level} className="row" style={{ gap: 4 }}>
          <span className="legend__dot" style={{ background: DIFFICULTY[level].color }} />
          {DIFFICULTY[level].code}
        </span>
      ))}
    </div>
  )
}

export function Avatar({
  rider,
  size = 40,
  showLevel = true,
}: {
  rider: Pick<Rider, 'displayName' | 'avatarUrl' | 'skillLevel'>
  size?: number
  showLevel?: boolean
}) {
  const initials = rider.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {rider.avatarUrl ? <img src={rider.avatarUrl} alt="" /> : initials}
      {showLevel && (
        <span className="avatar__level">
          <DifficultyBadge level={rider.skillLevel} size="sm" />
        </span>
      )}
    </span>
  )
}

export function TopBar({
  title,
  onBack,
  action,
}: {
  title: string
  onBack?: () => void
  action?: ReactNode
}) {
  return (
    <header className="topbar">
      {onBack && (
        <button className="topbar__action" onClick={onBack} aria-label="Назад">
          ←
        </button>
      )}
      <div className="topbar__title">{title}</div>
      {action}
    </header>
  )
}

export function Empty({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: string
  title: string
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <div className="empty__title">{title}</div>
      <div style={{ maxWidth: 320 }}>{text}</div>
      {actionLabel && onAction && (
        <button className="btn btn--primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button className="chip" aria-pressed={active} onClick={onClick} type="button">
      {children}
    </button>
  )
}

export function Stats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div key={item.label} className="stats__cell">
          <div className="stats__value">{item.value}</div>
          <div className="stats__label">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

/** Полоса состава покрытия маршрута — понятнее, чем список процентов. */
export function SurfaceBar({ mix }: { mix: Record<string, number> }) {
  const palette = ['#8d6e4a', '#d9c07a', '#7a6a55', '#4f6b52', '#5a6b86', '#8a8f9a']
  const entries = Object.entries(mix)
  if (entries.length === 0) return null
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="bar">
        {entries.map(([name, pct], i) => (
          <span
            key={name}
            className="bar__seg"
            style={{ width: `${pct}%`, background: palette[i % palette.length] }}
          />
        ))}
      </div>
      <div className="meta">
        {entries.map(([name, pct]) => (
          <span key={name}>
            {name} {pct}%
          </span>
        ))}
      </div>
    </div>
  )
}
