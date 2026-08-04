/**
 * Word export for the Arabic spike, using docx 9.7.1.
 *
 * Word does its own Arabic shaping and bidi, so what matters here is
 * that the OOXML carries the right properties:
 *   w:bidi       — paragraph is right-to-left   (bidirectional: true)
 *   w:rtl        — run is right-to-left         (rightToLeft: true)
 *   w:bidiVisual — table columns are mirrored   (visuallyRightToLeft: true)
 *
 * The font is named rather than embedded: the docx library exposes no
 * font-embedding API, and Word substitutes an Arabic-capable font when
 * Cairo is absent — shaping still comes from Word either way.
 */
import { writeFileSync } from 'node:fs'
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const ARABIC_FONT = 'Cairo'
const LATIN_FONT = 'Cairo'

/**
 * Wraps Latin text embedded in an Arabic line with Unicode directional
 * isolates: U+2066 LEFT-TO-RIGHT ISOLATE ... U+2069 POP DIRECTIONAL
 * ISOLATE. This is the plain-text equivalent of HTML's <bdi>.
 *
 * Without it a phone number like "+20 106 679 2806" can render reversed
 * as "2806 679 106 20+", because the leading "+" and the spaces are
 * bidi-neutral and get absorbed by the surrounding Arabic. Setting the
 * run to LTR is not enough on its own — the isolate is what guarantees
 * it in every reader, not just Word.
 */
const ltrIsolate = (value) => `⁦${value}⁩`

const text = (value, { rtl, bold = false, size = 22, color = '1D191A' } = {}) =>
  new TextRun({
    text: value,
    bold,
    size,
    color,
    rightToLeft: rtl,
    font: rtl ? ARABIC_FONT : LATIN_FONT,
  })

const para = (value, { rtl, bold = false, size = 22, spacing = 160, color } = {}) =>
  new Paragraph({
    bidirectional: rtl,
    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: spacing, line: 340 },
    children: Array.isArray(value) ? value : [text(value, { rtl, bold, size, color })],
  })

const cell = (value, { rtl, bold = false, shaded = false } = {}) =>
  new TableCell({
    shading: shaded ? { fill: 'F2F2F2' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        bidirectional: rtl,
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [text(value, { rtl, bold, size: 21 })],
      }),
    ],
  })

const borders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'D8D8D8' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D8D8D8' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'D8D8D8' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'D8D8D8' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D8D8D8' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D8D8D8' },
}

function buildSection(d) {
  const rtl = d.rtl

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: rtl, // <- mirrors the columns for RTL
    borders,
    rows: [
      new TableRow({
        children: d.tableHead.map((h) => cell(h, { rtl, bold: true, shaded: true })),
      }),
      ...d.tableRows.map((r) => new TableRow({ children: r.map((c) => cell(c, { rtl })) })),
      new TableRow({
        children: d.tableTotal.map((c) => cell(c, { rtl, bold: true, shaded: true })),
      }),
    ],
  })

  return [
    para([text(d.studio, { rtl: false, bold: true, size: 24 })], { rtl: false }),
    para([text(d.code, { rtl: false, size: 18, color: '5A5A5A' })], { rtl: false }),

    new Paragraph({
      bidirectional: rtl,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 200 },
      children: [text(d.title, { rtl, bold: true, size: 34 })],
    }),

    ...d.paragraphs.map((p) => para(p, { rtl })),

    // The bidi test line: Arabic label, Latin name, email, phone.
    // Each foreign run is its own TextRun with rightToLeft:false so
    // Word treats it as an isolated LTR run inside an RTL paragraph.
    new Paragraph({
      bidirectional: rtl,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: 120, after: 240 },
      shading: { fill: 'F4F8FB' },
      children: [
        text(d.mixedLabel + ' ', { rtl }),
        text(rtl ? ltrIsolate(d.designer) : d.designer, { rtl: false }),
        text(' — ' + d.emailLabel + ' ', { rtl }),
        text(rtl ? ltrIsolate(d.email) : d.email, { rtl: false }),
        text(' — ' + d.phoneLabel + ' ', { rtl }),
        text(rtl ? ltrIsolate(d.phone) : d.phone, { rtl: false }),
      ],
    }),

    table,

    new Paragraph({ text: '', spacing: { before: 300 } }),
    para('__________________________', { rtl, spacing: 60 }),
    para(d.signature, { rtl, spacing: 60, color: '5A5A5A' }),
    para(`${d.nameLabel}: ${d.name}`, { rtl, spacing: 60 }),
    para(`${d.titleLabel}: ${d.jobTitle}`, { rtl, spacing: 60 }),
    new Paragraph({
      bidirectional: rtl,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      // The Arabic date is Arabic prose containing a numeral, so it stays
      // an RTL run. Isolating it as LTR would push the day to the end.
      children: [text(`${d.dateLabel}: ${d.date}`, { rtl })],
    }),
  ]
}

