/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d8f1ff',
          500: '#2eb4f3',
          600: '#1499d6',
          900: '#10456b'
        }
      },
      boxShadow: {
        soft: '0 12px 35px -10px rgba(20, 153, 214, 0.25)'
      }
    },
  },
  plugins: [],
};
