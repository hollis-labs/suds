import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        terminal: {
          bg: "#0a0a0a",
          "bg-alt": "#111111",
          green: "#33ff33",
          "green-dim": "#1a8a1a",
          amber: "#ffaa00",
          "amber-dim": "#8a5500",
          blue: "#3399ff",
          red: "#ff3333",
          purple: "#cc66ff",
          gold: "#ffcc00",
          white: "#cccccc",
          "white-bright": "#ffffff",
          border: "#333333",
          "border-bright": "#555555",
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        "typing-cursor": "blink 0.7s step-end infinite",
        scanline: "scanline 8s linear infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        glow: {
          "0%": { textShadow: "0 0 5px currentColor" },
          "100%": { textShadow: "0 0 15px currentColor, 0 0 30px currentColor" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
