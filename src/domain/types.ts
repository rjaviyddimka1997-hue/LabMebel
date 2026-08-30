/** Все линейные размеры в модели хранятся в миллиметрах. */

export type UnitKind = 'base' | 'wall' | 'tall'

/** Чем заполнена секция изнутри. */
export type SectionFill =
  | { kind: 'shelves'; count: number }
  | { kind: 'drawers'; count: number }
  | { kind: 'rod' }
  | { kind: 'empty' }

/** Что закрывает секцию спереди. */
export type SectionFront =
  | 'none'
  | 'door-left'
  | 'door-right'
  | 'door-double'
  | 'drawers'
  | 'lift'

export interface Section {
  id: string
  /** Доля ширины корпуса. Нормализуется по сумме долей всех секций. */
  ratio: number
  fill: SectionFill
  front: SectionFront
}

export type BackPanel = 'hdf' | 'panel' | 'none'
export type BaseKind = 'plinth' | 'legs' | 'none'

export interface Unit {
  id: string
  name: string
  kind: UnitKind
  /** Габариты корпуса без столешницы и цоколя, мм. */
  width: number
  height: number
  depth: number
  /** Толщина корпусной плиты, мм. */
  panel: number
  /** Толщина фасада, мм. */
  frontPanel: number
  back: BackPanel
  base: BaseKind
  /** Высота цоколя/ножек, мм. Для навесных — высота низа над полом. */
  baseHeight: number
  sections: Section[]
  materials: {
    carcass: string
    front: string
    countertop: string
  }
  handle: string
  /** Столешница поверх модуля (обычно для нижних кухонных). */
  countertop: boolean
  /** Положение в комнате: X — вдоль, Z — от стены, мм; rotation в градусах. */
  x: number
  z: number
  rotation: number
}

export interface Room {
  width: number
  depth: number
  height: number
  wallColor: string
  floor: string
}

export interface Company {
  name: string
  phone: string
  site: string
  manager: string
}

export interface Pricing {
  /** Коэффициент к базовым ценам материалов, %. */
  markupPercent: number
  /** Работа: раскрой, кромление, присадка, сборка — % от материалов. */
  laborPercent: number
  /** Доставка и монтаж, руб. */
  delivery: number
  currency: string
}

export interface Project {
  version: 2
  name: string
  client: string
  room: Room
  units: Unit[]
  company: Company
  pricing: Pricing
}
