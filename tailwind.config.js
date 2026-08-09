/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Every colour points at a CSS variable defined in src/index.css.
      // A raw hex in a component is a dark-mode bug nobody notices
      // until a customer does.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        separator: 'var(--separator)',
        'separator-soft': 'var(--separator-soft)',
        border: 'var(--separator)',

        text: 'var(--text)',
        'text-secondary': 'var(--text-secondary)',
        'text-disabled': 'var(--text-disabled)',

        accent: 'var(--accent)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        muted: 'var(--muted)',

        // Foreground for a saturated fill. Never write text-white on
        // one of these — white is unreadable on dark mode's #30d158.
        'on-accent': 'var(--on-accent)',
        'on-success': 'var(--on-success)',
        'on-warning': 'var(--on-warning)',
        'on-danger': 'var(--on-danger)',

        // Tinted blocks: soft fill, own readable text colour.
        'success-bg': 'var(--success-bg)',
        'success-text': 'var(--success-text)',
        'warning-bg': 'var(--warning-bg)',
        'warning-text': 'var(--warning-text)',
        'danger-bg': 'var(--danger-bg)',
        'danger-text': 'var(--danger-text)',

        scrim: 'var(--scrim)',

        // The document preview. White in both themes by design — it is
        // a picture of the exported page, not app chrome.
        paper: 'var(--paper)',
        'paper-text': 'var(--paper-text)',
      },

      // RULE 1 — radius belongs to containers, not to rows.
      // Cards and panels 18px; buttons and pills 12-14px; rows inside a
      // card are flat with a hairline. Forty rounded cards in a leads
      // table is unreadable.
      borderRadius: {
        card: '18px',
        control: '12px',
        pill: '14px',
      },

      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Cairo', 'sans-serif'],
      },

      // 400 body, 600 emphasis, 700 headings and numbers. Nothing else.
      fontWeight: {
        normal: '400',
        medium: '600',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [],
}
