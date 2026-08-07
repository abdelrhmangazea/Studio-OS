import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listMyFeedback, submitFeedback } from '../lib/feedback'
import { errorMessage } from '../lib/errorMessage'
import { formatDate } from '../lib/format'
import { useI18n } from '../i18n'
import { Button, ErrorText, Field, Modal, Textarea } from './ui'

const KINDS = ['bug', 'idea', 'question']

/**
 * The feedback button, on every screen, always in the same place.
 *
 * It is deliberately not tucked inside Settings. During a beta the
 * moment worth capturing is the moment something goes wrong, and a
 * designer who has to go looking for the form will simply not report
 * it.
 *
 * The page they were on is captured automatically — a bug report that
 * does not say which screen is half a report, and asking someone to
 * remember the URL is asking them to give up.
 */
export default function FeedbackButton() {
  const { t, language } = useI18n()
  const location = useLocation()

  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('bug')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [mine, setMine] = useState(null)

  function reset() {
    setKind('bug')
    setMessage('')
    setError('')
    setSent(false)
    setMine(null)
  }

  async function send() {
    if (!message.trim()) return
    setBusy(true)
    setError('')
    try {
      await submitFeedback({ kind, message, page: location.pathname })
      // Item 18: say so on screen, and keep saying so until they close
      // the box. A form that empties itself and says nothing reads as
      // a form that lost what you wrote.
      setSent(true)
      setMessage('')
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy(false)
  }

  async function showMine() {
    setError('')
    try {
      setMine(await listMyFeedback())
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset()
          setOpen(true)
        }}
        title={t('feedback.title')}
        className="fixed bottom-5 end-5 z-40 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text shadow-lg hover:bg-bg"
      >
        {t('feedback.button')}
      </button>

      <Modal
        open={open}
        title={t('feedback.title')}
        onClose={() => setOpen(false)}
        footer={
          <>
            {!sent && (
              <Button onClick={send} disabled={busy || !message.trim()}>
                {busy ? t('common.loading') : t('feedback.send')}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {sent ? t('common.close') : t('common.cancel')}
            </Button>
          </>
        }
      >
        {sent ? (
          <div className="space-y-3">
            <p className="rounded border border-success/40 bg-success/10 p-3 text-sm text-text">
              {t('feedback.thanks')}
            </p>
            <p className="text-xs text-text-secondary">{t('feedback.thanksNote')}</p>
            <Button
              variant="secondary"
              onClick={() => {
                reset()
              }}
            >
              {t('feedback.sendAnother')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{t('feedback.intro')}</p>

            <Field label={t('feedback.kind')}>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded border px-3 py-1.5 text-sm ${
                      kind === k
                        ? 'border-accent bg-accent/10 text-text'
                        : 'border-border text-text-secondary hover:bg-surface'
                    }`}
                  >
                    {t(`feedback.kind_${k}`)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t('feedback.message')} hint={t('feedback.messageHint')}>
              <Textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
              />
            </Field>

            <p className="text-xs text-text-secondary">
              {t('feedback.pageNote', { page: location.pathname })}
            </p>

            <ErrorText>{error}</ErrorText>

            {/* Seeing what you already sent is the difference between
                "did that go anywhere?" and knowing it did. */}
            {mine === null ? (
              <button
                type="button"
                onClick={showMine}
                className="text-sm text-accent hover:underline"
              >
                {t('feedback.showMine')}
              </button>
            ) : mine.length === 0 ? (
              <p className="text-xs text-text-secondary">{t('feedback.noneYet')}</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto border-t border-border pt-3">
                {mine.map((row) => (
                  <div key={row.id} className="text-xs">
                    <p className="text-text-secondary">
                      {formatDate(row.created_at, language)} · {t(`feedback.kind_${row.kind}`)} ·{' '}
                      {t(`feedback.state_${row.state}`)}
                    </p>
                    <p className="text-text">{row.message}</p>
                    {row.reply && (
                      <p className="mt-1 border-s-2 border-accent ps-2 text-text-secondary">
                        {row.reply}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
