import type { Project } from './types'
import { emptyProject } from './presets'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Кодирует проект в компактную строку для ссылки (префикс: z — сжато, r — сырой JSON). */
export async function encodeProject(project: Project): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(project))
  const packed = await deflate(raw).catch(() => null)
  return packed && packed.length < raw.length
    ? `z${bytesToBase64Url(packed)}`
    : `r${bytesToBase64Url(raw)}`
}

export async function decodeProject(value: string): Promise<Project | null> {
  try {
    const mode = value[0]
    const bytes = base64UrlToBytes(value.slice(1))
    const raw = mode === 'z' ? await inflate(bytes) : bytes
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as Project
    if (!parsed || !Array.isArray(parsed.units)) return null
    return { ...emptyProject(), ...parsed }
  } catch {
    return null
  }
}

export interface UrlState {
  project: Project | null
  clientMode: boolean
}

/** Разбирает адрес вида #/p/<данные> или #/c/<данные> (режим клиента). */
export async function readUrlState(hash = window.location.hash): Promise<UrlState> {
  const match = /^#\/(p|c)\/(.+)$/.exec(hash)
  if (!match) return { project: null, clientMode: false }
  return { project: await decodeProject(match[2]), clientMode: match[1] === 'c' }
}

export async function buildShareUrl(project: Project, clientMode: boolean): Promise<string> {
  const encoded = await encodeProject(project)
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}#/${clientMode ? 'c' : 'p'}/${encoded}`
}
