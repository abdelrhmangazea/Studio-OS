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
        <p className="t-section">{label}</p>
        {/* RULE 2 — the value is NOT accented. Five accented numbers on
            one dashboard is five things shouting, which is the same as
            none of them shouting. The drill-in line below carries the
            affordance instead. */}
        <p className="t-metric mt-1.5 text-text">{value}</p>
        {note && <p className="t-meta mt-1.5 text-text-secondary">{note}</p>}
        {count > 0 && (
          <p className="t-meta mt-2 text-accent">
            {open ? t('insights.hideList') : t('insights.showList', { count })}
          </p>
        )}
      </button>

      {open && (
        <ul className="mt-3 space-y-1 border-t border-separator-soft pt-3">
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
