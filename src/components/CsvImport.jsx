import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { COUNTRIES } from '../data/countries'
import { digitsOnly, isValidEmail, validatePhone } from '../lib/phone'
import { listLabel } from '../lib/useLists'
import { useI18n } from '../i18n'
import { Button, ErrorText, Modal, Select } from './ui'

/**
 * CSV import: choose a file, map the columns, preview, import.
 *
 * Rows with a bad email or phone are skipped rather than guessed at,
 * and every skipped row is reported back with its row number and the
 * reason, so the file can be fixed and imported again.
 */

// The fields a column can be mapped onto.
const TARGET_FIELDS = [
  { key: 'first_name', labelKey: 'fields.firstName' },
  { key: 'last_name', labelKey: 'fields.lastName' },
  { key: 'email', labelKey: 'fields.email' },
  { key: 'phone_country_code', labelKey: 'fields.dialCode' },
  { key: 'phone_number', labelKey: 'fields.phoneNumber' },
  { key: 'country', labelKey: 'fields.country' },
  { key: 'nationality', labelKey: 'fields.nationality' },
  { key: 'address', labelKey: 'fields.address' },
  { key: 'birthday', labelKey: 'fields.birthday' },
  { key: 'source', labelKey: 'fields.source' },
]

// Longest codes first, so '+9715' never matches before '+971'.
const DIAL_CODES = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length)

/** Guesses a mapping from the heading text, so most files need no work. */
function guessMapping(headers) {
  const guess = {}
  const normalise = (text) => text.toLowerCase().replace(/[^a-z]/g, '')

  const hints = {
    first_name: ['firstname', 'first', 'name', 'fullname'],
    last_name: ['lastname', 'last', 'surname', 'family'],
    email: ['email', 'mail', 'emailaddress'],
    phone_country_code: ['countrycode', 'dialcode', 'code'],
    phone_number: ['phone', 'mobile', 'number', 'telephone', 'whatsapp'],
    country: ['country'],
    nationality: ['nationality'],
    address: ['address', 'location'],
    birthday: ['birthday', 'birthdate', 'dob'],
    source: ['source', 'channel'],
  }

  for (const [field, candidates] of Object.entries(hints)) {
    const match = headers.find((header) => candidates.includes(normalise(header)))
    if (match && !Object.values(guess).includes(match)) guess[field] = match
  }
  return guess
}

/** Splits "+201066792806" into a code and a national number. */
function splitCombinedPhone(raw) {
  const cleaned = String(raw ?? '').replace(/[\s()-]/g, '')
  if (!cleaned.startsWith('+')) return null

  const code = DIAL_CODES.find((dial) => cleaned.startsWith(dial))
  if (!code) return null

  return { code, number: digitsOnly(cleaned.slice(code.length)) }
}

/** Accepts an ISO code or a country name in either language. */
function resolveCountry(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return null

  const upper = value.toUpperCase()
  const byIso = COUNTRIES.find((c) => c.iso === upper)
  if (byIso) return byIso.iso

  const lower = value.toLowerCase()
  const byName = COUNTRIES.find(
    (c) => c.nameEn.toLowerCase() === lower || c.nameAr === value || c.demonymEn.toLowerCase() === lower
  )
  return byName?.iso ?? null
}

