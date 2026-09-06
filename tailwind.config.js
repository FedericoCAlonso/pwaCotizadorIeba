/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--md-sys-color-primary)',
        'on-primary': 'var(--md-sys-color-on-primary)',
        'primary-container': 'var(--md-sys-color-primary-container)',
        'on-primary-container': 'var(--md-sys-color-on-primary-container)',
        secondary: 'var(--md-sys-color-secondary)',
        'on-secondary': 'var(--md-sys-color-on-secondary)',
        'secondary-container': 'var(--md-sys-color-secondary-container)',
        'on-secondary-container': 'var(--md-sys-color-on-secondary-container)',
        tertiary: 'var(--md-sys-color-tertiary)',
        'on-tertiary': 'var(--md-sys-color-on-tertiary)',
        'tertiary-container': 'var(--md-sys-color-tertiary-container)',
        'on-tertiary-container': 'var(--md-sys-color-on-tertiary-container)',
        error: 'var(--md-sys-color-error)',
        'on-error': 'var(--md-sys-color-on-error)',
        'error-container': 'var(--md-sys-color-error-container)',
        'on-error-container': 'var(--md-sys-color-on-error-container)',
        background: 'var(--md-sys-color-background)',
        'on-background': 'var(--md-sys-color-on-background)',
        surface: 'var(--md-sys-color-surface)',
        'on-surface': 'var(--md-sys-color-on-surface)',
        'surface-variant': 'var(--md-sys-color-surface-variant)',
        'on-surface-variant': 'var(--md-sys-color-on-surface-variant)',
        outline: 'var(--md-sys-color-outline)',
        'outline-variant': 'var(--md-sys-color-outline-variant)',
        'surface-container-lowest': 'var(--md-sys-color-surface-container-lowest)',
        'surface-container-low': 'var(--md-sys-color-surface-container-low)',
        'surface-container': 'var(--md-sys-color-surface-container)',
        'surface-container-high': 'var(--md-sys-color-surface-container-high)',
        'surface-container-highest': 'var(--md-sys-color-surface-container-highest)',
        
        // Mantener compatibilidad con colores ieba en caso de que falten reemplazar
        ieba: {
          400: '#eab308',
          500: '#ca8a04',
        }
      },
      boxShadow: {
        'md3-1': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        'md3-2': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
        'md3-3': '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        // Material Design 3 Type Scale
        'display-lg': ['3.5rem', { lineHeight: '4rem', letterSpacing: '-0.015em', fontWeight: '400' }],
        'display-md': ['2.8125rem', { lineHeight: '3.25rem', letterSpacing: '0', fontWeight: '400' }],
        'display-sm': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '0', fontWeight: '400' }],
        'headline-lg': ['2rem', { lineHeight: '2.5rem', letterSpacing: '0', fontWeight: '400' }],
        'headline-md': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '0', fontWeight: '400' }],
        'headline-sm': ['1.5rem', { lineHeight: '2rem', letterSpacing: '0', fontWeight: '400' }],
        'title-lg': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '0', fontWeight: '400' }],
        'title-md': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0.009em', fontWeight: '500' }],
        'title-sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.007em', fontWeight: '500' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0.03em', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.018em', fontWeight: '400' }],
        'body-sm': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.025em', fontWeight: '400' }],
        'label-lg': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.007em', fontWeight: '500' }],
        'label-md': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.03em', fontWeight: '500' }],
        'label-sm': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.03em', fontWeight: '500' }],
      }
    },
  },
  plugins: [],
}
