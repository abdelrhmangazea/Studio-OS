import { useEffect, useState } from 'react'
import {
  buildExport,
  daysLeft,
  deleteMyAccount,
  downloadExport,
  listDeleted,
  restoreContact,
  restoreProject,
} from '../../lib/dataLifecycle'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  SectionTitle,
  WarningText,
} from '../ui'

/**
 * Your data: what is in the bin, a copy of everything, and the way out.
 *
 * All three in one place on purpose. They answer the same question —
 * "what happens to my work if I change my mind" — and someone about to
 * close their account should see the export button on the way past.
 */
export default function DataSettings() {
  const { t, language } = useI18n()
  const { settings, workspace, isOwner, signOut } = useAuth()

  const [bin, setBin] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [exported, setExported] = useState(null)
  const [confirmation, setConfirmation] = useState('')
  const [armed, setArmed] = useState(false)

  async function loadBin() {
    try {
      setBin(await listDeleted())
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
  }

  useEffect(() => {
    loadBin()
  }, [])

  async function restore(kind, id) {
    setBusy(`restore-${id}`)
    setError('')
    try {
      if (kind === 'contact') await restoreContact(id)
      else await restoreProject(id)
      await loadBin()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy('')
  }

  async function exportAll() {
    setBusy('export')
    setError('')
    setExported(null)
    try {
      const archive = await buildExport()
      downloadExport(archive, settings?.studio_name ?? workspace?.name)
      setExported(archive)
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy('')
  }

  async function closeAccount() {
    setBusy('delete')
    setError('')
    try {
      await deleteMyAccount(confirmation)
      await signOut()
      window.location.replace('/login')
    } catch (failure) {
      setError(errorMessage(failure, t))
      setBusy('')
    }
  }

  const studioName = workspace?.name ?? ''
  const contacts = bin?.contacts ?? []
  const projects = bin?.projects ?? []

  return (
    <>
      {/* ---------------- Item 14: the bin ---------------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('data.binHelp')}>{t('data.bin')}</SectionTitle>

        {bin === null ? (
          <p className="text-sm text-text-secondary">{t('common.loading')}</p>
        ) : contacts.length === 0 && projects.length === 0 ? (
          <EmptyState>{t('data.binEmpty')}</EmptyState>
        ) : (
          <div className="space-y-2">
            {contacts.map((row) => (
              <Row
                key={row.id}
                title={row.name || t('data.unnamed')}
                note={[
                  t('data.deletedOn', { date: formatDate(row.deleted_at, language) }),
                  row.projects > 0 && t('data.withProjects', { count: row.projects }),
                  t('data.daysLeft', { days: daysLeft(row.purges_at) }),
                ]}
                busy={busy === `restore-${row.id}`}
                label={t('data.restore')}
                onRestore={() => restore('contact', row.id)}
              />
            ))}

            {projects.map((row) => (
              <Row
                key={row.id}
                title={`${row.code} · ${row.name}`}
                note={[
                  t('data.deletedOn', { date: formatDate(row.deleted_at, language) }),
                  t('data.daysLeft', { days: daysLeft(row.purges_at) }),
                  // It went down with its client, so it comes back with
                  // them — restoring it alone would attach it to nobody.
                  row.with_contact && t('data.withClient'),
                ]}
                busy={busy === `restore-${row.id}`}
                label={t('data.restore')}
                disabled={row.with_contact}
                onRestore={() => restore('project', row.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ---------------- Item 13: take a copy ---------------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('data.exportHelp')}>{t('data.export')}</SectionTitle>

        <Button onClick={exportAll} disabled={busy === 'export'}>
          {busy === 'export' ? t('data.exporting') : t('data.exportButton')}
        </Button>

        {exported && (
          <div className="mt-4 rounded-card border border-separator p-3 text-sm">
            <p className="text-text">
              {t('data.exportDone', {
                rows: Object.values(exported.row_counts).reduce((a, b) => a + b, 0),
                tables: Object.keys(exported.row_counts).length,
              })}
            </p>
            {exported.tables_that_failed.length > 0 && (
              <WarningText>
                {t('data.exportPartial', {
                  tables: exported.tables_that_failed.map((f) => f.table).join(', '),
                })}
              </WarningText>
            )}
          </div>
        )}
      </Card>

      {/* ---------------- Item 24: the way out ---------------- */}
      <Card className="mb-6 border-danger/40">
        <SectionTitle hint={t('data.closeHelp')}>{t('data.close')}</SectionTitle>

        {!isOwner ? (
          <p className="text-sm text-text-secondary">{t('data.ownerOnly')}</p>
        ) : !armed ? (
          <Button variant="ghost" onClick={() => setArmed(true)}>
            {t('data.closeButton')}
          </Button>
        ) : (
          <div className="space-y-4">
            <WarningText>{t('data.closeWarning')}</WarningText>
            <p className="text-sm text-text-secondary">{t('data.closeFiles')}</p>

            <Field label={t('data.closeConfirmLabel', { name: studioName })}>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={studioName}
                autoComplete="off"
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={closeAccount}
                disabled={busy === 'delete' || confirmation.trim() !== studioName.trim()}
              >
                {busy === 'delete' ? t('common.loading') : t('data.closeConfirm')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setArmed(false)
                  setConfirmation('')
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
    </>
  )
}

function Row({ title, note, busy, label, onRestore, disabled }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-separator p-3">
      <div className="min-w-0">
        <p className="text-sm text-text">{title}</p>
        <p className="text-xs text-text-secondary">
          {note.filter(Boolean).join(' · ')}
        </p>
      </div>
      {!disabled && (
        <Button variant="secondary" onClick={onRestore} disabled={busy}>
          {busy ? '…' : label}
        </Button>
      )}
    </div>
  )
}
