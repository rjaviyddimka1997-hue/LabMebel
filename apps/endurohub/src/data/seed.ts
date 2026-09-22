import type { Difficulty, Ride, RideParticipant, Rider, Route } from '../types'
import { trackLength } from '../lib/geo'

/**
 * Демо-данные для работы без бэкенда.
 *
 * Треки синтетические: настоящие GPX попадают в базу через импорт, а в репозитории
 * им делать нечего — это чужие геоданные. Генератор детерминированный, чтобы
 * карта выглядела одинаково при каждом запуске.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Рисует правдоподобный лесной трек: базовая дуга между опорными точками
 * плюс шум, амплитуда которого растёт со сложностью — E4 петляет сильнее E1.
 */
function makeTrack(
  seed: number,
  origin: [number, number],
  spanKm: number,
  difficulty: Difficulty,
  loop: boolean,
): [number, number][] {
  const rnd = mulberry32(seed)
  const steps = 160
  const spanLng = spanKm / 63
  const spanLat = spanKm / 111
  const wobble = 0.12 + difficulty * 0.07
  const coords: [number, number][] = []

  let driftLng = 0
  let driftLat = 0

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = loop ? t * Math.PI * 2 : t * Math.PI
    const baseLng = origin[0] + Math.cos(angle) * spanLng * (loop ? 0.5 : t)
    const baseLat = origin[1] + Math.sin(angle) * spanLat * (loop ? 0.5 : 0.6)

    driftLng += (rnd() - 0.5) * spanLng * wobble * 0.14
    driftLat += (rnd() - 0.5) * spanLat * wobble * 0.14

    coords.push([
      Number((baseLng + driftLng).toFixed(5)),
      Number((baseLat + driftLat).toFixed(5)),
    ])
  }

  if (loop) coords.push(coords[0])

  // Дуга с шумом выходит в 2–4 раза длиннее габарита, поэтому подгоняем
  // геометрию под заявленную дистанцию: иначе «тренировочный E3 на 31 км»
  // превращается в 135 км, и демо перестаёт быть правдоподобным.
  return scaleToLength(coords, origin, spanKm * 1000)
}

function scaleToLength(
  coords: [number, number][],
  origin: [number, number],
  targetM: number,
): [number, number][] {
  const actual = trackLength(coords)
  if (actual === 0) return coords
  const k = targetM / actual
  return coords.map(([lng, lat]) => [
    Number((origin[0] + (lng - origin[0]) * k).toFixed(5)),
    Number((origin[1] + (lat - origin[1]) * k).toFixed(5)),
  ])
}

export const SEED_RIDERS: Rider[] = [
  {
    id: 'u-artem', username: 'artem_sokolov', displayName: 'Артём Соколов',
    avatarUrl: null, skillLevel: 4, city: 'Москва',
    motoText: 'KTM 350 EXC-F, 2021',
    bio: 'Катаю шестой сезон. Организую выезды по Подмосковью каждые выходные.',
    ridesCount: 47,
  },
  {
    id: 'u-sergey', username: 'sergey_mech', displayName: 'Сергей Ильин',
    avatarUrl: null, skillLevel: 3, city: 'Москва',
    motoText: 'Husqvarna TE 300, 2019',
    bio: 'Всё чиню сам. Могу подсказать по подвеске.',
    ridesCount: 31,
  },
  {
    id: 'u-dmitry', username: 'dmitry_first', displayName: 'Дмитрий Карпов',
    avatarUrl: null, skillLevel: 2, city: 'Химки',
    motoText: 'Honda CRF250L, 2020',
    bio: 'Первый год в эндуро. Ищу спокойные выезды.',
    ridesCount: 6,
  },
  {
    id: 'u-igor', username: 'igor_guide', displayName: 'Игорь Мельник',
    avatarUrl: null, skillLevel: 5, city: 'Санкт-Петербург',
    motoText: 'Beta RR 300, 2023',
    bio: 'Гид. Вожу туры по Карелии и Ленобласти.',
    ridesCount: 118,
  },
  {
    id: 'u-pavel', username: 'pavel_tver', displayName: 'Павел Громов',
    avatarUrl: null, skillLevel: 3, city: 'Тверь',
    motoText: 'GasGas EC 250, 2022',
    bio: null,
    ridesCount: 22,
  },
  {
    id: 'u-nina', username: 'nina_rides', displayName: 'Нина Абрамова',
    avatarUrl: null, skillLevel: 3, city: 'Москва',
    motoText: 'Yamaha WR250R, 2018',
    bio: 'Езжу в лес круглый год. Зимой — на шипах.',
    ridesCount: 38,
  },
]

