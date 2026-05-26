/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
      "./src/Sujith/**/*.{js,ts,jsx,tsx}", // 👈 මේ පේළිය එකතු කරන්න (Capital S)
    "./src/sujith/**/*.{js,ts,jsx,tsx}", // 👈 මේ පේළියත් එකතු කරන්න (Small s)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}