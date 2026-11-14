/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ivory: 'rgb(var(--ivory) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface2: 'rgb(var(--surface-2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ink-soft) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        stone: 'rgb(var(--stone) / <alpha-value>)',
        sage: 'rgb(var(--sage) / <alpha-value>)',
        'sage-soft': 'rgb(var(--sage-soft) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['"Noto Serif Display"', '"Noto Serif JP"', 'Georgia', 'serif'],
        sans: ['Inter', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        editorial: '0.22em',
        wide2: '0.34em',
      },
      borderRadius: {
        card: '12px',
        field: '9px',
        button: '8px',
        modal: '16px',
      },
      boxShadow: {
        paper: '0 1px 2px rgba(41, 43, 41, 0.035), 0 18px 44px -36px rgba(41, 43, 41, 0.3)',
        lift: '0 30px 80px -36px rgba(30, 31, 28, 0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
