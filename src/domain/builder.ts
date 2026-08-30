import type { Section, Unit } from './types'

export type PartRole =
  | 'side' | 'top' | 'bottom' | 'shelf' | 'divider' | 'back'
  | 'front' | 'drawerFront' | 'drawerBox' | 'countertop' | 'plinth'
  | 'leg' | 'rod' | 'handle'

/** Как деталь ведёт себя в режиме «открыть фасады». */
export type OpenSpec =
  | { kind: 'door'; hinge: 'left' | 'right'; pivotX: number }
  | { kind: 'drawer'; travel: number }
  | { kind: 'lift'; pivotY: number }

export interface Part {
  id: string
  role: PartRole
  name: string
  /** Габарит детали по локальным осям X, Y, Z в мм. */
  size: [number, number, number]
  /** Центр детали в локальных координатах модуля, мм. */
  pos: [number, number, number]
  materialId: string
  /** Материал для 3D, если он отличается от расчётного (ХДФ красят в цвет корпуса). */
  visualMaterialId?: string
  /** Погонаж кромки 2 мм (видимые торцы), мм. */
  edge2: number
  /** Погонаж кромки 0.4 мм (скрытые торцы), мм. */
  edge04: number
  /** Попадает ли деталь в карту раскроя. */
  inCutList: boolean
  shape: 'box' | 'cylinder'
  /** Детали с одинаковым group двигаются вместе (фасад + ручка + ящик). */
  group?: string
  open?: OpenSpec
}

export interface Hardware {
  hinges: number
  slides: number
  lifts: number
  legs: number
  rodMm: number
  handles: number
  fasteners: number
}

export interface UnitBuild {
  parts: Part[]
  hardware: Hardware
  /** Полная высота с цоколем и столешницей, мм. */
  totalHeight: number
  /** Полная глубина с фасадом и свесом столешницы, мм. */
  totalDepth: number
}

/** Зазор между фасадами, мм. */
const GAP = 3
/** Толщина ХДФ задней стенки, мм. */
const HDF = 4
/** Утопление цоколя от переднего края, мм. */
const PLINTH_SETBACK = 60
/** Свес столешницы вперёд, мм. */
const TOP_OVERHANG = 20
/** Толщина столешницы, мм. */
const TOP_THICKNESS = 38

export function sectionWidths(unit: Unit): number[] {
  const sections = unit.sections.length ? unit.sections : [defaultSection('s0')]
  const inner = unit.width - 2 * unit.panel
  const dividers = (sections.length - 1) * unit.panel
  const usable = Math.max(inner - dividers, sections.length * 40)
  const sum = sections.reduce((a, s) => a + Math.max(s.ratio, 0.05), 0)
  return sections.map((s) => (Math.max(s.ratio, 0.05) / sum) * usable)
}

export function defaultSection(id: string): Section {
  return { id, ratio: 1, fill: { kind: 'shelves', count: 2 }, front: 'door-left' }
}

/** Высота низа корпуса над полом. */
export function carcassBottom(unit: Unit): number {
  if (unit.kind === 'wall') return unit.baseHeight
  return unit.base === 'none' ? 0 : unit.baseHeight
}

/**
 * Разбирает модуль на детали и фурнитуру.
 * Локальные координаты: X — слева направо, Y — от пола вверх, Z — от стены вперёд.
 */
