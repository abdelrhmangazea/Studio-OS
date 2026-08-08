import { useState } from 'react'
import { softDeleteContact, softDeleteProject } from '../lib/dataLifecycle'
import { errorMessage } from '../lib/errorMessage'
import { useI18n } from '../i18n'
import { Button, ErrorText, Modal } from './ui'

/**
 * Delete a client or a project — into the bin, not into nothing.
 *
 * The dialog says where it goes and how long it stays, because the
 * word "delete" makes people expect the worst and hesitate over
 * something that is genuinely undoable for a month.
 *
 * For a contact it also says how many projects go with it, so the
 * scale of the action is visible before it is taken and not
 * discovered afterwards.
 */
export default function DeleteButton({ kind, id, name, projectCount = 0, onDeleted }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      if (kind === 'contact') await softDeleteContact(id)
      else await softDeleteProject(id)
      setOpen(false)
      onDeleted?.()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy(false)
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t('common.delete')}
      </Button>

      <Modal
        open={open}
        title={t('trash.confirmTitle', { name })}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={confirm} disabled={busy}>
              {busy ? t('common.loading') : t('trash.confirmDelete')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text">{t('trash.confirmBody')}</p>

        {kind === 'contact' && projectCount > 0 && (
          <p className="mt-2 text-sm text-warning">
            {t('trash.confirmProjects', { count: projectCount })}
          </p>
        )}

        <p className="mt-2 text-xs text-text-secondary">{t('trash.confirmWhere')}</p>

        <ErrorText>{error}</ErrorText>
      </Modal>
    </>
  )
}
