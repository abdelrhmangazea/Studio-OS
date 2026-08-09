import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmReceipt, receiptUrl } from '../../lib/booking'
import { formatDate, formatDateTime } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Badge, Button, Card, EmptyState, Loadable } from '../ui'
import DemoBadge from '../DemoBadge'

/**
 * Every invoice raised against this contact, and the receipts against
 * them.
 *
 * There is no gateway here either. An invoice is a record, a receipt is
 * an image the client uploaded, and the designer confirming it by hand
 * is the only thing that marks anything paid — the same rule as the
 * bookings inbox, just gathered per client.
 */
export default function PaymentsTab({ contact }) {
  const { t, language } = useI18n()
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [links, setLinks] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)

  async function load() {
    // Reset both, or a successful retry leaves the old error
    // sitting on screen underneath fresh data.
    setLoading(true)
    setLoadFailure(null)
    try {
      const { data } = await supabase
        .from('invoices')
        .select('*, receipts(*), project:projects(id, code, name)')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })

      setInvoices(data ?? [])
    } catch (caught) {
      setLoadFailure(caught)
    } finally {
      // Always. A failed load must never leave the
      // screen spinning with no way out.
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [contact.id])

  useEffect(() => {
    // Private bucket — each receipt needs its own short-lived URL.
    ;(async () => {
      const next = {}
      for (const invoice of invoices) {
        for (const receipt of invoice.receipts ?? []) {
          next[receipt.id] = await receiptUrl(receipt.file_url)
        }
      }
      setLinks(next)
    })()
  }, [invoices])

  if (loading || loadFailure) {
    return (
      <Loadable loading={loading} failure={loadFailure} onRetry={load} t={t} />
    )
  }
  if (invoices.length === 0) return <EmptyState>{t('contact.noPayments')}</EmptyState>

  const paid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0)
  const outstanding = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0)
  const currency = invoices[0]?.currency ?? ''

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="t-section">
              {t('contact.paid')}
            </p>
            <p className="mt-1 text-xl font-semibold text-success">
              {paid.toLocaleString()} {currency}
            </p>
          </div>
          <div>
            <p className="t-section">
              {t('contact.outstanding')}
            </p>
            <p className="mt-1 text-xl font-semibold text-text">
              {outstanding.toLocaleString()} {currency}
            </p>
          </div>
        </div>
      </Card>

      {invoices.map((invoice) => (
        <Card key={invoice.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-text">
                <span>
                  {invoice.amount} {invoice.currency}
                </span>
                <DemoBadge on={invoice} />
              </p>
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-secondary">
                {invoice.project && (
                  <Link
                    to={`/projects/${invoice.project.id}`}
                    className="font-mono text-accent hover:underline"
                    dir="ltr"
                  >
                    {invoice.project.code}
                  </Link>
                )}
                {invoice.issued_at && <span>{formatDate(invoice.issued_at, language)}</span>}
              </p>
            </div>
            <Badge tone={invoice.status === 'paid' ? 'success' : 'warning'}>
              {t(`booking.invoice_${invoice.status}`)}
            </Badge>
          </div>

          {(invoice.receipts ?? []).length === 0 ? (
            <p className="mt-3 border-t border-separator pt-3 text-xs text-text-secondary">
              {t('booking.awaitingReceipt')}
            </p>
          ) : (
            (invoice.receipts ?? []).map((receipt) => (
              <div key={receipt.id} className="mt-3 border-t border-separator pt-3">
                <p className="text-xs text-text-secondary">
                  {t('booking.receiptUploaded', {
                    date: formatDateTime(receipt.uploaded_at, language),
                  })}
                </p>

                {links[receipt.id] && (
                  <a href={links[receipt.id]} target="_blank" rel="noreferrer" className="mt-2 block">
                    <img
                      src={links[receipt.id]}
                      alt=""
                      className="max-h-56 rounded-card border border-separator"
                    />
                  </a>
                )}

                {receipt.confirmed ? (
                  <p className="mt-2 text-sm text-success">{t('booking.receiptConfirmed')}</p>
                ) : (
                  <Button
                    className="mt-2"
                    onClick={async () => {
                      await confirmReceipt(receipt, profile?.id, null)
                      load()
                    }}
                  >
                    {t('booking.confirmReceipt')}
                  </Button>
                )}
              </div>
            ))
          )}
        </Card>
      ))}
    </div>
  )
}
