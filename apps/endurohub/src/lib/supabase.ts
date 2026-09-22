import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Бэкенд подключается переменными окружения. Если их нет — приложение работает
 * на демо-данных, и это осознанный режим: продукт можно показать админу чата
 * с ноутбука, не поднимая инфраструктуру.
 */
export const hasBackend = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = hasBackend
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/**
 * Обмен Telegram initData на сессию Supabase.
 * Подпись проверяется на сервере: bot token клиенту недоступен.
 */
export async function signInWithTelegram(rawInitData: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.functions.invoke('auth-telegram', {
    body: { initData: rawInitData },
  })
  if (error) throw error
  const { access_token, refresh_token } = data as {
    access_token: string
    refresh_token: string
  }
  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })
  if (sessionError) throw sessionError
}
