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
        // Primary brand font — cross-platform consistent (no Avenir/Segoe drift)
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // Breakpoint strategy: 375 mobile, 640 sm, 768 md/tablet, 1024 lg/desktop, 1280 xl/wide
      // All responsive classes should use these standard Tailwind breakpoints only.
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
        },
        // Oli logo "thinking" — slow continuous rotation with subtle scale pulse
        oliThink: {
          '0%':   { transform: 'rotate(0deg)   scale(1)' },
          '25%':  { transform: 'rotate(90deg)  scale(1.08)' },
          '50%':  { transform: 'rotate(180deg) scale(1)' },
          '75%':  { transform: 'rotate(270deg) scale(1.08)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        // Individual dot fade for "Thinking..." text
        thinkDot: {
          '0%, 60%, 100%': { opacity: '0' },
          '30%':            { opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        'fade-in': 'fadeInUp 200ms ease-out forwards',
        'bounce-dot': 'bounce 1s infinite',
        'oli-think': 'oliThink 2s ease-in-out infinite',
        'think-dot': 'thinkDot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [typography],
} satisfies Config;
