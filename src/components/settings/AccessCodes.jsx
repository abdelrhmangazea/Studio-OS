import { useEffect, useState } from 'react'
import {
  adminCreateCode,
  adminEndAccess,
  adminExtendWorkspaces,
  adminExtensionPreview,
  adminListCodes,
  adminListWorkspaces,
  adminRevokeCode,
  adminSetPlan,
} from '../../lib/subscription'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'
import { useI18n } from '../../i18n'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  SectionTitle,
  Select,
} from '../ui'

/**
 * Issuing access, and taking it back.
 *
 * The create form is four fields on one row because issuing a code
 * has to take under thirty seconds. Anything that makes it a page of
 * its own makes it something to put off.
 *
 * Two rules the buttons here obey:
 *
 *   REVOKE stops future redemptions and leaves everybody already on
 *   the code exactly where they are. If a code leaks, killing it must
 *   not punish the forty studios who used it honestly.
 *
 *   ENDING ACCESS is aimed at ONE workspace and shows which. It never
 *   deletes anything — it sets the period to now, the workspace reads
 *   Free from that instant, and every row stays readable and
 *   exportable.
 */
export default function AccessCodes() {
  const { t, language } = useI18n()

  const [codes, setCodes] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)

  const [form, setForm] = useState({
    code: '',
    planKey: 'pro',
    type: 'beta',
    days: '90',
    maxUses: '',
    note: '',
  })

  async function load() {
    try {
      setCodes(await adminListCodes())
      setWorkspaces(await adminListWorkspaces())
    } catch (caught) {
      setError(errorMessage(caught, t))
    }
  }

  useEffect(() => {
    load()
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  /** Readable and unambiguous — no O/0 or I/1 to mis-type over the phone. */
  function suggest() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let out = ''
    for (let i = 0; i < 8; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    set('code', out)
  }

  async function create() {
    setBusy(true)
    setError('')
    try {
      await adminCreateCode({
        code: form.code.trim(),
        planKey: form.planKey,
        type: form.type,
        // Empty means null means unlimited / never expires — the two
        // cases the database spells out explicitly.
        days: form.days === '' ? null : Number(form.days),
        maxUses: form.maxUses === '' ? null : Number(form.maxUses),
        note: form.note || null,
      })
      setForm((f) => ({ ...f, code: '', note: '' }))
      await load()
    } catch (caught) {
      setError(errorMessage(caught, t))
    }
    setBusy(false)
  }

  async function extend(id, days) {
    const who = await adminExtensionPreview(id)
    setPreview({ id, days, who })
  }

  async function confirmExtend() {
    setError('')
    try {
      await adminExtendWorkspaces(preview.id, preview.days)
      setPreview(null)
      await load()
    } catch (caught) {
      setError(errorMessage(caught, t))
    }
  }

  return (
    <>
      {/* ---------- issue ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('codes.createHint')}>{t('codes.create')}</SectionTitle>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Field label={t('codes.code')}>
              <Input
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                dir="ltr"
              />
            </Field>
          </div>
          <Button variant="ghost" onClick={suggest}>
            {t('codes.suggest')}
          </Button>

          <div className="w-32">
            <Field label={t('codes.plan')}>
              <Select value={form.planKey} onChange={(e) => set('planKey', e.target.value)}>
                <option value="pro">Pro</option>
                <option value="studio">Studio</option>
                <option value="free">Free</option>
              </Select>
            </Field>
          </div>

          <div className="w-32">
            <Field label={t('codes.type')}>
              <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="beta">{t('codes.type_beta')}</option>
                <option value="trial">{t('codes.type_trial')}</option>
                <option value="comp">{t('codes.type_comp')}</option>
              </Select>
            </Field>
          </div>

          <div className="w-28">
            <Field label={t('codes.days')} hint={t('codes.daysHint')}>
              <Input
                type="number"
                value={form.days}
                onChange={(e) => set('days', e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>

          <div className="w-28">
            <Field label={t('codes.maxUses')} hint={t('codes.maxUsesHint')}>
              <Input
                type="number"
                value={form.maxUses}
                onChange={(e) => set('maxUses', e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>

          <div className="w-48">
            <Field label={t('codes.note')}>
              <Input value={form.note} onChange={(e) => set('note', e.target.value)} />
            </Field>
          </div>

          <Button onClick={create} disabled={busy || !form.code.trim()}>
            {busy ? t('common.loading') : t('codes.generate')}
          </Button>
        </div>

        <ErrorText>{error}</ErrorText>
      </Card>

      {/* ---------- issued ---------- */}
      <Card className="mb-6">
        <SectionTitle>{t('codes.issued')}</SectionTitle>

        {codes.length === 0 ? (
          <EmptyState>{t('codes.none')}</EmptyState>
        ) : (
          <div className="space-y-3">
            {codes.map((c) => (
              <div key={c.id} className="rounded-card border border-separator p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-text" dir="ltr">
                    {c.code}
                  </span>
                  <Badge color="var(--accent)">{t(`codes.type_${c.code_type}`)}</Badge>
                  <Badge>{c.grants_plan_key}</Badge>
                  <span className="text-xs text-text-secondary">
                    {c.never_expires
                      ? t('codes.neverExpires')
                      : t('codes.forDays', { days: c.duration_days })}
                    {' · '}
                    {c.unlimited_uses
                      ? t('codes.unlimitedUses', { used: c.uses_count })
                      : t('codes.usesOf', { used: c.uses_count, max: c.max_uses })}
                  </span>
                  {!c.active && <Badge color="var(--muted)">{t('codes.revoked')}</Badge>}
                </div>

                {c.note && <p className="mt-1 text-xs text-text-secondary">{c.note}</p>}

                <div className="mt-2 flex flex-wrap gap-2">
                  {c.active && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        await adminRevokeCode(c.id)
                        load()
                      }}
                    >
                      {t('codes.revoke')}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => extend(c.id, 30)}>
                    {t('codes.extend30')}
                  </Button>
                </div>

                {c.redemptions.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-separator pt-2">
                    {c.redemptions.map((r) => (
                      <p key={r.workspace_id} className="text-xs text-text-secondary">
                        {r.workspace} · {formatDate(r.redeemed_at, language)} ·{' '}
                        {r.expired
                          ? t('codes.expired')
                          : r.days_remaining == null
                            ? t('codes.noExpiry')
                            : t('codes.daysLeft', { days: r.days_remaining })}
                        {!r.changed_anything && ` · ${t('codes.noChange')}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---------- extension preview: never a silent broadcast ---------- */}
      {preview && (
        <Card className="mb-6 border-warning/50">
          <SectionTitle>{t('codes.confirmExtend', { days: preview.days })}</SectionTitle>
          <p className="mb-3 text-sm text-text">
            {t('codes.willAffect', { count: preview.who.length })}
          </p>
          <ul className="mb-3 space-y-1 text-xs text-text-secondary">
            {preview.who.map((w) => (
              <li key={w.workspace_id}>
                {w.workspace} ·{' '}
                {w.already_expired
                  ? t('codes.expired')
                  : t('codes.daysLeft', { days: w.days_remaining })}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button onClick={confirmExtend}>{t('common.confirm')}</Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {/* ---------- workspaces, and the Free-tier switch ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('codes.workspacesHint')}>{t('codes.workspaces')}</SectionTitle>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-separator text-xs text-text-secondary">
              <th className="p-2 text-start">{t('admin.studio')}</th>
              <th className="p-2 text-start">{t('codes.plan')}</th>
              <th className="p-2 text-start">{t('codes.left')}</th>
              <th className="p-2 text-start">{t('admin.contacts')}</th>
              <th className="p-2 text-start">{t('codes.setPlan')}</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((w) => (
              <tr key={w.id} className="border-b border-separator">
                <td className="p-2 text-text">{w.name}</td>
                <td className="p-2">
                  <Badge color={w.effective === 'free' ? 'var(--muted)' : 'var(--accent)'}>
                    {w.effective}
                  </Badge>
                  {w.effective !== w.plan_key && (
                    <span className="ms-1 text-xs text-warning">{t('codes.lapsed')}</span>
                  )}
                </td>
                <td className="p-2 text-xs text-text-secondary">
                  {w.days_remaining == null ? '∞' : w.days_remaining}
                </td>
                <td className="p-2 font-mono text-text" dir="ltr">
                  {w.contacts}
                </td>
                <td className="p-2">
                  <div className="flex gap-1">
                    {/* Put a test workspace on Free to walk the free-tier
                        experience end to end. */}
                    {['free', 'pro', 'studio'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={async () => {
                          await adminSetPlan(w.id, k, k === 'free' ? null : null)
                          load()
                        }}
                        className="rounded-card border border-separator px-2 py-0.5 text-xs text-accent hover:bg-surface"
                      >
                        {k}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={async () => {
                        await adminEndAccess(w.id)
                        load()
                      }}
                      className="rounded-card border border-separator px-2 py-0.5 text-xs text-text-secondary hover:bg-surface"
                      title={t('codes.endAccessHint')}
                    >
                      {t('codes.endAccess')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