interface RouteSpec {
  id: string
  authorId: string
  title: string
  description: string
  difficulty: Difficulty
  origin: [number, number]
  spanKm: number
  loop: boolean
  regionName: string
  surfaceMix: Record<string, number>
  ratingAvg: number
  ratingCount: number
  ridesCount: number
  difficultyConfirmed: Difficulty | null
}

const ROUTE_SPECS: RouteSpec[] = [
  {
    id: 'r-losiny', authorId: 'u-artem', title: 'Лосиный остров — Клязьма',
    description: 'Классический разминочный маршрут. Просеки, две колеи, брод через Клязьму по колено — есть объезд по мосту.',
    difficulty: 2, origin: [37.85, 55.86], spanKm: 42, loop: true,
    regionName: 'Московская область',
    surfaceMix: { 'грунт': 55, 'песок': 20, 'глина': 15, 'асфальт': 10 },
    ratingAvg: 4.6, ratingCount: 34, ridesCount: 19, difficultyConfirmed: 2,
  },
  {
    id: 'r-shatura', authorId: 'u-sergey', title: 'Шатурские торфяники',
    description: 'Открытые торфяники и заброшенные узкоколейки. После дождя сложность поднимается на уровень — не суйтесь в мокрое.',
    difficulty: 4, origin: [39.54, 55.57], spanKm: 78, loop: false,
    regionName: 'Московская область',
    surfaceMix: { 'торф': 45, 'грунт': 30, 'болото': 20, 'песок': 5 },
    ratingAvg: 4.8, ratingCount: 27, ridesCount: 12, difficultyConfirmed: 4,
  },
  {
    id: 'r-zvenigorod', authorId: 'u-nina', title: 'Звенигородские горки',
    description: 'Короткий техничный маршрут с глиняными подъёмами. Хорош для отработки техники в межсезонье.',
    difficulty: 3, origin: [36.85, 55.73], spanKm: 31, loop: true,
    regionName: 'Московская область',
    surfaceMix: { 'глина': 50, 'грунт': 35, 'корни': 15 },
    ratingAvg: 4.4, ratingCount: 41, ridesCount: 26, difficultyConfirmed: 3,
  },
  {
    id: 'r-dubna', authorId: 'u-artem', title: 'Дубна — Талдом по полям',
    description: 'Быстрый маршрут по грейдерам и полевым дорогам. Подойдёт и для туристов-двойников.',
    difficulty: 1, origin: [37.18, 56.73], spanKm: 64, loop: false,
    regionName: 'Московская область',
    surfaceMix: { 'грейдер': 60, 'грунт': 30, 'асфальт': 10 },
    ratingAvg: 4.1, ratingCount: 18, ridesCount: 14, difficultyConfirmed: 1,
  },
  {
    id: 'r-tver-les', authorId: 'u-pavel', title: 'Тверские вырубки',
    description: 'Лесовозные дороги, завалы, несколько бродов. Двигаться только группой, в одиночку вытаскивать некому.',
    difficulty: 4, origin: [35.92, 56.88], spanKm: 96, loop: false,
    regionName: 'Тверская область',
    surfaceMix: { 'грунт': 40, 'глина': 30, 'завалы': 20, 'брод': 10 },
    ratingAvg: 4.9, ratingCount: 15, ridesCount: 7, difficultyConfirmed: 4,
  },
  {
    id: 'r-karelia', authorId: 'u-igor', title: 'Карельские скалы, день 1',
    description: 'Первый день тура: скальные выходы, курумник, затяжные подъёмы. Нужна лебёдка или крепкие товарищи.',
    difficulty: 5, origin: [30.72, 61.21], spanKm: 112, loop: false,
    regionName: 'Карелия',
    surfaceMix: { 'камень': 45, 'грунт': 25, 'болото': 20, 'песок': 10 },
    ratingAvg: 5.0, ratingCount: 9, ridesCount: 4, difficultyConfirmed: 5,
  },
  {
    id: 'r-vsevolozhsk', authorId: 'u-igor', title: 'Всеволожские пески',
    description: 'Песчаные карьеры под Петербургом. Отличное место учиться держать газ в песке.',
    difficulty: 2, origin: [30.64, 60.02], spanKm: 38, loop: true,
    regionName: 'Ленинградская область',
    surfaceMix: { 'песок': 70, 'грунт': 25, 'асфальт': 5 },
    ratingAvg: 4.3, ratingCount: 22, ridesCount: 17, difficultyConfirmed: 2,
  },
  {
    id: 'r-ruza', authorId: 'u-nina', title: 'Рузское водохранилище',
    description: 'Берега, сосновый бор, пара крутых спусков к воде. Летом много отдыхающих — едем тихо.',
    difficulty: 2, origin: [36.2, 55.7], spanKm: 54, loop: true,
    regionName: 'Московская область',
    surfaceMix: { 'грунт': 50, 'песок': 30, 'глина': 20 },
    ratingAvg: 4.5, ratingCount: 29, ridesCount: 21, difficultyConfirmed: 2,
  },
  {
    id: 'r-chernogolovka', authorId: 'u-sergey', title: 'Черноголовка — спецучастки',
    description: 'Компактный полигон с техничными спецучастками. Тренировочный маршрут местной школы.',
    difficulty: 5, origin: [38.37, 56.0], spanKm: 22, loop: true,
    regionName: 'Московская область',
    surfaceMix: { 'глина': 40, 'корни': 30, 'камень': 20, 'вода': 10 },
    ratingAvg: 4.7, ratingCount: 12, ridesCount: 9, difficultyConfirmed: null,
  },
  {
    id: 'r-vladimir', authorId: 'u-artem', title: 'Владимирские просеки',
    description: 'Длинный ходовой маршрут по просекам. Заправка на 70-м километре — дальше 90 км без цивилизации.',
    difficulty: 3, origin: [40.3, 56.2], spanKm: 134, loop: false,
    regionName: 'Владимирская область',
    surfaceMix: { 'грунт': 55, 'песок': 20, 'глина': 20, 'брод': 5 },
    ratingAvg: 4.6, ratingCount: 24, ridesCount: 11, difficultyConfirmed: 3,
  },
]

