import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * The dashboard's chart primitives. Plain SVG and flexbox — no chart
 * library, because five small charts do not justify 200 KB and the
 * product's rules (one hue, thin marks, hairline grid, text in text
 * colours) are easier to keep when every mark is written here.
 *
 * Colours come from the --chart-* tokens in index.css, validated for
 * both themes. Status colours only ever appear next to a label.
 */

const LOCALE = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' }
const locale = (language) => LOCALE[language] ?? LOCALE.en

export function formatNumber(value, language) {
  return Number(value ?? 0).toLocaleString(locale(language), { maximumFractionDigits: 0 })
}

/** 1,284 → "1,284" · 12,900 → "12.9K" · 4,200,000 → "4.2M" */
export function compactNumber(value, language) {
  const v = Number(value ?? 0)
  const abs = Math.abs(v)
  if (abs >= 1e6) return `${(v / 1e6).toLocaleString(locale(language), { maximumFractionDigits: 1 })}M`
  if (abs >= 1e4) {
    return `${(v / 1e3).toLocaleString(locale(language), { maximumFractionDigits: abs >= 1e5 ? 0 : 1 })}K`
  }
  return v.toLocaleString(locale(language), { maximumFractionDigits: 0 })
}

export function monthLabel(date, language) {
  return new Intl.DateTimeFormat(locale(language), { month: 'short' }).format(date)
}

/** The container's width, so an SVG can be drawn at real pixels. */
function useWidth(ref, fallback = 600) {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const update = () => setWidth(el.clientWidth || fallback)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, fallback])
  return width
}

// ---------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------

export function StatTile({ label, value, suffix, note, delta, deltaLabel, trend, to, upIsGood = true }) {
  const body = (
    <div className="flex h-full flex-col rounded-card border border-separator bg-surface p-5 transition-colors hover:border-accent">
      <p className="t-section">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[28px] font-bold leading-none tracking-tight text-text">
          {value}
          {suffix && <span className="ms-1 text-[13px] font-medium text-text-secondary">{suffix}</span>}
        </p>
        {trend && <Sparkline values={trend} />}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 t-meta text-text-secondary">
        {delta !== null && delta !== undefined && (
          <Delta value={delta} upIsGood={upIsGood} label={deltaLabel} />
        )}
        {note && <span>{note}</span>}
      </p>
    </div>
  )
  return to ? <Link to={to} className="block h-full">{body}</Link> : body
}

function Delta({ value, upIsGood, label }) {
  const good = value === 0 ? null : value > 0 === upIsGood
  const tone = good === null ? 'text-text-secondary' : good ? 'text-success-text' : 'text-danger-text'
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '•'
  return (
    <>
      <span className={`font-medium ${tone}`} dir="ltr">
        {arrow} {Math.abs(value)}%
      </span>
      {label && <span>{label}</span>}
    </>
  )
}

/** Twelve points, history in the muted hue, the current period in the series colour. */
export function Sparkline({ values, width = 88, height = 28 }) {
  const n = values.length
  if (n < 2) return null
  const max = Math.max(...values, 1)
  const step = (width - 8) / (n - 1)
  const pts = values.map((v, i) => [4 + i * step, 4 + (height - 8) * (1 - v / max)])
  const path = (list) => list.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = pts[n - 1]
  return (
    <svg width={width} height={height} dir="ltr" className="shrink-0" aria-hidden="true">
      <path d={path(pts)} fill="none" stroke="var(--chart-muted)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path(pts.slice(-2))} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  )
}

// ---------------------------------------------------------------
// Meter — a progress track in the same hue as its fill
// ---------------------------------------------------------------

export function Meter({ percent, height = 8 }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: 'var(--chart-track)' }}
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: 'var(--chart-1)' }} />
    </div>
  )
}

// ---------------------------------------------------------------
// Horizontal bars — counts by category, value at the tip
// ---------------------------------------------------------------

