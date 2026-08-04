/**
 * WhatsApp output: plain text, no rich formatting, line breaks kept.
 *
 * The [[unresolved]] markers are left in on purpose. If a field never
 * got filled, the designer should see that in the text they are about
 * to paste, not discover it after sending.
 */
export function htmlToWhatsappText(html) {
  const holder = document.createElement('div')
  holder.innerHTML = html

  // Block elements become line breaks.
  holder.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  holder.querySelectorAll('p, div, li, h1, h2, h3').forEach((block) => {
    block.append('\n')
  })
  holder.querySelectorAll('li').forEach((li) => li.prepend('• '))

  return holder.textContent
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text)
}
