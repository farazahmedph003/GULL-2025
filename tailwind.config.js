/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        // Custom responsive breakpoints without overriding Tailwind defaults
        xs: '480px',      // Mobile
        tablet: '768px',  // Tablet
        desktop: '1200px' // Desktop
      },
      colors: {
        // Dashboard Design System v3.0 - Complete Implementation
        
        // Brand Colors (Indigo/Purple)
        primary: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
        },
        secondary: {
          DEFAULT: '#8B5CF6',
          light: '#A78BFA',
          dark: '#7C3AED',
        },
        
        // Light Mode Backgrounds (Pure White)
        'bg-light': {
          primary: '#FFFFFF',
          secondary: '#F9FAFB',
          tertiary: '#F3F4F6',
          elevated: '#FFFFFF',
          card: '#FFFFFF',
          widget: '#FFFFFF',
          panel: '#F9FAFB',
          hover: '#F3F4F6',
        },
        
        // Light Mode Text Hierarchy
        'text-light': {
          primary: '#111827',
          secondary: '#4B5563',
          tertiary: '#6B7280',
          quaternary: '#9CA3AF',
          disabled: '#D1D5DB',
          inverse: '#FFFFFF',
        },
        
        // Light Mode Borders
        'border-light': {
          subtle: '#F3F4F6',
          DEFAULT: '#E5E7EB',
          medium: '#D1D5DB',
          strong: '#9CA3AF',
        },
        
        // Dark Mode Backgrounds (Deep Navy)
        'bg-dark': {
          primary: '#1A1D29',
          secondary: '#20232F',
          tertiary: '#282B36',
          elevated: '#2D3040',
          card: '#252837',
          widget: '#2D3040',
          panel: '#252837',
          hover: '#33364A',
        },
        
        // Dark Mode Text Hierarchy
        'text-dark': {
          primary: '#F9FAFB',
          secondary: '#D1D5DB',
          tertiary: '#9CA3AF',
          quaternary: '#6B7280',
          disabled: '#4B5563',
          inverse: '#111827',
        },
        
        // Dark Mode Borders
        'border-dark': {
          subtle: '#2D3040',
          DEFAULT: '#33364A',
          medium: '#3D4254',
          strong: '#4B5563',
        },
        
        // Status Colors
        success: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
          bg: '#D1FAE5',
          'bg-dark': 'rgba(16, 185, 129, 0.15)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
          bg: '#FEF3C7',
          'bg-dark': 'rgba(245, 158, 11, 0.15)',
        },
        error: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dark: '#DC2626',
          bg: '#FEE2E2',
          'bg-dark': 'rgba(239, 68, 68, 0.15)',
        },
        info: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
          dark: '#2563EB',
          bg: '#DBEAFE',
          'bg-dark': 'rgba(59, 130, 246, 0.15)',
        },
        
        // Widget Colors - Light & Dark Variants
        'widget-yellow': {
          light: '#FEF3C7',
          dark: 'rgba(251, 191, 36, 0.2)',
          text: '#92400E',
          'text-dark': '#FCD34D',
          icon: '#F59E0B',
        },
        'widget-orange': {
          light: '#FFEDD5',
          dark: 'rgba(249, 115, 22, 0.2)',
          text: '#9A3412',
          'text-dark': '#FDBA74',
          icon: '#F97316',
        },
        'widget-green': {
          light: '#D1FAE5',
          dark: 'rgba(16, 185, 129, 0.2)',
          text: '#065F46',
          'text-dark': '#6EE7B7',
          icon: '#10B981',
        },
        'widget-blue': {
          light: '#DBEAFE',
          dark: 'rgba(59, 130, 246, 0.2)',
          text: '#1E40AF',
          'text-dark': '#93C5FD',
          icon: '#3B82F6',
        },
        'widget-purple': {
          light: '#EDE9FE',
          dark: 'rgba(139, 92, 246, 0.2)',
          text: '#5B21B6',
          'text-dark': '#C4B5FD',
          icon: '#8B5CF6',
        },
        'widget-pink': {
          light: '#FCE7F3',
          dark: 'rgba(236, 72, 153, 0.2)',
          text: '#9F1239',
          'text-dark': '#F9A8D4',
          icon: '#EC4899',
        },
      },
      
      // Typography System
      fontFamily: {
        primary: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        secondary: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['SF Mono', 'Roboto Mono', 'Fira Code', 'Consolas', 'monospace'],
        reading: ['Georgia', 'Times New Roman', 'serif'],
      },
      
      fontSize: {
        'xs': ['0.625rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        'sm': ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.01em' }],
        'base': ['0.875rem', { lineHeight: '1.375rem', letterSpacing: '0' }],
        'md': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.875rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
      },
      
      // Border Radius System
      borderRadius: {
        'sm': '0.375rem',
        'base': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        'full': '9999px',
      },
      
      // Shadows System
      boxShadow: {
        'sm-light': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'md-light': '0 4px 6px -1px rgba(0, 0, 0, 0.06)',
        'lg-light': '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
        'xl-light': '0 20px 25px -5px rgba(0, 0, 0, 0.10)',
        'sm-dark': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'md-dark': '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
        'lg-dark': '0 10px 15px -3px rgba(0, 0, 0, 0.6)',
        'xl-dark': '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
      },
      
      // Animation Durations
      transitionDuration: {
        'instant': '100ms',
        'fast': '200ms',
        'normal': '300ms',
        'slow': '500ms',
        'slower': '700ms',
      },
      
      // Animation Timing Functions
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      
      // Spacing Scale (already included by default, but documented here)
      // Uses 4px base unit: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24
    },
  },
  plugins: [],
}