export function HBars({ rows, format, colorFor, labelClass = 'w-40', hintClass = 'w-28', emptyLabel }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  if (rows.length === 0) return <p className="t-body text-text-secondary">{emptyLabel}</p>
  return (
    <ul className="space-y-2.5">
      {rows.map((row, index) => {
        const label = (
          <span className={`${labelClass} shrink-0 truncate t-meta text-text`} title={row.label}>
            {row.label}
          </span>
        )
        return (
          <li key={row.key ?? index} className="flex items-center gap-3">
            {row.to ? <Link to={row.to} className="contents hover:underline">{label}</Link> : label}
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="h-2.5 shrink-0"
                style={{
                  width: `${(row.value / max) * 100}%`,
                  minWidth: row.value > 0 ? 6 : 0,
                  backgroundColor: colorFor ? colorFor(row, index) : 'var(--chart-1)',
                  borderStartEndRadius: 4,
                  borderEndEndRadius: 4,
                }}
              />
              <span className="tabular t-meta font-medium text-text">
                {format ? format(row.value) : row.value}
              </span>
            </span>
            {rows.some((r) => r.hint) && (
              <span className={`${hintClass} shrink-0 truncate t-meta text-text-secondary`} title={row.hint ?? ''}>
                {row.hint}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------
// Stacked bar — part-to-whole, with a legend that carries the counts
// ---------------------------------------------------------------

export function StackedBar({ segments }) {
  const sum = segments.reduce((s, x) => s + x.count, 0)
  const shown = segments.filter((s) => s.count > 0)
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" style={{ backgroundColor: sum ? 'transparent' : 'var(--chart-track)' }}>
        {shown.map((s) => (
          <div key={s.key} style={{ width: `${(s.count / sum) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 t-meta text-text-secondary">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
            <span className="tabular font-medium text-text">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------
// Column chart — one series over time, with hover and a table twin
// ---------------------------------------------------------------

function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1]
  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const unit = rough / magnitude
  const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * magnitude
  const ticks = []
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

/** A column with a 4px rounded cap, square at the baseline. */
function cappedColumn(x, y, w, h, r) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

export function ColumnChart({
  points, language, format, highlightIndex, height = 200,
  tableLabel, chartLabel, periodLabel, valueLabel, emptyLabel,
}) {
  const ref = useRef(null)
  const width = useWidth(ref)
  const [hover, setHover] = useState(null)
  const [table, setTable] = useState(false)

  const pad = { top: 26, right: 8, bottom: 26, left: 44 }
  const plotW = Math.max(width - pad.left - pad.right, 10)
  const plotH = height - pad.top - pad.bottom
  const max = Math.max(...points.map((p) => p.value), 0)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const slot = plotW / Math.max(points.length, 1)
  const barW = Math.min(24, Math.max(slot - 6, 4))
  const y = (v) => pad.top + plotH * (1 - v / top)
  const empty = max === 0
  const everyOther = slot < 34
  const fmt = (v) => (format ? format(v) : formatNumber(v, language))

  const hovered = hover !== null ? points[hover] : null

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          onClick={() => setTable(!table)}
          className="t-meta text-accent hover:underline"
        >
          {table ? chartLabel : tableLabel}
        </button>
      </div>

      {table ? (
        <table className="w-full t-meta">
          <thead>
            <tr className="text-start text-text-secondary">
              <th className="py-1.5 text-start font-medium">{periodLabel}</th>
              <th className="py-1.5 text-end font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-separator-soft">
            {points.map((p) => (
              <tr key={p.key}>
                <td className="py-1.5 text-text">{p.longLabel ?? p.label}</td>
                <td className="tabular py-1.5 text-end text-text">{fmt(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={ref} className="relative" dir="ltr">
          <svg width={width} height={height} role="img" aria-label={valueLabel} className="block">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)" className="tabular">
                  {compactNumber(tick, language)}
                </text>
              </g>
            ))}

            {points.map((p, i) => {
              const x = pad.left + slot * i + (slot - barW) / 2
              const h = Math.max(0, plotH * (p.value / top))
              const isHighlight = i === highlightIndex
              const dim = hover !== null && hover !== i
              const showLabel = !everyOther || i % 2 === (points.length - 1) % 2
              return (
                <g key={p.key}>
                  {p.value > 0 && (
                    <path
                      d={cappedColumn(x, y(p.value), barW, h, 4)}
                      fill={isHighlight ? 'var(--chart-1-strong)' : 'var(--chart-1)'}
                      opacity={dim ? 0.45 : 1}
                    />
                  )}
                  {showLabel && (
                    <text
                      x={x + barW / 2}
                      y={height - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fill={isHighlight ? 'var(--text)' : 'var(--text-secondary)'}
                      fontWeight={isHighlight ? 700 : 400}
                    >
                      {p.label}
                    </text>
                  )}
                  {isHighlight && hover === null && p.value > 0 && (
                    <text x={x + barW / 2} y={y(p.value) - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">
                      {compactNumber(p.value, language)}
                    </text>
                  )}
                  <rect
                    x={pad.left + slot * i}
                    y={pad.top - 10}
                    width={slot}
                    height={plotH + 10}
                    fill="transparent"
                    tabIndex={0}
                    className="outline-none"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  />
                </g>
              )
            })}
          </svg>

          {empty && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center t-body text-text-secondary">
              {emptyLabel}
            </p>
          )}

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 rounded-control border border-separator bg-surface px-2.5 py-1.5 shadow-none"
              style={{
                left: pad.left + slot * hover + slot / 2,
                top: Math.max(y(hovered.value) - 10, 0),
                transform: 'translate(-50%, -100%)',
              }}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            >
              <p className="t-meta whitespace-nowrap text-text-secondary">{hovered.longLabel ?? hovered.label}</p>
              <p className="tabular whitespace-nowrap text-[13px] font-semibold text-text">{fmt(hovered.value)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
