import { bboxOf, simplify, trackLength, trimPrivacy } from './geo'

export interface ParsedGpx {
  name: string | null
  coordinates: [number, number][]
  distanceM: number
  elevationGainM: number
  /** Длительность записи, если в треке есть временные метки. */
  durationMin: number | null
  isLoop: boolean
}

export class GpxParseError extends Error {}

/**
 * Разбор GPX в браузере через DOMParser — без зависимостей.
 * Поддерживает <trkpt> (записанные треки) и <rtept> (спланированные маршруты).
 */
export function parseGpx(xml: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new GpxParseError('Файл повреждён: не удалось разобрать XML')
  }

  let points = Array.from(doc.getElementsByTagName('trkpt'))
  if (points.length === 0) points = Array.from(doc.getElementsByTagName('rtept'))
  if (points.length < 2) {
    throw new GpxParseError('В файле нет трека: не найдено ни одной точки маршрута')
  }

  const coordinates: [number, number][] = []
  const elevations: number[] = []
  const times: number[] = []

  for (const pt of points) {
    const lat = Number(pt.getAttribute('lat'))
    const lon = Number(pt.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    coordinates.push([lon, lat])

    const ele = pt.getElementsByTagName('ele')[0]?.textContent
    elevations.push(ele ? Number(ele) : Number.NaN)

    const time = pt.getElementsByTagName('time')[0]?.textContent
    if (time) {
      const ms = Date.parse(time)
      if (Number.isFinite(ms)) times.push(ms)
    }
  }

  if (coordinates.length < 2) {
    throw new GpxParseError('В файле нет валидных координат')
  }

  const name =
    doc.getElementsByTagName('name')[0]?.textContent?.trim() ||
    doc.querySelector('metadata > name')?.textContent?.trim() ||
    null

  const start = coordinates[0]
  const end = coordinates[coordinates.length - 1]
  const bbox = bboxOf(coordinates)
  const span = Math.max(bbox.east - bbox.west, bbox.north - bbox.south)
  // Петля, если концы сошлись ближе, чем на 3% габарита трека.
  const isLoop =
    span > 0 && Math.hypot(end[0] - start[0], end[1] - start[1]) < span * 0.03

  return {
    name,
    coordinates,
    distanceM: Math.round(trackLength(coordinates)),
    elevationGainM: elevationGain(elevations),
    durationMin:
      times.length >= 2
        ? Math.round((Math.max(...times) - Math.min(...times)) / 60_000)
        : null,
    isLoop,
  }
}

/**
 * Набор высоты с порогом 4 м: GPS шумит на ±3 м, и без порога ровная
 * грунтовка «набирает» полкилометра.
 */
function elevationGain(elevations: number[]): number {
  const clean = elevations.filter(Number.isFinite)
  if (clean.length < 2) return 0
  let gain = 0
  let reference = clean[0]
  for (const value of clean) {
    const delta = value - reference
    if (delta > 4) {
      gain += delta
      reference = value
    } else if (delta < 0) {
      reference = value
    }
  }
  return Math.round(gain)
}

/** Готовит трек к публикации: обрезает приватность и снимает избыточные точки. */
export function prepareForPublish(coordinates: [number, number][]): [number, number][] {
  return simplify(trimPrivacy(coordinates, 500), 0.00002)
}

export function toGpx(name: string, coordinates: [number, number][]): string {
  const points = coordinates
    .map(([lng, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"/>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="EnduroHub" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(name)}</name></metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function downloadGpx(name: string, coordinates: [number, number][]): void {
  const blob = new Blob([toGpx(name, coordinates)], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^\wа-яА-ЯёЁ\s-]/g, '').trim() || 'route'}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
