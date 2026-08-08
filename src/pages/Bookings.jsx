import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  answerFileUrl,
  confirmReceipt,
  getBooking,
  getBookingSettings,
  issueInvoice,
  listBookings,
  listInvoices,
  markBookingSeen,
  receiptUrl,
  setBookingStatus,
} from '../lib/booking'
import { generateBookingDocuments } from '../lib/bookingIntake'
import { fullName } from '../lib/contacts'
import { formatPhone } from '../lib/phone'
import { formatDateTime } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import PrepSheet from '../components/booking/PrepSheet'
import { Badge, Button, Card, EmptyState, ErrorText, Field, Input, Loadable, PageTitle, Select } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'
import { errorMessage } from '../lib/errorMessage'

const STATUS_COLOR = {
  pending: 'var(--warning)',
  confirmed: 'var(--success)',
  cancelled: 'var(--muted)',
  completed: 'var(--accent)',
}

/**
 * The bookings inbox.
 *
 * A booking arrives pending. It only becomes confirmed when the designer
 * looks at an uploaded receipt and says so — nothing is verified
 * automatically and no gateway is involved anywhere.
 */
export default function Bookings() {
  useFeatureUse('bookings_inbox')
  const { t, language } = useI18n()
  const { settings, profile } = useAuth()
  const navigate = useNavigate()

  const [bookings, setBookings] = useState([])
  const [selected, setSelected] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)
  const [prepOpen, setPrepOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [receiptLinks, setReceiptLinks] = useState({})
  const [answerLinks, setAnswerLinks] = useState({})
  const [filed, setFiled] = useState([])

  // Booking times are shown in the STUDIO's timezone, never the
  // browser's. A designer working from Dubai was seeing a Cairo
  // 11:00 appointment as 12:00.
  const [timezone, setTimezone] = useState(null)

  async function load() {
    // Reset both, or a successful retry leaves the old error
    // sitting on screen underneath fresh data.
    setLoading(true)
    setLoadFailure(null)
    try {
      setBookings(await listBookings())
      setTimezone((await getBookingSettings())?.timezone ?? null)
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
  }, [])

  async function open(booking) {
    const full = await getBooking(booking.id)
    setSelected(full)
    setInvoices(await listInvoices(booking.id))
    setAmount(full.session_type?.fee ?? '')
    setFiled([])

    // Steps 6 and 7 of the intake. Idempotent, so opening a booking
    // twice never files a second copy — see lib/bookingIntake.js.
    try {
      const { created } = await generateBookingDocuments({
        booking: full,
        settings,
        profile,
        language,
      })
      setFiled(created)
    } catch (failure) {
      setError(errorMessage(failure, t))
    }

    if (!full.seen_at) {
      await markBookingSeen(full.id)
      load()
    }
  }

  useEffect(() => {
    // Private bucket, so each receipt needs a short-lived signed URL.
    ;(async () => {
      const links = {}
      for (const invoice of invoices) {
        for (const receipt of invoice.receipts ?? []) {
          links[receipt.id] = await receiptUrl(receipt.file_url)
        }
      }
      setReceiptLinks(links)
    })()
  }, [invoices])

  useEffect(() => {
    // Same again for files the client attached to a question.
    ;(async () => {
      const links = {}
      for (const [questionId, file] of Object.entries(selected?.answer_files ?? {})) {
        links[questionId] = await answerFileUrl(file.path)
      }
      setAnswerLinks(links)
    })()
  }, [selected])

  if (loading || loadFailure) {
    return (
      <Loadable loading={loading} failure={loadFailure} onRetry={load} t={t} />
    )
  }

  return (
    <div>
      <PageTitle subtitle={t('booking.inboxSubtitle', { count: bookings.length })}>
        {t('nav.bookings')}
      </PageTitle>

      {bookings.length === 0 ? (
        <EmptyState>{t('booking.inboxEmpty')}</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          {/* ---------- The list ---------- */}
          <div className="space-y-2">
            {bookings.map((booking) => (
              <button
                key={booking.id}
                onClick={() => open(booking)}
                className={
                  'w-full rounded border p-3 text-start ' +
                  (selected?.id === booking.id ? 'border-accent bg-surface' : 'border-border hover:bg-surface')
                }
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm text-text">{booking.client_name}</span>
                  <span className="flex items-center gap-1.5">
                    {!booking.seen_at && (
                      <span className="h-2 w-2 rounded-full bg-accent" title={t('booking.unseen')} />
                    )}
                    <Badge color={STATUS_COLOR[booking.status]}>
                      {t(`booking.status_${booking.status}`)}
                    </Badge>
                  </span>
                </span>
                <span className="mt-1 block text-xs text-text-secondary">
                  {formatDateTime(booking.slot_start, language, timezone)}
                </span>
              </button>
            ))}
          </div>

          {/* ---------- The booking ---------- */}
          <div>
            {!selected ? (
              <EmptyState>{t('booking.selectOne')}</EmptyState>
            ) : (
              <>
                <Card className="mb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-text">{selected.client_name}</h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {formatDateTime(selected.slot_start, language, timezone)}
                        {timezone && (
                          <span className="ms-1 text-xs opacity-70" dir="ltr">
                            ({timezone})
                          </span>
                        )}{' '}
                        ·{' '}
                        {selected.session_type
                          ? language === 'ar'
                            ? selected.session_type.label_ar
                            : selected.session_type.label_en
                          : '—'}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {selected.client_email}
                        {selected.client_phone && (
                          <span dir="ltr">
                            {' · '}
                            {formatPhone(selected.client_phone_code, selected.client_phone)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge color={STATUS_COLOR[selected.status]}>
                      {t(`booking.status_${selected.status}`)}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.contact && (
                      <Link
                        to={`/contacts/${selected.contact_id}`}
                        className="rounded border border-border px-2 py-1 text-xs text-accent hover:underline"
                      >
                        {t('booking.openClient')}
                      </Link>
                    )}
                    {selected.project && (
                      <Link
                        to={`/projects/${selected.project_id}`}
                        className="rounded border border-border px-2 py-1 text-xs text-accent hover:underline"
                      >
                        <span className="font-mono" dir="ltr">
                          {selected.project.code}
                        </span>
                      </Link>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        navigate(
                          `/generate/consultation_confirmation/${selected.contact_id}` +
                            `?project=${selected.project_id}&booking=${selected.id}`
                        )
                      }
                    >
                      {t('booking.generateConfirmation')}
                    </Button>
                    <Button variant="secondary" onClick={() => setPrepOpen(true)}>
                      {t('booking.prepSheet')}
                    </Button>
                    {selected.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await setBookingStatus(selected.id, 'cancelled')
                          await open(selected)
                          load()
                        }}
                      >
                        {t('booking.cancel')}
                      </Button>
                    )}
                  </div>

                  {filed.length > 0 && (
                    <p className="mt-3 text-xs text-success">
                      {t('booking.autoFiled', { count: filed.length })}
                    </p>
                  )}
                </Card>

                {/* ---------- Brief and answers ---------- */}
                {(selected.project_brief ||
                  Object.keys(selected.answers ?? {}).length > 0 ||
                  Object.keys(selected.answer_files ?? {}).length > 0) && (
                  <Card className="mb-4">
                    <h3 className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
                      {t('booking.brief')}
                    </h3>
                    {selected.project_brief && (
                      <p className="mb-3 whitespace-pre-wrap text-sm text-text">
                        {selected.project_brief}
                      </p>
                    )}
                    <dl className="space-y-1 text-sm">
                      {Object.entries(selected.answers ?? {}).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs text-text-secondary">{key}</dt>
                          <dd className="text-text">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    {Object.keys(selected.answer_files ?? {}).length > 0 && (
                      <div className="mt-4 border-t border-border pt-3">
                        <h4 className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
                          {t('booking.attachedFiles')}
                        </h4>
                        <ul className="space-y-1">
                          {Object.entries(selected.answer_files).map(([questionId, file]) => (
                            <li key={questionId}>
                              {answerLinks[questionId] ? (
                                <a
                                  href={answerLinks[questionId]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-accent hover:underline"
                                >
                                  {file.name || file.path}
                                </a>
                              ) : (
                                <span className="text-sm text-text-secondary">
                                  {file.name || file.path}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                )}

                {/* ---------- Invoice and receipt ---------- */}
                <Card>
                  <h3 className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
                    {t('booking.payment')}
                  </h3>
                  <p className="mb-3 text-xs text-text-secondary">{t('booking.paymentHelp')}</p>

                  {invoices.length === 0 ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-40">
                        <Field label={t('booking.amount')}>
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </Field>
                      </div>
                      <Button
                        disabled={!amount}
                        onClick={async () => {
                          setError('')
                          try {
                            await issueInvoice({
                              contact_id: selected.contact_id,
                              project_id: selected.project_id,
                              booking_id: selected.id,
                              stage_key: '01_consultation',
                              amount: Number(amount),
                              currency: settings?.currency ?? 'EGP',
                            })
                            setInvoices(await listInvoices(selected.id))
                          } catch (failure) {
                            setError(errorMessage(failure, t))
                          }
                        }}
                      >
                        {t('booking.issueInvoice')}
                      </Button>
                      <ErrorText>{error}</ErrorText>
                    </div>
                  ) : (
                    invoices.map((invoice) => (
                      <div key={invoice.id} className="rounded border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm text-text">
                            {invoice.amount} {invoice.currency}
                          </span>
                          <Badge color={invoice.status === 'paid' ? 'var(--success)' : 'var(--warning)'}>
                            {t(`booking.invoice_${invoice.status}`)}
                          </Badge>
                        </div>

                        {/* The covering message. The amount comes from the
                            invoice itself, so it is never re-typed. */}
                        <Button
                          variant="secondary"
                          className="mt-3 px-2 py-1"
                          onClick={() =>
                            navigate(
                              `/generate/invoice_send/${selected.contact_id}` +
                                `?project=${selected.project_id}&booking=${selected.id}` +
                                `&invoice=${invoice.id}`
                            )
                          }
                        >
                          {t('booking.generateInvoiceMessage')}
                        </Button>

                        {(invoice.receipts ?? []).length === 0 ? (
                          <p className="mt-2 text-xs text-text-secondary">
                            {t('booking.awaitingReceipt')}
                          </p>
                        ) : (
                          (invoice.receipts ?? []).map((receipt) => (
                            <div key={receipt.id} className="mt-3 border-t border-border pt-3">
                              <p className="text-xs text-text-secondary">
                                {t('booking.receiptUploaded', {
                                  date: formatDateTime(receipt.uploaded_at, language),
                                })}
                              </p>

                              {receiptLinks[receipt.id] && (
                                <a
                                  href={receiptLinks[receipt.id]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 block"
                                >
                                  <img
                                    src={receiptLinks[receipt.id]}
                                    alt=""
                                    className="max-h-64 rounded border border-border"
                                  />
                                </a>
                              )}

                              {receipt.confirmed ? (
                                <p className="mt-2 text-sm text-success">
                                  {t('booking.receiptConfirmed')}
                                </p>
                              ) : (
                                <Button
                                  className="mt-2"
                                  onClick={async () => {
                                    await confirmReceipt(receipt, profile?.id, selected.id)
                                    await open(selected)
                                    load()
                                  }}
                                >
                                  {t('booking.confirmReceipt')}
                                </Button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      <PrepSheet booking={selected} open={prepOpen} onClose={() => setPrepOpen(false)} />
    </div>
  )
}
