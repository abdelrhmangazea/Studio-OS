import { useEffect, useState } from 'react'
import { listGeneratedDocuments } from '../../lib/templates'
import { copyToClipboard, htmlToWhatsappText } from '../../lib/exportWhatsapp'
import { formatDateTime } from '../../lib/format'
import { useI18n } from '../../i18n'
import { Badge, Button, EmptyState, Modal } from '../ui'
import DemoBadge from '../DemoBadge'

/**
 * Every document generated for this contact — the record of what was
 * actually sent, with the final edited body exactly as it went out.
 */
export default function DocumentsTab({ contact }) {
  const { t, language } = useI18n()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    listGeneratedDocuments(contact.id).then((rows) => {
      setDocuments(rows)
      setLoading(false)
    })
  }, [contact.id])

  if (loading) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>
  if (documents.length === 0) return <EmptyState>{t('documents.empty')}</EmptyState>

  async function handleCopy(doc) {
    await copyToClipboard(htmlToWhatsappText(doc.final_body))
    setCopied(doc.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="max-w-3xl space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-card border border-separator bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text">{doc.title}</span>
                <DemoBadge on={doc} />
                <Badge>{doc.language === 'ar' ? 'AR' : 'EN'}</Badge>
                {doc.type && <Badge>{doc.type}</Badge>}
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {t('documents.generatedOn', { date: formatDateTime(doc.created_at, language) })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" className="px-2 py-1" onClick={() => setViewing(doc)}>
                {t('documents.view')}
              </Button>
              <Button variant="secondary" className="px-2 py-1" onClick={() => handleCopy(doc)}>
                {copied === doc.id ? t('generator.copied') : t('documents.copyBody')}
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Modal open={Boolean(viewing)} title={viewing?.title || ''} onClose={() => setViewing(null)} wide>
        <div className="rounded-card border border-separator bg-paper text-paper-text p-6">
          <div
            dir={viewing?.language === 'ar' ? 'rtl' : 'ltr'}
            className="studio-doc"
            dangerouslySetInnerHTML={{ __html: viewing?.final_body ?? '' }}
          />
        </div>
      </Modal>
    </div>
  )
}
