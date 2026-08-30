import type { Project, Section, Unit } from './types'

let counter = 0
export function uid(prefix = 'u'): string {
  counter += 1
  return `${prefix}${Date.now().toString(36).slice(-4)}${counter.toString(36)}`
}

function sec(ratio: number, fill: Section['fill'], front: Section['front']): Section {
  return { id: uid('s'), ratio, fill, front }
}

interface UnitDraft extends Partial<Omit<Unit, 'id' | 'materials'>> {
  materials?: Partial<Unit['materials']>
}

export function makeUnit(draft: UnitDraft = {}): Unit {
  const kind = draft.kind ?? 'base'
  return {
    id: uid('u'),
    name: draft.name ?? 'Модуль',
    kind,
    width: draft.width ?? 800,
    height: draft.height ?? (kind === 'wall' ? 720 : kind === 'tall' ? 2100 : 720),
    depth: draft.depth ?? (kind === 'wall' ? 320 : 560),
    panel: draft.panel ?? 16,
    frontPanel: draft.frontPanel ?? 18,
    back: draft.back ?? 'hdf',
    base: draft.base ?? (kind === 'wall' ? 'none' : 'plinth'),
    baseHeight: draft.baseHeight ?? (kind === 'wall' ? 1450 : 100),
    sections: draft.sections ?? [sec(1, { kind: 'shelves', count: 1 }, 'door-left')],
    materials: {
      carcass: draft.materials?.carcass ?? 'ldsp-white',
      front: draft.materials?.front ?? 'front-sage',
      countertop: draft.materials?.countertop ?? 'top-stone-grey',
    },
    handle: draft.handle ?? 'bar-black',
    countertop: draft.countertop ?? kind === 'base',
    x: draft.x ?? 0,
    z: draft.z ?? 0,
    rotation: draft.rotation ?? 0,
  }
}

export interface Preset {
  id: string
  title: string
  hint: string
  build: () => Unit[]
}

