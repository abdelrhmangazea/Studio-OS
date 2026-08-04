import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { splitByDirection } from './documentHtml'

/**
 * Word export — the treatment proved in the Bucket 3 spike.
 *
 * Word does its own Arabic shaping, so what matters is that the OOXML
 * carries the right properties:
 *   bidirectional  -> w:bidi       paragraph is RTL
 *   rightToLeft    -> w:rtl        run is RTL
 *
 * And the bidi lesson from the spike: a Latin run inside an Arabic
 * paragraph must be wrapped in U+2066 LEFT-TO-RIGHT ISOLATE …
 * U+2069 POP DIRECTIONAL ISOLATE, or "+20 106 679 2806" comes out
 * reversed as "2806 679 106 20+". Marking the run LTR is not enough.
 *
 * The matching lesson: never isolate a run that is itself Arabic. Doing
 * that in the spike pushed the day of the Arabic date to the end.
 */

const LRI = '⁦'
const PDI = '⁩'
const FONT = 'Cairo'

/**
 * One text node becomes one or more runs, split on the script boundary.
 *
 * Splitting matters for the same reason it does in the HTML: a mixed
 * line like "المحطة القادمة: Concept presentation بتاريخ 15 August 2026"
 * has to isolate the whole Latin run, digits included. Isolating only
 * the words leaves the numbers bidi-neutral and Word reorders them.
 */
function runsFor(text, { rtl, bold, italic, underline } = {}) {
  const style = { bold, italics: italic, underline: underline ? {} : undefined, font: FONT, size: 22 }

  if (!rtl) return [new TextRun({ text, ...style })]

  return splitByDirection(text)
    .filter((segment) => segment.text.length > 0)
    .map((segment) => {
      const hasContent = /[A-Za-z0-9]/.test(segment.text)

      // Arabic, or punctuation-only: an ordinary RTL run.
      if (segment.arabic || !hasContent) {
        return new TextRun({ text: segment.text, rightToLeft: true, ...style })
      }

      // A foreign run: isolate it so its neutrals cannot be absorbed.
      const [, lead, core, trail] = segment.text.match(/^(\s*)([\s\S]*?)(\s*)$/)
      return new TextRun({ text: `${lead}${LRI}${core}${PDI}${trail}`, ...style })
    })
}

/** Walks a block element, collecting its inline runs with formatting. */
function runsFromNode(node, rtl, inherited = {}) {
  const runs = []

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent
      if (text) runs.push(...runsFor(text, { rtl, ...inherited }))
      return
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return

    const tag = child.tagName.toLowerCase()
    const style = {
      bold: inherited.bold || tag === 'b' || tag === 'strong',
      italic: inherited.italic || tag === 'i' || tag === 'em',
      underline: inherited.underline || tag === 'u',
    }

    if (tag === 'br') {
      runs.push(new TextRun({ break: 1 }))
      return
    }

    runs.push(...runsFromNode(child, rtl, style))
  })

  return runs
}

/** Turns the edited HTML body into Word paragraphs. */
function paragraphsFromHtml(html, rtl) {
  const holder = document.createElement('div')
  holder.innerHTML = html

  const blocks = holder.querySelectorAll('p, div, li, h1, h2, h3')
  const source = blocks.length > 0 ? [...blocks] : [holder]

  return source.map((block) => {
    const tag = block.tagName?.toLowerCase()
    const isHeading = tag === 'h1' || tag === 'h2' || tag === 'h3'
    const children = runsFromNode(block, rtl)

    return new Paragraph({
      bidirectional: rtl,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
      bullet: tag === 'li' ? { level: 0 } : undefined,
      spacing: { after: 120, line: 320 },
      children: children.length > 0 ? children : runsFor(' ', { rtl }),
    })
  })
}

export async function buildDocxBlob({ title, bodyHtml, language, settings }) {
  const rtl = language === 'ar'
  const studioName = settings?.studio_name || 'Studio OS'

  const header = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: studioName, bold: true, size: 24, font: FONT })],
    }),
    new Paragraph({
      bidirectional: rtl,
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
      children: runsFor(title, { rtl, bold: true }),
    }),
  ]

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{ properties: {}, children: [...header, ...paragraphsFromHtml(bodyHtml, rtl)] }],
  })

  return Packer.toBlob(doc)
}

export async function exportDocx(options) {
  const blob = await buildDocxBlob(options)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${(options.title || 'document').replace(/[\\/:*?"<>|]/g, '-')}.docx`
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
