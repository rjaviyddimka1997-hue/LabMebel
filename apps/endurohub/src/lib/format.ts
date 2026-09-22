const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} м`
  return `${Math.round(metres / 1000)} км`
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} мин`
  if (m === 0) return `${h} ч`
  return `${h} ч ${m} мин`
}

/** «Суббота, 12 октября · сбор 08:30» — формат заголовка карточки выезда. */
export function formatRideDate(iso: string): string {
  const d = new Date(iso)
  const weekday = WEEKDAYS[d.getDay()]
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  return `${capitalized}, ${d.getDate()} ${MONTHS[d.getMonth()]} · сбор ${formatTime(d)}`
}

/** «Сб 12.10» — компактный формат для плитки в ленте. */
export function formatRideDateShort(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${WEEKDAYS_SHORT[d.getDay()]} ${day}.${month}`
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function daysUntil(iso: string): number {
  const now = new Date()
  const target = new Date(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTarget = new Date(
    target.getFullYear(), target.getMonth(), target.getDate(),
  ).getTime()
  return Math.round((startOfTarget - startOfToday) / 86_400_000)
}

/** «сегодня» / «завтра» / «через 5 дней» — снимает необходимость считать в уме. */
export function relativeDay(iso: string): string {
  const days = daysUntil(iso)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  if (days === 2) return 'послезавтра'
  if (days < 0) return 'прошёл'
  if (days <= 7) return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`
  return `через ${Math.round(days / 7)} ${plural(Math.round(days / 7), 'неделю', 'недели', 'недель')}`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function formatSlots(taken: number, capacity: number): string {
  const free = Math.max(0, capacity - taken)
  if (free === 0) return 'мест нет'
  return `${free} ${plural(free, 'место', 'места', 'мест')}`
}

export function toIsoLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}
