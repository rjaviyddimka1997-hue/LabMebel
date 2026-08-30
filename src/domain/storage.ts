import type { Project } from './types'
import { emptyProject } from './presets'

const KEY = 'labmebel.projects.v2'
const LAST = 'labmebel.last.v2'

export interface SavedProject {
  id: string
  savedAt: number
  project: Project
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* приватный режим или переполнение — молча пропускаем */
  }
}

export function listProjects(): SavedProject[] {
  return read<SavedProject[]>(KEY, []).sort((a, b) => b.savedAt - a.savedAt)
}

export function saveProject(id: string, project: Project): SavedProject[] {
  const all = read<SavedProject[]>(KEY, []).filter((p) => p.id !== id)
  all.push({ id, savedAt: Date.now(), project })
  write(KEY, all)
  return all.sort((a, b) => b.savedAt - a.savedAt)
}

export function deleteProject(id: string): SavedProject[] {
  const all = read<SavedProject[]>(KEY, []).filter((p) => p.id !== id)
  write(KEY, all)
  return all.sort((a, b) => b.savedAt - a.savedAt)
}

export function rememberLast(project: Project): void {
  write(LAST, project)
}

export function recallLast(): Project | null {
  const value = read<Project | null>(LAST, null)
  if (!value || !Array.isArray(value.units)) return null
  return { ...emptyProject(), ...value }
}
