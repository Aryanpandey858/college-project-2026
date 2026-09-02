import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS Configuration:
 * Minimalist slate dark-mode palette tailored for high-contrast surveillance HUD interfaces.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#0f172a',
        border: '#1e293b',
        danger: '#ef4444',
        warning: '#f59e0b',
        accent: '#10b981',
      },
    },
  },
  plugins: [],
};

export default config;
