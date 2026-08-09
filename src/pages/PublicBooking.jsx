import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchBookingPage, fetchSlots, submitBooking, uploadAnswerFile } from '../lib/publicBooking'
import { COUNTRIES } from '../data/countries'
import { publicErrorMessage } from '../lib/errorMessage'
import { readableOn } from '../lib/readableOn'
import { usePageTitle } from '../lib/usePageTitle'

/**
 * The public booking page. No login, white-label.
 *
 * Everything it knows comes from public_booking_page and
 * public_available_slots — it cannot read a table directly, so it cannot
 * see contacts, projects or anyone else's bookings.
 *
 * Times are always shown in the STUDIO's timezone and labelled with it,
 * so a client in another country books the slot the designer meant.
 */
export default function PublicBooking() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionType, setSessionType] = useState(null)
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [chosenDay, setChosenDay] = useState(null)
  const [chosenSlot, setChosenSlot] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phoneCode: '+20',
    phone: '',
    brief: '',
  })
  const [answers, setAnswers] = useState({})
  // Chosen files wait here until the booking exists — see handleSubmit.
  const [files, setFiles] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // White-label reaches the tab too, not just the page.
  usePageTitle(page?.studio?.name)

  const language = page?.studio?.language === 'ar' ? 'ar' : 'en'
  const rtl = language === 'ar'
  const tz = page?.settings?.timezone ?? 'Africa/Cairo'
  const label = (row) => (rtl ? row.label_ar : row.label_en)

  useEffect(() => {
    fetchBookingPage(slug)
      .then((data) => {
        setPage(data)
        setSessionType(data?.session_types?.[0] ?? null)
      })
      .catch(() => setPage(null))
      .finally(() => setLoading(false))
  }, [slug])

  // Slots for the whole horizon, then grouped by day.
  useEffect(() => {
    if (!sessionType) return
    setSlotsLoading(true)
    setChosenSlot(null)

    const from = new Date()
    const to = new Date()
    to.setDate(to.getDate() + (page?.settings?.maximum_days_ahead ?? 60))

    fetchSlots(slug, sessionType.id, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10))
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [slug, sessionType, page])

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(rtl ? 'ar-EG-u-nu-latn' : 'en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        timeZone: tz,
      }),
    [rtl, tz]
  )
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(rtl ? 'ar-EG-u-nu-latn' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz,
      }),
    [rtl, tz]
  )

  const byDay = useMemo(() => {
    const map = new Map()
    for (const iso of slots) {
      const key = dayFormatter.format(new Date(iso))
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(iso)
    }
    return [...map.entries()]
  }, [slots, dayFormatter])

  if (loading) {
    return <div className="public-page p-10 text-[16px]">…</div>
  }

  if (!page) {
    return (
      <div className="public-page flex min-h-screen items-center justify-center p-10">
        <p className="text-[16px]">
          {rtl ? 'صفحة الحجز هذه غير متاحة.' : 'This booking page is not available.'}
        </p>
      </div>
    )
  }

  const accent = page.studio.accent_color || '#0077B6'
  const missingRequired = (page.questions ?? []).some(
    (q) => q.is_required && !String(answers[label(q)] ?? '').trim()
  )
  const canSubmit = chosenSlot && form.name.trim() && form.email.trim() && !missingRequired

  async function handleSubmit() {
    setBusy(true)
    setError('')
    try {
      const result = await submitBooking({
        slug,
        sessionTypeId: sessionType.id,
        slotStart: chosenSlot,
        name: form.name,
        email: form.email,
        phoneCode: form.phoneCode,
        phone: form.phone,
        brief: form.brief,
        answers,
      })
      // The booking is committed. Files go up now, against its token.
      // A failed upload is not a failed booking — the confirmation page
      // knows which files are still missing and asks for them again.
      for (const [questionId, file] of Object.entries(files)) {
        try {
          await uploadAnswerFile(result.token, result.upload_prefix, questionId, file)
        } catch {
          // Deliberately swallowed. Reported on the confirmation page.
        }
      }

      navigate(`/booking/${result.token}`)
    } catch (failure) {
      // A clash here means someone took the slot first — refresh what is left.
      setError(publicErrorMessage(failure, rtl))
      const from = new Date()
      const to = new Date()
      to.setDate(to.getDate() + (page.settings?.maximum_days_ahead ?? 60))
      setSlots(
        await fetchSlots(
          slug,
          sessionType.id,
          from.toISOString().slice(0, 10),
          to.toISOString().slice(0, 10)
        ).catch(() => [])
      )
      setChosenSlot(null)
    }
    setBusy(false)
  }

  return (
    <div className="public-page" dir={rtl ? 'rtl' : 'ltr'} lang={language} style={{ '--pub-accent': accent }}>
      <div className="mx-auto max-w-2xl px-5 py-10">
        {/* ---------- White-label header ---------- */}
        <header className="mb-8 flex items-center gap-3">
          {page.studio.logo_url ? (
            <img src={page.studio.logo_url} alt="" className="h-14 w-auto object-contain" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[16px] text-base font-bold"
              style={{ background: accent, color: readableOn(accent) }}
            >
              {page.studio.name?.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="pub-h2">{page.studio.name}</h1>
            <p className="pub-meta">
              {rtl ? 'احجز استشارتك التصميمية' : 'Book your design consultation'}
            </p>
          </div>
        </header>

        {/* ---------- 1. Session type ---------- */}
        <Section n="1" title={rtl ? 'نوع الاستشارة' : 'Consultation type'}>
          <div className="grid gap-2 sm:grid-cols-3">
            {page.session_types.map((type) => (
              <button
                key={type.id}
                onClick={() => setSessionType(type)}
                className="pub-card p-3 text-start"
                style={
                  sessionType?.id === type.id
                    ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` }
                    : undefined
                }
              >
                <span className="block text-[16px] font-medium">{label(type)}</span>
                <span className="pub-muted block text-[14px]">
                  {type.duration_minutes} {rtl ? 'دقيقة' : 'min'}
                  {type.fee ? ` · ${type.fee} ${page.currency}` : ''}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* ---------- 2. Date and slot ---------- */}
        <Section
          n="2"
          title={rtl ? 'اختر الموعد' : 'Choose a time'}
          hint={`${rtl ? 'كل المواعيد بتوقيت' : 'All times shown in'} ${tz}`}
        >
          {slotsLoading ? (
            <p className="pub-muted text-[16px]">…</p>
          ) : byDay.length === 0 ? (
            <p className="pub-muted text-[16px]">
              {rtl ? 'لا توجد مواعيد متاحة حالياً.' : 'No times are available right now.'}
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {byDay.slice(0, 14).map(([day]) => (
                  <button
                    key={day}
                    onClick={() => setChosenDay(day)}
                    className="pub-slot"
                    data-selected={(chosenDay ?? byDay[0][0]) === day}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {(byDay.find(([day]) => day === (chosenDay ?? byDay[0][0]))?.[1] ?? []).map(
                  (iso) => (
                    <button
                      key={iso}
                      onClick={() => setChosenSlot(iso)}
                      className="pub-slot"
                      data-selected={chosenSlot === iso}
                    >
                      {timeFormatter.format(new Date(iso))}
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </Section>

        {/* ---------- 3. Details ---------- */}
        <Section n="3" title={rtl ? 'بياناتك' : 'Your details'}>
          <div className="space-y-3">
            <Field label={rtl ? 'الاسم' : 'Name'} required>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>

            <Field label={rtl ? 'البريد الإلكتروني' : 'Email'} required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>

            <Field label={rtl ? 'رقم الهاتف' : 'Phone'}>
              <div dir="ltr" className="flex gap-2">
                <select
                  className="!w-40"
                  value={form.phoneCode}
                  onChange={(e) => setForm({ ...form, phoneCode: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.iso} value={c.dial}>
                      {c.flag} {c.dial} {rtl ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </Field>

            <Field label={rtl ? 'نبذة عن المشروع (اختياري)' : 'Project brief (optional)'}>
              <textarea
                rows={3}
                value={form.brief}
                onChange={(e) => setForm({ ...form, brief: e.target.value })}
              />
            </Field>
          </div>
        </Section>

        {/* ---------- 4. The designer's own questions ---------- */}
        {page.questions.length > 0 && (
          <Section n="4" title={rtl ? 'بعض الأسئلة' : 'A few questions'}>
            <div className="space-y-3">
              {page.questions.map((question) => {
                const key = label(question)
                const value = answers[key] ?? ''
                const set = (v) => setAnswers({ ...answers, [key]: v })

                return (
                  <Field key={question.id} label={key} required={question.is_required}>
                    {question.field_type === 'long_text' ? (
                      <textarea rows={3} value={value} onChange={(e) => set(e.target.value)} />
                    ) : question.field_type === 'dropdown' ? (
                      <select value={value} onChange={(e) => set(e.target.value)}>
                        <option value="">—</option>
                        {(question.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : question.field_type === 'checkbox' ? (
                      <div className="space-y-1">
                        {(question.options ?? []).map((option) => {
                          const list = value ? value.split(', ') : []
                          const on = list.includes(option)
                          return (
                            <label key={option} className="flex items-center gap-2 text-[16px]">
                              <input
                                type="checkbox"
                                className="!w-4"
                                checked={on}
                                onChange={() =>
                                  set(
                                    (on
                                      ? list.filter((x) => x !== option)
                                      : [...list, option]
                                    ).join(', ')
                                  )
                                }
                              />
                              {option}
                            </label>
                          )
                        })}
                      </div>
                    ) : question.field_type === 'file' ? (
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                          onChange={(e) => {
                            const chosen = e.target.files?.[0]
                            setFiles({ ...files, [question.id]: chosen ?? undefined })
                            // The answer itself records the file's name, so
                            // the brief and the note read as sentences.
                            set(chosen ? chosen.name : '')
                          }}
                        />
                        <p className="mt-1 text-[14px] opacity-70">
                          {rtl
                            ? 'صورة أو PDF، بحد أقصى ١٠ ميجابايت. يُرفع بعد تأكيد الحجز.'
                            : 'Image or PDF, up to 10MB. Uploaded once the booking is confirmed.'}
                        </p>
                      </div>
                    ) : (
                      <input value={value} onChange={(e) => set(e.target.value)} />
                    )}
                  </Field>
                )
              })}
            </div>
          </Section>
        )}

        {error && (
          <p
            className="mb-4 rounded-[14px] p-4 text-[15px]"
            style={{ background: 'var(--pub-danger-bg)', color: 'var(--pub-danger)' }}
          >
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          className="pub-btn pub-btn-primary w-full"
          style={{ background: accent }}
        >
          {busy
            ? rtl
              ? 'جارٍ الحجز…'
              : 'Booking…'
            : rtl
              ? 'تأكيد الحجز'
              : 'Confirm booking'}
        </button>

        <footer className="pub-muted mt-10 border-t pt-4 text-center text-[14px]" style={{ borderColor: 'var(--pub-border)' }}>
          <a href="https://interiorzone.com" target="_blank" rel="noreferrer">
            Powered by Interior Zone
          </a>
        </footer>
      </div>
    </div>
  )
}

function Section({ n, title, hint, children }) {
  return (
    <section className="mb-7">
      <h2 className="mb-1 pub-h2">
        <span className="pub-muted me-2">{n}</span>
        {title}
      </h2>
      {hint && <p className="pub-muted mb-2 text-[14px]">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[14px] font-medium">
        {label}
        {required && <span style={{ color: 'var(--pub-danger)' }}> *</span>}
      </span>
      {children}
    </label>
  )
}
