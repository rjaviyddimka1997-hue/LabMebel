import type {
  Difficulty, LngLat, Ride, RideDraft, RideFilters, Rider,
  Route, RouteFilters,
} from '../types'
import { hasBackend, supabase } from './supabase'
import { store } from './store'
import { haversine } from './geo'
import { toIsoLocal } from './format'

/**
 * Единственная граница данных в приложении.
 *
 * Каждая функция имеет две реализации: запрос к Supabase и работа с локальным
 * store. Экраны не знают, какая из них активна, — это позволяет показывать
 * продукт без бэкенда и переключиться на него одной переменной окружения.
 */

export interface RideListItem extends Ride {
  distanceKm: number
  organizerName: string
  organizerLevel: Difficulty
  routeDistanceM: number | null
}

export const DEFAULT_RIDE_FILTERS: RideFilters = {
  withinDays: 30,
  radiusKm: 300,
  difficultyMin: 1,
  difficultyMax: 5,
  onlyWithSlots: false,
}

export const DEFAULT_ROUTE_FILTERS: RouteFilters = {
  difficultyMin: 1,
  difficultyMax: 5,
}

// ─────────────────────────────── выезды ───────────────────────────────

export async function fetchRidesNearby(
  center: LngLat,
  filters: RideFilters,
): Promise<RideListItem[]> {
  if (supabase) {
    const now = new Date()
    const until = new Date(now.getTime() + filters.withinDays * 86_400_000)
    const { data, error } = await supabase.rpc('rides_nearby', {
      p_lat: center.lat,
      p_lng: center.lng,
      p_radius_m: filters.radiusKm * 1000,
      p_from: now.toISOString(),
      p_to: until.toISOString(),
      p_diff_min: filters.difficultyMin,
      p_diff_max: filters.difficultyMax,
      p_only_slots: filters.onlyWithSlots,
    })
    if (error) throw error
    return (data as RemoteRideRow[]).map(mapRemoteRide)
  }

  const horizon = Date.now() + filters.withinDays * 86_400_000
  return store.rides
    .filter((ride) => {
      const startsAt = Date.parse(ride.startsAt)
      if (startsAt < Date.now() || startsAt > horizon) return false
      if (ride.difficulty < filters.difficultyMin) return false
      if (ride.difficulty > filters.difficultyMax) return false
      if (filters.onlyWithSlots && ride.participantsCount >= ride.capacity) return false
      return haversine(center, ride.meetingPoint) <= filters.radiusKm * 1000
    })
    .map((ride) => decorate(ride, center))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.distanceKm - b.distanceKm)
}

export async function fetchRide(id: string, center: LngLat): Promise<RideListItem | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('rides')
      .select('*, organizer:users!rides_organizer_id_fkey(display_name, skill_level)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? mapRemoteRide(data as RemoteRideRow) : null
  }
  const ride = store.rides.find((r) => r.id === id)
  return ride ? decorate(ride, center) : null
}

export async function fetchRideParticipants(rideId: string): Promise<Rider[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ride_participants')
      .select('user:users_public(*)')
      .eq('ride_id', rideId)
      .in('status', ['approved', 'completed'])
    if (error) throw error
    // PostgREST отдаёт встроенную связь либо объектом, либо массивом из одного
    // элемента — в зависимости от того, как выведен внешний ключ.
    return (data as unknown as { user: RemoteRider | RemoteRider[] }[])
      .map((row) => (Array.isArray(row.user) ? row.user[0] : row.user))
      .filter((user): user is RemoteRider => Boolean(user))
      .map(mapRemoteRider)
  }
  const ids = store.participants
    .filter((p) => p.rideId === rideId && (p.status === 'approved' || p.status === 'completed'))
    .map((p) => p.userId)
  return store.riders.filter((r) => ids.includes(r.id))
}

export async function joinRide(rideId: string, userId: string): Promise<'approved' | 'requested'> {
  if (supabase) {
    const { data, error } = await supabase.rpc('join_ride', { p_ride_id: rideId })
    if (error) throw error
    return data as 'approved' | 'requested'
  }
  const ride = store.rides.find((r) => r.id === rideId)
  if (!ride) throw new Error('Выезд не найден')
  if (ride.participantsCount >= ride.capacity) throw new Error('Мест больше нет')
  const status = ride.visibility === 'request' ? 'requested' : 'approved'
  store.setParticipation(rideId, userId, status)
  return status
}

