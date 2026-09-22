/**
 * Сквозной прогон сценария MVP в headless Chromium.
 *
 * Запуск:
 *   npm run build && npm run test:e2e
 *
 * Playwright не в зависимостях проекта: скрипт берёт его из окружения
 * (`npx playwright install chromium` или системная установка). Если модуль
 * не найден — прогон помечается пропущенным, а не падает.
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(fileURLToPath(new URL('../dist', import.meta.url)))
const PORT = Number(process.env.E2E_PORT ?? 4173)
const ORIGIN = `http://127.0.0.1:${PORT}`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  try {
    ;({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'))
  } catch {
    console.log('SKIP: playwright не установлен — сквозной прогон пропущен')
    process.exit(0)
  }
}

try {
  await stat(join(DIST, 'index.html'))
} catch {
  console.error('Нет сборки: сначала выполните npm run build')
  process.exit(1)
}

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]))
  const file = path === '/' ? 'index.html' : path.replace(/^\/+/, '')
  try {
    const body = await readFile(join(DIST, file))
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve))

const results = []
const step = async (name, fn) => {
  try {
    await fn()
    results.push([true, name])
    console.log('PASS', name)
  } catch (cause) {
    results.push([false, name])
    console.log('FAIL', name, '->', String(cause.message).split('\n')[0])
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
// Тайлы OSM недоступны в CI — глушим, они не влияют на проверяемую логику.
await page.route('**tile.openstreetmap.org/**', (route) => route.abort())
await page.goto(ORIGIN, { waitUntil: 'networkidle' })

await step('карта: загрузились маршруты и выезды', async () => {
  await page.getByRole('button', { name: /Маршруты 10/ }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /Выезды \d+/ }).first().waitFor({ timeout: 10000 })
})

await step('карта: в шите видны ближайшие выезды', async () => {
  await page.getByText('Ближайшие выезды').waitFor({ timeout: 8000 })
})

await step('контейнер карты не схлопнут по высоте', async () => {
  await page.locator('.maplibregl-canvas').waitFor({ timeout: 12000 })
  const height = await page.locator('.map').evaluate((el) => el.offsetHeight)
  if (height < 100) throw new Error(`высота контейнера карты ${height}px`)
})

await step('таб «Выезды»: лента рендерится', async () => {
  await page.getByRole('tab', { name: /Выезды/ }).click()
  await page.getByText('Лосиный остров').first().waitFor({ timeout: 8000 })
})

await step('фильтр по уровню E4 сужает ленту', async () => {
  const before = await page.locator('.card').count()
  await page.getByRole('button', { name: 'E4 · Хард-трейл' }).click()
  await page.waitForTimeout(400)
  const after = await page.locator('.card').count()
  if (after >= before) throw new Error(`фильтр не сработал: ${before} -> ${after}`)
  await page.getByRole('button', { name: 'E4 · Хард-трейл' }).click()
  await page.waitForTimeout(300)
})

await step('карточка выезда открывается', async () => {
  await page.locator('.card').first().click()
  await page.getByText('Точка сбора').waitFor({ timeout: 8000 })
  await page.getByText('Участники').waitFor({ timeout: 4000 })
})

await step('вступление требует заполненного профиля', async () => {
  await page.getByRole('button', { name: /Присоединиться|Отправить заявку/ }).click()
  await page.getByText('Какой у тебя уровень?').waitFor({ timeout: 6000 })
})

await step('онбординг проходится за три шага', async () => {
  await page.getByText('Трейл', { exact: false }).first().click()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByPlaceholder('Марка, модель, год').fill('Husqvarna TE 300, 2019')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Москва', exact: true }).click()
  await page.getByRole('button', { name: 'Готово' }).click()
  await page.getByText('Точка сбора').waitFor({ timeout: 6000 })
})

await step('вступление в выезд меняет состояние карточки', async () => {
  await page.getByRole('button', { name: /Присоединиться|Отправить заявку/ }).click()
  await page.getByText(/Вы в группе|Заявка отправлена/).waitFor({ timeout: 6000 })
  await page.getByRole('button', { name: 'Выйти из выезда' }).waitFor({ timeout: 4000 })
})

await step('мастер создания выезда доходит до публикации', async () => {
  // На карточке выезда таб-бара нет — сначала возвращаемся в корень стека.
  await page.getByRole('button', { name: 'Назад' }).click()
  await page.getByRole('tab', { name: 'Карта' }).click()
  await page.getByLabel('Создать выезд').click()
  await page.getByText('Звенигородские горки').click()
  await page.getByRole('button', { name: 'Далее' }).click()

  await page.getByPlaceholder('АЗС, парковка, съезд с трассы').fill('Звенигород, заправка на въезде')
  await page.waitForTimeout(1500)
  const box = await page.locator('.maplibregl-canvas').boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Далее' }).click()

  await page.getByText('Новый выезд · Кто едет').waitFor({ timeout: 6000 })
  await page.getByRole('button', { name: 'Защита обязательна' }).click()
  await page.getByRole('button', { name: 'Далее' }).click()

  await page.getByText('Новый выезд · Описание').waitFor({ timeout: 6000 })
  await page.getByPlaceholder(/Спокойный темп/).fill('Разбираем подъёмы. Темп тренировочный.')
  await page.getByRole('button', { name: 'Опубликовать выезд' }).click()

  await page.getByText('Вы организатор').waitFor({ timeout: 8000 })
})

await step('созданный выезд переживает перезагрузку', async () => {
  // Проверяем по вкладке «Мои»: один выезд, в который мы вступили, плюс
  // только что созданный. Совпадение по названию маршрута было бы слабой
  // проверкой — такой выезд есть и в демо-данных.
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: /Выезды/ }).click()
  await page.getByRole('button', { name: 'Мои 2' }).click({ timeout: 8000 })
  await page.waitForTimeout(400)
  const mine = await page.locator('.card').count()
  if (mine !== 2) throw new Error(`во вкладке «Мои» ${mine} выездов вместо 2`)
})

await step('профиль показывает данные онбординга', async () => {
  await page.getByRole('tab', { name: 'Профиль' }).click()
  await page.getByText('Husqvarna TE 300, 2019').first().waitFor({ timeout: 6000 })
})

if (process.env.E2E_SHOT) {
  await page.screenshot({ path: process.env.E2E_SHOT })
}

await browser.close()
server.close()

const failed = results.filter(([ok]) => !ok)
if (pageErrors.length > 0) {
  console.log('ОШИБКИ СТРАНИЦЫ:\n' + pageErrors.join('\n'))
}
console.log(`\n${results.length - failed.length}/${results.length} шагов пройдено`)
process.exit(failed.length > 0 || pageErrors.length > 0 ? 1 : 0)

