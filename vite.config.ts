import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * BUILD_SINGLE=1 — сборка под склейку в один HTML: динамические чанки
 * (таблицы LTC для площадного света) вшиваются в основной файл.
 */
const single = process.env.BUILD_SINGLE === '1'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: single ? { output: { inlineDynamicImports: true } } : undefined,
  },
})
