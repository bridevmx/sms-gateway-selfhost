import { sveltekit } from '@sveltejs/kit/vite'
import adapter from '@sveltejs/adapter-static'
import tailwindcss from '@tailwindcss/vite'

export default {
  plugins: [tailwindcss(), sveltekit({ adapter: adapter({ fallback: 'index.html' }) })],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8090' },
  },
}
