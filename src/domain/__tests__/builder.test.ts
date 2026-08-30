import { describe, expect, it } from 'vitest'
import { buildUnit, sectionWidths } from '../builder'
import { cutListOf, estimateProject, estimateUnit, panelDims } from '../estimate'
import { PRESETS, demoProject, emptyProject, makeUnit } from '../presets'
import type { Unit } from '../types'

function wardrobe(): Unit {
  return makeUnit({
    name: 'Тест-шкаф', kind: 'tall', width: 1200, height: 2000, depth: 600,
    countertop: false,
    sections: [
      { id: 's1', ratio: 1, fill: { kind: 'shelves', count: 3 }, front: 'door-left' },
      { id: 's2', ratio: 1, fill: { kind: 'drawers', count: 2 }, front: 'drawers' },
    ],
  })
}

describe('sectionWidths', () => {
  it('делит внутреннюю ширину с учётом перегородок', () => {
    const unit = wardrobe()
    const widths = sectionWidths(unit)
    const inner = unit.width - 2 * unit.panel
    const dividers = (unit.sections.length - 1) * unit.panel
    expect(widths).toHaveLength(2)
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(inner - dividers, 5)
  })

  it('соблюдает заданные доли', () => {
    const unit = makeUnit({
      width: 2000,
      sections: [
        { id: 'a', ratio: 1, fill: { kind: 'empty' }, front: 'none' },
        { id: 'b', ratio: 3, fill: { kind: 'empty' }, front: 'none' },
      ],
    })
    const [a, b] = sectionWidths(unit)
    expect(b / a).toBeCloseTo(3, 5)
  })
})

describe('buildUnit', () => {
  it('строит корпус: две боковины, дно, крыша, задняя стенка', () => {
    const { parts } = buildUnit(wardrobe())
    expect(parts.filter((p) => p.role === 'side')).toHaveLength(2)
    expect(parts.filter((p) => p.role === 'bottom')).toHaveLength(1)
    expect(parts.filter((p) => p.role === 'top')).toHaveLength(1)
    expect(parts.filter((p) => p.role === 'back')).toHaveLength(1)
  })

  it('ставит перегородку между секциями и полки внутри', () => {
    const { parts } = buildUnit(wardrobe())
    expect(parts.filter((p) => p.role === 'divider')).toHaveLength(1)
    expect(parts.filter((p) => p.role === 'shelf')).toHaveLength(3)
  })

  it('на каждый ящик даёт фасад, направляющие и корпус ящика', () => {
    const { parts, hardware } = buildUnit(wardrobe())
    expect(parts.filter((p) => p.role === 'drawerFront')).toHaveLength(2)
    expect(hardware.slides).toBe(2)
    // 2 боковины + 2 стенки + дно на каждый ящик
    expect(parts.filter((p) => p.role === 'drawerBox')).toHaveLength(2 * 5)
  })

  it('считает петли только на распашные фасады', () => {
    const { hardware } = buildUnit(wardrobe())
    expect(hardware.hinges).toBeGreaterThan(0)
    const open = buildUnit(makeUnit({ sections: [{ id: 's', ratio: 1, fill: { kind: 'empty' }, front: 'none' }] }))
    expect(open.hardware.hinges).toBe(0)
  })

  it('не выпускает детали за габарит модуля', () => {
    const unit = wardrobe()
    const { parts } = buildUnit(unit)
    for (const part of parts) {
      const [sx, , sz] = part.size
      expect(part.pos[0] - sx / 2).toBeGreaterThanOrEqual(-1)
      expect(part.pos[0] + sx / 2).toBeLessThanOrEqual(unit.width + 1)
      // фасады и ручки выступают вперёд — проверяем только заднюю границу
      expect(part.pos[2] - sz / 2).toBeGreaterThanOrEqual(-1)
    }
  })

  it('навесной модуль поднят над полом', () => {
    const unit = makeUnit({ kind: 'wall', baseHeight: 1450, height: 720 })
    const { parts } = buildUnit(unit)
    const lowest = Math.min(...parts.map((p) => p.pos[1] - p.size[1] / 2))
    expect(lowest).toBeGreaterThanOrEqual(1450 - 5)
  })

  it('группирует фасад ящика с его коробом для анимации', () => {
    const { parts } = buildUnit(wardrobe())
    const front = parts.find((p) => p.role === 'drawerFront')!
    expect(front.group).toBeTruthy()
    expect(parts.filter((p) => p.group === front.group).length).toBeGreaterThan(1)
  })
})

describe('раскрой и смета', () => {
  it('группирует одинаковые детали', () => {
    const { parts } = buildUnit(wardrobe())
    const rows = cutListOf(parts)
    const sides = rows.find((r) => r.names.some((n) => n.includes('Боковина')))!
    expect(sides.qty).toBe(2)
    expect(rows.every((r) => r.length >= r.width)).toBe(true)
  })

  it('толщина детали — наименьший габарит', () => {
    const dims = panelDims({
      id: 'x', role: 'shelf', name: 'п', size: [800, 16, 500], pos: [0, 0, 0],
      materialId: 'ldsp-white', edge2: 0, edge04: 0, inCutList: true, shape: 'box',
    })
    expect(dims).toEqual({ length: 800, width: 500, thickness: 16 })
  })

  it('итог растёт от работы и наценки', () => {
    const unit = wardrobe()
    const cheap = estimateUnit(unit, { markupPercent: 0, laborPercent: 0, delivery: 0, currency: '₽' })
    const rich = estimateUnit(unit, { markupPercent: 50, laborPercent: 50, delivery: 0, currency: '₽' })
    expect(cheap.total).toBeGreaterThan(0)
    expect(rich.total).toBeCloseTo(cheap.materialsCost * 1.5 * 1.5, 5)
  })

  it('смета проекта складывается из изделий и доставки', () => {
    const project = demoProject()
    const estimate = estimateProject(project)
    const sum = estimate.units.reduce((a, u) => a + u.materialsCost, 0)
    expect(estimate.materialsCost).toBeCloseTo(sum, 5)
    expect(estimate.total).toBeCloseTo(
      estimate.materialsCost + estimate.laborCost + estimate.markupCost + estimate.delivery, 5,
    )
    expect(estimate.partCount).toBeGreaterThan(20)
  })

  it('пустой проект стоит только доставку', () => {
    const project = emptyProject()
    expect(estimateProject(project).total).toBe(project.pricing.delivery)
  })
})

describe('пресеты', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('%s собирается и считается', (_id, preset) => {
    const units = preset.build()
    expect(units.length).toBeGreaterThan(0)
    for (const unit of units) {
      const { parts } = buildUnit(unit)
      expect(parts.length).toBeGreaterThan(3)
      expect(parts.every((p) => p.size.every((v) => v > 0 && Number.isFinite(v)))).toBe(true)
    }
    const project = { ...emptyProject(), units }
    expect(estimateProject(project).total).toBeGreaterThan(0)
  })

  it('даёт уникальные идентификаторы модулей', () => {
    const units = [...PRESETS[0].build(), ...PRESETS[1].build()]
    expect(new Set(units.map((u) => u.id)).size).toBe(units.length)
  })
})