/** Готовые изделия — точка старта, дальше мебельщик правит параметры. */
export const PRESETS: Preset[] = [
  {
    id: 'kitchen-line',
    title: 'Кухня прямая 3 м',
    hint: 'Нижние модули со столешницей + навесные шкафы',
    build: () => {
      const front = 'front-sage'
      const carcass = 'ldsp-white'
      const base: Unit[] = [
        makeUnit({ name: 'Тумба с ящиками 600', width: 600, x: 0, kind: 'base', materials: { front, carcass }, sections: [sec(1, { kind: 'drawers', count: 3 }, 'drawers')] }),
        makeUnit({ name: 'Тумба под мойку 800', width: 800, x: 600, kind: 'base', materials: { front, carcass }, sections: [sec(1, { kind: 'empty' }, 'door-double')] }),
        makeUnit({ name: 'Тумба 600', width: 600, x: 1400, kind: 'base', materials: { front, carcass }, sections: [sec(1, { kind: 'shelves', count: 1 }, 'door-left')] }),
        makeUnit({ name: 'Тумба с ящиками 400', width: 400, x: 2000, kind: 'base', materials: { front, carcass }, sections: [sec(1, { kind: 'drawers', count: 2 }, 'drawers')] }),
        makeUnit({ name: 'Пенал 600', width: 600, kind: 'tall', height: 2100, depth: 560, x: 2400, countertop: false, materials: { front, carcass }, sections: [sec(1, { kind: 'shelves', count: 4 }, 'door-left')] }),
      ]
      const wall: Unit[] = [
        makeUnit({ name: 'Навесной 600', kind: 'wall', width: 600, height: 720, depth: 320, x: 0, baseHeight: 1450, materials: { front, carcass }, sections: [sec(1, { kind: 'shelves', count: 1 }, 'door-left')] }),
        makeUnit({ name: 'Навесной 800', kind: 'wall', width: 800, height: 720, depth: 320, x: 600, baseHeight: 1450, materials: { front, carcass }, sections: [sec(1, { kind: 'shelves', count: 1 }, 'door-double')] }),
        makeUnit({ name: 'Навесной 600 подъёмный', kind: 'wall', width: 600, height: 720, depth: 320, x: 1400, baseHeight: 1450, materials: { front, carcass }, sections: [sec(1, { kind: 'shelves', count: 1 }, 'lift')] }),
      ]
      return [...base, ...wall]
    },
  },
  {
    id: 'wardrobe',
    title: 'Шкаф распашной 2000×2400',
    hint: 'Штанга, полки и блок ящиков',
    build: () => [
      makeUnit({
        name: 'Шкаф распашной', kind: 'tall', width: 2000, height: 2400, depth: 600,
        countertop: false, base: 'plinth', baseHeight: 80, handle: 'bar-steel',
        materials: { carcass: 'ldsp-sonoma', front: 'front-beige' },
        sections: [
          sec(1, { kind: 'shelves', count: 5 }, 'door-left'),
          sec(1.4, { kind: 'rod' }, 'door-double'),
          sec(1, { kind: 'drawers', count: 4 }, 'drawers'),
        ],
      }),
    ],
  },
  {
    id: 'shelving',
    title: 'Стеллаж открытый',
    hint: 'Без фасадов — гостиная или офис',
    build: () => [
      makeUnit({
        name: 'Стеллаж', kind: 'tall', width: 1600, height: 1800, depth: 350,
        countertop: false, base: 'legs', baseHeight: 90, back: 'none', handle: 'none',
        materials: { carcass: 'ldsp-craft-gold', front: 'front-graphite' },
        sections: [
          sec(1, { kind: 'shelves', count: 4 }, 'none'),
          sec(1, { kind: 'shelves', count: 4 }, 'none'),
          sec(1, { kind: 'shelves', count: 2 }, 'door-double'),
        ],
      }),
    ],
  },
  {
    id: 'dresser',
    title: 'Комод 4 ящика',
    hint: 'Спальня или прихожая',
    build: () => [
      makeUnit({
        name: 'Комод', kind: 'base', width: 900, height: 800, depth: 450,
        countertop: false, base: 'legs', baseHeight: 120, handle: 'knob-black',
        materials: { carcass: 'ldsp-white', front: 'front-blue' },
        sections: [sec(1, { kind: 'drawers', count: 4 }, 'drawers')],
      }),
    ],
  },
  {
    id: 'tv',
    title: 'ТВ-тумба 1800',
    hint: 'Ящики по краям, ниша по центру',
    build: () => [
      makeUnit({
        name: 'ТВ-тумба', kind: 'base', width: 1800, height: 450, depth: 400,
        countertop: false, base: 'legs', baseHeight: 100, handle: 'edge-alu',
        materials: { carcass: 'ldsp-anthracite', front: 'front-graphite' },
        sections: [
          sec(1, { kind: 'drawers', count: 1 }, 'drawers'),
          sec(1.2, { kind: 'shelves', count: 1 }, 'none'),
          sec(1, { kind: 'drawers', count: 1 }, 'drawers'),
        ],
      }),
    ],
  },
  {
    id: 'bathroom',
    title: 'Тумба в ванную 800',
    hint: 'Подвесная, под раковину',
    build: () => [
      makeUnit({
        name: 'Тумба под раковину', kind: 'wall', width: 800, height: 500, depth: 450,
        baseHeight: 400, countertop: false, handle: 'bar-gold',
        materials: { carcass: 'ldsp-white', front: 'front-walnut', countertop: 'top-marble' },
        sections: [sec(1, { kind: 'drawers', count: 2 }, 'drawers')],
      }),
    ],
  },
]

export function emptyProject(): Project {
  return {
    version: 2,
    name: 'Новый проект',
    client: '',
    room: { width: 4000, depth: 3200, height: 2700, wallColor: '#efece6', floor: 'floor-oak' },
    units: [],
    company: {
      name: 'Мебельная мастерская',
      phone: '+7 (900) 000-00-00',
      site: '',
      manager: '',
    },
    pricing: { markupPercent: 35, laborPercent: 40, delivery: 6000, currency: '₽' },
  }
}

export function demoProject(): Project {
  const project = emptyProject()
  project.name = 'Кухня для клиента'
  project.client = 'Иванов Иван'
  project.units = PRESETS[0].build()
  return project
}
