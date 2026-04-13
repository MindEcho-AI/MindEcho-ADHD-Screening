/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ─── MindEcho Design Tokens ─────────────────────────────────────────
      colors: {
        // Primary olive-green (from Figma headers/buttons)
        primary: {
          50:  '#f6f7ee',
          100: '#eaedcf',
          200: '#d4dba1',
          300: '#b8c36a',
          400: '#9aaa42',
          500: '#7a8f2c',  // main brand green
          600: '#6B7F3A',  // Figma header green
          700: '#526030',
          800: '#424d28',
          900: '#384124',
        },
        // Dark brown (Figma dark backgrounds, text)
        bark: {
          50:  '#fdf8f5',
          100: '#f5ede4',
          200: '#e8d3c0',
          300: '#d4ad8e',
          400: '#b8835a',
          500: '#9a6038',
          600: '#7a4828',
          700: '#5e3520',
          800: '#3D2314',  // Figma dark brown
          900: '#2C1810',  // deepest dark
        },
        // Cream/off-white backgrounds
        cream: {
          50:  '#fdfcf9',
          100: '#F5F0E8',  // Figma main background
          200: '#ede5d5',
          300: '#dfd5be',
        },
        // Status colors
        success: '#6B7F3A',
        warning: '#D97706',
        danger:  '#DC2626',
        // Likelihood badge colors
        likelihood: {
          low:    '#6B7F3A',
          medium: '#D97706',
          high:   '#DC2626',
        }
      },
      fontFamily: {
        // Rounded friendly heading font
        display: ['"Nunito"', 'system-ui', 'sans-serif'],
        // Clean body
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['2.5rem',  { lineHeight: '1.1', fontWeight: '800' }],
        'display-lg': ['2rem',    { lineHeight: '1.15', fontWeight: '700' }],
        'display-md': ['1.5rem',  { lineHeight: '1.2', fontWeight: '700' }],
        'display-sm': ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
      },
      borderRadius: {
        'card': '1.25rem',
        'btn':  '0.875rem',
        'pill': '9999px',
      },
      boxShadow: {
        'card':  '0 2px 16px 0 rgba(44, 24, 16, 0.08)',
        'card-hover': '0 8px 32px 0 rgba(44, 24, 16, 0.16)',
        'sidebar': '4px 0 24px 0 rgba(44, 24, 16, 0.1)',
      },
      spacing: {
        'sidebar': '260px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow':  'spin 3s linear infinite',
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(-16px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