export const SEED_ROUTES: Route[] = ROUTE_SPECS.map((spec, index) => {
  const coordinates = makeTrack(index * 7919 + 13, spec.origin, spec.spanKm, spec.difficulty, spec.loop)
  const distanceM = Math.round(trackLength(coordinates))
  return {
    id: spec.id,
    authorId: spec.authorId,
    title: spec.title,
    description: spec.description,
    difficulty: spec.difficulty,
    difficultyConfirmed: spec.difficultyConfirmed,
    distanceM,
    // Набор высоты для равнинной части РФ: порядка 6–10 м на километр.
    elevationGainM: Math.round((distanceM / 1000) * (5 + spec.difficulty * 1.8)),
    // Средняя скорость падает со сложностью: E1 ~28 км/ч, E5 ~9 км/ч.
    durationEstMin: Math.round((distanceM / 1000) / (32 - spec.difficulty * 4.6) * 60),
    coordinates,
    isLoop: spec.loop,
    ratingAvg: spec.ratingAvg,
    ratingCount: spec.ratingCount,
    ridesCount: spec.ridesCount,
    surfaceMix: spec.surfaceMix,
    regionName: spec.regionName,
  }
})

/** Ближайшая суббота или воскресенье + смещение недель, 08:30 утра. */
function weekendAt(weeksAhead: number, day: 6 | 0, hour = 8, minute = 30): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  const currentDay = target.getDay()
  const wanted = day === 0 ? 7 : day
  const current = currentDay === 0 ? 7 : currentDay
  let delta = wanted - current
  if (delta < 0) delta += 7
  target.setDate(target.getDate() + delta + weeksAhead * 7)
  return target.toISOString()
}

