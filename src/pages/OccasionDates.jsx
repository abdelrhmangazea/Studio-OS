import { useEffect, useState } from 'react'
import {
  HIJRI_OCCASIONS,
  listOccasionDates,
  saveOccasionDate,
  syncOccasionReminders,
} from '../lib/reminders'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input, SectionTitle, Select } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'
import { errorMessage } from '../lib/errorMessage'

/**
 * This year's occasion dates, typed in by hand.
 *
 * Four of the five move with the Hijri calendar. Nothing here computes
 * them: a converted date that is a day out is worse than no date, so
 * the designer enters what they know to be right and the system stores
 * exactly that.
 *
 * New Year is fixed on 1 January and is not asked for.
 */
export default function OccasionDates() {
  useFeatureUse('occasion_dates')
  const { t } = useI18n()
  const thisYear = new Date().getFullYear()

  const [year, setYear] = useState(thisYear)
  const [dates, setDates] = useState({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load(forYear) {
    const rows = await listOccasionDates(forYear)
    setDates(Object.fromEntries(rows.map((r) => [r.occasion_key, r.date])))
  }

  useEffect(() => {
    load(year)
  }, [year])

  async function save() {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      for (const key of HIJRI_OCCASIONS) {
        if (dates[key]) await saveOccasionDate(year, key, dates[key])
      }
      // Fills in every reminder that was waiting on these dates.
      await syncOccasionReminders(year)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy(false)
  }

  const years = [thisYear, thisYear + 1]

  return (
    <Card>
      <SectionTitle hint={t('occasions.help')}>{t('occasions.title')}</SectionTitle>

      <div className="mb-5 w-40">
        <Field label={t('occasions.year')}>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {HIJRI_OCCASIONS.map((key) => (
          <Field key={key} label={t(`occasions.${key}`)}>
            <Input
              type="date"
              value={dates[key] ?? ''}
              onChange={(e) => setDates({ ...dates, [key]: e.target.value })}
            />
          </Field>
        ))}

        <Field label={t('occasions.new_year')} hint={t('occasions.newYearFixed')}>
          <Input value={`${year}-01-01`} readOnly disabled />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
        {saved && <span className="text-sm text-success">{t('occasions.saved')}</span>}
      </div>

      <ErrorText>{error}</ErrorText>
    </Card>
  )
}
