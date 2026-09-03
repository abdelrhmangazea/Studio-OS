import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/errorMessage'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, SectionTitle } from '../ui'

/**
 * Load and reset the teaching data.
 *
 * Built for a classroom, not for a demo of a demo. Thirty students will
 * break things during a session and the instructor needs one button
 * that puts it all back — so Load always resets first, and pressing it
 * twice gives the same result as pressing it once.
 *
 * The buttons are owner-only here, but that is a courtesy, not the
 * control: the database refuses both functions to anyone who is not
 * the owner or a platform admin. Hiding a button never stopped anyone.
 */
/**
 * Put the two placeholder objects behind the seeded file rows.
 *
 * Runs after the seeder, never before: the storage policy only allows
 * an upload when a files row already names that exact path, so the
 * rows have to exist first.
 *
 * The paths carry the workspace id. One shared object would be simpler
 * and wrong — storage delete on this bucket is granted to anyone
 * holding a files row that names the object, so a single student
 * deleting a demo file would take the placeholder away from every
 * other studio.
 *
 * Best-effort by design. A failure here means a download shows an
 * error; it does not mean the demo data is bad, so it must not fail
 * the whole load.
 */
async function uploadPlaceholders(workspaceId) {
  const [pdf, jpg] = await Promise.all([
    fetch('/demo/placeholder.pdf').then((r) => r.blob()),
    fetch('/demo/placeholder.jpg').then((r) => r.blob()),
  ])

  const targets = [
    ['project-files', `demo/${workspaceId}/placeholder.pdf`, pdf, 'application/pdf'],
    ['project-files', `demo/${workspaceId}/placeholder.jpg`, jpg, 'image/jpeg'],
    ['receipts', `${workspaceId}/demo-placeholder.jpg`, jpg, 'image/jpeg'],
  ]

  await Promise.all(
    targets.map(([bucket, path, body, contentType]) =>
      supabase.storage.from(bucket).upload(path, body, { contentType, upsert: true }),
    ),
  )
}

export default function DemoSettings() {
  const { t } = useI18n()
  const { isOwner, workspace } = useAuth()

  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [repaired, setRepaired] = useState(false)

  async function refreshStatus() {
    const { data, error: failed } = await supabase.rpc('demo_status')
    if (!failed) setStatus(data)
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  async function run(action) {
    // Reset throws away work a student may have done on the demo
    // records. It is recoverable in one click, but say so first.
    if (!window.confirm(t(action === 'load' ? 'demo.confirmLoad' : 'demo.confirmReset'))) return

    setBusy(action)
    setError('')
    setResult(null)

    try {
      const { data, error: failed } = await supabase.rpc(
        action === 'load' ? 'load_demo_data' : 'reset_demo_data',
      )
      if (failed) throw failed

      if (action === 'load') {
        // Best effort — see uploadPlaceholders. A studio with the demo
        // data loaded but a placeholder missing is still a usable
        // classroom; a load that refuses because of it is not.
        try {
          await uploadPlaceholders(workspace.id)
        } catch {
          /* downloads will show an error; the records are fine */
        }
      }

      setResult({ action, counts: data })
      await refreshStatus()
    } catch (caught) {
      // errorMessage(failure, t) — the second argument is the
      // translator, not the fallback key. Passing the key here made
      // every failure throw inside the catch and show nothing.
      setError(errorMessage(caught, t))
    } finally {
      setBusy('')
    }
  }

  /**
   * The placeholders alone, for a studio whose demo records exist
   * but whose files 404. That is exactly the state a load by SQL
   * leaves behind — the seeder runs in the database, the upload runs
   * in the browser, and only one of them happened.
   */
  async function repair() {
    setBusy('repair')
    setError('')
    setResult(null)
    setRepaired(false)
    try {
      await uploadPlaceholders(workspace.id)
      setRepaired(true)
    } catch (caught) {
      setError(errorMessage(caught, t))
    } finally {
      setBusy('')
    }
  }

  const loaded = (status?.contacts ?? 0) > 0

  return (
    <Card className="mb-6">
      <SectionTitle hint={t('demo.help')}>{t('demo.title')}</SectionTitle>

      <p className="mb-4 text-sm text-text-secondary">
        {loaded
          ? t('demo.present', {
              contacts: status.contacts,
              projects: status.projects,
              suppliers: status.suppliers,
            })
          : t('demo.absent')}
      </p>

      {!isOwner && <p className="mb-4 text-sm text-warning">{t('settings.ownerOnly')}</p>}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!isOwner || busy !== ''} onClick={() => run('load')}>
          {busy === 'load' ? t('common.saving') : t('demo.load')}
        </Button>

        <Button
          variant="secondary"
          disabled={!isOwner || busy !== '' || !loaded}
          onClick={() => run('reset')}
        >
          {busy === 'reset' ? t('common.saving') : t('demo.reset')}
        </Button>

        {loaded && (
          <Button
            variant="secondary"
            disabled={!isOwner || busy !== ''}
            onClick={repair}
            title={t('demo.repairHelp')}
          >
            {busy === 'repair' ? t('common.saving') : t('demo.repair')}
          </Button>
        )}
      </div>

      {repaired && <p className="mt-3 text-sm text-success">{t('demo.repaired')}</p>}

      {result?.action === 'load' && (
        <p className="mt-4 text-sm text-success">
          {t('demo.loadedSummary', {
            contacts: result.counts.contacts,
            projects: result.counts.projects,
            tasks: result.counts.tasks,
            stages: result.counts.stages_covered,
          })}
        </p>
      )}

      {result?.action === 'reset' && (
        <p className="mt-4 text-sm text-success">{t('demo.resetDone')}</p>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <p className="mt-4 text-xs text-text-secondary">{t('demo.safety')}</p>
    </Card>
  )
}
