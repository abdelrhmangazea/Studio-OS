import { useEffect, useMemo, useState } from 'react'
import { METHODS, METHOD_BY_KEY } from '../../lib/pricing'
import { applyCommon, comparableProjects, splitIntoPhases } from '../../lib/pricing/apply'
import {
  applyToProject,
  deleteCalculation,
  listCalculations,
  saveCalculation,
} from '../../lib/feeCalculator'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, Field, Input, Select } from '../ui'

const COMPLEXITY = ['simple', 'standard', 'complex']

/**
 * The fee calculator.
 *
 * The screen knows nothing about any particular pricing method — it
 * draws whatever `inputs()` describes and prints whatever `steps` come
 * back. That is what makes a method removable: delete its file and its
 * line in the index, and this component neither notices nor changes.
 *
 * The breakdown is the point. A total you cannot explain to a client
 * is a total you will discount the moment they push back.
 */
export default function FeeCalculator({ project, onApplied }) {
  const { t, language } = useI18n()
  const { settings } = useAuth()

  const config = settings?.pricing_config ?? {}
  const [methodKey, setMethodKey] = useState(settings?.default_pricing_method ?? METHODS[0].key)
  const [values, setValues] = useState({})
  const [complexity, setComplexity] = useState('standard')
  const [comparison, setComparison] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const method = METHOD_BY_KEY[methodKey] ?? METHODS[0]
  const fields = useMemo(() => method.inputs(config), [method, config])

  // Reset to this method's defaults, pre-filling anything the project
  // already knows.
  useEffect(() => {
    const next = {}
    for (const field of fields) {
      if (field.default !== undefined) next[field.name] = field.default
      if (field.from && project?.[field.from] != null) next[field.name] = project[field.from]
    }
    setValues(next)
    setNote('')
  }, [methodKey])

  useEffect(() => {
    listCalculations(project.id).then(setHistory)
    comparableProjects({
      projectId: project.id,
      area: project.area_sqm,
      projectType: project.project_type,
    }).then(setComparison)
  }, [project.id])

  const visible = fields.filter((field) => {
    if (field.hideWhen?.()) return false
    if (!field.showWhen) return true
    return Object.entries(field.showWhen).every(([k, v]) => values[k] === v)
  })

  const result = useMemo(() => {
    const calculated = method.calculate(values, config, settings)
    return applyCommon(calculated, { complexity, config, settings })
  }, [method, values, complexity, config, settings])

  const currency = result.currency

  async function save() {
    setError('')
    try {
      await saveCalculation({
        projectId: project.id,
        method: method.key,
        inputs: { ...values, complexity },
        result,
      })
      setHistory(await listCalculations(project.id))
      setNote(t('pricing.saved'))
    } catch (failure) {
      setError(failure.message)
    }
  }

  async function pushToProject() {
    setError('')
    try {
      await applyToProject(project.id, result.recommended)
      const phases = splitIntoPhases(result.recommended, config, values, method)
      await saveCalculation({
        projectId: project.id,
        method: method.key,
        inputs: { ...values, complexity },
        result: { ...result, phases },
      })
      setHistory(await listCalculations(project.id))
      setNote(t('pricing.pushed', { phases: phases.join(' · ') }))
      onApplied?.()
    } catch (failure) {
      setError(failure.message)
    }
  }

  const money = (n) => `${Number(n).toLocaleString()} ${currency}`

  return (
    <Card>
      <h3 className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
        {t('pricing.title')}
      </h3>
      <p className="mb-4 text-xs text-text-secondary">{t('pricing.help')}</p>

      {/* ---------- method ---------- */}
      <div className="mb-4 w-full sm:w-72">
        <Field label={t('pricing.method')}>
          <Select value={methodKey} onChange={(e) => setMethodKey(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {t(`pricing.method_${m.key}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* ---------- this method's own inputs ---------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((field) =>
          field.type === 'choice' ? (
            <Field key={field.name} label={t(`pricing.${field.name}`)}>
              <Select
                value={values[field.name] ?? field.default}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              >
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {t(`pricing.${field.name}_${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field key={field.name} label={t(`pricing.${field.name}`)}>
              <Input
                type="number"
                value={values[field.name] ?? ''}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              />
            </Field>
          )
        )}
      </div>

      {/* ---------- common to every method ---------- */}
      <div className="mt-4 w-full sm:w-72">
        <Field label={t('pricing.complexity')} hint={t('pricing.complexityHint')}>
          <Select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
            {COMPLEXITY.map((c) => (
              <option key={c} value={c}>
                {t(`pricing.complexity_${c}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* ---------- the breakdown ---------- */}
      {result.steps.length > 0 && (
        <div className="mt-5 rounded border border-border p-4">
          <h4 className="mb-3 text-xs uppercase tracking-wide text-text-secondary">
            {t('pricing.breakdown')}
          </h4>
          <ul className="space-y-1.5">
            {result.steps.map((step, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="text-text">
                  {t(step.label)}
                  {step.detail && (
                    <span className="ms-2 text-xs text-text-secondary" dir="ltr">
                      {step.detail}
                    </span>
                  )}
                </span>
                {step.amount !== null && (
                  <span className="font-mono text-text-secondary" dir="ltr">
                    {Number(step.amount).toLocaleString()}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <Figure label={t('pricing.low')} value={money(result.low)} />
            <Figure label={t('pricing.recommended')} value={money(result.recommended)} strong />
            <Figure label={t('pricing.high')} value={money(result.high)} />
          </div>
        </div>
      )}

      {/* ---------- what you actually charged before ---------- */}
      {comparison && (
        <div className="mt-4 rounded border border-border p-4">
          <h4 className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
            {t('pricing.comparison')}
          </h4>
          {comparison.enough ? (
            <p className="text-sm text-text">
              {t('pricing.comparisonAverage', {
                count: comparison.count,
                amount: money(comparison.average),
              })}
            </p>
          ) : (
            <p className="text-sm text-text-secondary">
              {t('pricing.comparisonTooFew', { count: comparison.count })}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={pushToProject}>{t('pricing.push')}</Button>
        <Button variant="secondary" onClick={save}>
          {t('pricing.save')}
        </Button>
      </div>

      {note && <p className="mt-2 text-sm text-success">{note}</p>}
      <ErrorText>{error}</ErrorText>

      {/* ---------- how this project was priced before ---------- */}
      {history.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h4 className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
            {t('pricing.history')}
          </h4>
          <ul className="space-y-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-sm"
              >
                <span className="text-text">
                  {t(`pricing.method_${row.method}`, {}, row.method)}
                  <span className="ms-2 text-xs text-text-secondary">
                    {formatDate(row.created_at, language)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-text-secondary" dir="ltr">
                    {Number(row.result?.recommended ?? 0).toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    className="px-2 py-0.5"
                    onClick={async () => {
                      await deleteCalculation(row.id)
                      setHistory(await listCalculations(project.id))
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Figure({ label, value, strong }) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={'mt-0.5 ' + (strong ? 'text-xl font-semibold text-accent' : 'text-base text-text')}>
        {value}
      </p>
    </div>
  )
}
