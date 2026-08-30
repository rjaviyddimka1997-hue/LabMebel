import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildUnit, carcassBottom, type Part } from '../domain/builder'
import { material } from '../domain/materials'
import type { Project, Unit } from '../domain/types'
import { floorTexture, labelSprite, surfaceTexture } from './textures'

/** Миллиметры сцены → метры three.js. */
const S = 0.001

export type CameraPreset = 'iso' | 'front' | 'top' | 'inside'

export interface ViewOptions {
  showRoom: boolean
  showDimensions: boolean
  openFronts: boolean
}

export interface SceneCallbacks {
  onSelect: (unitId: string | null) => void
  onMove: (unitId: string, x: number, z: number) => void
}

interface Movable {
  pivot: THREE.Object3D
  spec: NonNullable<Part['open']>
}

export class FurnitureScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private roomGroup = new THREE.Group()
  private unitsGroup = new THREE.Group()
  private helpersGroup = new THREE.Group()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private disposables: Array<{ dispose(): void }> = []
  private movables: Movable[] = []
  private openAmount = 0
  private targetOpen = 0
  private signature = ''
  private roomSignature = ''
  private selectedId: string | null = null
  private showDimensions = false
  private helperSignature = ''
  private units: Unit[] = []
  private roomSize = { width: 4000, depth: 3200, height: 2700 }
  private outline: THREE.LineSegments | null = null
  private frame = 0
  private cameraTween: { from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3; t: number } | null = null
  private drag: { unitId: string; offsetX: number; offsetZ: number } | null = null
  private pointerDownAt = { x: 0, y: 0, moved: false }
  private resizeObserver: ResizeObserver

  constructor(private container: HTMLElement, private callbacks: SceneCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color('#e8e6e1')
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100)
    this.camera.position.set(3.6, 2.2, 4.6)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02
    this.controls.minDistance = 0.6
    this.controls.maxDistance = 22
    this.controls.target.set(1.8, 0.9, 0.6)

    this.scene.add(this.roomGroup, this.unitsGroup, this.helpersGroup)
    this.addLights()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    this.renderer.setAnimationLoop(this.tick)
  }

  private addLights() {
    const hemi = new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.55)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight('#fff4e6', 2.1)
    key.position.set(4.5, 5.5, 4.2)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 25
    key.shadow.camera.left = -8
    key.shadow.camera.right = 8
    key.shadow.camera.top = 8
    key.shadow.camera.bottom = -8
    key.shadow.bias = -0.0008
    key.shadow.normalBias = 0.02
    this.scene.add(key)

    const fill = new THREE.DirectionalLight('#dde8ff', 0.55)
    fill.position.set(-4, 3, 2.5)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight('#ffffff', 0.35)
    rim.position.set(0, 2.5, -5)
    this.scene.add(rim)

    // Свет «от зрителя»: фасады не проваливаются в тень под любым углом обзора.
    const front = new THREE.DirectionalLight('#ffffff', 0.5)
    front.position.set(0, 0.4, 1)
    this.camera.add(front, front.target)
    front.target.position.set(0, 0, -1)
    this.scene.add(this.camera)
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // --- Публичный API ---

  update(project: Project, selectedId: string | null, options: ViewOptions) {
    this.units = project.units
    this.roomSize = { width: project.room.width, depth: project.room.depth, height: project.room.height }
    this.targetOpen = options.openFronts ? 1 : 0

    const roomSig = JSON.stringify(project.room) + String(options.showRoom)
    if (roomSig !== this.roomSignature) {
      this.roomSignature = roomSig
      this.buildRoom(project, options.showRoom)
    }

    // Позиция и поворот не входят в подпись: перетаскивание не должно
    // пересобирать геометрию, оно двигает уже готовые группы.
    const sig = JSON.stringify(
      project.units.map(({ x: _x, z: _z, rotation: _r, ...rest }) => rest),
    )
    if (sig !== this.signature) {
      this.signature = sig
      this.buildUnits(project)
    }
    this.syncTransforms(project.units)

    const helperSig = `${sig}|${JSON.stringify(project.units.map((u) => [u.x, u.z, u.rotation]))}`
    if (selectedId !== this.selectedId || options.showDimensions !== this.showDimensions || helperSig !== this.helperSignature) {
      this.selectedId = selectedId
      this.showDimensions = options.showDimensions
      this.helperSignature = helperSig
      this.buildHelpers(options.showDimensions)
    }
  }

  setSelection(selectedId: string | null, showDimensions: boolean) {
    this.selectedId = selectedId
    this.buildHelpers(showDimensions)
  }

  focus(preset: CameraPreset) {
    const box = new THREE.Box3()
    if (this.unitsGroup.children.length) box.setFromObject(this.unitsGroup)
    else box.setFromCenterAndSize(new THREE.Vector3(1.5, 1, 0.3), new THREE.Vector3(3, 2, 0.6))
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const span = Math.max(size.x, size.y, size.z, 1)

    let position: THREE.Vector3
    let target = center.clone()
    switch (preset) {
      case 'front':
        position = new THREE.Vector3(center.x, center.y + span * 0.1, center.z + span * 1.9)
        break
      case 'top':
        position = new THREE.Vector3(center.x, span * 2.4, center.z + 0.001)
        break
      case 'inside':
        position = new THREE.Vector3(center.x + span * 0.35, 1.55, center.z + span * 1.05)
        target = new THREE.Vector3(center.x, 1.2, center.z)
        break
      case 'iso':
      default:
        position = new THREE.Vector3(center.x + span * 0.95, center.y + span * 0.75, center.z + span * 1.45)
    }
    this.cameraTween = {
      from: this.camera.position.clone(),
      to: position,
      targetFrom: this.controls.target.clone(),
      targetTo: target,
      t: 0,
    }
  }

  /** Чистый PNG-снимок для КП: без рамки выделения и выносных размеров. */
  snapshot(scale = 2): string {
    const { clientWidth: w, clientHeight: h } = this.container
    const ratio = this.renderer.getPixelRatio()
    const helpersVisible = this.helpersGroup.visible
    this.helpersGroup.visible = false
    this.renderer.setPixelRatio(Math.min(scale, 3))
    this.renderer.setSize(w, h, false)
    this.renderer.render(this.scene, this.camera)
    const url = this.renderer.domElement.toDataURL('image/png')
    this.helpersGroup.visible = helpersVisible
    this.renderer.setPixelRatio(ratio)
    this.resize()
    return url
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.clearGroup(this.unitsGroup)
    this.clearGroup(this.roomGroup)
    this.clearGroup(this.helpersGroup)
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
    el.remove()
  }

  // --- Построение сцены ---

  private clearGroup(group: THREE.Group) {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else if (mat) mat.dispose()
    })
    group.clear()
  }

  private buildRoom(project: Project, show: boolean) {
    this.clearGroup(this.roomGroup)
    if (!show) return

    const { width, depth, height } = project.room
    const w = width * S
    const d = depth * S
    const h = height * S

    const floorMat = material(project.room.floor)
    const floorTex = floorTexture(floorMat).clone()
    floorTex.needsUpdate = true
    floorTex.repeat.set(w / 1.2, d / 1.2)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: floorMat.roughness, metalness: floorMat.metalness }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(w / 2, 0, d / 2)
    floor.receiveShadow = true
    this.roomGroup.add(floor)

    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(project.room.wallColor),
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    })

    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat)
    back.position.set(w / 2, h / 2, 0)
    back.receiveShadow = true
    this.roomGroup.add(back)

    const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat)
    left.rotation.y = Math.PI / 2
    left.position.set(0, h / 2, d / 2)
    left.receiveShadow = true
    this.roomGroup.add(left)

    // Плинтус для ощущения комнаты
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.8 })
    const skirtBack = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.018), skirtMat)
    skirtBack.position.set(w / 2, 0.04, 0.009)
    this.roomGroup.add(skirtBack)
    const skirtLeft = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.08, d), skirtMat)
    skirtLeft.position.set(0.009, 0.04, d / 2)
    this.roomGroup.add(skirtLeft)
  }

  private buildUnits(project: Project) {
    this.clearGroup(this.unitsGroup)
    this.movables = []

    for (const unit of project.units) {
      const group = new THREE.Group()
      group.position.set(unit.x * S, 0, unit.z * S)
      group.rotation.y = (-unit.rotation * Math.PI) / 180
      group.userData.unitId = unit.id

      const { parts } = buildUnit(unit)
      const pivots = new Map<string, THREE.Object3D>()

      for (const part of parts) {
        const mesh = this.makeMesh(part)
        mesh.userData.unitId = unit.id
        if (part.group && part.open) {
          let pivot = pivots.get(part.group)
          if (!pivot) {
            pivot = new THREE.Object3D()
            const spec = part.open
            if (spec.kind === 'door') pivot.position.set(spec.pivotX * S, 0, 0)
            else if (spec.kind === 'lift') pivot.position.set(0, spec.pivotY * S, 0)
            pivot.userData.unitId = unit.id
            pivots.set(part.group, pivot)
            group.add(pivot)
            this.movables.push({ pivot, spec })
          }
          mesh.position.sub(pivot.position)
          pivot.add(mesh)
        } else {
          group.add(mesh)
        }
      }

      this.unitsGroup.add(group)
    }
    this.applyOpen()
  }

  /** Дешёвая синхронизация положений без пересборки геометрии. */
  private syncTransforms(units: Unit[]) {
    for (const unit of units) {
      const group = this.unitsGroup.children.find((g) => g.userData.unitId === unit.id)
      if (!group) continue
      group.position.set(unit.x * S, 0, unit.z * S)
      group.rotation.y = (-unit.rotation * Math.PI) / 180
    }
  }

  private makeMesh(part: Part): THREE.Mesh {
    const mat = material(part.visualMaterialId ?? part.materialId)
    const [sx, sy, sz] = part.size.map((v) => Math.max(v, 1) * S) as [number, number, number]

    let geometry: THREE.BufferGeometry
    if (part.shape === 'cylinder') {
      // Ось цилиндра зависит от роли: штанга лежит вдоль X, опора стоит по Y,
      // ручка-кнопка смотрит вперёд по Z. Радиус берём из поперечных габаритов.
      if (part.role === 'rod') {
        geometry = new THREE.CylinderGeometry(sy / 2, sy / 2, sx, 16)
        geometry.rotateZ(Math.PI / 2)
      } else if (part.role === 'handle') {
        geometry = new THREE.CylinderGeometry(sx / 2, sx / 2, sz, 20)
        geometry.rotateX(Math.PI / 2)
      } else {
        geometry = new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 16)
      }
    } else {
      geometry = new THREE.BoxGeometry(sx, sy, sz)
    }

    const texture = surfaceTexture(mat).clone()
    texture.needsUpdate = true
    const dims = [sx, sy, sz].sort((a, b) => b - a)
    texture.repeat.set(Math.max(dims[0] / 0.7, 0.4), Math.max(dims[1] / 0.7, 0.4))

    const meshMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      color: new THREE.Color(mat.color),
      roughness: mat.roughness,
      metalness: mat.metalness,
    })
    if (part.role === 'handle') {
      meshMaterial.map = null
      meshMaterial.metalness = 0.75
      meshMaterial.roughness = 0.3
    }

    const mesh = new THREE.Mesh(geometry, meshMaterial)
    mesh.position.set(part.pos[0] * S, part.pos[1] * S, part.pos[2] * S)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.part = part.role
    return mesh
  }

  private buildHelpers(showDimensions: boolean) {
    this.clearGroup(this.helpersGroup)
    this.outline = null
    const unit = this.units.find((u) => u.id === this.selectedId)
    if (!unit) return

    // Рамка строится по паспортным габаритам модуля в его локальных координатах,
    // поэтому открытые фасады её не раздувают, а перетаскивание не требует пересборки.
    const { totalHeight, totalDepth } = buildUnit(unit)
    const bottom = carcassBottom(unit)
    const size = new THREE.Vector3(unit.width * S, (totalHeight - bottom) * S, totalDepth * S)
    const center = new THREE.Vector3((unit.width / 2) * S, ((bottom + totalHeight) / 2) * S, (totalDepth / 2) * S)
    const box = new THREE.Box3().setFromCenterAndSize(center, size)
    this.helpersGroup.position.set(unit.x * S, 0, unit.z * S)
    this.helpersGroup.rotation.y = (-unit.rotation * Math.PI) / 180

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x + 0.012, size.y + 0.012, size.z + 0.012))
    const outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: '#2f6df6', depthTest: false, transparent: true, opacity: 0.95 }),
    )
    outline.position.copy(center)
    outline.renderOrder = 998
    this.helpersGroup.add(outline)
    this.outline = outline

    if (!showDimensions) return

    const mm = (v: number) => `${Math.round(v)} мм`
    const widthLabel = labelSprite(mm(unit.width))
    widthLabel.position.set(center.x, box.min.y + 0.06, box.max.z + 0.16)
    const heightLabel = labelSprite(mm(unit.height))
    heightLabel.position.set(box.max.x + 0.14, center.y, box.max.z + 0.06)
    const depthLabel = labelSprite(mm(unit.depth))
    depthLabel.position.set(box.min.x - 0.16, box.min.y + 0.06, center.z)
    this.helpersGroup.add(widthLabel, heightLabel, depthLabel)

    const lineMat = new THREE.LineBasicMaterial({ color: '#2f6df6', depthTest: false, transparent: true, opacity: 0.7 })
    const line = (a: THREE.Vector3, b: THREE.Vector3) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, b])
      const l = new THREE.Line(g, lineMat)
      l.renderOrder = 997
      this.helpersGroup.add(l)
    }
    line(new THREE.Vector3(box.min.x, box.min.y + 0.01, box.max.z + 0.12), new THREE.Vector3(box.max.x, box.min.y + 0.01, box.max.z + 0.12))
    line(new THREE.Vector3(box.max.x + 0.1, box.min.y, box.max.z + 0.02), new THREE.Vector3(box.max.x + 0.1, box.max.y, box.max.z + 0.02))
    line(new THREE.Vector3(box.min.x - 0.12, box.min.y + 0.01, box.min.z), new THREE.Vector3(box.min.x - 0.12, box.min.y + 0.01, box.max.z))
  }

  // --- Взаимодействие ---

  private updatePointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private pickUnit(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.unitsGroup.children, true)
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (obj.userData.unitId) return obj.userData.unitId as string
        obj = obj.parent
      }
    }
    return null
  }

  private floorPoint(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const point = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(plane, point) ? point : null
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    this.updatePointer(event)
    this.pointerDownAt = { x: event.clientX, y: event.clientY, moved: false }
    const unitId = this.pickUnit()
    if (!unitId) return
    const unit = this.units.find((u) => u.id === unitId)
    const point = this.floorPoint()
    if (unit && point) {
      this.drag = {
        unitId,
        offsetX: point.x / S - unit.x,
        offsetZ: point.z / S - unit.z,
      }
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.drag) return
    const dx = event.clientX - this.pointerDownAt.x
    const dy = event.clientY - this.pointerDownAt.y
    if (!this.pointerDownAt.moved && Math.hypot(dx, dy) < 5) return
    this.pointerDownAt.moved = true
    this.controls.enabled = false

    this.updatePointer(event)
    const point = this.floorPoint()
    if (!point) return
    const unit = this.units.find((u) => u.id === this.drag!.unitId)
    if (!unit) return

    const snap = (v: number) => Math.round(v / 10) * 10
    let x = snap(point.x / S - this.drag.offsetX)
    let z = snap(point.z / S - this.drag.offsetZ)
    // Примагничивание к стенам комнаты
    if (Math.abs(z) < 60) z = 0
    if (Math.abs(x) < 60) x = 0
    x = Math.max(-500, Math.min(x, this.roomSize.width))
    z = Math.max(-200, Math.min(z, this.roomSize.depth))

    const group = this.unitsGroup.children.find((g) => g.userData.unitId === unit.id)
    if (group) group.position.set(x * S, 0, z * S)
    unit.x = x
    unit.z = z
    if (this.outline) this.helpersGroup.position.set(x * S, 0, z * S)
    this.callbacks.onMove(unit.id, x, z)
  }

  private onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return
    const moved = this.pointerDownAt.moved
    this.drag = null
    this.controls.enabled = true
    if (moved) return
    this.updatePointer(event)
    const target = event.target as Node | null
    if (target && !this.renderer.domElement.contains(target)) return
    this.callbacks.onSelect(this.pickUnit())
  }

  private tick = () => {
    this.frame += 1
    this.controls.update()

    // Плавное открывание фасадов
    if (Math.abs(this.openAmount - this.targetOpen) > 0.001) {
      this.openAmount += (this.targetOpen - this.openAmount) * 0.12
      this.applyOpen()
    }

    if (this.cameraTween) {
      const tw = this.cameraTween
      tw.t = Math.min(1, tw.t + 0.06)
      const e = 1 - Math.pow(1 - tw.t, 3)
      this.camera.position.lerpVectors(tw.from, tw.to, e)
      this.controls.target.lerpVectors(tw.targetFrom, tw.targetTo, e)
      if (tw.t >= 1) this.cameraTween = null
    }

    this.renderer.render(this.scene, this.camera)
  }

  private applyOpen() {
    const k = this.openAmount
    for (const { pivot, spec } of this.movables) {
      if (spec.kind === 'door') {
        pivot.rotation.y = (spec.hinge === 'left' ? 1 : -1) * k * (100 * Math.PI) / 180
      } else if (spec.kind === 'drawer') {
        pivot.position.z = spec.travel * S * k
      } else {
        pivot.rotation.x = -k * (55 * Math.PI) / 180
      }
    }
  }
}
