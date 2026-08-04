import { useEffect, useState } from 'react'
import { listChecklistItems } from '../../lib/projects'
import { fullName } from '../../lib/contacts'
import { formatPhone } from '../../lib/phone'
import { buildDocumentHtml } from '../../lib/documentHtml'
import { exportPdf } from '../../lib/exportPdf'
import { exportDocx } from '../../lib/exportDocx'
import { formatDateTime } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Button, Modal } from '../ui'

/**
 * The consultation prep sheet.
 *
 * Not a template — it is a composite of the client's data, their brief,
 * their answers, and the stage-01 checklist. It has no {{fields}} to
 * merge, so it is assembled here and then handed to the same PDF and
 * Word pipeline every other document uses.
 */
export default function PrepSheet({ booking, open, onClose }) {
  const { t, language } = useI18n()
  const { settings } = useAuth()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!open || !booking?.project_id) return
    listChecklistItems(booking.project_id).then((rows) =>
      setItems(rows.filter((row) => row.stage_key === '01_consultation'))
    )
  }, [open, booking])

  if (!booking) return null

  const rtl = language === 'ar'
  const contact = booking.contact
  const title = rtl ? 'ورقة تحضير الاستشارة' : 'Consultation Prep Sheet'

  const rows = [
    [rtl ? 'العميل' : 'Client', contact ? fullName(contact) : booking.client_name],
    [rtl ? 'البريد' : 'Email', booking.client_email || '—'],
    [
      rtl ? 'الهاتف' : 'Phone',
      booking.client_phone ? formatPhone(booking.client_phone_code, booking.client_phone) : '—',
    ],
    [
      rtl ? 'الموعد' : 'When',
      formatDateTime(booking.slot_start, language),
    ],
    [
      rtl ? 'نوع الاستشارة' : 'Session',
      booking.session_type ? (rtl ? booking.session_type.label_ar : booking.session_type.label_en) : '—',
    ],
    [rtl ? 'كود المشروع' : 'Project code', booking.project?.code || '—'],
  ]

  const answers = Object.entries(booking.answers ?? {})

  // Group the checklist back into its sections.
  const sections = []
  for (const item of items) {
    const heading = rtl ? item.section_title_ar : item.section_title_en
    let section = sections.at(-1)
    if (!section || section.heading !== heading) {
      section = { heading, items: [] }
      sections.push(section)
    }
    section.items.push(rtl ? item.label_ar : item.label_en)
  }

  const bodyHtml = [
    `<h2>${rtl ? 'بيانات العميل' : 'Client details'}</h2>`,
    '<table><tbody>',
    ...rows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escape(v)}</td></tr>`),
    '</tbody></table>',
    booking.project_brief
      ? `<h2>${rtl ? 'نبذة المشروع' : 'Project brief'}</h2><p>${escape(booking.project_brief)}</p>`
      : '',
    answers.length
      ? `<h2>${rtl ? 'إجابات نموذج الحجز' : 'Booking answers'}</h2>` +
        answers.map(([k, v]) => `<p><strong>${escape(k)}</strong><br>${escape(v)}</p>`).join('')
      : '',
    sections.length
      ? `<h2>${rtl ? 'قائمة مراجعة المرحلة الأولى' : 'Stage 01 checklist'}</h2>` +
        sections
          .map(
            (section) =>
              `<p><strong>${escape(section.heading ?? '')}</strong></p><ul>` +
              section.items.map((label) => `<li>☐ ${escape(label ?? '')}</li>`).join('') +
              '</ul>'
          )
          .join('')
      : '',
  ].join('\n')

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

function escape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
