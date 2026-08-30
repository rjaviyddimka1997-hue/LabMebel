import { estimateProject, formatMoney, type ProjectEstimate } from '../domain/estimate'
import type { Project } from '../domain/types'

function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function cutListCsv(estimate: ProjectEstimate): string {
  const head = ['Материал', 'Толщина, мм', 'Длина, мм', 'Ширина, мм', 'Кол-во, шт', 'Площадь, м²', 'Детали']
  const rows = estimate.cut.map((r) => [
    r.materialName, r.thickness, r.length, r.width, r.qty, r.areaM2.toFixed(3), r.names.join('; '),
  ])
  return [head, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
}

export function EstimatePanel({ project, clientMode }: { project: Project; clientMode: boolean }) {
  const estimate = estimateProject(project)
  const { pricing } = project

  if (!project.units.length) {
    return <div className="empty">Добавьте модуль — смета посчитается сама.</div>
  }

  return (
    <div>
      <div className="pane-section">
        <div className="total-box">
          <div className="caption">Стоимость проекта для клиента</div>
          <div className="value">{formatMoney(estimate.total, pricing.currency)}</div>
          <div className="caption" style={{ marginTop: 6 }}>
            {project.units.length} изделий · {estimate.partCount} деталей · {estimate.totalAreaM2.toFixed(2)} м² плиты
          </div>
        </div>
      </div>

      <div className="pane-section">
        <h4 className="pane-title">По изделиям</h4>
        <table className="data">
          <thead>
            <tr><th>Изделие</th><th className="num">Стоимость</th></tr>
          </thead>
          <tbody>
            {estimate.units.map((u) => (
              <tr key={u.unitId}>
                <td>{u.unitName}</td>
                <td className="num">{formatMoney(u.total, pricing.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!clientMode ? (
        <div className="pane-section">
          <h4 className="pane-title">Раскладка себестоимости</h4>
          <div className="kv"><span className="muted">Материалы и фурнитура</span><span>{formatMoney(estimate.materialsCost, pricing.currency)}</span></div>
          <div className="kv"><span className="muted">Работа ({pricing.laborPercent}%)</span><span>{formatMoney(estimate.laborCost, pricing.currency)}</span></div>
          <div className="kv"><span className="muted">Наценка ({pricing.markupPercent}%)</span><span>{formatMoney(estimate.markupCost, pricing.currency)}</span></div>
          <div className="kv"><span className="muted">Доставка и монтаж</span><span>{formatMoney(estimate.delivery, pricing.currency)}</span></div>
          <div className="kv strong"><span>Итого</span><span>{formatMoney(estimate.total, pricing.currency)}</span></div>
        </div>
      ) : (
        <div className="pane-section">
          <div className="kv"><span className="muted">Изготовление и материалы</span><span>{formatMoney(estimate.total - estimate.delivery, pricing.currency)}</span></div>
          <div className="kv"><span className="muted">Доставка и монтаж</span><span>{formatMoney(estimate.delivery, pricing.currency)}</span></div>
          <div className="kv strong"><span>Итого</span><span>{formatMoney(estimate.total, pricing.currency)}</span></div>
        </div>
      )}

      {!clientMode ? (
        <div className="pane-section">
          <h4 className="pane-title">Карта раскроя</h4>
          <table className="data">
            <thead>
              <tr>
                <th>Материал</th>
                <th className="num">Размер</th>
                <th className="num">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {estimate.cut.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.materialName}
                    <div className="small muted">{r.thickness} мм · {r.names.slice(0, 2).join(', ')}{r.names.length > 2 ? '…' : ''}</div>
                  </td>
                  <td className="num">{r.length}×{r.width}</td>
                  <td className="num">{r.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn small"
            style={{ marginTop: 10 }}
            onClick={() => download(`raskroy-${project.name || 'proekt'}.csv`, cutListCsv(estimate))}
          >
            Скачать раскрой CSV
          </button>
        </div>
      ) : null}
    </div>
  )
}
