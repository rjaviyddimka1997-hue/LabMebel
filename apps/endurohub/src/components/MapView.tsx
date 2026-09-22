import { useEffect, useRef, useState } from 'react'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LngLat, Route } from '../types'
import type { RideListItem } from '../lib/api'
import { DIFFICULTY } from '../lib/difficulty'
import { bboxOf, type Bbox } from '../lib/geo'

const ROUTES_SOURCE = 'eh-routes'
const RIDES_SOURCE = 'eh-rides'

/**
 * Растровый OSM — фоллбэк, чтобы карта работала без ключа MapTiler.
 * На проде ставится VITE_MAP_STYLE_URL: тайловая политика OSM не рассчитана
 * на продуктовый трафик (см. docs/endurohub/05, раздел 5).
 */
const RASTER_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    // Подложка под тайлами: если они не загрузились (нет сети в лесу,
    // заблокирован домен), карта читается как поверхность без данных,
    // а не как сломанный чёрный экран. Треки остаются видны.
    { id: 'surface', type: 'background', paint: { 'background-color': '#12151b' } },
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      // Приглушаем подложку, чтобы цветные треки читались на тёмной теме.
      paint: { 'raster-saturation': -0.45, 'raster-brightness-max': 0.72 },
    },
  ],
}

/** Цвет линии/точки по уровню сложности — одним выражением на весь слой. */
const DIFFICULTY_COLOR: unknown[] = [
  'match',
  ['get', 'difficulty'],
  1, DIFFICULTY[1].color,
  2, DIFFICULTY[2].color,
  3, DIFFICULTY[3].color,
  4, DIFFICULTY[4].color,
  5, DIFFICULTY[5].color,
  '#8a8f9a',
]

export interface MapViewProps {
  center: LngLat
  routes: Route[]
  rides: RideListItem[]
  userPoint: LngLat | null
  onRouteClick?: (routeId: string) => void
  onRideClick?: (rideId: string) => void
  /** Включает выбор точки тапом — режим «указать точку сбора». */
  onPickPoint?: (point: LngLat) => void
  pickedPoint?: LngLat | null
  fitToRoute?: Route | null
  /** Разовая подгонка вида под загруженные данные; применяется один раз. */
  fitToData?: Bbox | null
}

