import * as THREE from 'three'
import type { Material } from '../domain/materials'

const cache = new Map<string, THREE.Texture>()

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ]
}

function shade(rgb: [number, number, number], factor: number, alpha: number): string {
  const [r, g, b] = rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * factor))))
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Рисует процедурную текстуру поверхности: древесные волокна для декоров
 * под дерево и мягкий шум для однотонных плит. Без внешних файлов.
 */
export function surfaceTexture(mat: Material): THREE.Texture {
  const cached = cache.get(mat.id)
  if (cached) return cached

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rgb = hexToRgb(mat.color)

  ctx.fillStyle = mat.color
  ctx.fillRect(0, 0, size, size)

  let seed = [...mat.id].reduce((a, c) => a + c.charCodeAt(0), 7)
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  if (mat.grain === 'v' || mat.grain === 'h') {
    // Волокна: длинные полосы разной насыщенности вдоль оси V.
    for (let i = 0; i < 260; i++) {
      const x = rand() * size
      const w = 0.6 + rand() * 3.4
      const dark = rand() > 0.55
      ctx.strokeStyle = dark ? shade(rgb, 0.78, 0.16 + rand() * 0.2) : shade(rgb, 1.16, 0.1 + rand() * 0.16)
      ctx.lineWidth = w
      ctx.beginPath()
      let y = 0
      let cx = x
      ctx.moveTo(cx, y)
      while (y < size) {
        y += 24 + rand() * 40
        cx += (rand() - 0.5) * 7
        ctx.lineTo(cx, y)
      }
      ctx.stroke()
    }
    // Редкие сучки и переходы
    for (let i = 0; i < 5; i++) {
      const x = rand() * size
      const y = rand() * size
      const r = 6 + rand() * 16
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r)
      grad.addColorStop(0, shade(rgb, 0.65, 0.5))
      grad.addColorStop(1, shade(rgb, 0.8, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(x, y, r * 0.5, r, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    // Однотонная плита: тонкий шум, чтобы поверхность не выглядела пластиковой.
    const image = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < image.data.length; i += 4) {
      const n = (rand() - 0.5) * 9
      image.data[i] = Math.max(0, Math.min(255, image.data[i] + n))
      image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n))
      image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n))
    }
    ctx.putImageData(image, 0, 0)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  cache.set(mat.id, texture)
  return texture
}

/** Текстура пола: доски или плитка. */
export function floorTexture(mat: Material): THREE.Texture {
  const key = `floor:${mat.id}`
  const cached = cache.get(key)
  if (cached) return cached

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rgb = hexToRgb(mat.color)
  ctx.fillStyle = mat.color
  ctx.fillRect(0, 0, size, size)

  let seed = 31
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const rows = mat.grain === 'h' ? 6 : 4
  const rowH = size / rows
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (size / (rows * 1.5))
    for (let x = -size; x < size * 2; x += size / 2) {
      ctx.fillStyle = shade(rgb, 0.9 + rand() * 0.22, 1)
      ctx.fillRect(x + offset, r * rowH, size / 2 - 2, rowH - 2)
    }
  }
  ctx.strokeStyle = shade(rgb, 0.6, 0.35)
  ctx.lineWidth = 1.5
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * rowH)
    ctx.lineTo(size, r * rowH)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  cache.set(key, texture)
  return texture
}

/** Спрайт с текстом для выносных размеров. */
export function labelSprite(text: string, color = '#1d2530'): THREE.Sprite {
  const pad = 12
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = 'bold 44px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  canvas.width = w
  canvas.height = 68
  const c = canvas.getContext('2d')!
  c.font = font
  c.fillStyle = 'rgba(255,255,255,0.92)'
  c.beginPath()
  c.roundRect(0, 0, canvas.width, canvas.height, 12)
  c.fill()
  c.fillStyle = color
  c.textBaseline = 'middle'
  c.fillText(text, pad, canvas.height / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
  )
  sprite.scale.set((canvas.width / canvas.height) * 0.17, 0.17, 1)
  sprite.renderOrder = 999
  return sprite
}

export function disposeTextureCache(): void {
  for (const t of cache.values()) t.dispose()
  cache.clear()
}
