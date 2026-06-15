// tailwind.config.js
/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
  darkMode: 'class', // enable class-based dark mode
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Aligned with Design System Studio naming convention
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        border: 'var(--border)',
        ring: 'var(--ring)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        success: 'var(--success)',
        'success-foreground': 'var(--success-foreground)',
        warning: 'var(--warning)',
        'warning-foreground': 'var(--warning-foreground)',
        info: 'var(--info)',
        'info-foreground': 'var(--info-foreground)',
        premium: 'var(--premium)',
        'premium-foreground': 'var(--premium-foreground)',
        input: 'var(--input)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: '9999px',
      },
      spacing: {
        // Semantic sizing tokens for consistent UI dimensions
        'sidebar-collapsed': '70px',
        'sidebar-expanded': '280px',
        'dropdown-narrow': '70px',
        'dropdown-medium': '120px',
        'dropdown-standard': '160px',
        'dropdown-wide': '200px',
        'truncate-small': '150px',
        'truncate-medium': '200px',
        'truncate-large': '300px',
        'image-preview': '300px',
        'image-preview-large': '400px',
        'form-spacer': '100px',
        'command-list': '300px',
        'map-min-height': '500px',
        'textarea-min': '80px',
      },
      minWidth: {
        'dropdown-medium': '120px',
        'dropdown-standard': '160px',
        'dropdown-wide': '200px',
      },
      maxWidth: {
        'truncate-small': '150px',
        'truncate-medium': '200px',
        'truncate-large': '300px',
      },
      minHeight: {
        'textarea': '80px',
        'map': '500px',
      },
      maxHeight: {
        'command-list': '300px',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}

export default tailwindConfig
