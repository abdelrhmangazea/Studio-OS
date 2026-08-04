/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Every colour points at a CSS variable defined in src/index.css.
      // Nothing in this app should ever use a raw hex value — that is
      // what makes the dark/light switch work everywhere at once.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        text: 'var(--text)',
        'text-secondary': 'var(--text-secondary)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        muted: 'var(--muted)',
      },
      // Inter has no Arabic glyphs, so Arabic text falls through to
      // Cairo automatically. One stack works for both languages.
      fontFamily: {
        sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
