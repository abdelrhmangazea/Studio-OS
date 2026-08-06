import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatDate } from '../lib/format'
import { useI18n } from '../i18n'
import { Badge, Card, ErrorText, SectionTitle, Select } from './ui'

const ROLES = ['owner', 'member', 'viewer']

/**
 * The people in this workspace.
 *
 * There is no invite here, and that is not an omission. An invite is an
 * email, and this product does not send email — so the honest flow is
 * that a colleague creates their own account and the owner then places
 * them, rather than a button that pretends to send something.
 *
 * Only the owner can change a role, which the database enforces too:
 * the profiles UPDATE policy requires is_owner().
 */
export default function TeamSettings() {
  const { t, language } = useI18n()
  const { profile } = useAuth()
  const [members, setMembers] = useState([])
  const [error, setError] = useState('')

  const isOwner = profile?.role === 'owner'

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role, active, created_at')
      .order('created_at')

    setMembers(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function setRole(id, role) {
    setError('')
    const { error: failure } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (failure) setError(failure.message)
    load()
  }

  const owners = members.filter((m) => m.role === 'owner' && m.active)

  return (
    <Card className="mb-4">
      <SectionTitle hint={t('team.help')}>{t('settings.team')}</SectionTitle>

      <div className="space-y-2">
        {members.map((member) => {
          // Never let the last owner demote themselves out of the
          // workspace — it would leave nobody able to change anything.
          const lastOwner = member.role === 'owner' && owners.length === 1

          return (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-text">
                  {member.name || member.email}
                  {member.id === profile?.id && (
                    <span className="ms-2 text-xs text-text-secondary">· {t('team.you')}</span>
                  )}
                </p>
                <p className="text-xs text-text-secondary">
                  {member.email}
                  {member.created_at && ` · ${t('team.since', {
                    date: formatDate(member.created_at, language),
                  })}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!member.active && (
                  <Badge color="var(--muted)">{t('lists.inactive')}</Badge>
                )}
                {isOwner && !lastOwner ? (
                  <Select
                    className="w-32"
                    value={member.role}
                    onChange={(e) => setRole(member.id, e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`team.role_${r}`)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge color="var(--accent)">{t(`team.role_${member.role}`)}</Badge>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs text-text-secondary">{t('team.addHelp')}</p>
      </div>

      {!isOwner && (
        <p className="mt-2 text-xs text-text-secondary">{t('settings.ownerOnly')}</p>
      )}
    </Card>
  )
}
