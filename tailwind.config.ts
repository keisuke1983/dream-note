import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        paper: "#fbfaf7",
        moss: "#607466",
        leaf: "#8aa47d",
        clay: "#c47f5b",
        dawn: "#e7b86d",
        mist: "#e8ece4"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(31, 41, 51, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
