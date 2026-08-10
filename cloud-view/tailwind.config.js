/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#36013F',
          light:   '#7b3f8c',
          dark:    '#1e0024',
        },
        teal: {
          DEFAULT: '#176161',
          light:   '#1e8a8a',
          dark:    '#0e4040',
        },
        pursue: {
          DEFAULT: '#d97706',
          light:   '#E0CD67',
          dark:    '#b45309',
        },
        surface: {
          DEFAULT: '#0d0a12',
          raised:  '#120f1a',
          high:    '#1a1628',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'mesh-hero': [
          'radial-gradient(ellipse 90% 60% at 60% -5%, rgba(54,1,63,0.35) 0%, transparent 60%)',
          'radial-gradient(ellipse 50% 40% at 5%  90%, rgba(23,97,97,0.15) 0%, transparent 55%)',
        ].join(', '),
      },
      boxShadow: {
        'glass':  '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glow':   '0 0 24px rgba(54,1,63,0.4)',
        'pursue': '0 0 20px rgba(217,119,6,0.20)',
        'gold':   '0 0 16px rgba(224,205,103,0.35)',
      },
    },
  },
  plugins: [],
}
