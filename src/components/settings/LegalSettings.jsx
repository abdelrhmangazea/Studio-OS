import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, Field, Input, SectionTitle, Select } from '../ui'
import { errorMessage } from '../../lib/errorMessage'

const ID_TYPES = ['national_id', 'passport', 'residency', 'commercial_registration']
const ROLES = ['lead_designer', 'senior_assistant', 'design_manager', 'office_designer', 'office_admin']

/**
 * The studio as a legal entity, for the contract to merge from.
 *
 * Every field here is optional. Leave the whole tab blank and nothing
 * breaks — the contract simply prints [[markers]] where a detail is
 * missing, exactly like any other unfilled merge field.
 *
 * Two things the contract needs are NOT here on purpose:
 *   working days and hours  read from the booking availability
 *   free revisions          reads the number the portal counts against
 * Both are shown read-only at the bottom so it is obvious where they
 * come from, and obvious that they cannot drift.
 */
export default function LegalSettings() {
  const { t } = useI18n()
  const { workspace, settings, isOwner, refresh } = useAuth()

  const [form, setForm] = useState(null)
  const [availability, setAvailability] = useState([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!settings) return
    setForm({
      legal_name: settings.legal_name ?? '',
      registration_number: settings.registration_number ?? '',
      registered_address: settings.registered_address ?? '',
      country: settings.country ?? '',
      representative_name: settings.representative_name ?? '',
      representative_id: settings.representative_id ?? '',
      representative_id_type: settings.representative_id_type ?? '',
      representative_issuer: settings.representative_issuer ?? '',
      governing_law: settings.governing_law ?? '',
      dispute_venue: settings.dispute_venue ?? '',
      vat_rate: settings.vat_rate ?? '',
      vat_treatment: settings.vat_treatment ?? '',
      minimum_project_value: settings.minimum_project_value ?? '',
      hourly_rates: settings.hourly_rates ?? {},
    })
  }, [settings])

  useEffect(() => {
    supabase
      .from('booking_settings')
      .select('availability')
      .maybeSingle()
      .then(({ data }) => setAvailability(data?.availability ?? []))
  }, [])

  if (!form) return null

  const set = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  const setRate = (role, value) =>
    setForm((current) => ({
      ...current,
      hourly_rates: { ...current.hourly_rates, [role]: value === '' ? null : Number(value) },
    }))

  async function save() {
    setBusy(true)
    setError('')
    setSaved(false)

    const { error: failure } = await supabase
      .from('studio_settings')
      .update({
        ...form,
        vat_rate: form.vat_rate === '' ? null : Number(form.vat_rate),
        minimum_project_value:
          form.minimum_project_value === '' ? null : Number(form.minimum_project_value),
        vat_treatment: form.vat_treatment || null,
        representative_id_type: form.representative_id_type || null,
      })
      .eq('workspace_id', workspace.id)

    if (failure) setError(errorMessage(failure, t))
    else {
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setBusy(false)
  }

  const days = [...new Set(availability.map((r) => r.day))].sort((a, b) => a - b)
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

  return (
    <Card className="mb-4">
      <SectionTitle hint={t('legal.help')}>{t('legal.title')}</SectionTitle>

      {!isOwner && <p className="mb-4 text-sm text-warning">{t('settings.ownerOnly')}</p>}

      {/* ---------- the entity ---------- */}
      <h3 className="mb-3 text-sm font-medium text-text">{t('legal.entity')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('legal.legalName')} hint={t('legal.legalNameHint')}>
          <Input value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label={t('legal.registrationNumber')}>
          <Input value={form.registration_number} onChange={(e) => set('registration_number', e.target.value)} disabled={!isOwner} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('legal.registeredAddress')}>
            <Input value={form.registered_address} onChange={(e) => set('registered_address', e.target.value)} disabled={!isOwner} />
          </Field>
        </div>
        <Field label={t('legal.country')}>
          <Input value={form.country} onChange={(e) => set('country', e.target.value)} disabled={!isOwner} />
        </Field>
      </div>

      {/* ---------- who signs ---------- */}
      <h3 className="mb-3 mt-6 text-sm font-medium text-text">{t('legal.representative')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('legal.repName')}>
          <Input value={form.representative_name} onChange={(e) => set('representative_name', e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label={t('legal.repIdType')}>
          <Select value={form.representative_id_type} onChange={(e) => set('representative_id_type', e.target.value)} disabled={!isOwner}>
            <option value="">—</option>
            {ID_TYPES.map((k) => (
              <option key={k} value={k}>{t(`idType.${k}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('legal.repId')}>
          <Input value={form.representative_id} onChange={(e) => set('representative_id', e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label={t('legal.repIssuer')}>
          <Input value={form.representative_issuer} onChange={(e) => set('representative_issuer', e.target.value)} disabled={!isOwner} />
        </Field>
      </div>

      {/* ---------- law ---------- */}
      <h3 className="mb-3 mt-6 text-sm font-medium text-text">{t('legal.law')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('legal.governingLaw')} hint={t('legal.governingLawHint')}>
          <Input value={form.governing_law} onChange={(e) => set('governing_law', e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label={t('legal.disputeVenue')} hint={t('legal.disputeVenueHint')}>
          <Input value={form.dispute_venue} onChange={(e) => set('dispute_venue', e.target.value)} disabled={!isOwner} />
        </Field>
      </div>

      {/* ---------- money ---------- */}
      <h3 className="mb-3 mt-6 text-sm font-medium text-text">{t('legal.money')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('legal.vatRate')} hint={t('legal.vatRateHint')}>
          <Input type="number" value={form.vat_rate} onChange={(e) => set('vat_rate', e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label={t('legal.vatTreatment')}>
          <Select value={form.vat_treatment} onChange={(e) => set('vat_treatment', e.target.value)} disabled={!isOwner}>
            <option value="">—</option>
            <option value="inclusive">{t('legal.vatInclusive')}</option>
            <option value="exclusive">{t('legal.vatExclusive')}</option>
          </Select>
        </Field>
        <Field label={t('legal.minimumValue')} hint={t('legal.minimumValueHint')}>
          <Input type="number" value={form.minimum_project_value} onChange={(e) => set('minimum_project_value', e.target.value)} disabled={!isOwner} />
        </Field>
      </div>

      {/* ---------- hourly rates ---------- */}
      <h3 className="mb-3 mt-6 text-sm font-medium text-text">{t('legal.rates')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map((role) => (
          <Field key={role} label={t(`legal.rate_${role}`)}>
            <Input
              type="number"
              value={form.hourly_rates?.[role] ?? ''}
              onChange={(e) => setRate(role, e.target.value)}
              disabled={!isOwner}
            />
          </Field>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={busy || !isOwner}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
        {saved && <span className="text-sm text-success">{t('common.saved')}</span>}
      </div>
      <ErrorText>{error}</ErrorText>

      {/* ---------- what the contract reads from elsewhere ---------- */}
      <div className="mt-6 border-t border-separator pt-4">
        <h3 className="mb-1 text-sm font-medium text-text">{t('legal.derived')}</h3>
        <p className="mb-3 text-xs text-text-secondary">{t('legal.derivedHelp')}</p>

        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="text-text-secondary">{t('legal.workingDays')}:</dt>
            <dd className="text-text">
              {days.length ? days.map((d) => dayNames[d]).join('، ') : t('legal.noAvailability')}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-text-secondary">{t('legal.freeRevisions')}:</dt>
            <dd className="text-text">{settings?.default_revision_allowance ?? 0}</dd>
          </div>
        </dl>
      </div>
    </Card>
  )
}
