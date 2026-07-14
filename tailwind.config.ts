import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4f8',
          100: '#d6e6f0',
          200: '#b3d0e3',
          300: '#7eb0d0',
          500: '#1a5a8a',
          600: '#0f3d64',
          700: '#0c3254',
          800: '#0a2d47',
          900: '#082338',
        },
      },
    },
  },
  plugins: [],
}
export default config
