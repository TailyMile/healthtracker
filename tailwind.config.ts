import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        sky: "#f0f9ff",
        primary: "#0ea5e9",
        accent: "#10b981"
      }
    }
  },
  plugins: []
};

export default config;
