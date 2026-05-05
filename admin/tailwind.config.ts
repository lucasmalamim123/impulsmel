import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#D91E2E',
          ink: '#1F252B',
          gray: '#6B7280',
          soft: '#F3F4F6',
          line: '#E5E7EB',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        display: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
      },
      borderRadius: {
        brand: '8px',
      },
      boxShadow: {
        brand: '0 12px 30px rgba(31, 37, 43, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
