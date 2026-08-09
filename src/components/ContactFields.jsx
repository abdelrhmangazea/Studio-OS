import { COUNTRIES } from '../data/countries'
import { listLabel, selectableList } from '../lib/useLists'
import { useI18n } from '../i18n'
import { ErrorText, Field, Input, Select, Textarea } from './ui'

/**
 * Every editable field of a contact, in one place.
 *
 * Shared by the Add Lead panel and the Details tab so the two can never
 * drift apart — a field added here appears in both.
 */
export default function ContactFields({ form, errors, onChange, statuses, sources }) {
  const { t, language } = useI18n()

  const set = (field) => (event) => onChange(field, event.target.value)

  // Sorted in the reader's own language, so an Arabic user gets an
  // Arabic alphabetical list rather than an English one.
  const countries = [...COUNTRIES].sort((a, b) =>
    language === 'ar' ? a.nameAr.localeCompare(b.nameAr, 'ar') : a.nameEn.localeCompare(b.nameEn)
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('fields.firstName')}>
          <Input value={form.first_name} onChange={set('first_name')} required />
          <ErrorText>{errors.first_name && t(errors.first_name)}</ErrorText>
        </Field>

        <Field label={t('fields.lastName')}>
          <Input value={form.last_name} onChange={set('last_name')} />
        </Field>
      </div>

      <Field label={t('fields.email')}>
        <Input type="email" value={form.email} onChange={set('email')} />
        <ErrorText>{errors.email && t(errors.email)}</ErrorText>
      </Field>

      {/* Dialing code and number are separate columns in the database.
          dir="ltr" keeps "+20" from rendering as "20+" in Arabic. */}
      <Field label={t('fields.phone')}>
        <div dir="ltr" className="flex gap-2">
          {/* Narrow on purpose: the dialing code is four characters and
              the number needs the rest of the row. The country name
              stays in the option text so the list is searchable by
              name, and is simply clipped once the menu is closed. */}
          <Select
            value={form.phone_country_code}
            onChange={set('phone_country_code')}
            className="w-28 shrink-0 px-2"
          >
            <option value="">{t('fields.dialCode')}</option>
            {countries.map((country) => (
              <option key={country.iso} value={country.dial}>
                {country.flag} {country.dial} {language === 'ar' ? country.nameAr : country.nameEn}
              </option>
            ))}
          </Select>

          <Input
            value={form.phone_number}
            onChange={set('phone_number')}
            inputMode="numeric"
            placeholder={t('fields.phoneNumber')}
            className="min-w-0 flex-1"
          />
        </div>
        <ErrorText>{errors.phone && t(errors.phone)}</ErrorText>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('fields.country')}>
          <Select value={form.country} onChange={set('country')}>
            <option value="">{t('fields.notSet')}</option>
            {countries.map((country) => (
              <option key={country.iso} value={country.iso}>
                {country.flag} {language === 'ar' ? country.nameAr : country.nameEn}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('fields.nationality')}>
          <Select value={form.nationality} onChange={set('nationality')}>
            <option value="">{t('fields.notSet')}</option>
            {countries.map((country) => (
              <option key={country.iso} value={country.iso}>
                {language === 'ar' ? country.demonymAr : country.demonymEn}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={t('fields.address')}>
        <Textarea rows={2} value={form.address} onChange={set('address')} />
      </Field>

      {/* Identity — all optional. Only the contract reads these, and it
          prints a [[marker]] rather than blocking when they are blank. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('fields.idType')}>
          <Select value={form.id_type ?? ''} onChange={set('id_type')}>
            <option value="">{t('fields.notSet')}</option>
            {['national_id', 'passport', 'residency', 'commercial_registration'].map((k) => (
              <option key={k} value={k}>
                {t(`idType.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('fields.idNumber')}>
          <Input value={form.id_number ?? ''} onChange={set('id_number')} />
        </Field>
        <Field label={t('fields.idIssuer')}>
          <Input value={form.id_issuer ?? ''} onChange={set('id_issuer')} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('fields.source')}>
          <Select value={form.source_id} onChange={set('source_id')}>
            <option value="">{t('fields.notSet')}</option>
            {selectableList(sources, form.source_id).map((source) => (
              <option key={source.id} value={source.id}>
                {listLabel(source, language)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('fields.status')}>
          <Select value={form.status_id} onChange={set('status_id')}>
            <option value="">{t('fields.notSet')}</option>
            {selectableList(statuses, form.status_id).map((status) => (
              <option key={status.id} value={status.id}>
                {listLabel(status, language)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('fields.birthday')}>
          <Input type="date" value={form.birthday} onChange={set('birthday')} />
        </Field>

        <Field label={t('fields.nextAction')}>
          <Input type="date" value={form.next_action_at} onChange={set('next_action_at')} />
        </Field>
      </div>
    </div>
  )
}
