/** @type {import('tailwindcss').Config} */
//
// Design tokens for ReviewHub.
//
// Brand scale + semantic roles (success, warning, danger, info). Every
// non-trademark hex in JSX should reach for one of these scales instead of
// hardcoding Tailwind defaults or raw hex — that's what keeps the theme
// swappable and makes dark-mode + future re-brands a one-file change.
//
// Platform trademark colors (Google #4285F4, Yelp #d32323, Facebook #1877F2
// etc.) remain hardcoded in the platform-mark SVGs because they are the
// actual registered brand colors of those companies and cannot be re-themed.

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Semantic roles — map to Tailwind's standard palette so existing
        // `bg-green-*`/`text-red-*` usages already align with these tokens.
        // New code should prefer the semantic name (`bg-success-50`) over
        // the palette name (`bg-green-50`) so intent is encoded.
        success: {
          50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 900: '#14532d',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 900: '#78350f',
        },
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 900: '#7f1d1d',
        },
        info: {
          50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