export async function leaveRide(rideId: string, userId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('ride_participants')
      .delete()
      .eq('ride_id', rideId)
    if (error) throw error
    return
  }
  store.setParticipation(rideId, userId, null)
}

export async function createRide(draft: RideDraft, organizer: Rider): Promise<Ride> {
  if (!draft.meetingPoint) throw new Error('Не выбрана точка сбора')
  const startsAt = toIsoLocal(draft.date, draft.time)

  if (supabase) {
    const { data, error } = await supabase
      .from('rides')
      .insert({
        organizer_id: organizer.id,
        route_id: draft.routeId,
        title: draft.title,
        description: draft.description || null,
        difficulty: draft.difficulty,
        starts_at: startsAt,
        meeting_point: `SRID=4326;POINT(${draft.meetingPoint.lng} ${draft.meetingPoint.lat})`,
        meeting_address: draft.meetingAddress,
        capacity: draft.capacity,
        visibility: draft.visibility,
        requirements: draft.requirements,
        checklist: draft.checklist,
      })
      .select()
      .single()
    if (error) throw error
    return mapRemoteRide(data as RemoteRideRow)
  }

  const ride: Ride = {
    id: `local-ride-${Date.now()}`,
    organizerId: organizer.id,
    routeId: draft.routeId,
    title: draft.title,
    description: draft.description || null,
    difficulty: draft.difficulty,
    startsAt,
    meetingPoint: draft.meetingPoint,
    meetingAddress: draft.meetingAddress,
    capacity: draft.capacity,
    participantsCount: 1,
    visibility: draft.visibility,
    requirements: draft.requirements,
    checklist: draft.checklist,
    status: 'planned',
  }
  store.addRide(ride, organizer.id)
  return ride
}

export async function fetchMyRideIds(userId: string): Promise<string[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('ride_participants')
      .select('ride_id')
      .eq('user_id', userId)
    if (error) throw error
    return (data as { ride_id: string }[]).map((row) => row.ride_id)
  }
  return store.participants.filter((p) => p.userId === userId).map((p) => p.rideId)
}

// ─────────────────────────────── маршруты ───────────────────────────────

export async function fetchRoutes(filters: RouteFilters): Promise<Route[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('routes_in_bbox', {
      p_west: -180, p_south: -90, p_east: 180, p_north: 90,
      p_zoom: 12,
      p_diff_min: filters.difficultyMin,
      p_diff_max: filters.difficultyMax,
    })
    if (error) throw error
    return (data as RemoteRouteRow[]).map(mapRemoteRoute)
  }
  return store.routes.filter(
    (r) => r.difficulty >= filters.difficultyMin && r.difficulty <= filters.difficultyMax,
  )
}

export async function fetchRoute(id: string): Promise<Route | null> {
  if (supabase) {
    const { data, error } = await supabase.from('routes').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? mapRemoteRoute(data as RemoteRouteRow) : null
  }
  return store.routes.find((r) => r.id === id) ?? null
}

export async function createRoute(
  route: Omit<Route, 'id' | 'ratingAvg' | 'ratingCount' | 'ridesCount' | 'difficultyConfirmed'>,
): Promise<Route> {
  const full: Route = {
    ...route,
    id: `local-route-${Date.now()}`,
    difficultyConfirmed: null,
    ratingAvg: 0,
    ratingCount: 0,
    ridesCount: 0,
  }
  if (supabase) {
    const line = route.coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(',')
    const { data, error } = await supabase
      .from('routes')
      .insert({
        author_id: route.authorId,
        title: route.title,
        description: route.description,
        difficulty: route.difficulty,
        distance_m: route.distanceM,
        elevation_gain_m: route.elevationGainM,
        duration_est_min: route.durationEstMin,
        geom_raw: `SRID=4326;LINESTRING(${line})`,
        geom: `SRID=4326;LINESTRING(${line})`,
        is_loop: route.isLoop,
        surface_mix: route.surfaceMix,
        source: 'gpx_import',
      })
      .select()
      .single()
    if (error) throw error
    return mapRemoteRoute(data as RemoteRouteRow)
  }
  store.addRoute(full)
  return full
}

// ─────────────────────────────── райдеры ───────────────────────────────

export async function fetchRider(id: string): Promise<Rider | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('users_public').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? mapRemoteRider(data as RemoteRider) : null
  }
  return store.riders.find((r) => r.id === id) ?? null
}

