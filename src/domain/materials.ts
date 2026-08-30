export interface Material {
  id: string
  name: string
  /** Группа для селекторов: корпус, фасад, столешница, пол. */
  group: 'carcass' | 'front' | 'countertop' | 'floor'
  /** Базовый цвет для 3D и превью. */
  color: string
  /** 0 — зеркало, 1 — полный мат. */
  roughness: number
  metalness: number
  /** Цена материала за м², руб. Для пола — 0 (не считается в смете). */
  pricePerM2: number
  /** Направление текстуры древесины: продольное полосатое затемнение. */
  grain?: 'v' | 'h' | 'none'
  /** Короткая подпись для плитки выбора. */
  short: string
}

export const MATERIALS: Material[] = [
  // --- Корпус: ЛДСП 16 мм ---
  { id: 'ldsp-white', name: 'ЛДСП Белый W980', group: 'carcass', color: '#f2f0ec', roughness: 0.72, metalness: 0, pricePerM2: 1150, grain: 'none', short: 'Белый' },
  { id: 'ldsp-grey', name: 'ЛДСП Серый камень U727', group: 'carcass', color: '#9a9793', roughness: 0.74, metalness: 0, pricePerM2: 1290, grain: 'none', short: 'Серый камень' },
  { id: 'ldsp-sonoma', name: 'ЛДСП Дуб Сонома H1176', group: 'carcass', color: '#c2a781', roughness: 0.78, metalness: 0, pricePerM2: 1340, grain: 'v', short: 'Дуб сонома' },
  { id: 'ldsp-craft-gold', name: 'ЛДСП Дуб Крафт золотой K003', group: 'carcass', color: '#b98f5b', roughness: 0.8, metalness: 0, pricePerM2: 1420, grain: 'v', short: 'Дуб крафт' },
  { id: 'ldsp-wenge', name: 'ЛДСП Венге', group: 'carcass', color: '#4a3327', roughness: 0.76, metalness: 0, pricePerM2: 1380, grain: 'v', short: 'Венге' },
  { id: 'ldsp-anthracite', name: 'ЛДСП Антрацит U963', group: 'carcass', color: '#3b3d40', roughness: 0.7, metalness: 0, pricePerM2: 1490, grain: 'none', short: 'Антрацит' },

  // --- Фасады ---
  { id: 'front-white-matt', name: 'МДФ Белый матовый', group: 'front', color: '#f6f5f2', roughness: 0.62, metalness: 0.02, pricePerM2: 3200, grain: 'none', short: 'Белый мат' },
  { id: 'front-graphite', name: 'МДФ Графит софт-тач', group: 'front', color: '#3a3f45', roughness: 0.58, metalness: 0.04, pricePerM2: 3900, grain: 'none', short: 'Графит' },
  { id: 'front-sage', name: 'МДФ Шалфей матовый', group: 'front', color: '#8d9b83', roughness: 0.6, metalness: 0.02, pricePerM2: 3900, grain: 'none', short: 'Шалфей' },
  { id: 'front-blue', name: 'МДФ Синий ночной', group: 'front', color: '#2f4257', roughness: 0.55, metalness: 0.04, pricePerM2: 3900, grain: 'none', short: 'Синий' },
  { id: 'front-beige', name: 'МДФ Кашемир', group: 'front', color: '#ddd2c0', roughness: 0.6, metalness: 0.02, pricePerM2: 3600, grain: 'none', short: 'Кашемир' },
  { id: 'front-gloss-white', name: 'МДФ Белый глянец', group: 'front', color: '#fbfbfa', roughness: 0.12, metalness: 0.08, pricePerM2: 4700, grain: 'none', short: 'Белый глянец' },
  { id: 'front-oak', name: 'Шпон Дуб натуральный', group: 'front', color: '#c49a68', roughness: 0.66, metalness: 0, pricePerM2: 5400, grain: 'v', short: 'Шпон дуб' },
  { id: 'front-walnut', name: 'Шпон Орех американский', group: 'front', color: '#6f4a31', roughness: 0.64, metalness: 0, pricePerM2: 5900, grain: 'v', short: 'Шпон орех' },
  { id: 'front-ldsp-white', name: 'ЛДСП Белый (эконом)', group: 'front', color: '#f2f0ec', roughness: 0.72, metalness: 0, pricePerM2: 1250, grain: 'none', short: 'ЛДСП белый' },

  // --- Столешницы ---
  { id: 'top-stone-grey', name: 'Столешница Камень серый 38 мм', group: 'countertop', color: '#b9b6b0', roughness: 0.45, metalness: 0.03, pricePerM2: 4200, grain: 'none', short: 'Камень серый' },
  { id: 'top-marble', name: 'Столешница Мрамор Каррара 38 мм', group: 'countertop', color: '#e9e7e2', roughness: 0.32, metalness: 0.04, pricePerM2: 5300, grain: 'none', short: 'Мрамор' },
  { id: 'top-oak', name: 'Столешница Дуб 38 мм', group: 'countertop', color: '#b98b57', roughness: 0.6, metalness: 0, pricePerM2: 4800, grain: 'h', short: 'Дуб' },
  { id: 'top-black', name: 'Столешница Чёрный кварц 38 мм', group: 'countertop', color: '#2c2e30', roughness: 0.35, metalness: 0.06, pricePerM2: 5600, grain: 'none', short: 'Кварц чёрный' },

  // --- Пол (только визуал) ---
  { id: 'floor-oak', name: 'Ламинат дуб', group: 'floor', color: '#c4a276', roughness: 0.72, metalness: 0, pricePerM2: 0, grain: 'h', short: 'Ламинат дуб' },
  { id: 'floor-grey', name: 'Керамогранит серый', group: 'floor', color: '#a9a7a3', roughness: 0.5, metalness: 0.02, pricePerM2: 0, grain: 'none', short: 'Керамогранит' },
  { id: 'floor-dark', name: 'Тёмный паркет', group: 'floor', color: '#5b4433', roughness: 0.62, metalness: 0, pricePerM2: 0, grain: 'h', short: 'Тёмный паркет' },
]

