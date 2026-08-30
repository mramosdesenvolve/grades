/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b9d0ff',
          300: '#8bb0ff',
          400: '#5a87ff',
          500: '#3763f7',
          600: '#2544ec',
          700: '#1f36d1',
          800: '#202fa8',
          900: '#202c85',
        },
      },
    },
  },
  plugins: [],
}
