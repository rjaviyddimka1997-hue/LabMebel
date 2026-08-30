import { PRESETS } from '../domain/presets'
import type { SavedProject } from '../domain/storage'
import type { Unit, UnitKind } from '../domain/types'

interface Props {
  units: Unit[]
  selectedId: string | null
  saved: SavedProject[]
  onSelect: (id: string) => void
  onAdd: (kind: UnitKind) => void
  onApplyPreset: (presetId: string, replace: boolean) => void
  onLoadSaved: (id: string) => void
  onDeleteSaved: (id: string) => void
}

const KIND_LABEL: Record<UnitKind, string> = {
  base: 'напольный',
  wall: 'навесной',
  tall: 'высокий',
}

export function Sidebar({
  units, selectedId, saved, onSelect, onAdd, onApplyPreset, onLoadSaved, onDeleteSaved,
}: Props) {
  return (
    <aside className="pane left">
      <div className="pane-section">
        <h4 className="pane-title">Модули проекта</h4>
        {units.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Пусто. Добавьте модуль или выберите готовое изделие ниже.
          </p>
        ) : (
          units.map((unit) => (
            <div
              key={unit.id}
              className={`unit-row ${unit.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(unit.id)}
            >
              <div className="name">
                {unit.name}
                <div className="dims">{unit.width}×{unit.height}×{unit.depth}</div>
              </div>
              <span className="chip">{KIND_LABEL[unit.kind]}</span>
            </div>
          ))
        )}
        <div className="seg" style={{ marginTop: 10 }}>
          <button type="button" onClick={() => onAdd('base')}>+ Низ</button>
          <button type="button" onClick={() => onAdd('wall')}>+ Верх</button>
          <button type="button" onClick={() => onAdd('tall')}>+ Пенал</button>
        </div>
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Готовые изделия</h4>
        {PRESETS.map((preset) => (
          <div key={preset.id} className="preset-card">
            <strong>{preset.title}</strong>
            <em>{preset.hint}</em>
            <div className="seg" style={{ marginTop: 8 }}>
              <button type="button" onClick={() => onApplyPreset(preset.id, false)} title="Добавить к текущему проекту">
                Добавить
              </button>
              <button type="button" onClick={() => onApplyPreset(preset.id, true)} title="Заменить весь проект этим изделием">
                Заменить
              </button>
            </div>
          </div>
        ))}
      </div>

      {saved.length ? (
        <div className="pane-section">
          <h4 className="pane-title">Мои проекты</h4>
          {saved.map((item) => (
            <div key={item.id} className="unit-row">
              <div className="name" onClick={() => onLoadSaved(item.id)} style={{ cursor: 'pointer' }}>
                {item.project.name || 'Без названия'}
                <div className="dims">
                  {new Date(item.savedAt).toLocaleDateString('ru-RU')} · {item.project.units.length} изд.
                </div>
              </div>
              <button type="button" className="btn small ghost danger" onClick={() => onDeleteSaved(item.id)}>✕</button>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
