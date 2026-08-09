import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTasks, setTaskDone, today } from '../../lib/tasks'
import { listReminders, setReminderDone } from '../../lib/reminders'
import { formatDate } from '../../lib/format'
import { useI18n } from '../../i18n'
import { Card, EmptyState, Loadable } from '../ui'

/**
 * Everything outstanding against one contact — their tasks and their
 * follow-up reminders together.
 *
 * Reminders belong to the contact rather than to a project, so this is
 * the one screen where the whole relationship is visible at once,
 * including for clients whose projects have all been delivered.
 */
export default function TasksTab({ contact }) {
  const { t, language } = useI18n()
  const [tasks, setTasks] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)

  async function load() {
    // Reset both, or a successful retry leaves the old error
    // sitting on screen underneath fresh data.
    setLoading(true)
    setLoadFailure(null)
    try {
      const [taskRows, reminderRows] = await Promise.all([listTasks(), listReminders()])
      setTasks(taskRows.filter((row) => row.contact_id === contact.id))
      setReminders(reminderRows.filter((row) => row.contact_id === contact.id))
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

  if (loading || loadFailure) {
    return (
      <Loadable loading={loading} failure={loadFailure} onRetry={load} t={t} />
    )
  }

  if (tasks.length === 0 && reminders.length === 0) {
    return <EmptyState>{t('contact.noTasks')}</EmptyState>
  }

  const now = today()

  return (
    <div className="space-y-4">
      {tasks.length > 0 && (
        <Card>
          <h3 className="mb-3 t-section">
            {t('nav.tasks')}
          </h3>
          <div className="space-y-2">
            {tasks.map((task) => (
              <Row
                key={task.id}
                label={task.title}
                date={task.due_date}
                overdue={task.due_date && task.due_date < now}
                project={task.project}
                note={task.source !== 'manual' ? t(`tasks.source_${task.source}`) : null}
                onDone={async () => {
                  await setTaskDone(task.id, true)
                  load()
                }}
                language={language}
                t={t}
              />
            ))}
          </div>
        </Card>
      )}

      {reminders.length > 0 && (
        <Card>
          <h3 className="mb-3 t-section">
            {t('contact.remindersTitle')}
          </h3>
          <p className="mb-3 text-xs text-text-secondary">{t('contact.remindersHelp')}</p>
          <div className="space-y-2">
            {reminders.map((reminder) => (
              <Row
                key={reminder.id}
                label={t(`reminders.kind_${reminder.kind}`)}
                date={reminder.due_date}
                overdue={reminder.due_date && reminder.due_date < now}
                note={reminder.recurring ? t('reminders.recurring') : null}
                onDone={async () => {
                  await setReminderDone(reminder.id, true)
                  load()
                }}
                language={language}
                t={t}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Row({ label, date, overdue, project, note, onDone, language, t }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-separator p-3">
      <button
        onClick={onDone}
        className="h-4 w-4 shrink-0 rounded-card border border-separator hover:border-accent"
        title={t('tasks.markDone')}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{label}</p>
        <p className="flex flex-wrap gap-x-2 text-xs text-text-secondary">
          {project && (
            <Link
              to={`/projects/${project.id}`}
              className="font-mono text-accent hover:underline"
              dir="ltr"
            >
              {project.code}
            </Link>
          )}
          {date ? (
            <span className={overdue ? 'text-warning' : ''}>{formatDate(date, language)}</span>
          ) : (
            <span className="text-warning">{t('contact.noDateYet')}</span>
          )}
          {note && <span>· {note}</span>}
        </p>
      </div>
    </div>
  )
}
