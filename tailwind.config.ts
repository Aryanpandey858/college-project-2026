import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS Configuration
 * Custom design tokens for the AI surveillance HUD:
 *  - Dark glassmorphic palette  (background → surface → border)
 *  - Threat severity colors     (danger, warning, accent)
 *  - Neon glow shadows          (shadow-glow-*)
 *  - CRT & radar animations     (radar-sweep, pulse-neon, scanline)
 *  - HUD typography             (font-mono stack)
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Color Palette ──────────────────────────────────────────────────────
      colors: {
        background: '#090d16',
        surface:    '#0f172a',
        'surface-2': '#111827',
        border:     '#1e293b',
        'border-2': '#334155',
        // Threat severity
        danger:  '#ef4444',
        'danger-dim': '#7f1d1d',
        warning: '#f59e0b',
        'warning-dim': '#78350f',
        accent:  '#10b981',
        'accent-dim': '#064e3b',
        // Muted text
        muted:   '#64748b',
        'muted-2': '#94a3b8',
      },

      // ── Box-Shadow Glow Utilities ──────────────────────────────────────────
      boxShadow: {
        'glow-danger':  '0 0 12px 2px rgba(239,68,68,0.55)',
        'glow-warning': '0 0 12px 2px rgba(245,158,11,0.55)',
        'glow-accent':  '0 0 12px 2px rgba(16,185,129,0.55)',
        'glow-blue':    '0 0 12px 2px rgba(59,130,246,0.55)',
        'inner-glow':   'inset 0 0 20px rgba(16,185,129,0.08)',
        'glass':        '0 8px 32px rgba(0,0,0,0.45)',
      },

      // ── Font Families ──────────────────────────────────────────────────────
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Courier New"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      // ── Keyframe Animations ────────────────────────────────────────────────
      keyframes: {
        // Radar sweep: 360° clockwise rotation
        'radar-sweep': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        // Neon pulse: breathing glow on borders / badges
        'pulse-neon': {
          '0%, 100%': { opacity: '1',  boxShadow: '0 0 8px 1px rgba(16,185,129,0.4)' },
          '50%':      { opacity: '0.7', boxShadow: '0 0 20px 4px rgba(16,185,129,0.7)' },
        },
        // Danger pulse for active threat alerts
        'pulse-danger': {
          '0%, 100%': { opacity: '1',  boxShadow: '0 0 8px 1px rgba(239,68,68,0.4)' },
          '50%':      { opacity: '0.8', boxShadow: '0 0 24px 6px rgba(239,68,68,0.75)' },
        },
        // Slide-in from right for incident drawer cards
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        // Fade-in for modals
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // CRT scanline scroll
        'scanline': {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
        // HUD blink — for "LIVE" indicators
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        // Subtle shimmer for glass panels
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      // ── Animation Shorthand ────────────────────────────────────────────────
      animation: {
        'radar-sweep':    'radar-sweep 4s linear infinite',
        'pulse-neon':     'pulse-neon 2s ease-in-out infinite',
        'pulse-danger':   'pulse-danger 1.2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':        'fade-in 0.2s ease-out both',
        'scanline':       'scanline 8s linear infinite',
        'blink':          'blink 1s step-start infinite',
        'shimmer':        'shimmer 3s linear infinite',
      },

      // ── Border Radius ──────────────────────────────────────────────────────
      borderRadius: {
        'glass': '12px',
      },

      // ── Backdrop Blur ──────────────────────────────────────────────────────
      backdropBlur: {
        'glass': '16px',
      },
    },
  },
  plugins: [],
};

export default config;