interface RideSpec {
  id: string
  organizerId: string
  routeId: string
  title: string
  description: string
  startsAt: string
  meeting: [number, number]
  meetingAddress: string
  capacity: number
  participants: string[]
  visibility: 'open' | 'request'
  requirements: string[]
}

const RIDE_SPECS: RideSpec[] = [
  {
    id: 'ride-1', organizerId: 'u-artem', routeId: 'r-losiny',
    title: 'E2 · Лосиный остров · спокойный темп',
    description: 'Спокойный темп, ждём всех. Два брода по колено, объезд есть. Обед у костра, берём перекус с собой.',
    startsAt: weekendAt(0, 6), meeting: [38.0142, 55.8231],
    meetingAddress: 'АЗС Лукойл, Щёлковское шоссе, 24 км',
    capacity: 10, participants: ['u-artem', 'u-sergey', 'u-dmitry', 'u-nina', 'u-pavel'],
    visibility: 'open',
    requirements: ['Защита: черепаха и наколенники', 'Запас топлива на 150 км', 'Трос или стропа'],
  },
  {
    id: 'ride-2', organizerId: 'u-sergey', routeId: 'r-shatura',
    title: 'E4 · Шатурские торфяники · для опытных',
    description: 'Жёсткий маршрут. Берём только тех, кто уверенно едет болото. Выезжаем рано, возвращаемся затемно.',
    startsAt: weekendAt(0, 0, 7, 0), meeting: [39.5401, 55.5722],
    meetingAddress: 'Шатура, парковка у вокзала',
    capacity: 8, participants: ['u-sergey', 'u-artem', 'u-nina'],
    visibility: 'request',
    requirements: ['Опыт болота обязателен', 'Лебёдка или стропа', 'Запасная камера'],
  },
  {
    id: 'ride-3', organizerId: 'u-nina', routeId: 'r-zvenigorod',
    title: 'E3 · Звенигородские горки · отработка техники',
    description: 'Полдня катаем подъёмы, разбираем ошибки. Формат тренировочный, не гонка.',
    startsAt: weekendAt(1, 6, 9, 0), meeting: [36.8562, 55.7303],
    meetingAddress: 'Звенигород, заправка на въезде',
    capacity: 12, participants: ['u-nina', 'u-dmitry'],
    visibility: 'open',
    requirements: ['Полная защита', 'Вода минимум 1,5 литра'],
  },
  {
    id: 'ride-4', organizerId: 'u-artem', routeId: 'r-dubna',
    title: 'E1 · Дубна — Талдом · первый выезд сезона',
    description: 'Специально для новичков и двойников. Простые грейдеры, никакой грязи, темп прогулочный.',
    startsAt: weekendAt(1, 0, 10, 0), meeting: [37.1789, 56.7312],
    meetingAddress: 'Дубна, ТЦ «Дубна», парковка',
    capacity: 15, participants: ['u-artem', 'u-dmitry'],
    visibility: 'open',
    requirements: ['Шлем и перчатки', 'Полный бак'],
  },
  {
    id: 'ride-5', organizerId: 'u-pavel', routeId: 'r-tver-les',
    title: 'E4 · Тверские вырубки · два дня',
    description: 'Двухдневка с ночёвкой в палатках. Завалы, броды, лесовозные дороги. Нужен опыт многодневок.',
    startsAt: weekendAt(2, 6, 7, 30), meeting: [35.9176, 56.8587],
    meetingAddress: 'Тверь, выезд на Старицкое шоссе',
    capacity: 6, participants: ['u-pavel', 'u-sergey'],
    visibility: 'request',
    requirements: ['Палатка и спальник', 'Ремкомплект', 'Опыт двухдневных выездов'],
  },
  {
    id: 'ride-6', organizerId: 'u-nina', routeId: 'r-ruza',
    title: 'E2 · Руза · вечерний выезд',
    description: 'Короткий выезд после работы. Успеваем к закату на берег.',
    startsAt: weekendAt(0, 6, 16, 0), meeting: [36.2018, 55.7015],
    meetingAddress: 'Руза, площадь у автостанции',
    capacity: 8, participants: ['u-nina', 'u-artem', 'u-dmitry', 'u-pavel'],
    visibility: 'open',
    requirements: ['Рабочий свет — возвращаемся в сумерках'],
  },
  {
    id: 'ride-7', organizerId: 'u-igor', routeId: 'r-vsevolozhsk',
    title: 'E2 · Всеволожские пески · школа песка',
    description: 'Разбираем посадку и работу газом в песке. Подходит новичкам после первого сезона.',
    startsAt: weekendAt(1, 6, 11, 0), meeting: [30.6412, 60.0234],
    meetingAddress: 'Всеволожск, съезд с Дороги жизни',
    capacity: 10, participants: ['u-igor'],
    visibility: 'open',
    requirements: ['Защита', 'Резина не дорожная'],
  },
  {
    id: 'ride-8', organizerId: 'u-igor', routeId: 'r-karelia',
    title: 'E5 · Карелия · тур на три дня',
    description: 'Коммерческий тур. Скалы, курумник, ночёвки в гостевом доме. Техника своя или в аренду.',
    startsAt: weekendAt(3, 6, 8, 0), meeting: [30.7231, 61.2104],
    meetingAddress: 'Сортавала, база «Скалы»',
    capacity: 10, participants: ['u-igor', 'u-sergey'],
    visibility: 'request',
    requirements: ['Уровень E4 и выше', 'Опыт скального рельефа', 'Страховка'],
  },
]

