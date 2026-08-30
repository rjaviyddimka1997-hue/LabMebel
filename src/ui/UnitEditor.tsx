import { HANDLES } from '../domain/materials'
import { uid } from '../domain/presets'
import type { Section, SectionFill, SectionFront, Unit, UnitKind } from '../domain/types'
import { estimateUnit } from '../domain/estimate'
import { formatMoney } from '../domain/estimate'
import { Field, MaterialPicker, NumberField, Segmented, SliderField, TextField } from './controls'
import type { Project } from '../domain/types'

interface Props {
  unit: Unit
  pricing: Project['pricing']
  onChange: (patch: Partial<Unit>) => void
  onDuplicate: () => void
  onRemove: () => void
}

const FILL_LABELS: Record<SectionFill['kind'], string> = {
  shelves: 'Полки',
  drawers: 'Ящики',
  rod: 'Штанга',
  empty: 'Пусто',
}

const FRONT_LABELS: Record<SectionFront, string> = {
  none: 'Открытая',
  'door-left': 'Дверь ←',
  'door-right': 'Дверь →',
  'door-double': 'Две двери',
  drawers: 'Фасады ящиков',
  lift: 'Подъёмный',
}

export function UnitEditor({ unit, pricing, onChange, onDuplicate, onRemove }: Props) {
  const estimate = estimateUnit(unit, pricing)

  const patchSection = (id: string, patch: Partial<Section>) => {
    onChange({ sections: unit.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  }

  const addSection = () => {
    onChange({
      sections: [
        ...unit.sections,
        { id: uid('s'), ratio: 1, fill: { kind: 'shelves', count: 2 }, front: 'door-left' },
      ],
    })
  }

  const removeSection = (id: string) => {
    if (unit.sections.length <= 1) return
    onChange({ sections: unit.sections.filter((s) => s.id !== id) })
  }

  return (
    <div>
      <div className="pane-section">
        <TextField label="Название изделия" value={unit.name} onChange={(name) => onChange({ name })} />
        <Segmented<UnitKind>
          label="Тип модуля"
          value={unit.kind}
          onChange={(kind) =>
            onChange({
              kind,
              baseHeight: kind === 'wall' ? Math.max(unit.baseHeight, 1200) : Math.min(unit.baseHeight, 150),
              base: kind === 'wall' ? 'none' : unit.base === 'none' ? 'plinth' : unit.base,
              countertop: kind === 'wall' ? false : unit.countertop,
            })
          }
          options={[
            { value: 'base', label: 'Напольный' },
            { value: 'wall', label: 'Навесной' },
            { value: 'tall', label: 'Высокий' },
          ]}
        />
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Габариты</h4>
        <SliderField label="Ширина" value={unit.width} min={200} max={3000} step={10} onChange={(width) => onChange({ width })} />
        <SliderField label="Высота" value={unit.height} min={150} max={2700} step={10} onChange={(height) => onChange({ height })} />
        <SliderField label="Глубина" value={unit.depth} min={150} max={800} step={10} onChange={(depth) => onChange({ depth })} />
        <div className="row">
          <NumberField label="Плита корпуса" suffix="мм" value={unit.panel} min={10} max={38} step={1} onChange={(panel) => onChange({ panel })} />
          <NumberField label="Фасад" suffix="мм" value={unit.frontPanel} min={10} max={38} step={1} onChange={(frontPanel) => onChange({ frontPanel })} />
        </div>
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Основание и корпус</h4>
        {unit.kind === 'wall' ? (
          <SliderField label="Низ над полом" value={unit.baseHeight} min={200} max={2200} step={10} onChange={(baseHeight) => onChange({ baseHeight })} />
        ) : (
          <>
            <Segmented
              label="Опора"
              value={unit.base}
              onChange={(base) => onChange({ base })}
              options={[
                { value: 'plinth', label: 'Цоколь' },
                { value: 'legs', label: 'Ножки' },
                { value: 'none', label: 'На пол' },
              ]}
            />
            {unit.base !== 'none' ? (
              <SliderField label="Высота опоры" value={unit.baseHeight} min={20} max={250} step={5} onChange={(baseHeight) => onChange({ baseHeight })} />
            ) : null}
          </>
        )}
        <Segmented
          label="Задняя стенка"
          value={unit.back}
          onChange={(back) => onChange({ back })}
          options={[
            { value: 'hdf', label: 'ХДФ 4' },
            { value: 'panel', label: 'ЛДСП' },
            { value: 'none', label: 'Нет' },
          ]}
        />
        {unit.kind !== 'wall' ? (
          <Field label="Столешница">
            <div className="seg">
              <button type="button" className={unit.countertop ? 'on' : ''} onClick={() => onChange({ countertop: true })}>Есть</button>
              <button type="button" className={!unit.countertop ? 'on' : ''} onClick={() => onChange({ countertop: false })}>Нет</button>
            </div>
          </Field>
        ) : null}
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Материалы</h4>
        <MaterialPicker label="Корпус" group="carcass" value={unit.materials.carcass} onChange={(carcass) => onChange({ materials: { ...unit.materials, carcass } })} />
        <MaterialPicker label="Фасады" group="front" value={unit.materials.front} onChange={(front) => onChange({ materials: { ...unit.materials, front } })} />
        {unit.countertop ? (
          <MaterialPicker label="Столешница" group="countertop" value={unit.materials.countertop} onChange={(countertop) => onChange({ materials: { ...unit.materials, countertop } })} />
        ) : null}
        <Field label="Ручки">
          <select value={unit.handle} onChange={(e) => onChange({ handle: e.target.value })}>
            {HANDLES.map((h) => (
              <option key={h.id} value={h.id}>{h.name} — {h.price} ₽/шт</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Секции ({unit.sections.length})</h4>
        {unit.sections.map((section, index) => (
          <div className="section-card" key={section.id}>
            <header>
              <span>Секция {index + 1}</span>
              <button
                type="button"
                className="btn small ghost danger"
                onClick={() => removeSection(section.id)}
                disabled={unit.sections.length <= 1}
              >
                Удалить
              </button>
            </header>

            <SliderField
              label="Доля ширины"
              value={Math.round(section.ratio * 10)}
              min={3}
              max={40}
              step={1}
              unit=""
              onChange={(v) => patchSection(section.id, { ratio: v / 10 })}
            />

            <Segmented<SectionFill['kind']>
              label="Наполнение"
              value={section.fill.kind}
              onChange={(kind) => {
                const fill: SectionFill =
                  kind === 'shelves' ? { kind, count: 2 }
                  : kind === 'drawers' ? { kind, count: 3 }
                  : kind === 'rod' ? { kind } : { kind }
                patchSection(section.id, {
                  fill,
                  front: kind === 'drawers' ? 'drawers' : section.front === 'drawers' ? 'door-left' : section.front,
                })
              }}
              options={(Object.keys(FILL_LABELS) as Array<SectionFill['kind']>).map((k) => ({ value: k, label: FILL_LABELS[k] }))}
            />

            {section.fill.kind === 'shelves' || section.fill.kind === 'drawers' ? (
              <SliderField
                label={section.fill.kind === 'shelves' ? 'Полок' : 'Ящиков'}
                value={section.fill.count}
                min={section.fill.kind === 'shelves' ? 0 : 1}
                max={section.fill.kind === 'shelves' ? 10 : 6}
                step={1}
                unit="шт"
                onChange={(count) => patchSection(section.id, { fill: { kind: section.fill.kind, count } as SectionFill })}
              />
            ) : null}

            <Field label="Фасад">
              <select
                value={section.front}
                onChange={(e) => patchSection(section.id, { front: e.target.value as SectionFront })}
              >
                {(Object.keys(FRONT_LABELS) as SectionFront[]).map((f) => (
                  <option key={f} value={f}>{FRONT_LABELS[f]}</option>
                ))}
              </select>
            </Field>
          </div>
        ))}
        <button type="button" className="btn small" onClick={addSection}>+ Добавить секцию</button>
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Размещение в комнате</h4>
        <div className="row3">
          <NumberField label="X" suffix="мм" value={unit.x} min={-2000} max={12000} step={10} onChange={(x) => onChange({ x })} />
          <NumberField label="От стены" suffix="мм" value={unit.z} min={-500} max={8000} step={10} onChange={(z) => onChange({ z })} />
          <NumberField label="Поворот" suffix="°" value={unit.rotation} min={-180} max={180} step={15} onChange={(rotation) => onChange({ rotation })} />
        </div>
        <p className="small muted" style={{ margin: '2px 0 0' }}>
          Модуль можно двигать мышью прямо в 3D — шаг 10 мм, к стене примагничивается.
        </p>
      </div>

      <div className="pane-section">
        <div className="kv">
          <span className="muted">Деталей в раскрое</span>
          <span>{estimate.cut.reduce((a, r) => a + r.qty, 0)} шт</span>
        </div>
        <div className="kv">
          <span className="muted">Кромка 2 мм</span>
          <span>{estimate.edge2M.toFixed(1)} м</span>
        </div>
        <div className="kv strong">
          <span>Изделие</span>
          <span>{formatMoney(estimate.total, pricing.currency)}</span>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <button type="button" className="btn small" onClick={onDuplicate}>Дублировать модуль</button>
          <button type="button" className="btn small danger" onClick={onRemove}>Удалить модуль</button>
        </div>
      </div>
    </div>
  )
}
