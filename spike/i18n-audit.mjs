/**
 * Finds translation keys that do not exist.
 *
 * A missing key renders as the key itself — the user sees
 * "errors.signUp" sitting in the middle of the screen. That is easy to
 * ship and hard to notice, because it only appears on the one code path
 * nobody tested. So: read every t('...') in the source, and check both
 * dictionaries.
 *
 *   node spike/i18n-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'))
const ar = JSON.parse(readFileSync('src/i18n/ar.json', 'utf8'))

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(jsx?|mjs)$/.test(path)) out.push(path)
  }
  return out
}

const lookup = (dict, key) =>
  key.split('.').reduce((branch, part) => branch?.[part], dict)

/** Every key present in a dictionary, flattened to dotted paths. */
function flatten(node, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') flatten(value, path, out)
    else out.add(path)
  }
  return out
}

const files = walk('src')
const used = new Map()

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  // t('a.b') and t("a.b") — template literals are skipped on purpose,
  // a computed key cannot be checked statically.
  for (const match of source.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) {
    if (!used.has(match[1])) used.set(match[1], file)
  }

  // errorMessage(failure, t, 'errors.x') — the fallback key is a
  // translation key too, and the first version of this script missed
  // it because it is not inside a t(). That is how errors.signUp got
  // through: it only shows on the one path where nothing else matched.
  for (const match of source.matchAll(/errorMessage\([^)]*?,\s*['"]([\w.]+)['"]\s*\)/g)) {
    if (!used.has(match[1])) used.set(match[1], file)
  }
}

const missing = []
for (const [key, file] of used) {
  const inEn = typeof lookup(en, key) === 'string'
  const inAr = typeof lookup(ar, key) === 'string'
  if (!inEn || !inAr) missing.push({ key, file, en: inEn, ar: inAr })
}

const enKeys = flatten(en)
const arKeys = flatten(ar)
const onlyEn = [...enKeys].filter((k) => !arKeys.has(k))
const onlyAr = [...arKeys].filter((k) => !enKeys.has(k))

console.log(`scanned ${files.length} files, ${used.size} distinct keys used`)

if (missing.length) {
  console.log(`\nMISSING (${missing.length}) — these render as the raw key:`)
  for (const m of missing) {
    console.log(`  ${m.key.padEnd(38)} en:${m.en ? 'ok' : 'NO'} ar:${m.ar ? 'ok' : 'NO'}  ${m.file}`)
  }
} else {
  console.log('\nno missing keys')
}

if (onlyEn.length) console.log(`\nin en.json but not ar.json (${onlyEn.length}):\n  ${onlyEn.join('\n  ')}`)
if (onlyAr.length) console.log(`\nin ar.json but not en.json (${onlyAr.length}):\n  ${onlyAr.join('\n  ')}`)
if (!onlyEn.length && !onlyAr.length) console.log('the two dictionaries carry the same keys')

process.exit(missing.length || onlyEn.length || onlyAr.length ? 1 : 0)
