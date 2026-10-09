/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eaf7f1', 100: '#d5f0e3', 200: '#ade0c7', 300: '#78cba1', 400: '#3cae78', 500: '#178d5e', 600: '#087a52', 700: '#086143', 800: '#084d38', 900: '#073f30' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 6px 24px rgba(18, 44, 36, .06)' },
      borderRadius: { '2xl': '1rem' },
    },
  },
  plugins: [],
}
