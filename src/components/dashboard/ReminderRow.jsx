import { useState } from 'react'
import { Link } from 'react-router-dom'
import { setReminderDone, templateFor } from '../../lib/reminders'
import { renderTemplate, resolveAutoFields } from '../../lib/mergeEngine'
import { copyToClipboard } from '../../lib/exportWhatsapp'
import { fullName } from '../../lib/contacts'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { Button } from '../ui'

/**
 * A reminder on the dashboard, with its script already written.
 *
 * The spec asks for the message to be "ready to copy" on the due date,
 * so the template is merged the moment the row is opened rather than
 * making the designer walk to the generator. Nothing is sent — this
 * copies, like everything else in the product.
 */
export default function ReminderRow({ reminder, pairs, language, t, onChanged, overdue }) {
  const { settings, profile } = useAuth()
  const [script, setScript] = useState(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const row = templateFor(reminder, pairs, language)

  async function buildScript() {
    setBusy(true)
    const values = await resolveAutoFields({
      contact: reminder.contact,
      settings,
      profile,
      project: null,
      language,
    })
    setScript(renderTemplate(row.body, values))
    setBusy(false)
  }

  return (
    <div className="rounded-card border border-separator p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={async () => {
            await setReminderDone(reminder.id, true)
            onChanged()
          }}
          className="h-4 w-4 shrink-0 rounded-card border border-separator hover:border-accent"
          title={t('tasks.markDone')}
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm text-text">{t(`reminders.kind_${reminder.kind}`)}</p>
          <p className="flex flex-wrap gap-x-2 text-xs text-text-secondary">
            {reminder.contact && (
              <Link to={`/contacts/${reminder.contact.id}`} className="text-accent hover:underline">
                {fullName(reminder.contact)}
              </Link>
            )}
            {reminder.due_date && (
              <span className={overdue ? 'text-warning' : ''}>
                {formatDate(reminder.due_date, language)}
              </span>
            )}
            {reminder.recurring && <span>· {t('reminders.recurring')}</span>}
          </p>
        </div>

        {row && (
          <Button
            variant="secondary"
            className="px-2 py-1"
            disabled={busy}
            onClick={() => (script ? setScript(null) : buildScript())}
          >
            {script ? t('common.close') : t('reminders.showScript')}
          </Button>
        )}
      </div>

      {script && (
        <div className="mt-3 border-t border-separator pt-3">
          <pre
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="whitespace-pre-wrap rounded-card border border-separator bg-bg p-3 font-sans text-sm text-text"
          >
            {script}
          </pre>
          <Button
            className="mt-2"
            onClick={async () => {
              await copyToClipboard(script)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? t('common.copied') : t('common.copy')}
          </Button>
        </div>
      )}
    </div>
  )
}
