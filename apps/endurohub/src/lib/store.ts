import type { Ride, RideParticipant, Route, Rider } from '../types'
import { SEED_PARTICIPANTS, SEED_RIDERS, SEED_RIDES, SEED_ROUTES } from '../data/seed'

/**
 * Локальное состояние для режима без бэкенда.
 *
 * Держим отдельно от api.ts, чтобы граница «где данные» была одна и явная:
 * при подключении Supabase этот модуль перестаёт использоваться, а сигнатуры
 * api.ts не меняются.
 */

const STORAGE_KEY = 'endurohub:local:v1'

interface Persisted {
  routes: Route[]
  rides: Ride[]
  participants: RideParticipant[]
  riders: Rider[]
  currentUserId: string | null
}

function seed(): Persisted {
  return {
    routes: SEED_ROUTES,
    rides: SEED_RIDES,
    participants: SEED_PARTICIPANTS,
    riders: SEED_RIDERS,
    currentUserId: null,
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw) as Partial<Persisted>
    const base = seed()
    return {
      // Маршруты и райдеров берём из сида: это справочные данные, которые
      // обновляются вместе с кодом. Сохраняем только то, что создал пользователь.
      routes: [...base.routes, ...(parsed.routes ?? []).filter((r) => r.id.startsWith('local-'))],
      rides: mergeById(base.rides, parsed.rides ?? []),
      participants: parsed.participants ?? base.participants,
      riders: mergeById(base.riders, parsed.riders ?? []),
      currentUserId: parsed.currentUserId ?? null,
    }
  } catch {
    return seed()
  }
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const byId = new Map(base.map((item) => [item.id, item]))
  for (const item of extra) byId.set(item.id, item)
  return [...byId.values()]
}

let state: Persisted = load()

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Приватный режим или переполненное хранилище — работаем в памяти.
  }
}

export const store = {
  get routes() { return state.routes },
  get rides() { return state.rides },
  get participants() { return state.participants },
  get riders() { return state.riders },
  get currentUserId() { return state.currentUserId },

  setCurrentUser(rider: Rider) {
    state.riders = mergeById(state.riders, [rider])
    state.currentUserId = rider.id
    persist()
  },

  updateCurrentUser(patch: Partial<Rider>) {
    if (!state.currentUserId) return
    state.riders = state.riders.map((r) =>
      r.id === state.currentUserId ? { ...r, ...patch } : r,
    )
    persist()
  },

  addRoute(route: Route) {
    state.routes = [route, ...state.routes]
    persist()
  },

  addRide(ride: Ride, organizerId: string) {
    state.rides = [ride, ...state.rides]
    state.participants = [
      ...state.participants,
      { rideId: ride.id, userId: organizerId, status: 'approved', role: 'organizer' },
    ]
    persist()
  },

  setParticipation(rideId: string, userId: string, status: RideParticipant['status'] | null) {
    state.participants = state.participants.filter(
      (p) => !(p.rideId === rideId && p.userId === userId),
    )
    if (status) {
      state.participants = [...state.participants, { rideId, userId, status, role: 'rider' }]
    }
    state.rides = state.rides.map((ride) =>
      ride.id === rideId
        ? {
            ...ride,
            participantsCount: state.participants.filter(
              (p) => p.rideId === rideId && (p.status === 'approved' || p.status === 'completed'),
            ).length,
          }
        : ride,
    )
    persist()
  },

  reset() {
    state = seed()
    persist()
  },
}
