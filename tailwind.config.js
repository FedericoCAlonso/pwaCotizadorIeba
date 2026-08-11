/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ieba: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde047',
          300: '#facc15',
          400: '#eab308',
          500: '#ca8a04', // Amber/Electric Gold primary
          600: '#a16207',
          700: '#854d0e',
          800: '#713f12',
          900: '#422006',
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155'
        },
        surface: {
          DEFAULT: 'rgba(30, 41, 59, 0.5)',
          light: 'rgba(51, 65, 85, 0.3)',
          deep: 'rgba(15, 23, 42, 0.6)',
        }
      }
    },
  },
  plugins: [],
}
