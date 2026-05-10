/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Direct path to the library files (Bypassing the helper)
    "node_modules/flowbite-react/dist/esm/**/*.js"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // Direct plugin requirement
    require('flowbite/plugin')
  ],
}