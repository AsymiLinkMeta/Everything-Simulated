/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050507",
        panel: "#0d0d12",
        raised: "#14141b",
        gloss: "#1c1c26",
        paper: "#ffffff",
        muted: "#c8c8d0",
        subtle: "#7a7a85",
        line: "#2a2a35",
        esred: "#e10600",
        "esred-bright": "#ff1410",
        "esred-dim": "#b00500",
        ok: "#3d9a6a",
        warn: "#c4a15a",
      },
      borderRadius: {
        card: "12px",
        lg: "16px",
        md: "12px",
        sm: "8px",
      },
      fontFamily: {
        sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "red-glow": "0 0 20px rgba(225, 6, 0, 0.35)",
        "red-glow-lg": "0 0 40px rgba(225, 6, 0, 0.25), 0 0 8px rgba(225, 6, 0, 0.15)",
      },
    },
  },
  plugins: [],
};
