import type { LngLat } from '../types'

const EARTH_RADIUS_M = 6_371_008.8

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Расстояние по большому кругу в метрах. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function trackLength(coords: [number, number][]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversine(
      { lng: coords[i - 1][0], lat: coords[i - 1][1] },
      { lng: coords[i][0], lat: coords[i][1] },
    )
  }
  return total
}

export interface Bbox {
  west: number
  south: number
  east: number
  north: number
}

export function bboxOf(coords: [number, number][]): Bbox {
  const b: Bbox = { west: 180, south: 90, east: -180, north: -90 }
  for (const [lng, lat] of coords) {
    if (lng < b.west) b.west = lng
    if (lng > b.east) b.east = lng
    if (lat < b.south) b.south = lat
    if (lat > b.north) b.north = lat
  }
  return b
}

/**
 * Обрезка приватности: срезаем по `metres` с каждого конца трека,
 * чтобы публичный маршрут не начинался у чьего-то гаража.
 * Зеркалит триггер trim_route_privacy() в миграции 0001.
 */
export function trimPrivacy(coords: [number, number][], metres = 500): [number, number][] {
  if (coords.length < 3) return coords
  const total = trackLength(coords)
  if (total <= metres * 4) return coords

  let head = 0
  let acc = 0
  while (head < coords.length - 1 && acc < metres) {
    acc += haversine(
      { lng: coords[head][0], lat: coords[head][1] },
      { lng: coords[head + 1][0], lat: coords[head + 1][1] },
    )
    head++
  }

  let tail = coords.length - 1
  acc = 0
  while (tail > head + 1 && acc < metres) {
    acc += haversine(
      { lng: coords[tail][0], lat: coords[tail][1] },
      { lng: coords[tail - 1][0], lat: coords[tail - 1][1] },
    )
    tail--
  }

  return coords.slice(head, tail + 1)
}

/**
 * Упрощение трека (Ramer–Douglas–Peucker) в градусах.
 * Нужно ровно затем же, зачем ST_Simplify на сервере: трек на 8000 точек
 * кладёт рендер карты, а на экране всё равно неразличим.
 */
export function simplify(coords: [number, number][], tolerance: number): [number, number][] {
  if (coords.length < 3 || tolerance <= 0) return coords

  const keep = new Uint8Array(coords.length)
  keep[0] = 1
  keep[coords.length - 1] = 1

  const stack: [number, number][] = [[0, coords.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    let maxDist = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(coords[i], coords[first], coords[last])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  return coords.filter((_, i) => keep[i] === 1)
}

function perpendicularDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number],
): number {
  const [x, y] = point
  const [x1, y1] = lineStart
  const [x2, y2] = lineEnd
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1)
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
  const clamped = Math.max(0, Math.min(1, t))
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy))
}

/** Точка старта выезда, если маршрут задан; иначе — сама точка сбора. */
export function midpoint(coords: [number, number][]): LngLat {
  const i = Math.floor(coords.length / 2)
  return { lng: coords[i][0], lat: coords[i][1] }
}