export function buildUnit(unit: Unit): UnitBuild {
  const parts: Part[] = []
  const hw: Hardware = { hinges: 0, slides: 0, lifts: 0, legs: 0, rodMm: 0, handles: 0, fasteners: 0 }

  const { width: W, height: H, depth: D, panel: T } = unit
  const carcass = unit.materials.carcass
  const y0 = carcassBottom(unit)
  const innerW = W - 2 * T
  const innerH = H - 2 * T
  const backT = unit.back === 'hdf' ? HDF : unit.back === 'panel' ? T : 0
  /** Глубина внутренних деталей (полки, ящики) с отступом от задней стенки. */
  const innerD = Math.max(D - backT - 20, 100)

  let n = 0
  const add = (p: Omit<Part, 'id'>) => {
    parts.push({ ...p, id: `${unit.id}-p${n++}` })
  }

  // --- Корпус ---
  for (const [label, x] of [['Боковина левая', T / 2], ['Боковина правая', W - T / 2]] as const) {
    add({
      role: 'side', name: label, shape: 'box',
      size: [T, H, D], pos: [x, y0 + H / 2, D / 2],
      materialId: carcass, edge2: H, edge04: 2 * D + H, inCutList: true,
    })
  }
  add({
    role: 'bottom', name: 'Дно', shape: 'box',
    size: [innerW, T, D], pos: [W / 2, y0 + T / 2, D / 2],
    materialId: carcass, edge2: innerW, edge04: 2 * D + innerW, inCutList: true,
  })
  add({
    role: 'top', name: 'Крыша', shape: 'box',
    size: [innerW, T, D], pos: [W / 2, y0 + H - T / 2, D / 2],
    materialId: carcass, edge2: innerW, edge04: 2 * D + innerW, inCutList: true,
  })
  hw.fasteners += 8

  if (unit.back !== 'none') {
    add({
      role: 'back', name: unit.back === 'hdf' ? 'Задняя стенка ХДФ' : 'Задняя стенка ЛДСП', shape: 'box',
      size: [W, H, backT], pos: [W / 2, y0 + H / 2, backT / 2],
      materialId: unit.back === 'hdf' ? 'hdf' : carcass,
      visualMaterialId: carcass,
      edge2: 0, edge04: 0, inCutList: unit.back === 'panel',
    })
  }

  // --- Опоры ---
  if (unit.kind !== 'wall' && unit.base === 'plinth' && unit.baseHeight > 0) {
    add({
      role: 'plinth', name: 'Цоколь', shape: 'box',
      size: [W, unit.baseHeight, T], pos: [W / 2, unit.baseHeight / 2, D - PLINTH_SETBACK],
      materialId: carcass, edge2: W, edge04: 2 * unit.baseHeight + W, inCutList: true,
    })
    hw.legs += Math.max(4, Math.round(W / 600) * 2)
  } else if (unit.kind !== 'wall' && unit.base === 'legs' && unit.baseHeight > 0) {
    const legR = 22
    for (const lx of [60, W - 60]) {
      for (const lz of [60, D - 60]) {
        add({
          role: 'leg', name: 'Опора', shape: 'cylinder',
          size: [legR, unit.baseHeight, legR], pos: [lx, unit.baseHeight / 2, lz],
          materialId: 'ldsp-anthracite', edge2: 0, edge04: 0, inCutList: false,
        })
      }
    }
    hw.legs += 4
  }

  // --- Секции ---
  const widths = sectionWidths(unit)
  const sections = unit.sections.length ? unit.sections : [defaultSection('s0')]
  let cursor = T

  sections.forEach((section, i) => {
    const cw = widths[i]
    const cx = cursor + cw / 2
    const secBottom = y0 + T
    const secTop = y0 + H - T

    // Стойка-перегородка справа от секции
    if (i < sections.length - 1) {
      add({
        role: 'divider', name: `Стойка ${i + 1}`, shape: 'box',
        size: [T, innerH, innerD + 10], pos: [cursor + cw + T / 2, secBottom + innerH / 2, backT + (innerD + 10) / 2],
        materialId: carcass, edge2: innerH, edge04: 2 * (innerD + 10) + innerH, inCutList: true,
      })
      hw.fasteners += 4
    }

    // Наполнение
    if (section.fill.kind === 'shelves' && section.fill.count > 0) {
      const count = Math.min(section.fill.count, 12)
      for (let k = 1; k <= count; k++) {
        const y = secBottom + (innerH * k) / (count + 1)
        add({
          role: 'shelf', name: `Полка ${i + 1}.${k}`, shape: 'box',
          size: [cw - 2, T, innerD], pos: [cx, y, backT + innerD / 2],
          materialId: carcass, edge2: cw, edge04: 2 * innerD, inCutList: true,
        })
        hw.fasteners += 4
      }
    }

    if (section.fill.kind === 'rod') {
      add({
        role: 'rod', name: 'Штанга', shape: 'cylinder',
        size: [cw - 20, 25, 25], pos: [cx, secTop - 80, backT + innerD / 2],
        materialId: 'ldsp-anthracite', edge2: 0, edge04: 0, inCutList: false,
      })
      hw.rodMm += cw
    }

    const drawerCount =
      section.fill.kind === 'drawers' ? Math.min(section.fill.count, 8) : 0

    if (drawerCount > 0) {
      const boxH = (innerH - (drawerCount + 1) * 12) / drawerCount
      const boxW = cw - 26 // зазоры под направляющие
      const boxD = innerD - 20
      for (let k = 0; k < drawerCount; k++) {
        const by = secBottom + 12 + k * (boxH + 12) + boxH / 2
        const dgroup = `${unit.id}-drw-${i}-${k}`
        // Боковины ящика
        for (const dx of [-(boxW / 2) + 8, boxW / 2 - 8]) {
          add({
            role: 'drawerBox', name: `Ящик ${i + 1}.${k + 1} — боковина`, shape: 'box',
            size: [16, boxH, boxD], pos: [cx + dx, by, backT + 10 + boxD / 2],
            materialId: carcass, edge2: boxD, edge04: 2 * boxH, inCutList: true,
            group: dgroup, open: { kind: 'drawer', travel: boxD * 0.75 },
          })
        }
        // Передняя и задняя стенки ящика
        for (const dz of [10 + 8, 10 + boxD - 8]) {
          add({
            role: 'drawerBox', name: `Ящик ${i + 1}.${k + 1} — стенка`, shape: 'box',
            size: [boxW - 32, boxH, 16], pos: [cx, by, backT + dz],
            materialId: carcass, edge2: boxW - 32, edge04: 2 * boxH, inCutList: true,
            group: dgroup, open: { kind: 'drawer', travel: boxD * 0.75 },
          })
        }
        // Дно ящика
        add({
          role: 'drawerBox', name: `Ящик ${i + 1}.${k + 1} — дно`, shape: 'box',
          size: [boxW - 4, HDF, boxD - 4], pos: [cx, by - boxH / 2 + 4, backT + 10 + boxD / 2],
          materialId: 'hdf', visualMaterialId: carcass, edge2: 0, edge04: 0, inCutList: false,
          group: dgroup, open: { kind: 'drawer', travel: boxD * 0.75 },
        })
        hw.slides += 1
        hw.fasteners += 8
      }
    }

    // --- Фасады ---
    const frontZ = D + unit.frontPanel / 2
    const spanX = cx - (cw + T) / 2 + GAP / 2
    const spanW = cw + T - GAP
    const frontMat = unit.materials.front

    const addFront = (
      name: string, x: number, y: number, w: number, h: number,
      hinges: number, open: OpenSpec | undefined, group: string,
    ) => {
      add({
        role: section.front === 'drawers' ? 'drawerFront' : 'front', name, shape: 'box',
        size: [w, h, unit.frontPanel], pos: [x, y, frontZ],
        materialId: frontMat, edge2: 2 * (w + h), edge04: 0, inCutList: true,
        group, open,
      })
      hw.hinges += hinges
      addHandle(add, unit, x, y, w, h, frontZ, section.front === 'drawers', group, open)
      hw.handles += 1
    }

    const fullH = H - GAP
    const fullY = y0 + H / 2

    switch (section.front) {
      case 'door-left':
      case 'door-right': {
        const hinge = section.front === 'door-left' ? 'left' : 'right'
        const pivotX = hinge === 'left' ? spanX : spanX + spanW
        addFront(
          `Фасад ${i + 1}`, spanX + spanW / 2, fullY, spanW, fullH,
          hingeCount(fullH), { kind: 'door', hinge, pivotX }, `${unit.id}-f${i}`,
        )
        break
      }
      case 'door-double': {
        const half = (spanW - GAP) / 2
        addFront(
          `Фасад ${i + 1}Л`, spanX + half / 2, fullY, half, fullH,
          hingeCount(fullH), { kind: 'door', hinge: 'left', pivotX: spanX }, `${unit.id}-f${i}L`,
        )
        addFront(
          `Фасад ${i + 1}П`, spanX + half + GAP + half / 2, fullY, half, fullH,
          hingeCount(fullH), { kind: 'door', hinge: 'right', pivotX: spanX + spanW }, `${unit.id}-f${i}R`,
        )
        break
      }
      case 'lift':
        addFront(
          `Фасад подъёмный ${i + 1}`, spanX + spanW / 2, fullY, spanW, fullH,
          0, { kind: 'lift', pivotY: fullY + fullH / 2 }, `${unit.id}-f${i}`,
        )
        hw.lifts += 1
        break
      case 'drawers': {
        const count = Math.max(drawerCount, 1)
        const fh = (fullH - (count - 1) * GAP) / count
        const travel = Math.max(innerD - 40, 100) * 0.75
        for (let k = 0; k < count; k++) {
          const fy = y0 + GAP / 2 + k * (fh + GAP) + fh / 2
          addFront(
            `Фасад ящика ${i + 1}.${k + 1}`, spanX + spanW / 2, fy, spanW, fh,
            0, { kind: 'drawer', travel }, `${unit.id}-drw-${i}-${k}`,
          )
        }
        break
      }
      case 'none':
      default:
        break
    }

    cursor += cw + T
  })

  // --- Столешница ---
  if (unit.countertop && unit.kind !== 'wall') {
    const topD = D + TOP_OVERHANG + unit.frontPanel
    add({
      role: 'countertop', name: 'Столешница', shape: 'box',
      size: [W, TOP_THICKNESS, topD], pos: [W / 2, y0 + H + TOP_THICKNESS / 2, topD / 2],
      materialId: unit.materials.countertop, edge2: W, edge04: 0, inCutList: true,
    })
  }

  const totalHeight = y0 + H + (unit.countertop && unit.kind !== 'wall' ? TOP_THICKNESS : 0)
  const totalDepth = D + unit.frontPanel + (unit.countertop && unit.kind !== 'wall' ? TOP_OVERHANG : 0)

  return { parts, hardware: hw, totalHeight, totalDepth }
}