export async function saveProfile(rider: Rider): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('users')
      .update({
        display_name: rider.displayName,
        skill_level: rider.skillLevel,
        moto_text: rider.motoText,
        bio: rider.bio,
      })
      .eq('id', rider.id)
    if (error) throw error
    return
  }
  store.updateCurrentUser(rider)
}

export const backendMode: 'supabase' | 'local' = hasBackend ? 'supabase' : 'local'

// ────────────────────────── маппинг ответов ──────────────────────────

interface RemoteRideRow {
  id: string
  organizer_id?: string
  route_id: string | null
  title: string
  description: string | null
  difficulty: number
  starts_at: string
  meeting_address: string | null
  meeting_lat?: number
  meeting_lng?: number
  meeting_point?: { coordinates: [number, number] }
  distance_km?: number
  capacity: number
  participants_count: number
  visibility?: string
  requirements?: string[]
  checklist?: string[]
  status?: string
  route_distance_m?: number | null
  organizer_name?: string
  organizer_level?: number
  organizer?: { display_name: string; skill_level: number }
}

interface RemoteRouteRow {
  id: string
  author_id?: string
  title: string
  description?: string | null
  difficulty: number
  difficulty_confirmed?: number | null
  distance_m: number
  elevation_gain_m?: number
  duration_est_min?: number | null
  geojson?: { coordinates: [number, number][] }
  geom?: { coordinates: [number, number][] }
  is_loop?: boolean
  rating_avg?: number
  rating_count?: number
  rides_count?: number
  surface_mix?: Record<string, number>
  region_name?: string
}

interface RemoteRider {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  skill_level: number
  moto_text: string | null
  bio: string | null
  rides_count: number
}

function asDifficulty(value: number | null | undefined): Difficulty {
  const n = Math.round(value ?? 1)
  return (n < 1 ? 1 : n > 5 ? 5 : n) as Difficulty
}

function mapRemoteRide(row: RemoteRideRow): RideListItem {
  const lng = row.meeting_lng ?? row.meeting_point?.coordinates[0] ?? 0
  const lat = row.meeting_lat ?? row.meeting_point?.coordinates[1] ?? 0
  return {
    id: row.id,
    organizerId: row.organizer_id ?? '',
    routeId: row.route_id,
    title: row.title,
    description: row.description ?? null,
    difficulty: asDifficulty(row.difficulty),
    startsAt: row.starts_at,
    meetingPoint: { lng, lat },
    meetingAddress: row.meeting_address ?? '',
    capacity: row.capacity,
    participantsCount: row.participants_count,
    visibility: (row.visibility as Ride['visibility']) ?? 'open',
    requirements: row.requirements ?? [],
    checklist: row.checklist ?? [],
    status: (row.status as Ride['status']) ?? 'planned',
    distanceKm: row.distance_km ?? 0,
    organizerName: row.organizer_name ?? row.organizer?.display_name ?? 'Организатор',
    organizerLevel: asDifficulty(row.organizer_level ?? row.organizer?.skill_level),
    routeDistanceM: row.route_distance_m ?? null,
  }
}

function mapRemoteRoute(row: RemoteRouteRow): Route {
  return {
    id: row.id,
    authorId: row.author_id ?? '',
    title: row.title,
    description: row.description ?? null,
    difficulty: asDifficulty(row.difficulty),
    difficultyConfirmed: row.difficulty_confirmed ? asDifficulty(row.difficulty_confirmed) : null,
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m ?? 0,
    durationEstMin: row.duration_est_min ?? null,
    coordinates: row.geojson?.coordinates ?? row.geom?.coordinates ?? [],
    isLoop: row.is_loop ?? false,
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: row.rating_count ?? 0,
    ridesCount: row.rides_count ?? 0,
    surfaceMix: row.surface_mix ?? {},
    regionName: row.region_name ?? '',
  }
}

function mapRemoteRider(row: RemoteRider): Rider {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    skillLevel: asDifficulty(row.skill_level),
    city: '',
    motoText: row.moto_text,
    bio: row.bio,
    ridesCount: row.rides_count,
  }
}

function decorate(ride: Ride, center: LngLat): RideListItem {
  const organizer = store.riders.find((r) => r.id === ride.organizerId)
  const route = ride.routeId ? store.routes.find((r) => r.id === ride.routeId) : null
  return {
    ...ride,
    distanceKm: Math.round(haversine(center, ride.meetingPoint) / 1000),
    organizerName: organizer?.displayName ?? 'Организатор',
    organizerLevel: organizer?.skillLevel ?? 1,
    routeDistanceM: route?.distanceM ?? null,
  }
}
