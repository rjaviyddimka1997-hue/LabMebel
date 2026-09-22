import type { Difficulty } from '../types'

export interface DifficultyMeta {
  code: string
  name: string
  short: string
  color: string
  /** Цвет текста поверх заливки — считаем один раз, чтобы не гадать в компонентах. */
  ink: string
  description: string
  experience: string
}

export const DIFFICULTY: Record<Difficulty, DifficultyMeta> = {
  1: {
    code: 'E1',
    name: 'Грунт',
    short: 'Грейдеры и полевые дороги',
    color: '#34C759',
    ink: '#08210F',
    description: 'Грейдеры, полевые дороги, сухие лесные просеки. Проходится на любой технике.',
    experience: 'Первый сезон',
  },
  2: {
    code: 'E2',
    name: 'Лайт-трейл',
    short: 'Колея, песок, броды до 20 см',
    color: '#A3D93B',
    ink: '#16210A',
    description: 'Колея, песок, небольшие подъёмы, неглубокие броды. Падения редки.',
    experience: '1 сезон',
  },
  3: {
    code: 'E3',
    name: 'Трейл',
    short: 'Глина, корни, броды до 50 см',
    color: '#FFCC00',
    ink: '#241C00',
    description: 'Глина, корни, крутые подъёмы, броды до полуметра. Падения вероятны.',
    experience: '2+ сезона',
  },
  4: {
    code: 'E4',
    name: 'Хард-трейл',
    short: 'Болото, завалы, техничные участки',
    color: '#FF8A00',
    ink: '#241200',
    description: 'Болото, завалы, затяжные технические участки. Нужна физподготовка.',
    experience: '3+ сезона',
  },
  5: {
    code: 'E5',
    name: 'Хард-эндуро',
    short: 'Экстрим, нужна помощь и лебёдка',
    color: '#2C2C2E',
    ink: '#FFFFFF',
    description: 'Экстремальный рельеф, спецучастки. В одиночку не проходится.',
    experience: 'Соревновательный уровень',
  },
}

export const ALL_DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5]

export function isDifficulty(value: number): value is Difficulty {
  return value >= 1 && value <= 5 && Number.isInteger(value)
}

/** Приводит произвольное число к допустимому уровню — для данных из внешних источников. */
export function clampDifficulty(value: number): Difficulty {
  const rounded = Math.round(value)
  if (rounded < 1) return 1
  if (rounded > 5) return 5
  return rounded as Difficulty
}
