import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  downloadPortalFile,
  fetchPortal,
  submitDecision,
  uploadPortalReceipt,
} from '../lib/publicPortal'
import { publicErrorMessage } from '../lib/errorMessage'
import { usePageTitle } from '../lib/usePageTitle'

/**
 * The client portal. One secret link, one project, no login.
 *
 * Everything it knows arrives from portal_project, which resolves the
 * token to a single project before reading anything — so this page
 * cannot see another client, another project, or any studio data
 * beyond the logo and colour it renders itself in.
 *
 * Stages are shown by their client-facing titles. Internal keys like
 * '06_design_development' never reach this file.
 */

/**
 * Black or white, whichever can actually be read on the studio's own
 * colour. Rec. 601 luma is enough here — this decides one pair of
 * initials, not a colour system.
 */
function readableOn(hex) {
  const value = String(hex ?? '').replace('#', '')
  if (value.length !== 6) return '#ffffff'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#ffffff'
}

export default function Portal() {
  const { token } = useParams()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [receiptBusy, setReceiptBusy] = useState(false)

  async function load() {
    try {
      setData(await fetchPortal(token))
    } catch {
      setData(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [token])

  // White-label reaches the tab too, not just the page.
  usePageTitle(data?.studio?.name)

  const language = data?.studio?.language === 'ar' ? 'ar' : 'en'
  const rtl = language === 'ar'
  const t = (ar, en) => (rtl ? ar : en)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(rtl ? 'ar-EG-u-nu-latn' : 'en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    [rtl]
  )

  if (loading) return <div className="public-page p-10 text-sm">…</div>

  // Unknown, revoked, or switched off — all say the same thing, and
  // none of them says anything about the link itself.
  if (!data) {
    return (
      <div className="public-page flex min-h-screen items-center justify-center p-10">
        <p className="text-sm">
          {t('هذا الرابط لم يعد صالحاً.', 'This link is no longer active.')}
        </p>
      </div>
    )
  }

  const accent = data.studio?.accent_color || '#0077B6'
  const stageTitle = (s) => (rtl ? s.title_ar : s.title_en)
  const revisions = data.revisions ?? { free_allowance: 0, used: 0 }
  const remaining = Math.max(0, revisions.free_allowance - revisions.used)
  const exhausted = remaining === 0

  // A stage approval is the one that matters here; file decisions are
  // listed but do not close anything.
  const stageApproval = (data.approvals ?? []).find(
    (a) => a.decision === 'approved' && !a.item_ref
  )

  async function decide(decision, fileId = null) {
    setBusy(true)
    setError('')
    setNote('')
    try {
      const result = await submitDecision(token, { decision, comment, fileId })
      setComment('')
      if (result?.billable) {
        setNote(
          t(
            'تم إرسال طلبك. عدد التعديلات المجانية انتهى، فهذا التعديل وما بعده يُحتسب كعمل إضافي — سيتواصل معك الاستوديو بالتفاصيل.',
            'Your request has been sent. The free revisions are used up, so this change and any after it are billable — the studio will follow up with the details.'
          )
        )
      } else {
        setNote(t('تم تسجيل ردّك.', 'Your response has been recorded.'))
      }
      await load()
    } catch (failure) {
      setError(publicErrorMessage(failure, rtl))
    }
    setBusy(false)
  }

  async function handleReceipt(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setReceiptBusy(true)
    setError('')
    try {
      await uploadPortalReceipt(token, data.upload_prefix, file)
      await load()
    } catch (failure) {
      setError(publicErrorMessage(failure, rtl))
    }
    setReceiptBusy(false)
  }

  return (
    <div
      className="public-page"
      dir={rtl ? 'rtl' : 'ltr'}
      lang={language}
      style={{ '--pub-accent': accent }}
    >
      <div className="mx-auto max-w-2xl px-5 py-12">
        {/* ---------- White-label header ---------- */}
        <header className="mb-8 flex items-center gap-4">
          {data.studio?.logo_url ? (
            <img src={data.studio.logo_url} alt="" className="h-14 w-auto object-contain" />
          ) : (
            /* The ONE place the designer's own colour appears. Every
               action below is black, because an accent belonging to one
               studio clashes with the next studio's identity.

               The initials pick black or white against whatever colour
               the studio chose. That is not overriding their choice —
               it is the only way their choice stays legible. */
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[16px] text-base font-bold"
              style={{ background: accent, color: readableOn(accent) }}
            >
              {(data.studio?.name ?? '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="pub-h2">{data.studio?.name}</h1>
        </header>

        {/* ---------- Where the project stands ---------- */}
        <section className="pub-card mb-4 p-6 sm:p-7">
          <p className="pub-meta">{t('مشروعك', 'Your project')}</p>
          <h2 className="pub-title mt-1.5">{data.project?.name}</h2>
          <p className="pub-meta mt-2 font-mono" dir="ltr">
            {data.project?.code}
          </p>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[17px] font-bold">
                {data.current_stage ? stageTitle(data.current_stage) : '—'}
                {data.current_stage && (
                  <span className="pub-muted ms-2 text-[15px] font-normal">
                    {t(
                      `المرحلة ${data.current_stage.number} من ${(data.stages ?? []).length}`,
                      `stage ${data.current_stage.number} of ${(data.stages ?? []).length}`
                    )}
                  </span>
                )}
              </span>
              <span className="pub-meta">
                {t(
                  `${data.progress}% مكتمل`,
                  `${data.progress}% complete`
                )}
              </span>
            </div>

            <div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--pub-border)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${data.progress}%`, background: 'var(--pub-primary)' }}
              />
            </div>

            <ol className="mt-4 space-y-1.5">
              {(data.stages ?? []).map((stage) => (
                <li
                  key={stage.number}
                  className={
                    'flex items-center gap-2.5 text-[15px] ' +
                    (stage.status === 'locked' ? 'is-faded' : '')
                  }
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        stage.status === 'complete'
                          ? 'var(--pub-primary)'
                          : stage.status === 'active'
                            ? 'var(--pub-muted)'
                            : 'var(--pub-border)',
                    }}
                  />
                  <span>{stageTitle(stage)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Files the studio chose to share ---------- */}
        <section className="pub-card mb-4 p-6 sm:p-7">
          <h3 className="pub-h2">{t('الملفات', 'Files')}</h3>

          {(data.files ?? []).length === 0 ? (
            <p className="pub-meta mt-2">
              {t(
                'لم تتم مشاركة أي ملفات بعد. ستظهر هنا فور مشاركتها.',
                'No files have been shared yet. They will appear here once they are.'
              )}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.files.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3.5 last:border-0"
                  style={{ borderColor: 'var(--pub-border)' }}
                >
                  <div>
                    <p className="text-[16px] font-semibold">{file.filename}</p>
                    <p className="pub-meta">
                      {rtl ? file.stage_title_ar : file.stage_title_en} ·{' '}
                      {dateFormatter.format(new Date(file.uploaded_at))}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadPortalFile(file.path, file.filename)}
                    className="pub-btn pub-btn-secondary shrink-0 !px-4 !py-2 !text-[15px]"
                  >
                    {t('تنزيل', 'Download')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Approve, or ask for changes ---------- */}
        <section className="pub-card mb-4 p-6 sm:p-7">
          <h3 className="pub-h2">{t('المراجعة', 'Your review')}</h3>

          {stageApproval ? (
            <p className="mt-3 text-[16px] font-semibold">
              {t('تمت الموافقة في ', 'Approved on ')}
              {dateFormatter.format(new Date(stageApproval.decided_at))}
              {t('. الموافقة نهائية ولا يمكن تعديلها.', '. An approval is final and cannot be changed.')}
            </p>
          ) : (
            <>
              <p className="pub-muted mt-2 text-[16px]">
                {t(
                  'راجع ما تمت مشاركته، ثم وافق أو اطلب تعديلاً موضّحاً ما تريد تغييره.',
                  'Review what has been shared, then approve or request a change describing what you would like different.'
                )}
              </p>

              <textarea
                rows={3}
                className="mt-3"
                placeholder={t('اكتب ملاحظاتك هنا…', 'Describe the change you would like…')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => decide('approved')}
                  className="pub-btn pub-btn-primary"
                >
                  {t('أوافق على هذه المرحلة', 'Approve this stage')}
                </button>
                <button
                  disabled={busy || !comment.trim()}
                  onClick={() => decide('changes_requested')}
                  className="pub-btn pub-btn-secondary"
                >
                  {t('أطلب تعديلاً', 'Request a change')}
                </button>
              </div>
            </>
          )}

          {/* Revisions. Stated plainly, and never used to block. */}
          <div
            className="mt-5 border-t pt-4 text-[15px]"
            style={{ borderColor: 'var(--pub-border)' }}
          >
            {exhausted ? (
              <p className="pub-muted">
                {t(
                  `استُخدمت جميع التعديلات المجانية (${revisions.free_allowance}). أي تعديل إضافي يُحتسب كعمل إضافي، ويمكنك طلبه في أي وقت.`,
                  `All ${revisions.free_allowance} free revisions have been used. Further changes are billable — you can still request them at any time.`
                )}
              </p>
            ) : (
              <p className="pub-muted">
                {t(
                  `التعديلات المجانية المتبقية: ${remaining} من ${revisions.free_allowance}`,
                  `Free revisions remaining: ${remaining} of ${revisions.free_allowance}`
                )}
              </p>
            )}
          </div>

          {note && <p className="mt-4 text-[15px] font-semibold">{note}</p>}
          {error && (
            <p className="mt-4 text-[15px]" style={{ color: '#b3261e' }}>
              {error}
            </p>
          )}
        </section>

        {/* ---------- Decisions already recorded ---------- */}
        {(data.approvals ?? []).length > 0 && (
          <section className="pub-card mb-4 p-6 sm:p-7">
            <h3 className="pub-h2">{t('سجل ردودك', 'Your responses')}</h3>
            <ul className="mt-3 space-y-2">
              {data.approvals.map((row, index) => (
                <li key={index} className="border-b py-3 text-[16px] last:border-0" style={{ borderColor: 'var(--pub-border)' }}>
                  <span className="font-semibold">
                    {row.decision === 'approved'
                      ? t('موافقة', 'Approved')
                      : t('طلب تعديل', 'Change requested')}
                  </span>
                  <span className="pub-meta">
                    {' · '}
                    {dateFormatter.format(new Date(row.decided_at))}
                  </span>
                  {row.comment && <p className="pub-muted mt-1 text-[15px]">{row.comment}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------- Invoice and receipt: no gateway anywhere ---------- */}
        {data.invoice && (
          <section className="pub-card mb-4 p-6 sm:p-7">
            <h3 className="pub-h2">{t('الدفعة', 'Payment')}</h3>
            <p className="pub-title mt-2">
              {data.invoice.amount} {data.invoice.currency}
            </p>
            <p className="pub-muted mt-3 text-[15px]">
              {t(
                'حوّل المبلغ بالبيانات التي أرسلها لك الاستوديو، ثم ارفع صورة الإيصال هنا. التأكيد يدوي من الاستوديو — لا يوجد خصم تلقائي ولا تُطلب أي بيانات بطاقة.',
                'Transfer the amount using the details the studio sent you, then upload a photo of the receipt here. The studio confirms it manually — nothing is charged automatically and no card details are ever collected.'
              )}
            </p>

            {data.receipt_uploaded ? (
              <p className="mt-4 text-[16px] font-semibold">
                {t(
                  'تم استلام الإيصال. سيؤكده الاستوديو قريباً.',
                  'Receipt received. The studio will confirm it shortly.'
                )}
              </p>
            ) : (
              <div className="mt-4">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  onChange={handleReceipt}
                  disabled={receiptBusy}
                />
                <p className="pub-meta mt-2">
                  {t('صورة أو PDF، بحد أقصى ٥ ميجابايت.', 'JPG, PNG or PDF, up to 5MB.')}
                </p>
                {receiptBusy && <p className="mt-2 text-xs">{t('جارٍ الرفع…', 'Uploading…')}</p>}
              </div>
            )}
          </section>
        )}

        <footer
          className="pub-muted mt-12 border-t pt-5 text-center text-[13px]"
          style={{ borderColor: 'var(--pub-border)' }}
        >
          Powered by Interior Studio OS
        </footer>
      </div>
    </div>
  )
}
