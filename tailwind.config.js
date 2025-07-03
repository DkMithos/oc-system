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
    },
  },

  plugins: [],
}

