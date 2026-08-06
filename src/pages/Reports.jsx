import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadInsights } from '../lib/insights'
import { fullName } from '../lib/contacts'
import { useI18n } from '../i18n'
import { Button, Card, Field, Input, PageTitle, Select } from '../components/ui'

/**
 * Reports.
 *
 * The same five numbers as the dashboard, over a range you choose,
 * with the rows behind each one and a CSV of whichever you are looking
 * at. Deliberately nothing more: the spec allowed no reports beyond
 * these five, and inventing a sixth would be inventing a metric nobody
 * asked to be measured by.
 */

const RANGES = ['this_month', 'last_month', 'last_90', 'this_year', 'all', 'custom']

function rangeBounds(key, custom) {
  const now = new Date()
  const iso = (d) => d.toISOString()

  switch (key) {
    case 'this_month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: null }
    case 'last_month':
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)),
      }
    case 'last_90': {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      return { from: iso(d), to: null }
    }
    case 'this_year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: null }
    case 'all':
      return { from: '1970-01-01T00:00:00.000Z', to: null }
    case 'custom':
      return {
        from: custom.from ? new Date(custom.from).toISOString() : '1970-01-01T00:00:00.000Z',
        to: custom.to ? new Date(custom.to + 'T23:59:59').toISOString() : null,
      }
    default:
      return { from: null, to: null }
  }
}

export default function Reports() {
  const { t } = useI18n()
  const [range, setRange] = useState('this_month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Changing the range fires a fresh query while the previous one is
    // still in flight. Without this guard the slower of the two lands
    // last and wins, and the screen shows a number for a range you are
    // no longer looking at.
    let cancelled = false

    setLoading(true)
    loadInsights(rangeBounds(range, custom)).then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [range, custom.from, custom.to])

  function download(name, rows) {
    // Excel opens CSV as the local encoding unless told otherwise, and
    // Arabic names turn to mojibake. The BOM is what stops that.
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

  if (loading || !data) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  const sections = [
    {
      key: 'leads',
      label: t('reports.newLeads'),
      value: data.leadsThisMonth.count,
      rows: data.leadsThisMonth.rows,
      head: [t('columns.name'), t('columns.email'), t('columns.converted')],
      line: (c) => [fullName(c), c.email ?? '', c.converted_at ?? ''],
      href: (c) => `/contacts/${c.id}`,
      text: (c) => fullName(c),
    },
    {
      key: 'to-consultation',
      label: t('insights.toConsultation'),
      value:
        data.toConsultation.percent === null ? '—' : `${data.toConsultation.percent}%`,
      note: t('reports.ratioInRange', {
        a: data.toConsultation.numerator,
        b: data.toConsultation.denominator,
      }),
      rows: data.toConsultation.rows,
      head: [t('columns.name'), t('columns.email'), t('columns.converted')],
      line: (c) => [fullName(c), c.email ?? '', c.converted_at ?? ''],
      href: (c) => `/contacts/${c.id}`,
      text: (c) => fullName(c),
    },
    {
      key: 'to-contract',
      label: t('insights.toContract'),
      value: data.toContract.percent === null ? '—' : `${data.toContract.percent}%`,
      note: t('insights.ratioClients', {
        a: data.toContract.numerator,
        b: data.toContract.denominator,
      }),
      rows: data.toContract.rows,
      head: [t('reports.code'), t('reports.project')],
      line: (p) => [p.code, p.name],
      href: (p) => `/projects/${p.id}`,
      text: (p) => `${p.code} · ${p.name}`,
    },
    {
      key: 'active-projects',
      label: t('insights.activeProjects'),
      value: data.activeProjects.count,
      rows: data.activeProjects.rows,
      head: [t('reports.code'), t('reports.project'), t('columns.status')],
      line: (p) => [p.code, p.name, p.state],
      href: (p) => `/projects/${p.id}`,
      text: (p) => `${p.code} · ${p.name}`,
    },
    {
      key: 'average-value',
      label: t('insights.averageValue'),
      value: data.value.average === null ? '—' : data.value.average.toLocaleString(),
      note: t('insights.valueCoverage', {
        covering: data.value.covering,
        entered: data.value.fromEntered,
        invoices: data.value.fromInvoices,
      }),
      rows: data.value.rows,
      head: [t('reports.code'), t('reports.project'), t('reports.value'), t('reports.basis')],
      line: (p) => [p.code, p.name, p.resolved, p.basis],
      href: (p) => `/projects/${p.id}`,
      text: (p) => `${p.code} · ${p.resolved.toLocaleString()}`,
    },
  ]

  return (
    <div>
      <PageTitle subtitle={t('reports.subtitle')}>{t('nav.reports')}</PageTitle>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Field label={t('reports.range')}>
              <Select value={range} onChange={(e) => setRange(e.target.value)}>
                {RANGES.map((r) => (
                  <option key={r} value={r}>
                    {t(`reports.range_${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {range === 'custom' && (
            <>
              <div className="w-40">
                <Field label={t('reports.from')}>
                  <Input
                    type="date"
                    value={custom.from}
                    onChange={(e) => setCustom({ ...custom, from: e.target.value })}
                  />
                </Field>
              </div>
              <div className="w-40">
                <Field label={t('reports.to')}>
                  <Input
                    type="date"
                    value={custom.to}
                    onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-text-secondary">{t('reports.rangeNote')}</p>
      </Card>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.key}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-secondary">
                  {section.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-text">{section.value}</p>
                {section.note && (
                  <p className="mt-1 text-xs text-text-secondary">{section.note}</p>
                )}
              </div>
              {section.rows.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    download(section.key, [section.head, ...section.rows.map(section.line)])
                  }
                >
                  {t('reports.exportCsv')}
                </Button>
              )}
            </div>

            {section.rows.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3">
                {section.rows.slice(0, 50).map((row, index) => (
                  <li key={index} className="text-sm">
                    <Link to={section.href(row)} className="text-accent hover:underline">
                      {section.text(row)}
                    </Link>
                  </li>
                ))}
                {section.rows.length > 50 && (
                  <li className="text-xs text-text-secondary">
                    {t('reports.andMore', { count: section.rows.length - 50 })}
                  </li>
                )}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
