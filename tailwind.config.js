/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        memphisYellow: "#fbc102",
        memphisGray: "#5f5f5f",
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(200%)' },
        },
        dotPulse: {
          '0%, 80%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '40%':           { opacity: '1',   transform: 'scale(1.2)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer:    'shimmer 1.4s infinite',
        dotPulse:   'dotPulse 1.2s ease-in-out infinite',
        fadeInUp:   'fadeInUp 0.5s ease both',
      },
    },
  },

  plugins: [],
}

