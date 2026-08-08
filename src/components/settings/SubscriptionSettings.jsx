import { useEffect, useState } from 'react'
import { listPlans, mySubscription, redeemCode, yearlyPrice } from '../../lib/subscription'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, Field, Input, SectionTitle } from '../ui'

/**
 * The plan, what it includes, and the code field.
 *
 * There is no purchase button yet and this screen does not pretend
 * otherwise — during the beta it says plainly that upgrades are
 * arranged by hand. A button that opens nothing is worse than no
 * button, because it costs somebody a click and their trust.
 */
export default function SubscriptionSettings() {
  const { t, language } = useI18n()

  const [sub, setSub] = useState(null)
  const [plans, setPlans] = useState([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  async function load() {
    try {
      setSub(await mySubscription())
      setPlans(await listPlans())
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function redeem() {
    setBusy(true)
    setError('')
    setDone(null)
    try {
      const result = await redeemCode(code)
      setDone(result)
      setCode('')
      await load()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy(false)
  }

  const effective = sub?.effective_plan_key
  const plan = plans.find((p) => p.key === effective)

  return (
    <Card className="mb-6" id="subscription">
      <SectionTitle hint={t('plan.settingsHint')}>{t('plan.title')}</SectionTitle>

      {/* ---------- where you stand ---------- */}
      <div className="mb-6 rounded border border-border p-4">
        <p className="text-xs text-text-secondary">{t('plan.current')}</p>
        <p className="mt-1 text-xl font-semibold text-text">
          {plan ? (language === 'ar' ? plan.name_ar : plan.name_en) : '—'}
        </p>

        {sub?.status && (
          <p className="mt-1 text-xs text-text-secondary">
            {t(`plan.status_${sub.status}`)}
            {sub.current_period_end &&
              ` · ${t('plan.until', { date: formatDate(sub.current_period_end, language) })}`}
            {sub.days_remaining != null &&
              ` · ${t('plan.daysLeft', { days: sub.days_remaining })}`}
          </p>
        )}

        {/* The paid plan lapsed and they are reading Free. Say so —
            otherwise "Free" looks like a mistake rather than an expiry. */}
        {sub?.expired && (
          <p className="mt-2 text-sm text-warning">
            {t('plan.lapsed', { plan: t(`plan.name_${sub.plan_key}`) })}
          </p>
        )}
      </div>

      {/* ---------- a code ---------- */}
      <div className="mb-6">
        <Field label={t('plan.haveCode')} hint={t('plan.codeHint')}>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="IADB2026"
              autoComplete="off"
              dir="ltr"
            />
            <Button onClick={redeem} disabled={busy || !code.trim()}>
              {busy ? t('common.loading') : t('plan.apply')}
            </Button>
          </div>
        </Field>

        {done && (
          <p className="mt-2 rounded border border-success/40 bg-success/10 p-2 text-sm text-text">
            {done.changed
              ? t('plan.codeApplied', { plan: t(`plan.name_${done.plan_key}`) })
              : t('plan.codeNoChange')}
          </p>
        )}
        <ErrorText>{error}</ErrorText>
      </div>

      {/* ---------- what each plan is ---------- */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`rounded border p-4 ${
              p.key === effective ? 'border-accent' : 'border-border'
            }`}
          >
            <p className="text-sm font-semibold text-text">
              {language === 'ar' ? p.name_ar : p.name_en}
            </p>

            <p className="mt-1 text-lg text-text" dir="ltr">
              {Number(p.price_monthly) === 0
                ? t('plan.freePrice')
                : `${p.currency} ${p.price_monthly}/${t('plan.month')}`}
            </p>
            {Number(p.price_monthly) > 0 && (
              <p className="text-xs text-text-secondary" dir="ltr">
                {p.currency} {yearlyPrice(p)}/{t('plan.year')} · {t('plan.twoMonthsFree')}
              </p>
            )}

            <ul className="mt-3 space-y-1 text-xs text-text-secondary">
              <li>{t('plan.seats', { n: p.max_team_seats ?? '∞' })}</li>
              <li>{t('plan.contacts', { n: p.max_contacts ?? '∞' })}</li>
              <li>{t('plan.projects', { n: p.max_active_projects ?? '∞' })}</li>
              <li>
                {t('plan.templates', {
                  n: p.usable_template_keys ? p.max_usable_templates : '∞',
                })}
              </li>
              <li className={p.client_portal_enabled ? 'text-text' : ''}>
                {p.client_portal_enabled ? '✓' : '—'} {t('plan.portal')}
              </li>
              <li className={p.document_generator_enabled ? 'text-text' : ''}>
                {p.document_generator_enabled ? '✓' : '—'} {t('plan.generator')}
              </li>
              <li className={p.fee_calculator_enabled ? 'text-text' : ''}>
                {p.fee_calculator_enabled ? '✓' : '—'} {t('plan.calculator')}
              </li>
              <li className={p.reports_enabled ? 'text-text' : ''}>
                {p.reports_enabled ? '✓' : '—'} {t('plan.reports')}
              </li>
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-text-secondary">{t('plan.betaUpgradeNote')}</p>
    </Card>
  )
}
