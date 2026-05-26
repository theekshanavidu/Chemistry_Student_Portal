import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/Chemistry_Student_Portal/',
  plugins: [
    tailwindcss(),
    react(),
  ],
})
