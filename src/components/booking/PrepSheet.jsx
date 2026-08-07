import { useEffect, useState } from 'react'
import { listChecklistItems } from '../../lib/projects'
import { getBookingSettings } from '../../lib/booking'
import { buildPrepSheet } from '../../lib/prepSheet'
import { buildDocumentHtml } from '../../lib/documentHtml'
import { exportPdf } from '../../lib/exportPdf'
import { exportDocx } from '../../lib/exportDocx'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Button, Modal } from '../ui'

/**
 * The consultation prep sheet, on screen.
 *
 * The sheet itself is built by buildPrepSheet — the same function the
 * inbox uses to file it automatically when a booking is first opened,
 * so what is filed and what is previewed can never drift apart.
 */
export default function PrepSheet({ booking, open, onClose }) {
  const { t, language } = useI18n()
  const { settings } = useAuth()
  const [items, setItems] = useState([])
  const [timezone, setTimezone] = useState(null)

  useEffect(() => {
    if (!open || !booking?.project_id) return
    listChecklistItems(booking.project_id).then((rows) =>
      setItems(rows.filter((row) => row.stage_key === '01_consultation'))
    )
    getBookingSettings().then((cfg) => setTimezone(cfg?.timezone ?? null))
  }, [open, booking])

  if (!booking) return null

  const rtl = language === 'ar'
  const { title, bodyHtml } = buildPrepSheet({ booking, items, language, timezone })

  const full = () =>
    buildDocumentHtml({
      title,
      bodyHtml,
      language,
      settings,
      meta: booking.project?.code ?? '',
    })

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={() => exportPdf(full())}>
            {t('generator.exportPdf')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportDocx({ title, bodyHtml, language, settings })}
          >
            {t('generator.exportWord')}
          </Button>
        </>
      }
    >
      <div className="rounded border border-border bg-white p-6">
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          className="studio-doc"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </Modal>
  )
}
