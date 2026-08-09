import { useEffect, useState } from 'react'
import {
  getPortalLink,
  getRevisions,
  issuePortalLink,
  portalUrl,
  revokePortalLink,
  setRevisionAllowance,
} from '../../lib/portal'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, Field, Input } from '../ui'
import { useFeatureUse } from '../../lib/useFeatureUse'
import { errorMessage } from '../../lib/errorMessage'

/**
 * The portal link, and the revision budget that goes with it.
 *
 * A project has no portal until this is used — nothing is exposed by
 * default. Regenerating revokes the previous token in the same
 * transaction, so two working links can never exist at once.
 */
export default function PortalLinkCard({ project, changeRequests }) {
  useFeatureUse('client_portal')
  const { t } = useI18n()
  const [link, setLink] = useState(null)
  const [revisions, setRevisions] = useState(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  async function load() {
    try {
      setLink(await getPortalLink(project.id))
      setRevisions(await getRevisions(project.id))
    } catch (caught) {
      setError(errorMessage(caught, t))
    }
  }

  useEffect(() => {
    load()
  }, [project.id])

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy(false)
    setConfirmRegenerate(false)
  }

  const url = link ? portalUrl(link.token) : ''

  return (
    <Card>
      <h3 className="mb-1 t-section">
        {t('portal.title')}
      </h3>
      <p className="mb-3 text-xs text-text-secondary">{t('portal.help')}</p>

      {!link ? (
        <Button disabled={busy} onClick={() => run(() => issuePortalLink(project.id))}>
          {t('portal.create')}
        </Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={url} dir="ltr" className="min-w-0 flex-1 font-mono text-xs" />
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-card border border-separator px-3 py-2 text-sm text-accent hover:underline"
            >
              {t('portal.preview')}
            </a>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {confirmRegenerate ? (
              <>
                <span className="text-xs text-warning">{t('portal.regenerateWarning')}</span>
                <Button disabled={busy} onClick={() => run(() => issuePortalLink(project.id))}>
                  {t('portal.regenerateConfirm')}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRegenerate(false)}>
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setConfirmRegenerate(true)}>
                  {t('portal.regenerate')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => revokePortalLink(project.id))}
                >
                  {t('portal.revoke')}
                </Button>
              </>
            )}
          </div>
        </>
      )}

      <ErrorText>{error}</ErrorText>

      {/* ---------- Revisions ---------- */}
      {revisions && (
        <div className="mt-4 border-t border-separator pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Field label={t('portal.freeAllowance')}>
                <Input
                  type="number"
                  min="0"
                  value={revisions.free_allowance}
                  onChange={(e) =>
                    setRevisions({ ...revisions, free_allowance: Number(e.target.value) })
                  }
                  onBlur={() => setRevisionAllowance(project.id, revisions.free_allowance)}
                />
              </Field>
            </div>
            <p className="pb-2 text-sm text-text-secondary">
              {t('portal.used', { used: revisions.used })}
              {revisions.used > revisions.free_allowance && (
                <span className="text-warning"> · {t('portal.billable')}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Change requests waiting on you. The counter stands in for a
          task until tasks exist in Bucket 7. */}
      {changeRequests > 0 && (
        <p className="mt-3 rounded border border-warning px-3 py-2 text-sm text-warning">
          {t('portal.openChangeRequests', { count: changeRequests })}
        </p>
      )}
    </Card>
  )
}
