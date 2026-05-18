/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Deep midnight-navy sidebar palette (petroleum blue, not coal black)
        ink: {
          950: '#0e2057',   // midnight navy — was #04080f
          900: '#142d78',   // deep royal navy — was #080f1c
          800: '#1a3598',   // royal blue — was #0c1627
          700: '#1e40af',   // Tailwind blue-800 — was #101f36
          600: '#2554d4',   // bright royal — was #152847
          500: '#3b7ef8',   // lighter royal — was #1e3a6e
        },
        // Amber / petrol brand accent
        petrol: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Surface / background — very slightly warm
        canvas: '#f4f6fb',
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'card-lift':  '0 8px 24px -4px rgb(0 0 0 / 0.13), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
        'sidebar':    '4px 0 24px 0 rgb(14 32 87 / 0.40)',
        'bottom-nav': '0 -1px 12px 0 rgb(0 0 0 / 0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      backgroundImage: {
        // Midnight navy → royal blue — NOT coal black
        'sidebar-gradient': 'linear-gradient(160deg, #0e2057 0%, #152e80 60%, #1a3a9e 100%)',
        'card-shine':       'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)',
        // Net-worth hero card: rich royal blue gradient
        'networth-dark':    'linear-gradient(135deg, #0e1f6e 0%, #1a3598 50%, #1e40af 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
