/** Уровень сложности EnduroHub. Центральная онтология продукта. */
export type Difficulty = 1 | 2 | 3 | 4 | 5

export type RideVisibility = 'open' | 'request' | 'link'
export type RideStatus = 'planned' | 'confirmed' | 'active' | 'finished' | 'cancelled'
export type ParticipantStatus = 'requested' | 'approved' | 'declined' | 'left' | 'completed'

export interface LngLat {
  lng: number
  lat: number
}

export interface Rider {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  skillLevel: Difficulty
  city: string
  motoText: string | null
  bio: string | null
  ridesCount: number
}

export interface Route {
  id: string
  authorId: string
  title: string
  description: string | null
  difficulty: Difficulty
  /** Медиана голосов прошедших маршрут; null, пока голосов меньше трёх. */
  difficultyConfirmed: Difficulty | null
  distanceM: number
  elevationGainM: number
  durationEstMin: number | null
  /** Публичная (обрезанная на 500 м с концов) геометрия трека. */
  coordinates: [number, number][]
  isLoop: boolean
  ratingAvg: number
  ratingCount: number
  ridesCount: number
  surfaceMix: Record<string, number>
  regionName: string
}

export interface Ride {
  id: string
  organizerId: string
  routeId: string | null
  title: string
  description: string | null
  difficulty: Difficulty
  startsAt: string
  meetingPoint: LngLat
  meetingAddress: string
  capacity: number
  participantsCount: number
  visibility: RideVisibility
  requirements: string[]
  checklist: string[]
  status: RideStatus
}

export interface RideParticipant {
  rideId: string
  userId: string
  status: ParticipantStatus
  role: 'organizer' | 'rider'
}

export interface RideFilters {
  /** Верхняя граница окна поиска в днях от сегодня. */
  withinDays: number
  radiusKm: number
  difficultyMin: Difficulty
  difficultyMax: Difficulty
  onlyWithSlots: boolean
}

export interface RouteFilters {
  difficultyMin: Difficulty
  difficultyMax: Difficulty
}

/** Черновик выезда в мастере создания (4 шага, см. docs/endurohub/03). */
export interface RideDraft {
  routeId: string | null
  title: string
  description: string
  difficulty: Difficulty
  date: string
  time: string
  meetingPoint: LngLat | null
  meetingAddress: string
  capacity: number
  visibility: RideVisibility
  requirements: string[]
  checklist: string[]
}
