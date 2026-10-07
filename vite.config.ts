import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the same build works locally and under the GitHub Pages path (/3DIhminen/).
  base: './',
  plugins: [react()],
  build: {
    // Two pages: the Lihastohtori app and the Tapan Kaikki 3 game (tk3.html, src/tk3).
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), tk3: resolve(import.meta.dirname, 'tk3.html') } },
  },
})
