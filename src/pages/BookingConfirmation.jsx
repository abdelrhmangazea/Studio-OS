import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchBookingStatus, uploadAnswerFile, uploadReceipt } from '../lib/publicBooking'
import { publicErrorMessage } from '../lib/errorMessage'
import { usePageTitle } from '../lib/usePageTitle'

/**
 * The confirmation page the client lands on, and where they upload the
 * transfer receipt.
 *
 * There is no payment gateway. The client transfers manually, uploads a
 * photo of the receipt, and the designer confirms it by hand — that
 * confirmation is the only thing that makes the booking confirmed.
 *
 * Renders in the studio's language, like the booking page it follows.
 * It used to be hardcoded to English with dir="ltr", so a client who
 * booked in Arabic landed here and found the page had switched language
 * under them.
 */
export default function BookingConfirmation() {
  const { token } = useParams()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState('')
  const [answerBusy, setAnswerBusy] = useState(null)
  const [answerError, setAnswerError] = useState('')
  const fileRef = useRef(null)

  async function load() {
    try {
      setBooking(await fetchBookingStatus(token))
    } catch {
      setBooking(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [token])

  // White-label reaches the tab too, not just the page.
  usePageTitle(booking?.studio?.name)

  const language = booking?.studio?.language === 'ar' ? 'ar' : 'en'
  const rtl = language === 'ar'
  const t = (ar, en) => (rtl ? ar : en)
  const tz = booking?.timezone ?? 'Africa/Cairo'

  const when = useMemo(() => {
    if (!booking?.slot_start) return ''
    // Latin digits in Arabic too: a date is read back to a bank
    // transfer reference and copied into a calendar.
    return new Intl.DateTimeFormat(rtl ? 'ar-EG-u-nu-latn' : 'en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(new Date(booking.slot_start))
  }, [booking, tz, rtl])

  if (loading) return <div className="public-page p-10 text-[16px]">…</div>

  if (!booking) {
    return (
      <div className="public-page flex min-h-screen items-center justify-center p-10">
        <p className="text-[16px]">
          {t('ما لقيناش الحجز ده.', 'We could not find that booking.')}
        </p>
      </div>
    )
  }

  const STATUS_LABEL = {
    pending:   t('في انتظار التأكيد', 'Awaiting confirmation'),
    confirmed: t('مؤكَّد', 'Confirmed'),
    cancelled: t('ملغي', 'Cancelled'),
    completed: t('تم', 'Completed'),
  }

  const accent = booking.studio?.accent_color || '#0077B6'

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      await uploadReceipt(token, booking.upload_prefix, file)
      setUploaded(true)
      await load()
    } catch (failure) {
      setError(publicErrorMessage(failure, rtl))
    }
    setUploading(false)
  }

  /** Retry for a question file that did not make it up at booking time. */
  async function handleAnswerFile(question, event) {
    const file = event.target.files?.[0]
    if (!file) return

    setAnswerBusy(question.id)
    setAnswerError('')
    try {
      await uploadAnswerFile(token, booking.upload_prefix, question.id, file)
      await load()
    } catch (failure) {
      setAnswerError(publicErrorMessage(failure, rtl))
    }
    setAnswerBusy(null)
  }

  return (
    <div
      className="public-page"
      dir={rtl ? 'rtl' : 'ltr'}
      lang={language}
      style={{ '--pub-accent': accent }}
    >
      <div className="mx-auto max-w-xl px-5 py-10">
        <header className="mb-8 flex items-center gap-3">
          {booking.studio?.logo_url ? (
            <img src={booking.studio.logo_url} alt="" className="h-12 w-auto object-contain" />
          ) : null}
          <h1 className="text-lg font-semibold">{booking.studio?.name}</h1>
        </header>

        <div className="pub-card p-5">
          <p className="text-[16px] font-medium" style={{ color: accent }}>
            {booking.status === 'confirmed'
              ? t('حجزك مؤكَّد', 'Your booking is confirmed')
              : t('حجزك محفوظ', 'Your booking is reserved')}
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {rtl ? booking.session?.label_ar : booking.session?.label_en}
          </h2>
          <p className="mt-1 text-[16px]">{when}</p>
          <p className="pub-muted mt-1 text-[14px]" dir="ltr">{tz}</p>

          <dl className="mt-4 border-t pt-4 text-[16px]" style={{ borderColor: 'var(--pub-border)' }}>
            <div className="flex justify-between py-1">
              <dt className="pub-muted">{t('الاسم', 'Name')}</dt>
              <dd>{booking.client_name}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="pub-muted">{t('الحالة', 'Status')}</dt>
              <dd>{STATUS_LABEL[booking.status] ?? booking.status}</dd>
            </div>
          </dl>
        </div>

        {/* ---------- Files the booking form asked for but never got ---------- */}
        {(booking.pending_files ?? []).length > 0 && (
          <div className="pub-card mt-4 p-5">
            <h3 className="pub-h2">{t('ناقص', 'Still needed')}</h3>
            <p className="pub-muted mt-1 text-[14px]">
              {t(
                'الملفات دي ما اترفعتش مع حجزك. حجزك سليم — ارفعها من هنا.',
                'These files did not upload with your booking. Your booking is safe — please attach them here.'
              )}
            </p>

            <div className="mt-4 space-y-4">
              {booking.pending_files.map((question) => (
                <div key={question.id}>
                  <p className="mb-1 text-[16px]">
                    {(rtl ? question.label_ar : question.label_en) ||
                      question.label_en ||
                      question.label_ar}
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    disabled={answerBusy === question.id}
                    onChange={(event) => handleAnswerFile(question, event)}
                  />
                  {answerBusy === question.id && (
                    <p className="mt-1 text-[14px]">{t('جاري الرفع…', 'Uploading…')}</p>
                  )}
                </div>
              ))}
            </div>

            {answerError && (
              <p className="mt-2 text-[15px]" style={{ color: 'var(--pub-danger)' }}>
                {answerError}
              </p>
            )}
          </div>
        )}

        {/* ---------- Invoice and receipt: no gateway anywhere ---------- */}
        {booking.invoice ? (
          <div className="pub-card mt-4 p-5">
            <h3 className="pub-h2">{t('الدفع', 'Payment')}</h3>
            <p className="mt-1 text-2xl font-semibold" dir="ltr">
              {booking.invoice.amount} {booking.invoice.currency}
            </p>
            <p className="pub-muted mt-2 text-[14px]">
              {t(
                'حوّل المبلغ بالبيانات اللي بعتها لك الاستوديو، وبعدين ارفع صورة إيصال التحويل هنا. الاستوديو بيأكّده بنفسه — مفيش أي خصم تلقائي ومفيش بيانات كارت بتتاخد أبداً.',
                'Transfer the amount using the details the studio sent you, then upload a photo of the transfer receipt here. The studio confirms it manually — nothing is charged automatically and no card details are ever collected.'
              )}
            </p>

            {booking.receipt_uploaded || uploaded ? (
              <p className="mt-4 text-[16px] font-semibold" style={{ color: 'var(--pub-success)' }}>
                {t(
                  'وصلنا الإيصال. الاستوديو هيأكّده قريب.',
                  'Receipt received. The studio will confirm it shortly.'
                )}
              </p>
            ) : (
              <div className="mt-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                <p className="pub-muted mt-2 text-[14px]">
                  {t('JPG أو PNG أو PDF، وحتى ٥ ميجابايت.', 'JPG, PNG or PDF, up to 5MB.')}
                </p>
                {uploading && <p className="mt-2 text-[14px]">{t('جاري الرفع…', 'Uploading…')}</p>}
                {error && (
                  <p className="mt-2 text-[15px]" style={{ color: 'var(--pub-danger)' }}>
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="pub-muted mt-4 text-[16px]">
            {t(
              'الاستوديو هيبعت لك فاتورة الاستشارة دي قريب.',
              'The studio will send you an invoice for this consultation shortly.'
            )}
          </p>
        )}

        <footer
          className="pub-muted mt-10 border-t pt-4 text-center text-[14px]"
          style={{ borderColor: 'var(--pub-border)' }}
        >
          <a href="https://interiorzone.com" target="_blank" rel="noreferrer">
            Powered by Interior Zone
          </a>
        </footer>
      </div>
    </div>
  )
}
