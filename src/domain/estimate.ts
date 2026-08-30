import { buildUnit, type Hardware, type Part } from './builder'
import { HARDWARE_PRICES, handle, material } from './materials'
import type { Project, Unit } from './types'

/** Коэффициент отхода при раскрое плиты. */
export const WASTE_FACTOR = 1.12

export interface CutRow {
  materialId: string
  materialName: string
  thickness: number
  length: number
  width: number
  qty: number
  /** Площадь всех деталей строки, м². */
  areaM2: number
  names: string[]
}

export interface CostRow {
  label: string
  detail: string
  amount: number
}

export interface UnitEstimate {
  unitId: string
  unitName: string
  cut: CutRow[]
  hardware: Hardware
  edge2M: number
  edge04M: number
  /** Себестоимость материалов и фурнитуры, руб. */
  materialsCost: number
  rows: CostRow[]
  /** Итог по изделию с работой и наценкой, руб. */
  total: number
}

export interface ProjectEstimate {
  units: UnitEstimate[]
  cut: CutRow[]
  materialsCost: number
  laborCost: number
  markupCost: number
  delivery: number
  total: number
  totalAreaM2: number
  partCount: number
}

/** Две наибольшие стороны детали — это габарит заготовки, наименьшая — толщина. */
export function panelDims(part: Part): { length: number; width: number; thickness: number } {
  const s = [...part.size].sort((a, b) => b - a)
  return { length: Math.round(s[0]), width: Math.round(s[1]), thickness: Math.round(s[2]) }
}

export function cutListOf(parts: Part[]): CutRow[] {
  const map = new Map<string, CutRow>()
  for (const part of parts) {
    if (!part.inCutList) continue
    const { length, width, thickness } = panelDims(part)
    const key = `${part.materialId}|${thickness}|${length}x${width}`
    const areaOne = (length * width) / 1_000_000
    const existing = map.get(key)
    if (existing) {
      existing.qty += 1
      existing.areaM2 += areaOne
      if (!existing.names.includes(part.name)) existing.names.push(part.name)
    } else {
      map.set(key, {
        materialId: part.materialId,
        materialName: material(part.materialId).name,
        thickness, length, width,
        qty: 1,
        areaM2: areaOne,
        names: [part.name],
      })
    }
  }
  return [...map.values()].sort(
    (a, b) => a.materialName.localeCompare(b.materialName) || b.areaM2 - a.areaM2,
  )
}

function mergeCut(rows: CutRow[]): CutRow[] {
  const map = new Map<string, CutRow>()
  for (const r of rows) {
    const key = `${r.materialId}|${r.thickness}|${r.length}x${r.width}`
    const e = map.get(key)
    if (e) {
      e.qty += r.qty
      e.areaM2 += r.areaM2
      for (const n of r.names) if (!e.names.includes(n)) e.names.push(n)
    } else {
      map.set(key, { ...r, names: [...r.names] })
    }
  }
  return [...map.values()].sort(
    (a, b) => a.materialName.localeCompare(b.materialName) || b.areaM2 - a.areaM2,
  )
}

export function estimateUnit(unit: Unit, pricing: Project['pricing']): UnitEstimate {
  const { parts, hardware } = buildUnit(unit)
  const cut = cutListOf(parts)

  const edge2M = parts.reduce((a, p) => a + (p.inCutList ? p.edge2 : 0), 0) / 1000
  const edge04M = parts.reduce((a, p) => a + (p.inCutList ? p.edge04 : 0), 0) / 1000

  const rows: CostRow[] = []
  const byMaterial = new Map<string, number>()
  for (const row of cut) {
    byMaterial.set(row.materialId, (byMaterial.get(row.materialId) ?? 0) + row.areaM2)
  }
  for (const [id, area] of byMaterial) {
    const m = material(id)
    const withWaste = area * WASTE_FACTOR
    rows.push({
      label: m.name,
      detail: `${withWaste.toFixed(2)} м² × ${m.pricePerM2} ₽ (с отходом ${Math.round((WASTE_FACTOR - 1) * 100)}%)`,
      amount: withWaste * m.pricePerM2,
    })
  }

  if (edge2M > 0) {
    rows.push({ label: 'Кромка ПВХ 2 мм', detail: `${edge2M.toFixed(1)} м × ${HARDWARE_PRICES.edge2} ₽`, amount: edge2M * HARDWARE_PRICES.edge2 })
  }
  if (edge04M > 0) {
    rows.push({ label: 'Кромка ПВХ 0.4 мм', detail: `${edge04M.toFixed(1)} м × ${HARDWARE_PRICES.edge04} ₽`, amount: edge04M * HARDWARE_PRICES.edge04 })
  }

  const h = handle(unit.handle)
  const hardwareRows: Array<[string, number, number]> = [
    ['Петли с доводчиком', hardware.hinges, HARDWARE_PRICES.hinge],
    ['Направляющие для ящиков', hardware.slides, HARDWARE_PRICES.drawerSlide],
    ['Подъёмные механизмы', hardware.lifts, HARDWARE_PRICES.lift],
    ['Опоры регулируемые', hardware.legs, HARDWARE_PRICES.leg],
    ['Крепёж (конфирматы, эксцентрики)', hardware.fasteners, HARDWARE_PRICES.fastener],
    [h.name, hardware.handles, h.price],
  ]
  for (const [label, qty, price] of hardwareRows) {
    if (qty > 0) rows.push({ label, detail: `${qty} шт × ${price} ₽`, amount: qty * price })
  }
  if (hardware.rodMm > 0) {
    const m = hardware.rodMm / 1000
    rows.push({ label: 'Штанга для одежды', detail: `${m.toFixed(2)} м × ${HARDWARE_PRICES.rod} ₽`, amount: m * HARDWARE_PRICES.rod })
  }

  const materialsCost = rows.reduce((a, r) => a + r.amount, 0)
  const labor = materialsCost * (pricing.laborPercent / 100)
  const markup = (materialsCost + labor) * (pricing.markupPercent / 100)

  return {
    unitId: unit.id,
    unitName: unit.name,
    cut,
    hardware,
    edge2M,
    edge04M,
    materialsCost,
    rows,
    total: materialsCost + labor + markup,
  }
}

export function estimateProject(project: Project): ProjectEstimate {
  const units = project.units.map((u) => estimateUnit(u, project.pricing))
  const cut = mergeCut(units.flatMap((u) => u.cut))
  const materialsCost = units.reduce((a, u) => a + u.materialsCost, 0)
  const laborCost = materialsCost * (project.pricing.laborPercent / 100)
  const markupCost = (materialsCost + laborCost) * (project.pricing.markupPercent / 100)
  const delivery = project.pricing.delivery
  return {
    units,
    cut,
    materialsCost,
    laborCost,
    markupCost,
    delivery,
    total: materialsCost + laborCost + markupCost + delivery,
    totalAreaM2: cut.reduce((a, r) => a + r.areaM2, 0),
    partCount: cut.reduce((a, r) => a + r.qty, 0),
  }
}

export function formatMoney(value: number, currency = '₽'): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ${currency}`
}
