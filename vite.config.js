import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// No dev proxy: PHP runs under Laragon's own Apache on its own port,
// and the frontend reaches it via the apiBase in .config.json instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