export function MapView({
  center, routes, rides, userPoint,
  onRouteClick, onRideClick, onPickPoint, pickedPoint, fitToRoute, fitToData,
}: MapViewProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const userMarker = useRef<maplibregl.Marker | null>(null)
  const pickMarker = useRef<maplibregl.Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const didFitData = useRef(false)

  // Обработчики держим в ref: они меняются на каждом рендере, а подписки
  // на карту вешаются один раз при инициализации.
  const handlers = useRef({ onRouteClick, onRideClick, onPickPoint })
  handlers.current = { onRouteClick, onRideClick, onPickPoint }

  useEffect(() => {
    if (!container.current || map.current) return

    const styleUrl = import.meta.env.VITE_MAP_STYLE_URL as string | undefined
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: styleUrl || RASTER_FALLBACK,
        center: [center.lng, center.lat],
        zoom: 8,
        attributionControl: { compact: true },
      })
    } catch {
      setFailed(true)
      return
    }
    map.current = instance

    instance.on('error', (event) => {
      // Ошибка загрузки отдельного тайла не должна ронять экран.
      if ((event as { error?: { status?: number } }).error?.status === 404) return
    })

    instance.on('load', () => {
      instance.addSource(ROUTES_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      instance.addLayer({
        id: 'routes-casing',
        type: 'line',
        source: ROUTES_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0b0d11', 'line-width': 7, 'line-opacity': 0.55 },
      })
      instance.addLayer({
        id: 'routes-line',
        type: 'line',
        source: ROUTES_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': DIFFICULTY_COLOR as maplibregl.ExpressionSpecification,
          'line-width': 3.5,
        },
      })

      instance.addSource(RIDES_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      instance.addLayer({
        id: 'rides-halo',
        type: 'circle',
        source: RIDES_SOURCE,
        paint: { 'circle-radius': 12, 'circle-color': '#0b0d11', 'circle-opacity': 0.6 },
      })
      instance.addLayer({
        id: 'rides-point',
        type: 'circle',
        source: RIDES_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': DIFFICULTY_COLOR as maplibregl.ExpressionSpecification,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f1115',
        },
      })

      const pointer = (on: boolean) => {
        instance.getCanvas().style.cursor = on ? 'pointer' : ''
      }
      for (const layer of ['routes-line', 'rides-point'] as const) {
        instance.on('mouseenter', layer, () => pointer(true))
        instance.on('mouseleave', layer, () => pointer(false))
      }

      instance.on('click', 'rides-point', (event) => {
        const id = event.features?.[0]?.properties?.id
        if (typeof id === 'string') handlers.current.onRideClick?.(id)
      })
      instance.on('click', 'routes-line', (event) => {
        const id = event.features?.[0]?.properties?.id
        if (typeof id === 'string') handlers.current.onRouteClick?.(id)
      })
      instance.on('click', (event) => {
        const { onPickPoint, onRideClick, onRouteClick } = handlers.current
        if (!onPickPoint) return
        // Проглатываем тап только теми слоями, у которых есть собственный
        // обработчик. Иначе в режиме выбора точки сбора тап по линии маршрута
        // не ставит метку и выглядит как зависшее приложение.
        const guarded: string[] = []
        if (onRideClick) guarded.push('rides-point')
        if (onRouteClick) guarded.push('routes-line')
        if (guarded.length > 0 && instance.queryRenderedFeatures(event.point, { layers: guarded }).length > 0) {
          return
        }
        onPickPoint({ lng: event.lngLat.lng, lat: event.lngLat.lat })
      })

      setReady(true)
    })

    // Контейнер карты живёт во flex-раскладке и меняет высоту после того, как
    // отрисуются соседние блоки. Без этого канвас остаётся прежнего размера,
    // и видимая область карты не совпадает с тем, куда попадает тап.
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      userMarker.current?.remove()
      pickMarker.current?.remove()
      instance.remove()
      map.current = null
      setReady(false)
    }
    // Карта создаётся один раз; центр обновляется отдельным эффектом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !map.current) return
    const source = map.current.getSource(ROUTES_SOURCE) as maplibregl.GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      features: routes
        .filter((route) => route.coordinates.length > 1)
        .map((route) => ({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: route.coordinates },
          properties: { id: route.id, difficulty: route.difficulty, title: route.title },
        })),
    })
  }, [routes, ready])

  useEffect(() => {
    if (!ready || !map.current) return
    const source = map.current.getSource(RIDES_SOURCE) as maplibregl.GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      features: rides.map((ride) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [ride.meetingPoint.lng, ride.meetingPoint.lat],
        },
        properties: { id: ride.id, difficulty: ride.difficulty, title: ride.title },
      })),
    })
  }, [rides, ready])

  useEffect(() => {
    if (!ready || !map.current) return
    if (!userPoint) {
      userMarker.current?.remove()
      userMarker.current = null
      return
    }
    if (!userMarker.current) {
      const el = document.createElement('div')
      el.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#2f8fff;' +
        'border:3px solid #0f1115;box-shadow:0 0 0 4px rgba(47,143,255,0.25)'
      userMarker.current = new maplibregl.Marker({ element: el })
    }
    userMarker.current.setLngLat([userPoint.lng, userPoint.lat]).addTo(map.current)
  }, [userPoint, ready])

  useEffect(() => {
    if (!ready || !map.current) return
    if (!pickedPoint) {
      pickMarker.current?.remove()
      pickMarker.current = null
      return
    }
    if (!pickMarker.current) {
      pickMarker.current = new maplibregl.Marker({ color: '#ff6b1a' })
    }
    pickMarker.current.setLngLat([pickedPoint.lng, pickedPoint.lat]).addTo(map.current)
  }, [pickedPoint, ready])

  useEffect(() => {
    if (!ready || !map.current || !fitToRoute || fitToRoute.coordinates.length < 2) return
    const box = bboxOf(fitToRoute.coordinates)
    map.current.fitBounds(
      [
        [box.west, box.south],
        [box.east, box.north],
      ],
      { padding: 48, duration: 600 },
    )
  }, [fitToRoute, ready])

  // Карта, открытая на фиксированном зуме, показывает один маршрут из десяти
  // и читается как пустая. Первый кадр подгоняем под то, что реально загрузилось;
  // дальше вид принадлежит пользователю и сам не прыгает.
  useEffect(() => {
    if (!ready || !map.current || fitToRoute || didFitData.current || !fitToData) return
    didFitData.current = true
    map.current.fitBounds(
      [
        [fitToData.west, fitToData.south],
        [fitToData.east, fitToData.north],
      ],
      { padding: { top: 64, bottom: 260, left: 40, right: 40 }, duration: 0, maxZoom: 11 },
    )
  }, [fitToData, ready, fitToRoute])

  useEffect(() => {
    if (!ready || !map.current || fitToRoute || fitToData) return
    map.current.easeTo({ center: [center.lng, center.lat], duration: 600 })
  }, [center, ready, fitToRoute, fitToData])

  if (failed) {
    return (
      <div className="map-fallback">
        Карта не запустилась: браузер не поддерживает WebGL.
        Списки выездов и маршрутов работают без неё.
      </div>
    )
  }

  return <div className="map" ref={container} />
}
