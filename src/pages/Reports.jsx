import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadBusinessReports } from '../lib/businessReports'
import { fullName } from '../lib/contacts'
import { listLabel } from '../lib/useLists'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Button, Card, Field, Input, PageTitle, Select } from '../components/ui'

/**
 * Reports.
 *
 * Four sections, each drilling into the rows behind it and each
 * exporting them. Nothing here is a headline figure with no way to
 * check it.
 */

const RANGES = ['this_month', 'last_90', 'this_year', 'all', 'custom']

function rangeBounds(key, custom) {
  const now = new Date()
  const iso = (d) => d.toISOString()

  switch (key) {
    case 'this_month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: null }
    case 'last_90': {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      return { from: iso(d), to: null }
    }
    case 'this_year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: null }
    case 'all':
      return { from: null, to: null }
    case 'custom':
      return {
        from: custom.from ? new Date(custom.from).toISOString() : null,
        to: custom.to ? new Date(custom.to + 'T23:59:59').toISOString() : null,
      }
    default:
      return { from: null, to: null }
  }
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function download(name, rows) {
  // The BOM keeps Arabic readable when Excel opens the file.
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { t, language } = useI18n()
  const { settings } = useAuth()

  const [range, setRange] = useState('this_year')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadBusinessReports(rangeBounds(range, custom)).then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [range, custom.from, custom.to])

  if (loading || !data) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  const currency = settings?.currency ?? ''
  const money = (n) => `${Number(n ?? 0).toLocaleString()} ${currency}`
  const toggle = (id) => setOpen(open === id ? null : id)

  return (
    <div>
      <PageTitle subtitle={t('reports.subtitle')}>{t('nav.reports')}</PageTitle>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Field label={t('reports.range')}>
              <Select value={range} onChange={(e) => setRange(e.target.value)}>
                {RANGES.map((r) => (
                  <option key={r} value={r}>{t(`reports.range_${r}`)}</option>
                ))}
              </Select>
            </Field>
          </div>
          {range === 'custom' && (
            <>
              <div className="w-40">
                <Field label={t('reports.from')}>
                  <Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
                </Field>
              </div>
              <div className="w-40">
                <Field label={t('reports.to')}>
                  <Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
                </Field>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ---------- 1. FUNNEL ---------- */}
      <Card className="mb-4">
        <Header
          title={t('reports.funnel')}
          onExport={() =>
            download('funnel', [
              [t('reports.step'), t('reports.count'), t('reports.conversion')],
              ...data.funnel.map((s) => [t(`reports.funnel_${s.key}`), s.count, s.percent ?? '']),
            ])
          }
        />

        <div className="space-y-2">
          {data.funnel.map((step) => (
            <div key={step.key}>
              <button
                onClick={() => step.count > 0 && toggle(`funnel-${step.key}`)}
                disabled={step.count === 0}
                className="flex w-full flex-wrap items-baseline justify-between gap-3 rounded border border-border p-3 text-start disabled:cursor-default hover:bg-bg"
              >
                <span className="text-sm text-text">{t(`reports.funnel_${step.key}`)}</span>
                <span className="flex items-baseline gap-3">
                  {step.percent !== null && (
                    <span className="text-xs text-text-secondary">
                      {t('reports.fromPrevious', { percent: step.percent })}
                    </span>
                  )}
                  <span className={'text-xl font-semibold ' + (step.count ? 'text-accent' : 'text-text-secondary')}>
                    {step.count}
                  </span>
                </span>
              </button>

              {open === `funnel-${step.key}` && (
                <ul className="mt-1 space-y-1 rounded border border-border p-3">
                  {step.rows.slice(0, 60).map((row) => (
                    <li key={row.id} className="text-sm">
                      <Link
                        to={row.code ? `/projects/${row.id}` : `/contacts/${row.id}`}
                        className="text-accent hover:underline"
                      >
                        {row.code ? `${row.code} · ${row.name}` : fullName(row)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ---------- 2. REVENUE ---------- */}
      <Card className="mb-4">
        <Header
          title={t('reports.revenue')}
          onExport={() =>
            download('revenue', [
              [t('reports.month'), t('reports.invoiced')],
              ...data.revenue.months.map((m) => [m.month, m.total]),
              [],
              [t('reports.projectType'), t('reports.invoiced'), t('reports.count')],
              ...data.revenue.byType.map((r) => [r.type, r.total, r.count]),
            ])
          }
        />

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Figure label={t('reports.totalInvoiced')} value={money(data.revenue.total)} />
          <Figure
            label={t('reports.averageValue')}
            value={data.revenue.averageValue === null ? '—' : money(data.revenue.averageValue)}
            note={t('reports.averageOver', { count: data.revenue.valuedCount })}
          />
        </div>

        {data.revenue.months.length > 0 && (
          <ul className="mb-4 space-y-1">
            {data.revenue.months.map((m) => (
              <li key={m.month} className="flex justify-between text-sm">
                <span className="text-text-secondary" dir="ltr">{m.month}</span>
                <span className="font-mono text-text" dir="ltr">{Number(m.total).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}

        {data.revenue.byType.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
              {t('reports.byType')}
            </p>
            <ul className="space-y-1">
              {data.revenue.byType.map((r) => (
                <li key={r.type} className="flex justify-between text-sm">
                  <span className="text-text">{r.type} · {r.count}</span>
                  <span className="font-mono text-text-secondary" dir="ltr">
                    {Number(r.total).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* ---------- 3. PROFITABILITY ---------- */}
      <Card className="mb-4">
        <Header
          title={t('reports.profitability')}
          onExport={() =>
            download('profitability', [
              [t('reports.code'), t('reports.project'), t('reports.value'), t('time.hours'), t('reports.effectiveRate')],
              ...data.profitability.map((p) => [p.code, p.name, p.value, p.hours, p.rate]),
            ])
          }
        />

        <p className="mb-3 text-xs text-text-secondary">{t('reports.profitabilityHelp')}</p>

        {data.profitability.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('reports.noLoggedTime')}</p>
        ) : (
          <ul className="space-y-2">
            {data.profitability.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3">
                <Link to={`/projects/${p.id}`} className="text-sm text-accent hover:underline">
                  <span className="font-mono" dir="ltr">{p.code}</span> {p.name}
                </Link>
                <span className="flex items-baseline gap-4 text-sm">
                  <span className="text-text-secondary">{money(p.value)}</span>
                  <span className="text-text-secondary">{p.hours} {t('time.hoursShort')}</span>
                  <span className="font-semibold text-accent" dir="ltr">{money(p.rate)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {data.withoutTime > 0 && (
          <p className="mt-3 text-xs text-text-secondary">
            {t('reports.excludedNoTime', { count: data.withoutTime })}
          </p>
        )}
      </Card>

      {/* ---------- 4. SOURCE PERFORMANCE ---------- */}
      <Card>
        <Header
          title={t('reports.sourcePerformance')}
          onExport={() =>
            download('sources', [
              [t('reports.source'), t('reports.funnel_leads'), t('reports.funnel_consultations'), t('reports.funnel_contracts'), t('reports.invoiced')],
              ...data.sources.map((s) => [listLabel(s, language), s.leads, s.consultations, s.contracts, s.invoiced]),
            ])
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-start text-xs uppercase tracking-wide text-text-secondary">
                <th className="p-2 text-start">{t('reports.source')}</th>
                <th className="p-2 text-start">{t('reports.funnel_leads')}</th>
                <th className="p-2 text-start">{t('reports.funnel_consultations')}</th>
                <th className="p-2 text-start">{t('reports.funnel_contracts')}</th>
                <th className="p-2 text-start">{t('reports.invoiced')}</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-2 text-text">{listLabel(s, language)}</td>
                  <td className="p-2 text-text-secondary">{s.leads}</td>
                  <td className="p-2 text-text-secondary">{s.consultations}</td>
                  <td className="p-2 text-text-secondary">{s.contracts}</td>
                  <td className="p-2 font-mono text-text" dir="ltr">{Number(s.invoiced).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Header({ title, onExport }) {
  const { t } = useI18n()
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xs uppercase tracking-wide text-text-secondary">{title}</h2>
      <Button variant="secondary" className="px-2 py-1" onClick={onExport}>
        {t('reports.exportCsv')}
      </Button>
    </div>
  )
}

function Figure({ label, value, note }) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
      {note && <p className="mt-1 text-xs text-text-secondary">{note}</p>}
    </div>
  )
}
