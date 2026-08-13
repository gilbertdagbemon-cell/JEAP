/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.html",
    "./public/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Vert fonce - couleur principale (base du livre du logo)
        "jeap-green": {
          DEFAULT: "#0F3D2E",
          light: "#1A5C45",
          dark: "#0A2B20"
        },
        // Jaune-orange - accent / CTA (flamme du logo)
        "jeap-accent": {
          DEFAULT: "#F2A93B",
          light: "#F7C067",
          dark: "#D98B1F"
        },
        "jeap-bg": "#FAFAF9"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    },
  },
  plugins: [],
}
