import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ✅ You do NOT import tailwindcss or scrollbar here
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()],
})
