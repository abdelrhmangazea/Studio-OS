import { useEffect, useState } from 'react'
import {
  blockedDates as blockedDatesApi,
  bookingQuestions as questionsApi,
  getBookingSettings,
  listBlockedDates,
  listBookingQuestions,
  listSessionTypes,
  saveBookingSettings,
  sessionTypes as sessionTypesApi,
} from '../lib/booking'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input, PageTitle, SectionTitle, Select } from '../components/ui'

const DAYS = [0, 1, 2, 3, 4, 5, 6]
const MODES = ['zoom', 'onsite', 'office']
const FIELD_TYPES = ['short_text', 'long_text', 'dropdown', 'checkbox', 'file']

/** Everything that shapes the public booking page. */
export default function BookingSetup() {
  const { t, language } = useI18n()
  const { workspace } = useAuth()

  const [settings, setSettings] = useState(null)
  const [types, setTypes] = useState([])
  const [questions, setQuestions] = useState([])
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function load() {
    const [s, ty, q, bd] = await Promise.all([
      getBookingSettings(),
      listSessionTypes(),
      listBookingQuestions(),
      listBlockedDates(),
    ])
    setSettings(
      s ?? {
        availability: [],
        session_duration_minutes: 60,
        buffer_minutes: 15,
        minimum_notice_hours: 24,
        maximum_days_ahead: 60,
        timezone: 'Africa/Cairo',
        public_slug: '',
        is_active: false,
      }
    )
    setTypes(ty)
    setQuestions(q)
    setBlocked(bd)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  const publicUrl = `${window.location.origin}/book/${settings.public_slug || '…'}`

  const ruleFor = (day) => settings.availability.find((r) => r.day === day)

  function setRule(day, patch) {
    const existing = ruleFor(day)
    const next = existing
      ? settings.availability.map((r) => (r.day === day ? { ...r, ...patch } : r))
      : [...settings.availability, { day, start: '10:00', end: '17:00', ...patch }]
    setSettings({ ...settings, availability: next.sort((a, b) => a.day - b.day) })
    setSaved(false)
  }

  function toggleDay(day) {
    if (ruleFor(day)) {
      setSettings({ ...settings, availability: settings.availability.filter((r) => r.day !== day) })
    } else {
      setRule(day, {})
    }
    setSaved(false)
  }

  async function handleSave() {
    setError('')
    try {
      const { id, created_at, updated_at, ...rest } = settings
      const row = { ...rest, workspace_id: workspace.id }
      setSettings(await saveBookingSettings(id, row))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageTitle subtitle={t('booking.setupSubtitle')}>{t('nav.bookingSetup')}</PageTitle>

      {/* ---------- The public link ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('booking.linkHelp')}>{t('booking.link')}</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('booking.slug')}>
            <Input
              value={settings.public_slug}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  public_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                })
              }
            />
          </Field>
          <Field label={t('booking.isActive')} hint={t('booking.isActiveHelp')}>
            <Select
              value={settings.is_active ? 'yes' : 'no'}
              onChange={(e) => setSettings({ ...settings, is_active: e.target.value === 'yes' })}
            >
              <option value="yes">{t('booking.live')}</option>
              <option value="no">{t('booking.off')}</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="rounded border border-border bg-bg px-3 py-2 text-xs text-text-secondary" dir="ltr">
            {publicUrl}
          </code>
          <Button
            variant="secondary"
            className="px-2 py-1"
            onClick={async () => {
              await navigator.clipboard.writeText(publicUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? t('generator.copied') : t('generator.copy')}
          </Button>
          <a
            href={`/book/${settings.public_slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent hover:underline"
          >
            {t('booking.preview')}
          </a>
        </div>
      </Card>

      {/* ---------- Availability ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('booking.availabilityHelp')}>{t('booking.availability')}</SectionTitle>

        <div className="space-y-2">
          {DAYS.map((day) => {
            const rule = ruleFor(day)
            return (
              <div key={day} className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={Boolean(rule)}
                    onChange={() => toggleDay(day)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {t(`booking.day_${day}`)}
                </label>

                {rule && (
                  <div dir="ltr" className="flex items-center gap-2">
                    <input
                      type="time"
                      value={rule.start}
                      onChange={(e) => setRule(day, { start: e.target.value })}
                      className="rounded border border-border bg-surface px-2 py-1 text-sm text-text"
                    />
                    <span className="text-text-secondary">→</span>
                    <input
                      type="time"
                      value={rule.end}
                      onChange={(e) => setRule(day, { end: e.target.value })}
                      className="rounded border border-border bg-surface px-2 py-1 text-sm text-text"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={t('booking.duration')}>
            <Input
              type="number"
              value={settings.session_duration_minutes}
              onChange={(e) =>
                setSettings({ ...settings, session_duration_minutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field label={t('booking.buffer')} hint={t('booking.bufferHelp')}>
            <Input
              type="number"
              value={settings.buffer_minutes}
              onChange={(e) => setSettings({ ...settings, buffer_minutes: Number(e.target.value) })}
            />
          </Field>
          <Field label={t('booking.notice')} hint={t('booking.noticeHelp')}>
            <Input
              type="number"
              value={settings.minimum_notice_hours}
              onChange={(e) =>
                setSettings({ ...settings, minimum_notice_hours: Number(e.target.value) })
              }
            />
          </Field>
          <Field label={t('booking.horizon')} hint={t('booking.horizonHelp')}>
            <Input
              type="number"
              value={settings.maximum_days_ahead}
              onChange={(e) =>
                setSettings({ ...settings, maximum_days_ahead: Number(e.target.value) })
              }
            />
          </Field>
          <Field label={t('booking.timezone')} hint={t('booking.timezoneHelp')}>
            <Input
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSave}>{t('common.save')}</Button>
          {saved && <span className="text-sm text-success">{t('common.saved')}</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </Card>

      {/* ---------- Blocked dates ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('booking.blockedHelp')}>{t('booking.blocked')}</SectionTitle>

        <div className="space-y-2">
          {blocked.map((row) => (
            <div key={row.id} className="flex items-center gap-3">
              <span className="text-sm text-text" dir="ltr">
                {row.date}
              </span>
              <span className="flex-1 text-xs text-text-secondary">{row.reason}</span>
              <Button
                variant="ghost"
                className="px-2 py-1"
                onClick={() => blockedDatesApi.remove(row.id).then(load)}
              >
                {t('common.delete')}
              </Button>
            </div>
          ))}
        </div>

        <AddBlockedDate onAdded={load} />
      </Card>

      {/* ---------- Session types ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('booking.sessionTypesHelp')}>{t('booking.sessionTypes')}</SectionTitle>

        <div className="space-y-3">
          {types.map((type) => (
            <div key={type.id} className="grid gap-2 rounded border border-border p-3 sm:grid-cols-2">
              <Input
                dir="rtl"
                value={type.label_ar}
                onChange={(e) =>
                  setTypes(types.map((x) => (x.id === type.id ? { ...x, label_ar: e.target.value } : x)))
                }
                onBlur={(e) => sessionTypesApi.update(type.id, { label_ar: e.target.value })}
              />
              <Input
                value={type.label_en}
                onChange={(e) =>
                  setTypes(types.map((x) => (x.id === type.id ? { ...x, label_en: e.target.value } : x)))
                }
                onBlur={(e) => sessionTypesApi.update(type.id, { label_en: e.target.value })}
              />
              <Select
                value={type.mode}
                onChange={(e) => {
                  setTypes(types.map((x) => (x.id === type.id ? { ...x, mode: e.target.value } : x)))
                  sessionTypesApi.update(type.id, { mode: e.target.value })
                }}
              >
                {MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {t(`booking.mode_${mode}`)}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={type.duration_minutes}
                  onChange={(e) =>
                    setTypes(
                      types.map((x) =>
                        x.id === type.id ? { ...x, duration_minutes: Number(e.target.value) } : x
                      )
                    )
                  }
                  onBlur={(e) =>
                    sessionTypesApi.update(type.id, { duration_minutes: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  value={type.fee ?? ''}
                  placeholder={t('booking.fee')}
                  onChange={(e) =>
                    setTypes(types.map((x) => (x.id === type.id ? { ...x, fee: e.target.value } : x)))
                  }
                  onBlur={(e) =>
                    sessionTypesApi.update(type.id, {
                      fee: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  className="px-2 py-1"
                  onClick={() => sessionTypesApi.remove(type.id).then(load)}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          className="mt-3"
          onClick={() =>
            sessionTypesApi
              .create({
                label_ar: 'استشارة',
                label_en: 'Consultation',
                mode: 'zoom',
                duration_minutes: 60,
                sort_order: types.length + 1,
              })
              .then(load)
          }
        >
          {t('booking.addSessionType')}
        </Button>
      </Card>

      {/* ---------- Question builder ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('booking.questionsHelp')}>{t('booking.questions')}</SectionTitle>

        <div className="space-y-3">
          {questions.map((question, index) => (
            <div key={question.id} className="rounded border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  dir="rtl"
                  value={question.label_ar}
                  onChange={(e) =>
                    setQuestions(
                      questions.map((x) =>
                        x.id === question.id ? { ...x, label_ar: e.target.value } : x
                      )
                    )
                  }
                  onBlur={(e) => questionsApi.update(question.id, { label_ar: e.target.value })}
                />
                <Input
                  value={question.label_en}
                  onChange={(e) =>
                    setQuestions(
                      questions.map((x) =>
                        x.id === question.id ? { ...x, label_en: e.target.value } : x
                      )
                    )
                  }
                  onBlur={(e) => questionsApi.update(question.id, { label_en: e.target.value })}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="w-40">
                  <Select
                    value={question.field_type}
                    onChange={(e) => {
                      setQuestions(
                        questions.map((x) =>
                          x.id === question.id ? { ...x, field_type: e.target.value } : x
                        )
                      )
                      questionsApi.update(question.id, { field_type: e.target.value })
                    }}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`booking.type_${type}`)}
                      </option>
                    ))}
                  </Select>
                </div>

                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={question.is_required}
                    onChange={(e) => {
                      setQuestions(
                        questions.map((x) =>
                          x.id === question.id ? { ...x, is_required: e.target.checked } : x
                        )
                      )
                      questionsApi.update(question.id, { is_required: e.target.checked })
                    }}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {t('booking.required')}
                </label>

                <Button
                  variant="secondary"
                  className="px-2 py-1"
                  disabled={index === 0}
                  onClick={async () => {
                    const above = questions[index - 1]
                    await questionsApi.update(question.id, { sort_order: above.sort_order })
                    await questionsApi.update(above.id, { sort_order: question.sort_order })
                    load()
                  }}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  className="px-2 py-1"
                  disabled={index === questions.length - 1}
                  onClick={async () => {
                    const below = questions[index + 1]
                    await questionsApi.update(question.id, { sort_order: below.sort_order })
                    await questionsApi.update(below.id, { sort_order: question.sort_order })
                    load()
                  }}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-1"
                  onClick={() => questionsApi.remove(question.id).then(load)}
                >
                  {t('common.delete')}
                </Button>
              </div>

              {['dropdown', 'checkbox'].includes(question.field_type) && (
                <div className="mt-2">
                  <Field label={t('booking.options')} hint={t('booking.optionsHelp')}>
                    <Input
                      defaultValue={(question.options ?? []).join(', ')}
                      onBlur={(e) =>
                        questionsApi
                          .update(question.id, {
                            options: e.target.value
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                          .then(load)
                      }
                    />
                  </Field>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          className="mt-3"
          onClick={() =>
            questionsApi
              .create({
                label_ar: 'سؤال جديد',
                label_en: 'New question',
                field_type: 'short_text',
                sort_order: questions.length + 1,
              })
              .then(load)
          }
        >
          {t('booking.addQuestion')}
        </Button>
      </Card>
    </div>
  )
}

function AddBlockedDate({ onAdded }) {
  const { t } = useI18n()
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <div className="w-44">
        <Field label={t('booking.blockDate')}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="flex-1">
        <Field label={t('booking.blockReason')}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <Button
        variant="secondary"
        disabled={!date}
        onClick={() =>
          blockedDatesApi.create({ date, reason: reason || null }).then(() => {
            setDate('')
            setReason('')
            onAdded()
          })
        }
      >
        {t('common.add')}
      </Button>
    </div>
  )
}
