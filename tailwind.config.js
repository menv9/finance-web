/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      wide: '1680px',
    },
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-sunken': 'var(--surface-sunken)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
          inverse: 'var(--ink-inverse)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
        },
        positive: {
          DEFAULT: 'var(--positive)',
          soft: 'var(--positive-soft)',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
        xs: ['0.75rem', { lineHeight: '1.1rem', letterSpacing: '0.04em' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.55rem' }],
        lg: ['1.125rem', { lineHeight: '1.65rem' }],
        xl: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.75rem', { lineHeight: '2.05rem', letterSpacing: '-0.02em' }],
        '3xl': ['2.25rem', { lineHeight: '2.4rem', letterSpacing: '-0.03em' }],
        '4xl': ['3.25rem', { lineHeight: '3.2rem', letterSpacing: '-0.035em' }],
        '5xl': ['4.5rem', { lineHeight: '4.3rem', letterSpacing: '-0.04em' }],
      },
      spacing: {
        gutter: '1.5rem',
        rhythm: '2rem',
        section: '4rem',
      },
      maxWidth: {
        wide: '1680px',
        prose: '68ch',
      },
      borderRadius: {
        none: '0',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '999px',
      },
      boxShadow: {
        hairline: '0 0 0 1px var(--rule)',
        soft: '0 1px 0 var(--rule), 0 12px 32px -20px rgba(0,0,0,0.35)',
        lift: '0 1px 0 var(--rule), 0 24px 48px -24px rgba(0,0,0,0.45)',
        'focus-ring': '0 0 0 2px var(--canvas), 0 0 0 4px var(--accent)',
      },
      letterSpacing: {
        eyebrow: '0.18em',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        120: '120ms',
        180: '180ms',
        220: '220ms',
        360: '360ms',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        rise: 'rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
