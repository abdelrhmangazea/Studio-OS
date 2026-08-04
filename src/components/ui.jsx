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

export function WarningText({ children }) {
  if (!children) return null
  return <p className="text-sm text-warning">{children}</p>
}

/** A small coloured pill. Used for lead statuses and lead/client type. */
export function Badge({ color, children }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs"
      style={color ? { borderColor: color, color } : undefined}
    >
      {color && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </span>
  )
}

/**
 * Slides in from the inline end — the right in English, the left in
 * Arabic. `inset-inline-end` handles the mirroring, so there is no
 * direction check anywhere in this component.
 */
export function SidePanel({ open, title, onClose, children, footer }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="absolute inset-y-0 flex w-full max-w-md flex-col border-s border-border bg-surface"
        style={{ insetInlineEnd: 0 }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-text-secondary hover:text-text"
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="flex items-center gap-3 border-t border-border px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

/** Centred confirmation dialog. */
export function Modal({ open, title, onClose, children, footer, wide = false }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative flex max-h-[85vh] w-full flex-col rounded border border-border bg-surface ${
          wide ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-text-secondary hover:text-text"
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Horizontal tab strip. `tabs` is [{ key, label, disabled }]. */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => !tab.disabled && onChange(tab.key)}
          className={
            'relative px-4 py-2.5 text-sm transition-colors ' +
            (tab.key === active
              ? 'text-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent'
              : tab.disabled
                ? 'cursor-default text-text-secondary/50'
                : 'text-text-secondary hover:text-text')
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={
        'w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text ' +
        'placeholder:text-text-secondary focus:border-accent focus:outline-none ' +
        `focus:ring-1 focus:ring-accent ${className}`
      }
      {...props}
    />
  )
}

export function EmptyState({ children }) {
  return (
    <div className="rounded border border-dashed border-border p-10 text-center">
      <p className="text-sm text-text-secondary">{children}</p>
    </div>
  )
}
