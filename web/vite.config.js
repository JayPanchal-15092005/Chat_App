import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Expose env vars with VITE_ or API_ prefix to browser (import.meta.env)
  envPrefix: ['VITE_', 'API_'],
})