const AR = {
  rtl: true,
  studio: 'Interior Zone',
  code: 'IZ-2026-0043',
  title: 'عرض أتعاب التصميم الداخلي',
  paragraphs: [
    'يسعد استوديو إنتيريور زون أن يقدّم لكم هذا العرض لتصميم المساحات الداخلية للوحدة السكنية الواقعة في التجمّع الخامس بالقاهرة الجديدة. يشمل العرض مراحل التصميم كاملةً، بدءاً من الاستشارة الأولى ومروراً بالتصميم المبدئي والرسومات التنفيذية، وحتى الإشراف على التنفيذ وتسليم المشروع.',
    'تستند الأتعاب المذكورة أدناه إلى المساحة الإجمالية ونطاق الأعمال المتفق عليه خلال الاستشارة. تبدأ مدة التنفيذ من تاريخ توقيع العقد وسداد الدفعة الأولى، ولا يبدأ أي عمل قبل استيفاء الشرطين معاً.',
  ],
  mixedLabel: 'المصمم المسؤول:',
  designer: 'Abdelrhman Gazea',
  emailLabel: 'البريد الإلكتروني:',
  email: 'hello@interiorzone.com',
  phoneLabel: 'هاتف:',
  phone: '+20 106 679 2806',
  tableHead: ['البند', 'المساحة (م²)', 'سعر المتر (ج.م)', 'الإجمالي (ج.م)'],
  tableRows: [
    ['تصميم المساحات الداخلية', '240', '1,250', '300,000'],
    ['الرسومات التنفيذية', '240', '450', '108,000'],
    ['الإشراف على التنفيذ', '240', '300', '72,000'],
  ],
  tableTotal: ['الإجمالي', '', '', '480,000'],
  signature: 'التوقيع',
  nameLabel: 'الاسم',
  name: 'عبدالرحمن جازع',
  titleLabel: 'الصفة',
  jobTitle: 'مدير الاستوديو',
  dateLabel: 'التاريخ',
  date: '4 أغسطس 2026',
}

const EN = {
  rtl: false,
  studio: 'Interior Zone',
  code: 'IZ-2026-0043',
  title: 'Interior Design Fee Proposal',
  paragraphs: [
    'Interior Zone is pleased to submit this proposal for the interior design of the residential unit located in the Fifth Settlement, New Cairo. The proposal covers the full design programme, from the initial consultation through concept design and tender drawings, to construction supervision and handover.',
    'The fees below are based on the total area and the scope of works agreed during the consultation. The programme begins on the date the contract is signed and the first payment is confirmed. No work starts before both conditions are met.',
  ],
  mixedLabel: 'Lead designer:',
  designer: 'Abdelrhman Gazea',
  emailLabel: 'Email:',
  email: 'hello@interiorzone.com',
  phoneLabel: 'Phone:',
  phone: '+20 106 679 2806',
  tableHead: ['Item', 'Area (m²)', 'Rate (EGP)', 'Total (EGP)'],
  tableRows: [
    ['Interior design', '240', '1,250', '300,000'],
    ['Tender drawings', '240', '450', '108,000'],
    ['Construction supervision', '240', '300', '72,000'],
  ],
  tableTotal: ['Total', '', '', '480,000'],
  signature: 'Signature',
  nameLabel: 'Name',
  name: 'Abdelrhman Gazea',
  titleLabel: 'Title',
  jobTitle: 'Studio Director',
  dateLabel: 'Date',
  date: '4 August 2026',
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: ARABIC_FONT, size: 22 } },
    },
  },
  sections: [
    { properties: {}, children: buildSection(AR) },
    { properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } }, children: buildSection(EN) },
  ],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync(new URL('./studio-os-arabic-sample.docx', import.meta.url), buffer)
console.log('studio-os-arabic-sample.docx written —', (buffer.length / 1024).toFixed(0) + 'KB')
