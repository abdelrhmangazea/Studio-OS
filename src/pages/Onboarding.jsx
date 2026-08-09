import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CURRENCIES, uploadLogo } from '../lib/uploadLogo'
import { useAuth } from '../lib/AuthContext'
import { usePrefs } from '../lib/PrefsContext'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input, Select } from '../components/ui'

/**
 * Shown once, at first sign-in. Three short steps, then the workspace
 * is marked onboarding_complete and never asks again.
 */

const TOTAL_STEPS = 3

export default function Onboarding() {
  const { workspace, settings, refresh } = useAuth()
  const { setLanguage, setTheme } = usePrefs()
  const { t } = useI18n()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    studio_name: settings?.studio_name || workspace?.name || '',
    logo_url: settings?.logo_url || '',
    accent_color: settings?.accent_color || '#0077B6',
    default_language: settings?.default_language || 'ar',
    default_theme: settings?.default_theme || 'light',
    currency: settings?.currency || 'EGP',
    project_code_prefix: settings?.project_code_prefix || 'IZ',
  })

  // Already done? Never show this screen again.
  if (workspace?.onboarding_complete) return <Navigate to="/dashboard" replace />

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleLogo(event) {
    const file = event.target.files?.[0]
    if (!file || !workspace) return

    setUploading(true)
    setError('')
    try {
      const url = await uploadLogo(workspace.id, file)
      update('logo_url', url)
    } catch {
      setError(t('errors.upload'))
    }
    setUploading(false)
  }

  async function handleFinish() {
    setBusy(true)
    setError('')

    const settingsUpdate = await supabase
      .from('studio_settings')
      .update(form)
      .eq('workspace_id', workspace.id)

    const workspaceUpdate = await supabase
      .from('workspaces')
      .update({ name: form.studio_name, onboarding_complete: true })
      .eq('id', workspace.id)

    if (settingsUpdate.error || workspaceUpdate.error) {
      setError(t('errors.generic'))
      setBusy(false)
      return
    }

    // The owner's own view adopts the defaults they just chose.
    setLanguage(form.default_language)
    setTheme(form.default_theme)

    await refresh()
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-lg">
        <Card>
          <p className="t-section">
            {t('onboarding.step', { current: step, total: TOTAL_STEPS })}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-text">{t('onboarding.title')}</h1>
          <p className="mb-6 mt-1 text-sm text-text-secondary">{t('onboarding.subtitle')}</p>

          {step === 1 && (
            <div className="space-y-4">
              <Field
                label={t('onboarding.studioNameLabel')}
                hint={t('onboarding.studioNameHelp')}
              >
                <Input
                  value={form.studio_name}
                  onChange={(e) => update('studio_name', e.target.value)}
                  required
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field label={t('onboarding.logoLabel')} hint={t('onboarding.logoHelp')}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogo}
                  className="block w-full text-sm text-text-secondary file:me-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-2 file:text-[13px] file:text-on-accent"
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
                    className="mt-3 h-16 rounded-card border border-separator bg-bg object-contain p-2"
                  />
                )}
              </Field>

              <Field label={t('onboarding.accentLabel')} hint={t('onboarding.accentHelp')}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) => update('accent_color', e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-card border border-separator bg-surface"
                  />
                  <Input
                    value={form.accent_color}
                    onChange={(e) => update('accent_color', e.target.value)}
                  />
                </div>
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Field label={t('onboarding.languageLabel')}>
                <Select
                  value={form.default_language}
                  onChange={(e) => update('default_language', e.target.value)}
                >
                  <option value="ar">{t('language.ar')}</option>
                  <option value="en">{t('language.en')}</option>
                </Select>
              </Field>

              <Field label={t('onboarding.themeLabel')}>
                <Select
                  value={form.default_theme}
                  onChange={(e) => update('default_theme', e.target.value)}
                >
                  <option value="dark">{t('theme.dark')}</option>
                  <option value="light">{t('theme.light')}</option>
                </Select>
              </Field>

              <Field label={t('onboarding.currencyLabel')}>
                <Select
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value)}
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
                />
              </Field>
            </div>
          )}

          <ErrorText>{error}</ErrorText>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1 || busy}
            >
              {t('common.back')}
            </Button>

            {step < TOTAL_STEPS ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={uploading || (step === 1 && !form.studio_name.trim())}
              >
                {t('common.next')}
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={busy || uploading}>
                {busy ? t('common.saving') : t('onboarding.done')}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
