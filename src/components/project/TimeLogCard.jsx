import { useEffect, useState } from 'react'
import { addTimeLog, deleteTimeLog, hoursFrom, listTimeLogs, totalByStage } from '../../lib/timeLogs'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, Field, Input, Select } from '../ui'
import { useFeatureUse } from '../../lib/useFeatureUse'

/**
 * Hours on this project.
 *
 * Manual entry, no timer. Hours in, minutes stored — "1.5" is what a
 * designer types and 90 is what survives without rounding.
 */
export default function TimeLogCard({ project, definitions }) {
  useFeatureUse('time_log')
  const { t, language } = useI18n()
  const { profile } = useAuth()

  const [logs, setLogs] = useState([])
  const [draft, setDraft] = useState({ hours: '', stage_key: '', note: '' })
  const [error, setError] = useState('')

  async function load() {
    setLogs(await listTimeLogs(project.id))
  }

  useEffect(() => {
    load()
  }, [project.id])

  const total = logs.reduce((sum, l) => sum + l.minutes, 0)
  const byStage = totalByStage(logs)

  const stageTitle = (key) => {
    const d = definitions?.find((x) => x.stage_key === key)
    return (language === 'ar' ? d?.title_ar : d?.title_en) ?? key
  }

  async function add() {
    setError('')
    const minutes = Math.round((Number(draft.hours) || 0) * 60)
    if (minutes <= 0) return
    try {
      await addTimeLog({
        project_id: project.id,
        stage_key: draft.stage_key || null,
        minutes,
        note: draft.note.trim() || null,
        logged_by: profile?.id ?? null,
      })
      setDraft({ hours: '', stage_key: '', note: '' })
      load()
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
        {t('time.title')}
      </h3>
      <p className="mb-3 text-xs text-text-secondary">{t('time.help')}</p>

      <p className="mb-4 text-2xl font-semibold text-accent">
        {t('time.totalHours', { hours: hoursFrom(total) })}
      </p>

      {Object.keys(byStage).length > 0 && (
        <ul className="mb-4 space-y-1">
          {Object.entries(byStage).map(([key, minutes]) => (
            <li key={key} className="flex justify-between text-sm">
              <span className="text-text-secondary">{key === '—' ? t('time.noStage') : stageTitle(key)}</span>
              <span className="font-mono text-text" dir="ltr">{hoursFrom(minutes)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="w-24">
          <Field label={t('time.hours')}>
            <Input type="number" step="0.25" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
          </Field>
        </div>
        <div className="w-44">
          <Field label={t('time.stage')}>
            <Select value={draft.stage_key} onChange={(e) => setDraft({ ...draft, stage_key: e.target.value })}>
              <option value="">{t('time.noStage')}</option>
              {(definitions ?? []).map((d) => (
                <option key={d.stage_key} value={d.stage_key}>
                  {language === 'ar' ? d.title_ar : d.title_en}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="min-w-40 flex-1">
          <Field label={t('time.note')}>
            <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </Field>
        </div>
        <Button onClick={add} disabled={!draft.hours}>{t('common.add')}</Button>
      </div>

      <ErrorText>{error}</ErrorText>

      {logs.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3">
          {logs.slice(0, 12).map((log) => (
            <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-text">
                <span className="font-mono" dir="ltr">{hoursFrom(log.minutes)}</span>
                <span className="ms-2 text-xs text-text-secondary">
                  {formatDate(log.logged_at, language)}
                  {log.stage_key && ` · ${stageTitle(log.stage_key)}`}
                  {log.note && ` · ${log.note}`}
                </span>
              </span>
              <Button
                variant="ghost"
                className="px-2 py-0.5"
                onClick={async () => { await deleteTimeLog(log.id); load() }}
              >
                {t('common.delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
