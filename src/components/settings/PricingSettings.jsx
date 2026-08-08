import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { METHODS } from '../../lib/pricing'
import { methodUsage } from '../../lib/feeCalculator'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, Field, Input, SectionTitle, Select } from '../ui'
import { errorMessage } from '../../lib/errorMessage'

const SPACES = ['living', 'kitchen', 'bathroom', 'outdoor']
const ROOMS = ['bedroom', 'living', 'kitchen', 'bathroom']
const COMPLEXITY = ['simple', 'standard', 'complex']

/**
 * Rates and multipliers for the fee calculator, plus which methods are
 * actually being used.
 *
 * The usage counts are the point of shipping all six: beta shows which
 * ones designers reach for, and the rest come out afterwards.
 */
export default function PricingSettings() {
  const { t, language } = useI18n()
  const { workspace, settings, isOwner, refresh } = useAuth()

  const [config, setConfig] = useState(null)
  const [method, setMethod] = useState('')
  const [usage, setUsage] = useState([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!settings) return
    setConfig(settings.pricing_config ?? {})
    setMethod(settings.default_pricing_method ?? METHODS[0].key)
  }, [settings])

  useEffect(() => {
    methodUsage().then(setUsage).catch(() => setUsage([]))
  }, [])

  if (!config) return null

  const at = (path, fallback = '') =>
    path.reduce((node, key) => node?.[key], config) ?? fallback

  const put = (path, value) => {
    setConfig((current) => {
      const next = structuredClone(current)
      let node = next
      for (const key of path.slice(0, -1)) {
        node[key] ??= {}
        node = node[key]
      }
      node[path.at(-1)] = value === '' ? 0 : Number(value)
      return next
    })
    setSaved(false)
  }

  async function save() {
    setError('')
    const { error: failure } = await supabase
      .from('studio_settings')
      .update({ pricing_config: config, default_pricing_method: method })
      .eq('workspace_id', workspace.id)

    if (failure) setError(errorMessage(failure, t))
    else {
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const splitTotal = [1, 2, 3, 4, 5].reduce((sum, n) => sum + Number(at(['phase_split', String(n)], 0)), 0)

  return (
    <Card className="mb-4">
      <SectionTitle hint={t('pricing.settingsHelp')}>{t('pricing.settingsTitle')}</SectionTitle>

      <div className="mb-5 w-full sm:w-72">
        <Field label={t('pricing.defaultMethod')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} disabled={!isOwner}>
            {METHODS.map((m) => (
              <option key={m.key} value={m.key}>{t(`pricing.method_${m.key}`)}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Group title={t('pricing.method_per_sqm')}>
        <Field label={t('pricing.rateSimple')}>
          <Input type="number" value={at(['per_sqm', 'simple'], 0)} onChange={(e) => put(['per_sqm', 'simple'], e.target.value)} disabled={!isOwner} />
        </Field>
        {SPACES.map((s) => (
          <Field key={s} label={t(`space.${s}`)}>
            <Input type="number" value={at(['per_sqm', 'by_space', s], 0)} onChange={(e) => put(['per_sqm', 'by_space', s], e.target.value)} disabled={!isOwner} />
          </Field>
        ))}
      </Group>

      <Group title={t('pricing.method_percentage')} hint={t('pricing.bandsHint')}>
        <Field label={t('pricing.flatPercentLabel')}>
          <Input type="number" value={at(['percentage', 'flat'], 0)} onChange={(e) => put(['percentage', 'flat'], e.target.value)} disabled={!isOwner} />
        </Field>
      </Group>

      <Group title={t('pricing.method_per_room')}>
        {ROOMS.map((r) => (
          <Field key={r} label={t(`room.${r}`)}>
            <Input type="number" value={at(['per_room', 'types', r], 0)} onChange={(e) => put(['per_room', 'types', r], e.target.value)} disabled={!isOwner} />
          </Field>
        ))}
      </Group>

      <Group title={t('pricing.method_cost_plus')}>
        <Field label={t('pricing.markup')}>
          <Input type="number" value={at(['cost_plus', 'markup'], 0)} onChange={(e) => put(['cost_plus', 'markup'], e.target.value)} disabled={!isOwner} />
        </Field>
      </Group>

      <Group title={t('pricing.commonTitle')} hint={t('pricing.commonHint')}>
        {COMPLEXITY.map((c) => (
          <Field key={c} label={t(`pricing.complexity_${c}`)}>
            <Input type="number" step="0.05" value={at(['complexity', c], 1)} onChange={(e) => put(['complexity', c], e.target.value)} disabled={!isOwner} />
          </Field>
        ))}
        <Field label={t('pricing.marginLabel')}>
          <Input type="number" value={at(['margin'], 0)} onChange={(e) => put(['margin'], e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label={t('pricing.rangeLow')}>
          <Input type="number" step="0.05" value={at(['range', 'low'], 0.85)} onChange={(e) => put(['range', 'low'], e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label={t('pricing.rangeHigh')}>
          <Input type="number" step="0.05" value={at(['range', 'high'], 1.2)} onChange={(e) => put(['range', 'high'], e.target.value)} disabled={!isOwner} />
        </Field>
      </Group>

      <Group
        title={t('pricing.phaseSplit')}
        hint={
          splitTotal === 100
            ? t('pricing.phaseSplitOk')
            : t('pricing.phaseSplitOff', { total: splitTotal })
        }
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Field key={n} label={t(`pricing.phase_${n}`)}>
            <Input type="number" value={at(['phase_split', String(n)], 0)} onChange={(e) => put(['phase_split', String(n)], e.target.value)} disabled={!isOwner} />
          </Field>
        ))}
      </Group>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={!isOwner}>{t('common.save')}</Button>
        {saved && <span className="text-sm text-success">{t('common.saved')}</span>}
      </div>
      <ErrorText>{error}</ErrorText>

      {/* ---------- which methods earn their place ---------- */}
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="mb-1 text-sm font-medium text-text">{t('pricing.usageTitle')}</h3>
        <p className="mb-3 text-xs text-text-secondary">{t('pricing.usageHelp')}</p>

        {usage.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('pricing.usageEmpty')}</p>
        ) : (
          <ul className="space-y-1">
            {usage.map((row) => (
              <li key={row.method} className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-text">{t(`pricing.method_${row.method}`, {}, row.method)}</span>
                <span className="text-text-secondary">
                  {t('pricing.usageCount', { count: row.uses })}
                  {row.last_used && ` · ${formatDate(row.last_used, language)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function Group({ title, hint, children }) {
  return (
    <div className="mb-5">
      <h3 className="mb-1 text-sm font-medium text-text">{title}</h3>
      {hint && <p className="mb-3 text-xs text-text-secondary">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-3">{children}</div>
    </div>
  )
}
