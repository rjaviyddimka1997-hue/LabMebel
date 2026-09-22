/**
 * Тонкая обёртка над Telegram WebApp SDK.
 *
 * Важно: initData здесь только передаётся на сервер. Проверять подпись на клиенте
 * бессмысленно — HMAC считается по bot token, который клиенту знать нельзя.
 * Верификация живёт в Edge Function (см. docs/endurohub/05, раздел 2).
 */

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: { user?: TelegramUser; start_param?: string }
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  viewportStableHeight: number
  ready(): void
  expand(): void
  close(): void
  openTelegramLink(url: string): void
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
  }
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
  MainButton: {
    setText(text: string): void
    show(): void
    hide(): void
    enable(): void
    disable(): void
    onClick(cb: () => void): void
    offClick(cb: () => void): void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export const webApp = (): TelegramWebApp | undefined => window.Telegram?.WebApp

export const isTelegram = (): boolean => Boolean(webApp()?.initData)

export function initTelegram(): void {
  const app = webApp()
  if (!app) return
  app.ready()
  app.expand()
}

export function telegramUser(): TelegramUser | null {
  return webApp()?.initDataUnsafe.user ?? null
}

export function initData(): string {
  return webApp()?.initData ?? ''
}

/** Deep link вида t.me/endurohub_bot/app?startapp=ride_<id> — им делятся в чатах. */
export function startParam(): string | null {
  return webApp()?.initDataUnsafe.start_param ?? null
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  webApp()?.HapticFeedback?.impactOccurred(style)
}

export function hapticSuccess(): void {
  webApp()?.HapticFeedback?.notificationOccurred('success')
}

/** Нативная кнопка «назад» в шапке Telegram; в браузере — no-op. */
export function setBackButton(handler: (() => void) | null): void {
  const app = webApp()
  if (!app) return
  if (!handler) {
    app.BackButton.hide()
    return
  }
  app.BackButton.onClick(handler)
  app.BackButton.show()
}

export function hideBackButton(handler: () => void): void {
  const app = webApp()
  if (!app) return
  app.BackButton.offClick(handler)
  app.BackButton.hide()
}

export function shareRideLink(rideId: string, title: string): void {
  const link = `https://t.me/endurohub_bot/app?startapp=ride_${rideId}`
  const text = encodeURIComponent(`${title} — присоединяйся`)
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`
  const app = webApp()
  if (app) {
    app.openTelegramLink(url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}
