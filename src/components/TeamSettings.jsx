import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createInvite, listInvites, revokeInvite } from '../lib/subscription'
import { errorMessage } from '../lib/errorMessage'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import PlanLimitNotice from './PlanLimitNotice'
import { Badge, Button, Card, ErrorText, Field, Input, SectionTitle, Select } from './ui'

const ROLES = ['owner', 'member', 'viewer']

/**
 * The people in this workspace, and how somebody new gets in.
 *
 * INVITES ARE LINKS, NOT EMAILS. This product sends nothing on your
 * behalf and that does not change for invites — the owner generates
 * a link and sends it themselves, exactly as they send everything
 * else it writes.
 *
 * AND THE LINK IS A CREDENTIAL. It is 256 bits of random, single
 * use, and dies after seven days. Whoever opens it first joins;
 * forwarding it to the wrong person gives that person access. The
 * screen says all three of those things next to the copy button
 * rather than in a help article, because that is where the decision
 * is made.
 */
export default function TeamSettings() {
  const { t, language } = useI18n()
  const { profile } = useAuth()

  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [role, setRole] = useState('member')
  const [label, setLabel] = useState('')
  const [fresh, setFresh] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [failure, setFailure] = useState(null)

  const isOwner = profile?.role === 'owner'

  async function load() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, role, active, created_at')
        .order('created_at')
      setMembers(data ?? [])
      if (isOwner) setInvites(await listInvites())
    } catch (caught) {
      setError(errorMessage(caught, t))
    }
  }

  useEffect(() => {
    load()
  }, [isOwner])

  async function generate() {
    setError('')
    setFailure(null)
    setCopied(false)
    try {
      const made = await createInvite(role, label || null)
      setFresh(made)
      setLabel('')
      await load()
    } catch (caught) {
      // A seat limit is not an error, it is a plan fact. The notice
      // says which plan lifts it and the form keeps what was typed.
      setFailure(caught)
    }
  }

  const linkFor = (token) => `${window.location.origin}/invite/${token}`

  async function copy(token) {
    await navigator.clipboard.writeText(linkFor(token))
    setCopied(true)
  }

  async function setMemberRole(id, next) {
    setError('')
    const { error: caught } = await supabase.from('profiles').update({ role: next }).eq('id', id)
    if (caught) setError(errorMessage(caught, t))
    load()
  }

  async function setActive(id, active) {
    setError('')
    const { error: caught } = await supabase.from('profiles').update({ active }).eq('id', id)
    if (caught) setError(errorMessage(caught, t))
    load()
  }

  const liveInvites = invites.filter(
    (i) => !i.revoked_at && !i.accepted_at && new Date(i.expires_at) > new Date()
  )

  return (
    <Card className="mb-6">
      <SectionTitle hint={t('team.help')}>{t('settings.team')}</SectionTitle>

      {/* ---------- who is here ---------- */}
      <div className="mb-6 space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-separator p-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-text">
                {m.name || m.email}
                {!m.active && (
                  <span className="ms-2 text-xs text-text-secondary">· {t('team.inactive')}</span>
                )}
              </p>
              <p className="text-xs text-text-secondary">{m.email}</p>
            </div>

            <div className="flex items-center gap-2">
              {isOwner && m.id !== profile.id ? (
                <>
                  <Select value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`team.role_${r}`)}
                      </option>
                    ))}
                  </Select>
                  <Button variant="ghost" onClick={() => setActive(m.id, !m.active)}>
                    {t(m.active ? 'team.deactivate' : 'team.activate')}
                  </Button>
                </>
              ) : (
                <Badge color="var(--accent)">{t(`team.role_${m.role}`)}</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- what each role can do ---------- */}
      <div className="mb-6 rounded-card border border-separator p-3 text-xs text-text-secondary">
        <p>{t('team.roleOwner')}</p>
        <p className="mt-1">{t('team.roleMember')}</p>
        <p className="mt-1">{t('team.roleViewer')}</p>
      </div>

      {/* ---------- invite ---------- */}
      {isOwner && (
        <>
          <h3 className="mb-2 text-sm font-medium text-text">{t('team.invite')}</h3>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Field label={t('team.inviteRole')}>
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">{t('team.role_member')}</option>
                  <option value="viewer">{t('team.role_viewer')}</option>
                </Select>
              </Field>
            </div>
            <div className="w-52">
              <Field label={t('team.inviteLabel')}>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </Field>
            </div>
            <Button onClick={generate}>{t('team.generateLink')}</Button>
          </div>

          <PlanLimitNotice failure={failure} onDismiss={() => setFailure(null)} />

          {fresh && (
            <div className="mt-4 rounded border border-accent/50 bg-accent/10 p-3">
              <p className="text-sm text-text">{t('team.linkReady')}</p>
              <p
                className="mt-2 break-all rounded-card border border-separator bg-bg p-2 font-mono text-xs text-text"
                dir="ltr"
              >
                {linkFor(fresh.token)}
              </p>
              <Button variant="secondary" onClick={() => copy(fresh.token)} className="mt-2">
                {copied ? t('common.copied') : t('common.copy')}
              </Button>

              {/* The three facts that decide how this link gets handled. */}
              <ul className="mt-3 space-y-1 text-xs text-warning">
                <li>{t('team.warnCredential')}</li>
                <li>{t('team.warnSingleUse')}</li>
                <li>{t('team.warnExpires', { date: formatDate(fresh.expires_at, language) })}</li>
              </ul>
            </div>
          )}

          {liveInvites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-text-secondary">{t('team.openInvites')}</p>
              {liveInvites.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-separator p-2 text-xs"
                >
                  <span className="text-text">
                    {i.label || t(`team.role_${i.role}`)} ·{' '}
                    {t('team.expiresOn', { date: formatDate(i.expires_at, language) })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => copy(i.token)}
                      className="text-accent hover:underline"
                    >
                      {t('common.copy')}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await revokeInvite(i.id)
                        load()
                      }}
                      className="text-text-secondary hover:text-text"
                    >
                      {t('team.revoke')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Card>
  )
}