/** Служебные материалы: в селекторах не показываются, но участвуют в 3D и смете. */
export const INTERNAL_MATERIALS: Material[] = [
  { id: 'hdf', name: 'ХДФ 4 мм', group: 'carcass', color: '#d8cdbd', roughness: 0.9, metalness: 0, pricePerM2: 320, grain: 'none', short: 'ХДФ' },
]

const BY_ID = new Map([...MATERIALS, ...INTERNAL_MATERIALS].map((m) => [m.id, m]))

export function material(id: string): Material {
  return BY_ID.get(id) ?? MATERIALS[0]
}

export function materialsOf(group: Material['group']): Material[] {
  return MATERIALS.filter((m) => m.group === group)
}

export interface Handle {
  id: string
  name: string
  /** Тип отрисовки в 3D. */
  style: 'bar' | 'knob' | 'edge' | 'none'
  color: string
  metalness: number
  roughness: number
  /** Цена за штуку, руб. */
  price: number
}

export const HANDLES: Handle[] = [
  { id: 'bar-black', name: 'Рейлинг чёрный 160 мм', style: 'bar', color: '#1e1f21', metalness: 0.5, roughness: 0.4, price: 240 },
  { id: 'bar-steel', name: 'Рейлинг нержавейка 160 мм', style: 'bar', color: '#c9ccd0', metalness: 0.9, roughness: 0.25, price: 280 },
  { id: 'bar-gold', name: 'Рейлинг латунь 160 мм', style: 'bar', color: '#c4a052', metalness: 0.85, roughness: 0.3, price: 420 },
  { id: 'knob-black', name: 'Кнопка чёрная', style: 'knob', color: '#1e1f21', metalness: 0.45, roughness: 0.45, price: 150 },
  { id: 'edge-alu', name: 'Профиль-ручка Gola алюминий', style: 'edge', color: '#b8bcc0', metalness: 0.8, roughness: 0.3, price: 690 },
  { id: 'none', name: 'Без ручек (push-to-open)', style: 'none', color: '#000000', metalness: 0, roughness: 1, price: 320 },
]

const HANDLE_BY_ID = new Map(HANDLES.map((h) => [h.id, h]))
export function handle(id: string): Handle {
  return HANDLE_BY_ID.get(id) ?? HANDLES[0]
}

/** Прайс на фурнитуру и погонаж. Цены — ориентир, правятся в настройках. */
export const HARDWARE_PRICES = {
  /** Петля с доводчиком, комплект на одну точку. */
  hinge: 260,
  /** Комплект направляющих скрытого монтажа на ящик. */
  drawerSlide: 1450,
  /** Штанга для одежды, за метр. */
  rod: 380,
  /** Подъёмный механизм на фасад. */
  lift: 2100,
  /** Опора регулируемая. */
  leg: 85,
  /** Конфирмат / эксцентрик, на точку. */
  fastener: 12,
  /** Кромка ПВХ 2 мм, за погонный метр. */
  edge2: 45,
  /** Кромка ПВХ 0.4 мм, за погонный метр. */
  edge04: 18,
  /** ХДФ задней стенки, за м². */
  hdf: 320,
}
