import { fullName } from './contacts'
import { formatPhone } from './phone'
import { formatDateTime } from './format'

/**
 * The consultation prep sheet.
 *
 * Not a template — a composite of the client's data, their brief, their
 * booking answers, and the stage-01 checklist. It has no {{fields}} to
 * merge, so it is assembled here and handed to the same PDF/Word
 * pipeline every other document uses.
 *
 * It lives in lib rather than in the modal because two callers need it:
 * the modal itself, and the inbox, which generates and files it the
 * first time a booking is opened.
 */
export function buildPrepSheet({ booking, items, language, timezone }) {
  const rtl = language === 'ar'
  const contact = booking.contact
  const title = rtl ? 'ورقة تحضير الاستشارة' : 'Consultation Prep Sheet'

  // The sheet the designer carries into the meeting. The time on it has
  // to be the studio's, not whatever zone the laptop that printed it
  // happened to be in.
  const tz = timezone ?? booking.timezone ?? null

  const rows = [
    [rtl ? 'العميل' : 'Client', contact ? fullName(contact) : booking.client_name],
    [rtl ? 'البريد' : 'Email', booking.client_email || '—'],
    [
      rtl ? 'الهاتف' : 'Phone',
      booking.client_phone ? formatPhone(booking.client_phone_code, booking.client_phone) : '—',
    ],
    [
      rtl ? 'الموعد' : 'When',
      formatDateTime(booking.slot_start, language, tz) + (tz ? ` (${tz})` : ''),
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
  for (const item of items ?? []) {
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
    ...rows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`),
    '</tbody></table>',
    booking.project_brief
      ? `<h2>${rtl ? 'نبذة المشروع' : 'Project brief'}</h2><p>${escapeHtml(booking.project_brief)}</p>`
      : '',
    answers.length
      ? `<h2>${rtl ? 'إجابات نموذج الحجز' : 'Booking answers'}</h2>` +
        answers
          .map(([k, v]) => `<p><strong>${escapeHtml(k)}</strong><br>${escapeHtml(v)}</p>`)
          .join('')
      : '',
    sections.length
      ? `<h2>${rtl ? 'قائمة مراجعة المرحلة الأولى' : 'Stage 01 checklist'}</h2>` +
        sections
          .map(
            (section) =>
              `<p><strong>${escapeHtml(section.heading ?? '')}</strong></p><ul>` +
              section.items.map((label) => `<li>☐ ${escapeHtml(label ?? '')}</li>`).join('') +
              '</ul>'
          )
          .join('')
      : '',
  ].join('\n')

  return { title, bodyHtml }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
