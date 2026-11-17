/** @type {import('tailwindcss').Config} */
// Identidade visual: Design System CIEP · ETIM Senac RJ (roxo Senac #492983, laranja #EC6608,
// amarelo #FFCD04, neutros arroxeados, Montserrat, formas arredondadas).
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
      },
      colors: {
        // roxo Senac (cor institucional / primária)
        brand: {
          50: '#F6F3FA',
          100: '#ECE7F4',
          200: '#C9B8DD',
          300: '#A98FCB',
          400: '#7B57A0',
          500: '#64358C',
          600: '#492983',
          700: '#3E2272',
          800: '#331C5C',
          900: '#252350',
        },
        // acentos do kit ETIM
        senac: {
          laranja: '#EC6608',
          amarelo: '#FFCD04',
          ciano: '#00AFCB',
          coral: '#EA5153',
          menta: '#84C59E',
        },
        // neutros arroxeados e mornos (o sistema não usa cinza puro nem preto)
        slate: {
          50: '#F8F5F6',
          100: '#F3ECEB',
          200: '#EBDFE1',
          300: '#D6D1DE',
          400: '#887C9B',
          500: '#6E6280',
          600: '#60556C',
          700: '#492983',
          800: '#472682',
          900: '#252350',
        },
      },
    },
  },
  plugins: [],
}
