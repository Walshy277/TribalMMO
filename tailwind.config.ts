import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tribal: {
          50: '#fdf8f0',
          100: '#f5e6cc',
          200: '#e8c999',
          300: '#d4a766',
          400: '#c48b3d',
          500: '#a67329',
          600: '#8b5e1f',
          700: '#6b471a',
          800: '#4a3115',
          900: '#2d1f0f',
          950: '#1a1108',
        },
      },
    },
  },
  plugins: [],
};
export default config;
