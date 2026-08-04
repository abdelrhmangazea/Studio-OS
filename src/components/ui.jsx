/**
 * The shared building blocks. Flat by design — no shadows, no gradients.
 * Every colour here is a theme variable, so these adapt to dark/light
 * and to RTL without any extra work in the pages that use them.
 */

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium ' +
    'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg'

  const variants = {
    primary: 'bg-accent text-white hover:opacity-90',
    secondary: 'bg-surface text-text border border-border hover:border-accent',
    ghost: 'text-text-secondary hover:text-text',
    danger: 'bg-danger text-white hover:opacity-90',
  }

  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={
        'w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text ' +
        'placeholder:text-text-secondary focus:border-accent focus:outline-none ' +
        `focus:ring-1 focus:ring-accent ${className}`
      }
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={
        'w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text ' +
        `focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`
      }
      {...props}
    >
      {children}
    </select>
  )
}

/** A labelled form row. `hint` sits under the control in muted text. */
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-secondary">{hint}</span>}
    </label>
  )
}

export function Card({ className = '', children }) {
  return (
    <div className={`rounded border border-border bg-surface p-6 ${className}`}>{children}</div>
  )
}

export function PageTitle({ children, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-text">{children}</h1>
      {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
    </div>
  )
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-text">{children}</h2>
      {hint && <p className="mt-1 text-sm text-text-secondary">{hint}</p>}
    </div>
  )
}

export function ErrorText({ children }) {
  if (!children) return null
  return <p className="text-sm text-danger">{children}</p>
}
