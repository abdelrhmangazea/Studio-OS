/**
 * Black or white, whichever can actually be read on a given colour.
 *
 * Used only on the white-label public pages, where the background is a
 * colour the studio chose and we have no say over. Picking the
 * foreground is not overriding their choice — it is the only way their
 * choice stays legible when it turns out to be pale yellow.
 *
 * Rec. 601 luma is enough here: this decides a pair of initials, not a
 * colour system.
 */
export function readableOn(hex) {
  const value = String(hex ?? '').replace('#', '')
  if (value.length !== 6) return '#ffffff'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#ffffff'
}
