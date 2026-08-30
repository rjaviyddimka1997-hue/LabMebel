import { materialsOf } from '../domain/materials'
import type { Project } from '../domain/types'
import { Field, NumberField, SliderField, TextField } from './controls'

interface Props {
  project: Project
  onChange: (patch: Partial<Project>) => void
}

export function ProjectPanel({ project, onChange }: Props) {
  const room = project.room
  const setRoom = (patch: Partial<Project['room']>) => onChange({ room: { ...room, ...patch } })
  const setPricing = (patch: Partial<Project['pricing']>) => onChange({ pricing: { ...project.pricing, ...patch } })
  const setCompany = (patch: Partial<Project['company']>) => onChange({ company: { ...project.company, ...patch } })

  return (
    <div>
      <div className="pane-section">
        <h4 className="pane-title">Проект</h4>
        <TextField label="Название" value={project.name} onChange={(name) => onChange({ name })} />
        <TextField label="Клиент" value={project.client} placeholder="Иванов Иван" onChange={(client) => onChange({ client })} />
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Помещение</h4>
        <SliderField label="Ширина стены" value={room.width} min={1500} max={9000} step={100} onChange={(width) => setRoom({ width })} />
        <SliderField label="Глубина" value={room.depth} min={1500} max={9000} step={100} onChange={(depth) => setRoom({ depth })} />
        <SliderField label="Высота потолка" value={room.height} min={2200} max={4000} step={50} onChange={(height) => setRoom({ height })} />
        <Field label="Цвет стен">
          <input type="color" value={room.wallColor} onChange={(e) => setRoom({ wallColor: e.target.value })} style={{ width: '100%', height: 34, background: 'transparent', border: '1px solid var(--line)', borderRadius: 8 }} />
        </Field>
        <Field label="Пол">
          <select value={room.floor} onChange={(e) => setRoom({ floor: e.target.value })}>
            {materialsOf('floor').map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Ценообразование</h4>
        <SliderField label="Работа от материалов" value={project.pricing.laborPercent} min={0} max={150} step={5} unit="%" onChange={(laborPercent) => setPricing({ laborPercent })} />
        <SliderField label="Наценка" value={project.pricing.markupPercent} min={0} max={200} step={5} unit="%" onChange={(markupPercent) => setPricing({ markupPercent })} />
        <NumberField label="Доставка и монтаж" suffix="₽" value={project.pricing.delivery} min={0} max={500000} step={500} onChange={(delivery) => setPricing({ delivery })} />
      </div>

      <div className="pane-section">
        <h4 className="pane-title">Реквизиты для КП</h4>
        <TextField label="Мастерская / компания" value={project.company.name} onChange={(name) => setCompany({ name })} />
        <TextField label="Телефон" value={project.company.phone} onChange={(phone) => setCompany({ phone })} />
        <TextField label="Сайт или мессенджер" value={project.company.site} placeholder="t.me/mebel" onChange={(site) => setCompany({ site })} />
        <TextField label="Менеджер" value={project.company.manager} onChange={(manager) => setCompany({ manager })} />
      </div>
    </div>
  )
}
