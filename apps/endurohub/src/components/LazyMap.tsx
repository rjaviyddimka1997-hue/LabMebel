import { lazy, Suspense } from 'react'
import type { MapViewProps } from './MapView'

/**
 * MapLibre весит около 800 КБ — больше, чем всё остальное приложение.
 * Держим его отдельным чанком: чипы, лента выездов и карточки успевают
 * отрисоваться, пока карта грузится (принцип «3 тапа до ценности»).
 */
const MapView = lazy(async () => ({ default: (await import('./MapView')).MapView }))

export function LazyMap(props: MapViewProps) {
  return (
    <Suspense
      fallback={
        <div className="map-fallback">Загружаем карту…</div>
      }
    >
      <MapView {...props} />
    </Suspense>
  )
}
