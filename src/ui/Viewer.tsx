import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { FurnitureScene, type CameraPreset, type ViewOptions } from '../viewer/scene'
import type { Project } from '../domain/types'

export interface ViewerHandle {
  snapshot: () => string | null
  focus: (preset: CameraPreset) => void
}

interface Props {
  project: Project
  selectedId: string | null
  options: ViewOptions
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, z: number) => void
}

export const Viewer = forwardRef<ViewerHandle, Props>(function Viewer(
  { project, selectedId, options, onSelect, onMove },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<FurnitureScene | null>(null)
  const handlers = useRef({ onSelect, onMove })
  handlers.current = { onSelect, onMove }

  useEffect(() => {
    if (!hostRef.current) return
    const scene = new FurnitureScene(hostRef.current, {
      onSelect: (id) => handlers.current.onSelect(id),
      onMove: (id, x, z) => handlers.current.onMove(id, x, z),
    })
    sceneRef.current = scene
    scene.focus('iso')
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.update(project, selectedId, options)
  }, [project, selectedId, options])

  useImperativeHandle(ref, () => ({
    snapshot: () => sceneRef.current?.snapshot() ?? null,
    focus: (preset: CameraPreset) => sceneRef.current?.focus(preset),
  }), [])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
})
