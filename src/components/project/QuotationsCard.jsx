import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  acceptQuotation,
  deleteQuotation,
  listQuotations,
  requestQuotation,
  updateQuotation,
} from '../../lib/quotations'
import { listSuppliers } from '../../lib/suppliers'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Badge, Button, Card, ErrorText, Field, Input, Select } from '../ui'
import { useFeatureUse } from '../../lib/useFeatureUse'

const STATUS_COLOR = {
  requested: 'var(--muted)',
  received: 'var(--warning)',
  accepted: 'var(--success)',
  rejected: 'var(--muted)',
}

/**
 * Quotations for this project, side by side.
 *
 * Comparison is the whole point, so received quotations are sorted by
 * amount and the cheapest is marked — without hiding that cheapest is
 * not always the one you accept.
 */
export default function QuotationsCard({ project }) {
  useFeatureUse('quotations')
  const { t, language } = useI18n()
  const { settings } = useAuth()

  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ supplier_id: '', title: '', stage_key: '' })
  const [error, setError] = useState('')

  async function load() {
    setRows(await listQuotations(project.id))
    setSuppliers((await listSuppliers()).filter((s) => s.active))
  }

  useEffect(() => {
    load()
  }, [project.id])

  const priced = rows.filter((r) => r.amount != null && r.status !== 'rejected')
  const cheapest = priced.length > 1
    ? priced.reduce((min, r) => (Number(r.amount) < Number(min.amount) ? r : min))
    : null

  async function add() {
    setError('')
    try {
      await requestQuotation({
        project_id: project.id,
        supplier_id: draft.supplier_id,
        title: draft.title.trim(),
        stage_key: draft.stage_key || null,
        currency: settings?.currency ?? null,
      })
      setDraft({ supplier_id: '', title: '', stage_key: '' })
      setAdding(false)
      load()
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
        {t('quotations.title')}
      </h3>
      <p className="mb-3 text-xs text-text-secondary">{t('quotations.help')}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('quotations.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text">
                    {row.title}
                    {cheapest?.id === row.id && (
                      <span className="ms-2 text-xs text-success">· {t('quotations.lowest')}</span>
                    )}
                  </p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-text-secondary">
                    <Link to="/suppliers" className="text-accent hover:underline">
                      {row.supplier?.name}
                    </Link>
                    <span>{formatDate(row.requested_at, language)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.amount != null && (
                    <span className="font-mono text-sm text-text" dir="ltr">
                      {Number(row.amount).toLocaleString()} {row.currency}
                    </span>
                  )}
                  <Badge color={STATUS_COLOR[row.status]}>{t(`quotations.status_${row.status}`)}</Badge>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <div className="w-32">
                  <Field label={t('quotations.amount')}>
                    <Input
                      type="number"
                      defaultValue={row.amount ?? ''}
                      onBlur={async (e) => {
                        const amount = e.target.value === '' ? null : Number(e.target.value)
                        if (amount === (row.amount ?? null)) return
                        await updateQuotation(row.id, {
                          amount,
                          status: amount != null && row.status === 'requested' ? 'received' : row.status,
                          received_at: amount != null ? new Date().toISOString() : null,
                        })
                        load()
                      }}
                    />
                  </Field>
                </div>

                {row.status !== 'accepted' && (
                  <Button
                    className="px-2 py-1"
                    disabled={row.amount == null}
                    onClick={async () => {
                      await acceptQuotation(row)
                      load()
                    }}
                  >
                    {t('quotations.accept')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="px-2 py-1"
                  onClick={async () => {
                    await deleteQuotation(row.id)
                    load()
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <Field label={t('quotations.supplier')}>
            <Select
              value={draft.supplier_id}
              onChange={(e) => setDraft({ ...draft, supplier_id: e.target.value })}
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.category ? ` · ${s.category}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('quotations.what')}>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <Button disabled={!draft.supplier_id || !draft.title.trim()} onClick={add}>
              {t('quotations.request')}
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
          {t('quotations.request')}
        </Button>
      )}
    </Card>
  )
}
