/**
 * Склеивает прод-сборку в один HTML-файл: его можно отправить клиенту
 * вложением или положить куда угодно без веб-сервера.
 * Запуск: npm run build:single
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const assets = 'dist/assets'
const files = readdirSync(assets)
const jsFiles = files.filter((f) => f.endsWith('.js'))
if (jsFiles.length !== 1) {
  throw new Error(
    `Ожидался один JS-файл, найдено ${jsFiles.length}. ` +
      'Собирайте через BUILD_SINGLE=1, иначе динамические чанки не попадут в файл.',
  )
}

const js = readFileSync(join(assets, jsFiles[0]), 'utf8')
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8')
const html = readFileSync('index.html', 'utf8')

const head = html.slice(0, html.indexOf('</head>'))
const title = /<title>(.*?)<\/title>/s.exec(head)?.[1] ?? 'LabMebel'
const icon = /<link rel="icon"[^>]*>/.exec(head)?.[0] ?? ''

const out = `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${icon}
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
<div id="root">
  <div style="height:100%;display:flex;align-items:center;justify-content:center;color:#98a2b6;font:14px system-ui,sans-serif;background:#10131a">Загружаем конструктор…</div>
</div>
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
</body>
</html>
`

mkdirSync('dist-single', { recursive: true })
writeFileSync('dist-single/labmebel.html', out)
console.log(`dist-single/labmebel.html — ${(out.length / 1024).toFixed(0)} КБ`)
