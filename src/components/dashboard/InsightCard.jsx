import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../ui'

/**
 * One insight number, and the list behind it.
 *
 * The number is a button: clicking it opens the exact rows it was
 * computed from. A figure you cannot drill into is a figure you stop
 * trusting, so there is no such figure on this dashboard.
 */
export default function InsightCard({ label, value, note, rows, render, t }) {
  const [open, setOpen] = useState(false)
  const count = rows?.length ?? 0

  return (
    <Card>
      <button
        onClick={() => count > 0 && setOpen(!open)}
        disabled={count === 0}
        className="w-full text-start disabled:cursor-default"
      >
        <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
        <p
          className={
            'mt-1 text-2xl font-semibold ' + (count > 0 ? 'text-accent' : 'text-text')
          }
        >
          {value}
        </p>
        {note && <p className="mt-1 text-xs text-text-secondary">{note}</p>}
        {count > 0 && (
          <p className="mt-2 text-xs text-text-secondary">
            {open ? t('insights.hideList') : t('insights.showList', { count })}
          </p>
        )}
      </button>

      {open && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {rows.map((row, index) => {
            const item = render(row)
            return (
              <li key={index} className="text-sm">
                <Link to={item.to} className="text-accent hover:underline">
                  {item.text}
                </Link>
                {item.hint && (
                  <span className="text-xs text-text-secondary"> · {item.hint}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
