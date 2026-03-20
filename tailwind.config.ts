import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0D1117',
        surface: '#161C23',
        primary: '#2EA043',
        brand: '#2D6A4F',
        accent: '#4ADE80',
        muted: '#8B949E',
        border: '#21262D',
        foreground: '#F0F6FC',
      },
      borderRadius: {
        bubble: '18px',
        card: '12px',
        input: '22px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-25%)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        'fade-in': 'fadeInUp 200ms ease-out forwards',
        'bounce-dot': 'bounce 1s infinite',
      },
    },
  },
  plugins: [typography],
} satisfies Config;