export default function CsvImport({ open, onClose, onImported, statuses, sources }) {
  const { t, language } = useI18n()

  const [step, setStep] = useState(1)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  function reset() {
    setStep(1)
    setHeaders([])
    setRows([])
    setMapping({})
    setError('')
    setResult(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const fields = parsed.meta.fields ?? []
        if (parsed.data.length === 0 || fields.length === 0) {
          setError(t('csv.emptyFile'))
          return
        }
        setHeaders(fields)
        setRows(parsed.data)
        setMapping(guessMapping(fields))
        setStep(2)
      },
      error: () => setError(t('errors.generic')),
    })
  }

  /** Turns every CSV row into either a contact or a skip reason. */
  function buildRows() {
    const ready = []
    const skipped = []
    const defaultStatus = statuses[0]?.id ?? null

    rows.forEach((row, index) => {
      const rowNumber = index + 2 // +1 for the header, +1 for 1-based
      const value = (field) => {
        const column = mapping[field]
        return column ? String(row[column] ?? '').trim() : ''
      }

      const firstName = value('first_name')
      if (!firstName) {
        skipped.push({ rowNumber, reason: t('validation.firstNameRequired') })
        return
      }

      const email = value('email')
      if (email && !isValidEmail(email)) {
        skipped.push({ rowNumber, reason: t('validation.emailInvalid') })
        return
      }

      // A single "+20 106…" column is split automatically.
      let code = value('phone_country_code')
      let number = value('phone_number')
      const combined = splitCombinedPhone(number)
      if (!code && combined) {
        code = combined.code
        number = combined.number
      }
      number = digitsOnly(number)

      const phoneProblem = validatePhone(code, number)
      if (phoneProblem) {
        skipped.push({ rowNumber, reason: t(phoneProblem) })
        return
      }

      const sourceText = value('source').toLowerCase()
      const matchedSource = sourceText
        ? sources.find(
            (source) =>
              source.label_en.toLowerCase() === sourceText || source.label_ar === value('source')
          )
        : null

      const birthday = value('birthday')

      ready.push({
        first_name: firstName,
        last_name: value('last_name') || null,
        email: email || null,
        phone_country_code: code || null,
        phone_number: number || null,
        country: resolveCountry(value('country')),
        nationality: resolveCountry(value('nationality')),
        address: value('address') || null,
        birthday: /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : null,
        source_id: matchedSource?.id ?? null,
        status_id: defaultStatus,
      })
    })

    return { ready, skipped }
  }

  const { ready, skipped } = step >= 3 || step === 2 ? buildRows() : { ready: [], skipped: [] }

  async function handleImport() {
    setBusy(true)
    setError('')
    const { error: insertError } = await supabase.from('contacts').insert(ready)

    if (insertError) {
      setError(insertError.message)
      setBusy(false)
      return
    }

    setResult({ imported: ready.length, skipped })
    setStep(4)
    setBusy(false)
    onImported()
  }

  return (
    <Modal open={open} title={t('csv.title')} onClose={handleClose} wide>
      {/* ---------- 1. Choose a file ---------- */}
      {step === 1 && (
        <div>
          <p className="mb-4 text-sm text-text-secondary">{t('csv.fileHelp')}</p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm text-text-secondary file:me-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:text-white"
          />
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {/* ---------- 2. Map columns ---------- */}
      {step === 2 && (
        <div>
          <p className="mb-4 text-sm text-text-secondary">{t('csv.mapHelp')}</p>

          <div className="grid grid-cols-2 gap-3">
            {TARGET_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-sm text-text">{t(field.labelKey)}</span>
                <Select
                  value={mapping[field.key] ?? ''}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                >
                  <option value="">{t('csv.ignore')}</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={() => setStep(3)}>{t('common.next')}</Button>
            <Button variant="ghost" onClick={() => setStep(1)}>
              {t('common.back')}
            </Button>
          </div>
        </div>
      )}

      {/* ---------- 3. Preview ---------- */}
      {step === 3 && (
        <div>
          <p className="mb-1 text-sm text-text">{t('csv.rowsReady', { count: ready.length })}</p>
          {skipped.length > 0 && (
            <p className="mb-3 text-sm text-warning">
              {t('csv.rowsSkipped', { count: skipped.length })}
            </p>
          )}

          <p className="mb-2 text-xs text-text-secondary">
            {t('csv.previewHelp', { count: Math.min(5, ready.length) })}
          </p>

          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-start text-text-secondary">
                    {t('fields.firstName')}
                  </th>
                  <th className="px-3 py-2 text-start text-text-secondary">
                    {t('fields.lastName')}
                  </th>
                  <th className="px-3 py-2 text-start text-text-secondary">{t('fields.email')}</th>
                  <th className="px-3 py-2 text-start text-text-secondary">{t('fields.phone')}</th>
                  <th className="px-3 py-2 text-start text-text-secondary">{t('fields.source')}</th>
                </tr>
              </thead>
              <tbody>
                {ready.slice(0, 5).map((row, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text">{row.first_name}</td>
                    <td className="px-3 py-2 text-text">{row.last_name ?? '—'}</td>
                    <td className="px-3 py-2 text-text">{row.email ?? '—'}</td>
                    <td className="px-3 py-2 text-text">
                      {row.phone_country_code
                        ? `${row.phone_country_code} ${row.phone_number}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-text">
                      {listLabel(
                        sources.find((source) => source.id === row.source_id),
                        language
                      ) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {skipped.length > 0 && <SkippedTable skipped={skipped} />}

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={handleImport} disabled={busy || ready.length === 0}>
              {busy ? t('csv.importing') : t('csv.importNow', { count: ready.length })}
            </Button>
            <Button variant="ghost" onClick={() => setStep(2)} disabled={busy}>
              {t('common.back')}
            </Button>
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      )}

      {/* ---------- 4. Done ---------- */}
      {step === 4 && result && (
        <div>
          <h3 className="text-base font-semibold text-success">{t('csv.doneTitle')}</h3>
          <p className="mt-1 text-sm text-text">
            {t('csv.doneBody', { imported: result.imported })}
          </p>

          {result.skipped.length > 0 && <SkippedTable skipped={result.skipped} />}

          <div className="mt-5">
            <Button onClick={handleClose}>{t('common.close')}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function SkippedTable({ skipped }) {
  const { t } = useI18n()

  return (
    <div className="mt-5">
      <h4 className="text-sm font-medium text-warning">{t('csv.skippedTitle')}</h4>
      <p className="mb-2 text-xs text-text-secondary">{t('csv.skippedHelp')}</p>

      <div className="max-h-48 overflow-y-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-20 px-3 py-2 text-start text-text-secondary">{t('csv.row')}</th>
              <th className="px-3 py-2 text-start text-text-secondary">{t('csv.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {skipped.map((item) => (
              <tr key={item.rowNumber} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-text">{item.rowNumber}</td>
                <td className="px-3 py-2 text-text-secondary">{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