function hingeCount(heightMm: number): number {
  if (heightMm <= 900) return 2
  if (heightMm <= 1600) return 3
  if (heightMm <= 2000) return 4
  return 5
}

function addHandle(
  add: (p: Omit<Part, 'id'>) => void,
  unit: Unit,
  x: number, y: number, w: number, h: number, frontZ: number,
  horizontal: boolean,
  group: string,
  open: OpenSpec | undefined,
) {
  if (unit.handle === 'none') return
  const z = frontZ + unit.frontPanel / 2 + 16
  if (unit.handle === 'edge-alu') {
    add({
      role: 'handle', name: 'Профиль-ручка', shape: 'box',
      size: [w, 22, 18], pos: [x, y + h / 2 - 14, frontZ + unit.frontPanel / 2 + 6],
      materialId: 'ldsp-grey', edge2: 0, edge04: 0, inCutList: false, group, open,
    })
    return
  }
  if (unit.handle === 'knob-black') {
    add({
      role: 'handle', name: 'Ручка-кнопка', shape: 'cylinder',
      size: [16, 26, 16], pos: [x, horizontal ? y : y + h / 2 - 90, z - 6],
      materialId: 'ldsp-anthracite', edge2: 0, edge04: 0, inCutList: false, group, open,
    })
    return
  }
  const len = Math.min(horizontal ? 192 : 288, horizontal ? w - 40 : h - 60)
  /** У распашного фасада ручка ставится со стороны, противоположной петлям. */
  const side = open?.kind === 'door' && open.hinge === 'right' ? -1 : 1
  add({
    role: 'handle', name: 'Ручка-рейлинг', shape: 'box',
    size: horizontal ? [len, 16, 30] : [16, len, 30],
    pos: horizontal ? [x, y + h / 2 - 60, z] : [x + side * (w / 2 - 50), y, z],
    materialId: 'ldsp-anthracite', edge2: 0, edge04: 0, inCutList: false, group, open,
  })
}
