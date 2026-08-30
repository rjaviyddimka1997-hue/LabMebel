import { useEffect, useState, type ReactNode } from 'react'
import { estimateProject, formatMoney } from '../domain/estimate'
import { buildShareUrl } from '../domain/share'
import { material } from '../domain/materials'
import type { Project } from '../domain/types'

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={wide ? { width: 'min(820px, 100%)' } : undefined} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/** Коммерческое предложение: печатается в PDF средствами браузера. */
export function OfferModal({
  project, snapshot, onClose,
}: {
  project: Project
  snapshot: string | null
  onClose: () => void
}) {
  const estimate = estimateProject(project)
  const today = new Date()
  const until = new Date(today.getTime() + 14 * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU')

  return (
    <Modal onClose={onClose} wide>
      <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        <button type="button" className="btn primary" onClick={() => window.print()}>Печать / Сохранить PDF</button>
      </div>

      <div className="offer">
        <div className="offer-head">
          <div>
            <h1>{project.company.name || 'Мебельная мастерская'}</h1>
            <div className="muted">
              {[project.company.phone, project.company.site, project.company.manager].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div><strong>Коммерческое предложение</strong></div>
            <div className="muted">от {fmt(today)}</div>
            <div className="muted">действует до {fmt(until)}</div>
          </div>
        </div>

        <h2>{project.name}</h2>
        {project.client ? <div className="muted">Для: {project.client}</div> : null}

        {snapshot ? <img className="shot" src={snapshot} alt="Визуализация проекта" /> : null}

        <h2>Состав заказа</h2>
        <table>
          <thead>
            <tr>
              <th>Изделие</th>
              <th>Габариты, мм</th>
              <th>Материалы</th>
              <th className="num">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {project.units.map((unit) => {
              const row = estimate.units.find((u) => u.unitId === unit.id)
              return (
                <tr key={unit.id}>
                  <td>{unit.name}</td>
                  <td>{unit.width}×{unit.height}×{unit.depth}</td>
                  <td>
                    {material(unit.materials.carcass).name}
                    <br />
                    <span style={{ color: '#5c6675' }}>фасад: {material(unit.materials.front).name}</span>
                  </td>
                  <td className="num">{formatMoney(row?.total ?? 0, project.pricing.currency)}</td>
                </tr>
              )
            })}
            <tr>
              <td colSpan={3}>Доставка и монтаж</td>
              <td className="num">{formatMoney(estimate.delivery, project.pricing.currency)}</td>
            </tr>
          </tbody>
        </table>

        <div className="grand">
          <span>Итого</span>
          <span>{formatMoney(estimate.total, project.pricing.currency)}</span>
        </div>

        <p className="fine">
          В стоимость входят материалы, фурнитура, распил, кромление, присадка и сборка.
          Срок изготовления — 15–25 рабочих дней с момента подтверждения замеров и внесения предоплаты.
          Итоговая сумма может измениться после контрольного замера помещения.
        </p>
      </div>
    </Modal>
  )
}

export function ShareModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [links, setLinks] = useState<{ master: string; client: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([buildShareUrl(project, false), buildShareUrl(project, true)]).then(([master, client]) => {
      if (alive) setLinks({ master, client })
    })
    return () => { alive = false }
  }, [project])

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <Modal onClose={onClose}>
      <h3>Ссылки на проект</h3>
      <p className="small muted">
        Весь проект зашит в саму ссылку — сервер не нужен. Отправьте её клиенту в мессенджер:
        он откроет 3D в браузере, покрутит модель и увидит цену.
      </p>

      {!links ? (
        <div className="empty">Готовим ссылки…</div>
      ) : (
        <div className="stack">
          <div>
            <div className="field">
              <label>Клиенту — просмотр без редактирования</label>
              <textarea readOnly rows={3} value={links.client} onFocus={(e) => e.currentTarget.select()} />
            </div>
            <button type="button" className="btn primary small" onClick={() => copy(links.client, 'client')}>
              {copied === 'client' ? 'Скопировано ✓' : 'Скопировать ссылку клиенту'}
            </button>
          </div>
          <div style={{ paddingTop: 8 }}>
            <div className="field">
              <label>Себе или коллеге — с редактированием</label>
              <textarea readOnly rows={3} value={links.master} onFocus={(e) => e.currentTarget.select()} />
            </div>
            <button type="button" className="btn small" onClick={() => copy(links.master, 'master')}>
              {copied === 'master' ? 'Скопировано ✓' : 'Скопировать рабочую ссылку'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