const BASE_CHECKLIST = [
  'Шлем, очки, перчатки',
  'Защита: черепаха, наколенники',
  'Вода и перекус',
  'Аптечка',
  'Трос или стропа',
  'Ремкомплект и камера',
  'Заряженный телефон, павербанк',
]

export const SEED_RIDES: Ride[] = RIDE_SPECS.map((spec) => {
  const route = SEED_ROUTES.find((r) => r.id === spec.routeId)!
  return {
    id: spec.id,
    organizerId: spec.organizerId,
    routeId: spec.routeId,
    title: spec.title,
    description: spec.description,
    difficulty: route.difficulty,
    startsAt: spec.startsAt,
    meetingPoint: { lng: spec.meeting[0], lat: spec.meeting[1] },
    meetingAddress: spec.meetingAddress,
    capacity: spec.capacity,
    participantsCount: spec.participants.length,
    visibility: spec.visibility,
    requirements: spec.requirements,
    checklist: BASE_CHECKLIST,
    status: 'planned',
  }
})

export const SEED_PARTICIPANTS: RideParticipant[] = RIDE_SPECS.flatMap((spec) =>
  spec.participants.map((userId) => ({
    rideId: spec.id,
    userId,
    status: 'approved' as const,
    role: userId === spec.organizerId ? ('organizer' as const) : ('rider' as const),
  })),
)

/** Москва — дефолтный центр, пока не получена геопозиция. */
export const DEFAULT_CENTER = { lng: 37.6173, lat: 55.7558 }
