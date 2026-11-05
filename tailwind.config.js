/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050507",
        panel: "#0d0d12",
        raised: "#14141b",
        // Form fields and message bubbles (bg-surface was used before it existed, so textareas fell back to white).
        surface: "#101017",
        accent: "#e10600",
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
        // One corner for cards, buttons and inputs: the --radius token (15px) in es-system.css.
        card: "var(--radius, 15px)",
        sm: "var(--radius, 15px)",
        md: "var(--radius, 15px)",
        lg: "var(--radius, 15px)",
        xl: "var(--radius, 15px)",
        "2xl": "var(--radius, 15px)",
        "3xl": "var(--radius, 15px)",
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
