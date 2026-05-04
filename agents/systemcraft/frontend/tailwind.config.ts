import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#06111f',
          900: '#0f172a',
          800: '#162033',
          700: '#233149',
        },
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      boxShadow: {
        glow: '0 24px 80px rgba(15, 23, 42, 0.28)',
        panel: '0 20px 40px rgba(15, 23, 42, 0.16)',
      },
      backgroundImage: {
        aurora:
          'radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 35%), radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))',
        'aurora-dark':
          'radial-gradient(circle at top left, rgba(59,130,246,0.24), transparent 30%), radial-gradient(circle at top right, rgba(56,189,248,0.16), transparent 28%), linear-gradient(180deg, rgba(6,17,31,0.98), rgba(15,23,42,0.95))',
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
        pulseSoft: 'pulseSoft 2.8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.65' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
