/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tous les gabarits Django et les scripts qui contiennent des classes Tailwind
  content: ["./templates/**/*.html", "./**/templates/**/*.html", "./static/**/*.js"],
  theme: { extend: {} },
  plugins: [],
};
