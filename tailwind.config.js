/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070708",
        panel: "#111114",
        raised: "#18181c",
        paper: "#f4f4f5",
        muted: "#9a9aa3",
        subtle: "#6b6b74",
        line: "#222228",
        esred: "#E10600",
        ok: "#3d9a6a",
        warn: "#c4a15a",
      },
      borderRadius: {
        card: "15px",
        lg: "15px",
        md: "10px",
      },
      fontFamily: {
        sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
