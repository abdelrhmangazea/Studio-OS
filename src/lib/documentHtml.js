/**
 * The document skeleton — the one proved in the Bucket 3 spike.
 *
 * Same Cairo woff2 files, same CSS, same <bdi> isolation. The browser
 * engine does the Arabic shaping and bidi; nothing here draws glyphs.
 *
 * Two rules carried over from the spike, both of which caused real
 * failures there:
 *   - a phone number needs white-space: nowrap or it breaks mid-number
 *   - Latin runs inside Arabic need <bdi>, or "+20 106 679 2806"
 *     renders reversed as "2806 679 106 20+"
 */

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/

/** True when the text has no Arabic — i.e. it is a foreign run. */
export function isForeignRun(text) {
  return !ARABIC.test(text) && /[A-Za-z0-9]/.test(text)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Plain template text into HTML.
 *
 * Runs of Latin/digits inside an Arabic document are wrapped in <bdi>
 * so the bidi algorithm cannot absorb their neutral characters. Emails,
 * URLs and phone numbers additionally get nowrap.
 */
export function textToHtml(text, language) {
  const rtl = language === 'ar'

  return String(text ?? '')
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '<p class="blank">&nbsp;</p>'
      return `<p>${rtl ? isolateForeignRuns(line) : escapeHtml(line)}</p>`
    })
    .join('\n')
}

/**
 * Splits a line into alternating Arabic and non-Arabic segments.
 *
 * Splitting on the script boundary — rather than pattern-matching for
 * "words" — is what makes this correct. An earlier version matched
 * Latin words only, so "15 August 2026" was split into a bare "15",
 * an isolated "August", and a bare "2026". The two bare numbers are
 * bidi-neutral, so the algorithm reordered them and the date rendered
 * as "2026 August 15". Grouping the whole run keeps it intact.
 */
export function splitByDirection(text) {
  const segments = []
  let current = null

  for (const char of String(text ?? '')) {
    const arabic = ARABIC.test(char)
    if (!current || current.arabic !== arabic) {
      current = { arabic, text: '' }
      segments.push(current)
    }
    current.text += char
  }

  return segments
}

/** Wraps every non-Arabic run of a line in <bdi>. */
function isolateForeignRuns(line) {
  return splitByDirection(line)
    .map((segment) => {
      if (segment.arabic) return escapeHtml(segment.text)

      // Keep the surrounding whitespace outside the isolate so it still
      // belongs to the Arabic flow.
      const [, lead, core, trail] = segment.text.match(/^(\s*)([\s\S]*?)(\s*)$/)

      // Punctuation-only runs (bullets, dashes) need no isolation.
      if (!/[A-Za-z0-9]/.test(core)) return escapeHtml(segment.text)

      const noWrap = /@|https?:\/\/|www\.|^\+?\d/.test(core) ? ' class="nowrap"' : ''
      return `${escapeHtml(lead)}<bdi${noWrap}>${escapeHtml(core)}</bdi>${escapeHtml(trail)}`
    })
    .join('')
}

const STYLES = `
  @font-face {
    font-family: 'Cairo';
    font-style: normal;
    font-weight: 400 700;
    src: url('/fonts/cairo-arabic.woff2') format('woff2');
    unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+200C-200E, U+2010-2011,
                   U+FB50-FDFF, U+FE70-FEFC;
  }
  @font-face {
    font-family: 'Cairo';
    font-style: normal;
    font-weight: 400 700;
    src: url('/fonts/cairo-latin.woff2') format('woff2');
    unicode-range: U+0000-00FF, U+2000-206F, U+20AC, U+2122, U+2212;
  }

  @page { size: A4; margin: 18mm 16mm; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Cairo', sans-serif;
    color: #1d191a;
    background: #fff;
    font-size: 11pt;
    line-height: 1.9;
    -webkit-font-smoothing: antialiased;
  }

  .doc { padding: 0; }
  .head { border-bottom: 2px solid var(--accent); padding-bottom: 8px; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { height: 38px; width: auto; object-fit: contain; }
  .mark {
    width: 34px; height: 34px; border-radius: 4px; background: var(--accent); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 12pt;
  }
  .studio { font-weight: 700; font-size: 12pt; }
  .meta { font-size: 9pt; color: #5a5a5a; }

  h1 { font-size: 16pt; font-weight: 700; margin: 0 0 14px; }
  h2 { font-size: 13pt; font-weight: 700; margin: 18px 0 8px; }
  p { margin: 0 0 8px; }
  p.blank { margin: 0 0 4px; }
  ul, ol { margin: 0 0 10px; padding-inline-start: 22px; }
  strong { font-weight: 700; }

  .nowrap { white-space: nowrap; }

  /* An unresolved merge field. Loud on purpose — it must be impossible
     to send a document with one of these still in it. */
  .unresolved { background: #ffe8ea; color: #e11d3c; padding: 0 3px; border-radius: 2px; }

  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10.5pt; }
  th, td { border: 1px solid #d8d8d8; padding: 6px 9px; text-align: start; }
  thead th { background: #f2f2f2; font-weight: 700; }
`

/** Highlights [[unresolved]] markers so they cannot be missed. */
export function highlightUnresolved(html) {
  return html.replace(/\[\[(\w+)\]\]/g, '<span class="unresolved">[[$1]]</span>')
}

/**
 * The full standalone document, used for the print/PDF pipeline.
 *
 * `bodyHtml` is taken straight from the preview, which already carries
 * the highlighted [[markers]] — highlighting again here would nest the
 * spans.
 */
export function buildDocumentHtml({ title, bodyHtml, language, settings, meta }) {
  const rtl = language === 'ar'
  const accent = settings?.accent_color || '#0077B6'
  const studioName = settings?.studio_name || 'Studio OS'
  const logo = settings?.logo_url
    ? `<img class="logo" src="${escapeHtml(settings.logo_url)}" alt="">`
    : `<div class="mark">${escapeHtml(studioName.slice(0, 2).toUpperCase())}</div>`

  return `<!doctype html>
<html lang="${language}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>:root { --accent: ${escapeHtml(accent)}; }${STYLES}</style>
</head>
<body>
  <div class="doc">
    <header class="head">
      <div class="brand">
        ${logo}
        <div>
          <div class="studio">${escapeHtml(studioName)}</div>
          ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
        </div>
      </div>
    </header>
    ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
    ${bodyHtml}
  </div>
</body>
</html>`
}
