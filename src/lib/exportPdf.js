/**
 * PDF export — the pipeline proved in the spike.
 *
 * The document is rendered by the browser engine itself, which is what
 * makes Arabic shaping and bidi correct. Nothing draws glyphs.
 *
 * THE CRITICAL LINE is `await frame.contentWindow.document.fonts.ready`.
 * In the spike, printing before the webfonts had loaded produced a PDF
 * with perfect vector layout, zero embedded fonts, and no Arabic at all
 * — a silent failure that looks like a font problem. Do not remove it.
 */
export async function exportPdf(html) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)

  try {
    const doc = frame.contentDocument
    doc.open()
    doc.write(html)
    doc.close()

    await waitForReady(frame.contentWindow)
    await frame.contentWindow.document.fonts.ready

    frame.contentWindow.focus()
    frame.contentWindow.print()
  } finally {
    // Give the print dialog time to take its snapshot before removal.
    setTimeout(() => frame.remove(), 60000)
  }
}

function waitForReady(win) {
  return new Promise((resolve) => {
    if (win.document.readyState === 'complete') return resolve()
    win.addEventListener('load', resolve, { once: true })
    // document.write can settle without firing load in some browsers.
    setTimeout(resolve, 1500)
  })
}
