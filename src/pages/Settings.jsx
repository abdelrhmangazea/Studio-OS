import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CURRENCIES, uploadLogo } from '../lib/uploadLogo'
import { useAuth } from '../lib/AuthContext'
import { usePrefs } from '../lib/PrefsContext'
import { useI18n } from '../i18n'
import ListsSettings from '../components/ListsSettings'
import ResetTemplates from '../components/ResetTemplates'
import OccasionDates from './OccasionDates'
import TeamSettings from '../components/TeamSettings'
import LegalSettings from '../components/settings/LegalSettings'
import PricingSettings from '../components/settings/PricingSettings'
import SupplierCategories from '../components/settings/SupplierCategories'
import DataSettings from '../components/settings/DataSettings'
import SubscriptionSettings from '../components/settings/SubscriptionSettings'
import {
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  PageTitle,
  Select,
  SectionTitle,
} from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'

/**
 * Studio profile, preferences, occasion dates, lists, templates, team.
 *
 * There is no Subscription section: no billing exists anywhere in this
 * product, so a page about a plan would have nothing true to say.
 */

export default function Settings() {
  useFeatureUse('settings')
  const { workspace, settings, profile, isOwner, refresh } = useAuth()
  const { theme, language, setTheme, setLanguage } = usePrefs()
  const { t } = useI18n()

  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!settings) return
    setForm({
      studio_name: settings.studio_name || '',
      logo_url: settings.logo_url || '',
      accent_color: settings.accent_color || '#0077B6',
      contact_email: settings.contact_email || '',
      contact_phone: settings.contact_phone || '',
      website: settings.website || '',
      currency: settings.currency || 'EGP',
      project_code_prefix: settings.project_code_prefix || 'IZ',
      default_language: settings.default_language || 'ar',
      default_theme: settings.default_theme || 'dark',
      default_revision_allowance: settings.default_revision_allowance ?? 2,
    })
  }, [settings])

  if (!form) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  async function handleLogo(event) {
    const file = event.target.files?.[0]
    if (!file || !workspace) return

    setUploading(true)
    setError('')
    try {
      update('logo_url', await uploadLogo(workspace.id, file))
    } catch {
      setError(t('errors.upload'))
    }
    setUploading(false)
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    setSaved(false)

    const { error: saveError } = await supabase
      .from('studio_settings')
      .update({
        ...form,
        // The input hands back a string; the column is an integer.
        default_revision_allowance: Number(form.default_revision_allowance) || 0,
      })
      .eq('workspace_id', workspace.id)

    if (saveError) {
      setError(t('errors.generic'))
    } else {
      // Keep the workspace name in step with the studio name.
      await supabase
        .from('workspaces')
        .update({ name: form.studio_name })
        .eq('id', workspace.id)
      await refresh()
      setSaved(true)
    }
    setBusy(false)
  }

  return (
    <div className="max-w-2xl">
      <PageTitle>{t('settings.title')}</PageTitle>

      {/* ---------- Studio Profile ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('settings.studioProfileHelp')}>
          {t('settings.studioProfile')}
        </SectionTitle>

        {!isOwner && <p className="mb-4 text-sm text-warning">{t('settings.ownerOnly')}</p>}

        <div className="space-y-4">
          <Field label={t('onboarding.studioNameLabel')}>
            <Input
              value={form.studio_name}
              onChange={(e) => update('studio_name', e.target.value)}
              disabled={!isOwner}
            />
          </Field>

          <Field label={t('onboarding.logoLabel')} hint={t('onboarding.logoHelp')}>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogo}
              disabled={!isOwner}
              className="block w-full text-sm text-text-secondary file:me-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:text-white"
            />
            {uploading && (
              <span className="mt-2 block text-xs text-text-secondary">
                {t('onboarding.logoUploading')}
              </span>
            )}
            {form.logo_url && !uploading && (
              <img
                src={form.logo_url}
                alt=""
                className="mt-3 h-16 rounded border border-border bg-bg object-contain p-2"
              />
            )}
          </Field>

          <Field label={t('onboarding.accentLabel')} hint={t('onboarding.accentHelp')}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.accent_color}
                onChange={(e) => update('accent_color', e.target.value)}
                disabled={!isOwner}
                className="h-10 w-14 cursor-pointer rounded border border-border bg-surface"
              />
              <Input
                value={form.accent_color}
                onChange={(e) => update('accent_color', e.target.value)}
                disabled={!isOwner}
              />
            </div>
          </Field>

          <Field label={t('settings.contactEmail')}>
            <Input
              type="email"
              value={form.contact_email}
              onChange={(e) => update('contact_email', e.target.value)}
              disabled={!isOwner}
            />
          </Field>

          <Field label={t('settings.contactPhone')}>
            <Input
              value={form.contact_phone}
              onChange={(e) => update('contact_phone', e.target.value)}
              disabled={!isOwner}
            />
          </Field>

          <Field label={t('settings.website')}>
            <Input
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              disabled={!isOwner}
            />
          </Field>
        </div>
      </Card>

      {/* ---------- Preferences ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('settings.preferencesHelp')}>
          {t('settings.preferences')}
        </SectionTitle>

        <h3 className="mb-3 text-sm font-medium text-text">{t('settings.yourPreferences')}</h3>

        {/* designer_title merges into documents, so it lives with the
            other per-user settings rather than on the studio profile. */}
        <div className="mb-4">
          <Field label={t('settings.yourTitle')} hint={t('settings.yourTitleHelp')}>
            <Input
              defaultValue={profile?.title ?? ''}
              onBlur={async (event) => {
                const next = event.target.value.trim() || null
                if (next === (profile?.title ?? null)) return
                await supabase.from('profiles').update({ title: next }).eq('id', profile.id)
                await refresh()
              }}
            />
          </Field>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <Field label={t('onboarding.themeLabel')}>
            <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="dark">{t('theme.dark')}</option>
              <option value="light">{t('theme.light')}</option>
            </Select>
          </Field>

          <Field label={t('onboarding.languageLabel')}>
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="ar">{t('language.ar')}</option>
              <option value="en">{t('language.en')}</option>
            </Select>
          </Field>
        </div>

        <h3 className="mb-1 text-sm font-medium text-text">{t('settings.studioDefaults')}</h3>
        <p className="mb-3 text-xs text-text-secondary">{t('settings.studioDefaultsHelp')}</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('onboarding.themeLabel')}>
            <Select
              value={form.default_theme}
              onChange={(e) => update('default_theme', e.target.value)}
              disabled={!isOwner}
            >
              <option value="dark">{t('theme.dark')}</option>
              <option value="light">{t('theme.light')}</option>
            </Select>
          </Field>

          <Field label={t('onboarding.languageLabel')}>
            <Select
              value={form.default_language}
              onChange={(e) => update('default_language', e.target.value)}
              disabled={!isOwner}
            >
              <option value="ar">{t('language.ar')}</option>
              <option value="en">{t('language.en')}</option>
            </Select>
          </Field>

          <Field label={t('onboarding.currencyLabel')}>
            <Select
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
              disabled={!isOwner}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('onboarding.prefixLabel')}
            hint={t('onboarding.prefixHelp', {
              example: `${form.project_code_prefix || 'IZ'}-2026-0043`,
            })}
          >
            <Input
              value={form.project_code_prefix}
              onChange={(e) => update('project_code_prefix', e.target.value.toUpperCase())}
              maxLength={6}
              disabled={!isOwner}
            />
          </Field>

          <Field label={t('portal.defaultAllowance')} hint={t('portal.defaultAllowanceHelp')}>
            <Input
              type="number"
              min="0"
              value={form.default_revision_allowance}
              onChange={(e) => update('default_revision_allowance', e.target.value)}
              disabled={!isOwner}
            />
          </Field>
        </div>
      </Card>

      <div className="mb-8 flex items-center gap-3">
        <Button onClick={handleSave} disabled={busy || uploading || !isOwner}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
        {saved && <span className="text-sm text-success">{t('common.saved')}</span>}
        <ErrorText>{error}</ErrorText>
      </div>

      {/* ---------- Pricing ---------- */}
      <PricingSettings />

      {/* ---------- Supplier categories ---------- */}
      <SupplierCategories />

      {/* ---------- Legal & Contract ---------- */}
      <LegalSettings />

      {/* ---------- Occasion dates ---------- */}
      <div id="occasions" className="mb-4">
        <OccasionDates />
      </div>

      {/* ---------- Lists ---------- */}
      <ListsSettings />

      {/* ---------- Templates ---------- */}
      <ResetTemplates />

      {/* ---------- Team ----------
          No Subscription section: there is no billing anywhere in this
          product, so a page about a plan would have nothing true to
          say. Removed rather than left as a promise. */}
      <SubscriptionSettings />

      <TeamSettings />

      {/* ---------- Your data: the bin, a copy, and the way out ---------- */}
      <DataSettings />
    </div>
  )
}
