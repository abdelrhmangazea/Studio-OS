import { useEffect, useState } from 'react'
import {
  adminListFeedback,
  adminOverview,
  adminUpdateFeedback,
  isPlatformAdmin,
} from '../lib/feedback'
import { errorMessage } from '../lib/errorMessage'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../i18n'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  PageTitle,
  SectionTitle,
  Select,
  Textarea,
} from '../components/ui'

const STATE_COLOR = {
  new: 'var(--warning)',
  read: 'var(--accent)',
  answered: 'var(--success)',
  closed: 'var(--muted)',
}

/**
 * The internal screen. Ours, not the studio's.
 *
 * This is the ONE place in the product that reads across workspaces,
 * and it is limited to two tables: feedback and feature_usage. It can
 * show that a studio has 17 contacts; it cannot show who they are.
 * Contacts, projects, invoices, documents and portal links are all
 * still behind the ordinary workspace policies and are not reachable
 * from here.
 *
 * Access is a row in platform_admins, checked inside the database, not
 * a flag this component trusts. Hiding the link would not be security;
 * admin_overview() raises if the caller is not an admin, and the
 * feedback policy returns nothing.
 */
export default function Admin() {
  const { t, language } = useI18n()

  const [allowed, setAllowed] = useState(null)
  const [overview, setOverview] = useState(null)
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [replyFor, setReplyFor] = useState(null)
  const [replyText, setReplyText] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const ok = await isPlatformAdmin()
      setAllowed(ok)
      if (ok) {
        setOverview(await adminOverview())
        setRows(await adminListFeedback(filter || undefined))
      }
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [filter])

  async function setState(row, state) {
    try {
      await adminUpdateFeedback(row.id, { state })
      await load()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
  }

  async function saveReply(row) {
    try {
      await adminUpdateFeedback(row.id, { reply: replyText, state: 'answered' })
      setReplyFor(null)
      setReplyText('')
      await load()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
  }

  if (loading && allowed === null) {
    return <p className="text-sm text-text-secondary">{t('common.loading')}</p>
  }

  // Not an admin: say nothing about what is behind it.
  if (allowed === false) {
    return <EmptyState>{t('admin.notAllowed')}</EmptyState>
  }

  return (
    <div>
      <PageTitle subtitle={t('admin.subtitle')}>{t('admin.title')}</PageTitle>

      <ErrorText>{error}</ErrorText>

      {/* ---------- The three numbers ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ['admin.workspaces', overview?.workspaces],
          ['admin.feedbackOpen', overview?.feedback_open],
          ['admin.feedbackTotal', overview?.feedback_total],
        ].map(([key, value]) => (
          <Card key={key}>
            <p className="text-xs text-text-secondary">{t(key)}</p>
            <p className="mt-1 text-2xl font-semibold text-text" dir="ltr">
              {value ?? '—'}
            </p>
          </Card>
        ))}
      </div>

      {/* ---------- Item 19: what anyone actually opens ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('admin.featuresHelp')}>{t('admin.features')}</SectionTitle>

        {(overview?.features ?? []).length === 0 ? (
          <EmptyState>{t('admin.noUsage')}</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-text-secondary">
                <th className="p-2 text-start">{t('admin.feature')}</th>
                <th className="p-2 text-start">{t('admin.uses')}</th>
                <th className="p-2 text-start">{t('admin.studios')}</th>
                <th className="p-2 text-start">{t('admin.lastUsed')}</th>
              </tr>
            </thead>
            <tbody>
              {overview.features.map((f) => (
                <tr key={f.feature} className="border-b border-border">
                  <td className="p-2 text-text">{f.feature}</td>
                  <td className="p-2 font-mono text-text" dir="ltr">{f.total}</td>
                  <td className="p-2 font-mono text-text" dir="ltr">{f.studios}</td>
                  <td className="p-2 text-text-secondary">
                    {formatDateTime(f.last_used, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ---------- Studios, by activity. Counts only. ---------- */}
      <Card className="mb-6">
        <SectionTitle hint={t('admin.studiosHelp')}>{t('admin.studioList')}</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="p-2 text-start">{t('admin.studio')}</th>
              <th className="p-2 text-start">{t('admin.contacts')}</th>
              <th className="p-2 text-start">{t('admin.projects')}</th>
              <th className="p-2 text-start">{t('admin.uses')}</th>
            </tr>
          </thead>
          <tbody>
            {(overview?.studios ?? []).map((s) => (
              <tr key={s.id} className="border-b border-border">
                <td className="p-2 text-text">{s.name}</td>
                <td className="p-2 font-mono text-text" dir="ltr">{s.contacts}</td>
                <td className="p-2 font-mono text-text" dir="ltr">{s.projects}</td>
                <td className="p-2 font-mono text-text" dir="ltr">{s.feature_uses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ---------- The reports ---------- */}
      <Card>
        <SectionTitle>{t('admin.reports')}</SectionTitle>

        <div className="mb-4 w-48">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{t('admin.allStates')}</option>
            {['new', 'read', 'answered', 'closed'].map((s) => (
              <option key={s} value={s}>
                {t(`feedback.state_${s}`)}
              </option>
            ))}
          </Select>
        </div>

        {rows.length === 0 ? (
          <EmptyState>{t('admin.noReports')}</EmptyState>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={STATE_COLOR[row.state]}>{t(`feedback.state_${row.state}`)}</Badge>
                  <span className="text-xs text-text-secondary">
                    {t(`feedback.kind_${row.kind}`)} · {formatDateTime(row.created_at, language)}
                    {row.page && ` · ${row.page}`}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-text">{row.message}</p>

                {row.context && (
                  <p className="mt-1 text-xs text-text-secondary" dir="ltr">
                    {[row.context.language, row.context.theme, row.context.viewport]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}

                {row.reply && (
                  <p className="mt-2 border-s-2 border-accent ps-2 text-sm text-text-secondary">
                    {row.reply}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {row.state !== 'read' && (
                    <Button variant="ghost" onClick={() => setState(row, 'read')}>
                      {t('admin.markRead')}
                    </Button>
                  )}
                  {row.state !== 'closed' && (
                    <Button variant="ghost" onClick={() => setState(row, 'closed')}>
                      {t('admin.close')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setReplyFor(replyFor === row.id ? null : row.id)
                      setReplyText(row.reply ?? '')
                    }}
                  >
                    {t('admin.reply')}
                  </Button>
                </div>

                {replyFor === row.id && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <Button onClick={() => saveReply(row)}>{t('common.save')}</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
