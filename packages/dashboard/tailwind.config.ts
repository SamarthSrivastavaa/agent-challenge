import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sovereign: {
          bg: "#0A0A0F",
          surface: "#111118",
          border: "#1E1E2E",
          accent: "#7C3AED",
          accent2: "#06B6D4",
          text: "#E2E8F0",
          muted: "#64748B",
          success: "#10B981",
          danger: "#EF4444",
          warning: "#F59E0B",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
