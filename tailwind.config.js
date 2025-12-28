/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        boulangerie: {
          50: '#fefdf9',
          100: '#fdf9f0',
          200: '#faf1dc',
          300: '#f5e7c8',
          400: '#efd09f',
          500: '#e8b976',
          600: '#d4a76a',
          700: '#b88b59',
          800: '#926f47',
          900: '#785a3a',
        },
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}