import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the same build works locally and under the GitHub Pages path (/3DIhminen/).
  base: './',
  plugins: [react()],
})
