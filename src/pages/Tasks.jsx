import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createTask, deleteTask, groupTasks, listTasks, setTaskDone, today } from '../lib/tasks'
import { listContacts } from '../lib/contacts'
import { listProjects } from '../lib/projects'
import { fullName } from '../lib/contacts'
import { formatDate } from '../lib/format'
import { useI18n } from '../i18n'
import { Button, Card, EmptyState, Field, Input, Loadable, PageTitle, Select } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'

/**
 * Tasks, in three groups: Overdue, Today, Upcoming.
 *
 * Overdue is first and never empties itself. Nothing here reschedules
 * or hides an item that has slipped — it rolls forward and stays in
 * view until it is actually done.
 */
export default function Tasks() {
  useFeatureUse('tasks')
  const { t, language } = useI18n()
  const [tasks, setTasks] = useState([])
  const [contacts, setContacts] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', due_date: today(), contact_id: '', project_id: '' })

  async function load() {
    // Reset both, or a successful retry leaves the old error
    // sitting on screen underneath fresh data.
    setLoading(true)
    setLoadFailure(null)
    try {
      const [taskRows, contactRows, projectRows] = await Promise.all([
        listTasks(),
        listContacts(),
        listProjects(),
      ])
      setTasks(taskRows)
      setContacts(contactRows)
      setProjects(projectRows)
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

  if (loading || loadFailure) {
    return (
      <Loadable loading={loading} failure={loadFailure} onRetry={load} t={t} />
    )
  }

  const groups = groupTasks(tasks)

  async function add() {
    if (!draft.title.trim()) return
    await createTask({
      title: draft.title.trim(),
      due_date: draft.due_date || null,
      contact_id: draft.contact_id || null,
      project_id: draft.project_id || null,
    })
    setDraft({ title: '', due_date: today(), contact_id: '', project_id: '' })
    setAdding(false)
    load()
  }

  return (
    <div>
      <PageTitle subtitle={t('tasks.subtitle', { count: tasks.length })}>
        {t('nav.tasks')}
      </PageTitle>

      <div className="mb-6">
        {adding ? (
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t('tasks.title')}>
                  <Input
                    autoFocus
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                  />
                </Field>
              </div>
              <Field label={t('tasks.due')}>
                <Input
                  type="date"
                  value={draft.due_date}
                  onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                />
              </Field>
              <Field label={t('tasks.client')}>
                <Select
                  value={draft.contact_id}
                  onChange={(e) => setDraft({ ...draft, contact_id: e.target.value })}
                >
                  <option value="">—</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fullName(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('tasks.project')}>
                <Select
                  value={draft.project_id}
                  onChange={(e) => setDraft({ ...draft, project_id: e.target.value })}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={add}>{t('common.add')}</Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </Card>
        ) : (
          <Button onClick={() => setAdding(true)}>{t('tasks.add')}</Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState>{t('tasks.empty')}</EmptyState>
      ) : (
        <div className="space-y-6">
          <TaskGroup
            title={t('tasks.overdue')}
            tone="warning"
            tasks={groups.overdue}
            onChanged={load}
            language={language}
            t={t}
          />
          <TaskGroup
            title={t('tasks.today')}
            tasks={groups.today}
            onChanged={load}
            language={language}
            t={t}
          />
          <TaskGroup
            title={t('tasks.upcoming')}
            tasks={groups.upcoming}
            onChanged={load}
            language={language}
            t={t}
          />
        </div>
      )}
    </div>
  )
}

function TaskGroup({ title, tasks, tone, onChanged, language, t }) {
  if (tasks.length === 0) return null

  return (
    <section>
      <h2
        className={
          'mb-2 t-section ' +
          (tone === 'warning' ? 'text-warning' : 'text-text-secondary')
        }
      >
        {title} · {tasks.length}
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onChanged={onChanged}
            language={language}
            t={t}
          />
        ))}
      </div>
    </section>
  )
}

export function TaskRow({ task, onChanged, language, t }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-separator p-3">
      <button
        onClick={async () => {
          await setTaskDone(task.id, true)
          onChanged()
        }}
        className="h-4 w-4 shrink-0 rounded-card border border-separator hover:border-accent"
        title={t('tasks.markDone')}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{task.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
          {task.contact && (
            <Link to={`/contacts/${task.contact.id}`} className="text-accent hover:underline">
              {fullName(task.contact)}
            </Link>
          )}
          {task.project && (
            <>
              {task.contact && '·'}
              <Link to={`/projects/${task.project.id}`} className="text-accent hover:underline">
                <span className="font-mono" dir="ltr">
                  {task.project.code}
                </span>
              </Link>
            </>
          )}
          {task.due_date && (
            <>
              {(task.contact || task.project) && '·'}
              <span>{formatDate(task.due_date, language)}</span>
            </>
          )}
          {task.source !== 'manual' && (
            <>
              ·<span>{t(`tasks.source_${task.source}`)}</span>
            </>
          )}
        </p>
      </div>

      <Button
        variant="ghost"
        className="px-2 py-1"
        onClick={async () => {
          await deleteTask(task.id)
          onChanged()
        }}
      >
        {t('common.delete')}
      </Button>
    </div>
  )
}
