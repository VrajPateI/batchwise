import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ], // <--- The plugins array ENDS here.

  // The server config starts separately here:
  server: {
    host: true,
  },
})