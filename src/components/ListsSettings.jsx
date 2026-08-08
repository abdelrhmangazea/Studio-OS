import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLists } from '../lib/useLists'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Input, SectionTitle } from './ui'
import { errorMessage } from '../lib/errorMessage'

/**
 * Settings → Lists.
 *
 * A status that any contact still uses cannot be deleted — the database
 * foreign key refuses it. The UI checks first so it can explain why,
 * and offers deactivation instead, which keeps the status on the records
 * that already carry it while hiding it from new dropdowns.
 */
export default function ListsSettings() {
  const { t, language } = useI18n()
  const { isOwner } = useAuth()
  const { statuses, sources, reload } = useLists()

  const [usage, setUsage] = useState({})
  const [error, setError] = useState('')

  // How many contacts sit on each status, so "in use" is a real number.
  useEffect(() => {
    supabase
      .from('contacts')
      .select('status_id')
      .then(({ data }) => {
        const counts = {}
        for (const row of data ?? []) {
          if (row.status_id) counts[row.status_id] = (counts[row.status_id] ?? 0) + 1
        }
        setUsage(counts)
      })
  }, [statuses])

  async function run(action) {
    setError('')
    const { error: failure } = await action()
    if (failure) setError(errorMessage(failure, t))
    await reload()
  }

  const updateRow = (table, id, patch) => () =>
    supabase.from(table).update(patch).eq('id', id)

  async function swapOrder(table, items, index, direction) {
    const target = index + direction
    if (target < 0 || target >= items.length) return

    const a = items[index]
    const b = items[target]
    await run(() => supabase.from(table).update({ sort_order: b.sort_order }).eq('id', a.id))
    await run(() => supabase.from(table).update({ sort_order: a.sort_order }).eq('id', b.id))
  }

  async function addRow(table, extra) {
    const highest = Math.max(0, ...(table === 'lead_statuses' ? statuses : sources).map((i) => i.sort_order))
    await run(() =>
      supabase.from(table).insert({
        label_en: 'New',
        label_ar: 'جديد',
        sort_order: highest + 1,
        ...extra,
      })
    )
  }

  async function removeRow(table, item) {
    const count = table === 'lead_statuses' ? (usage[item.id] ?? 0) : 0

    if (count > 0) {
      setError(t('lists.deleteBlocked', { count }))
      return
    }
    if (!window.confirm(t('lists.deleteConfirm'))) return

    await run(() => supabase.from(table).delete().eq('id', item.id))
  }

  function renderRows(table, items, withColor) {
    return items.map((item, index) => (
      <div
        key={item.id}
        className={
          'flex flex-wrap items-end gap-2 rounded border border-border p-3 ' +
          (item.is_active ? '' : 'opacity-60')
        }
      >
        <label className="flex-1">
          <span className="mb-1 block text-xs text-text-secondary">{t('lists.labelEn')}</span>
          <Input
            defaultValue={item.label_en}
            disabled={!isOwner}
            onBlur={(event) =>
              event.target.value !== item.label_en &&
              run(updateRow(table, item.id, { label_en: event.target.value }))
            }
          />
        </label>

        <label className="flex-1">
          <span className="mb-1 block text-xs text-text-secondary">{t('lists.labelAr')}</span>
          <Input
            defaultValue={item.label_ar}
            disabled={!isOwner}
            onBlur={(event) =>
              event.target.value !== item.label_ar &&
              run(updateRow(table, item.id, { label_ar: event.target.value }))
            }
          />
        </label>

        {withColor && (
          <label>
            <span className="mb-1 block text-xs text-text-secondary">{t('lists.color')}</span>
            <input
              type="color"
              defaultValue={item.color}
              disabled={!isOwner}
              onBlur={(event) => run(updateRow(table, item.id, { color: event.target.value }))}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-surface"
            />
          </label>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            className="px-2 py-1.5"
            disabled={!isOwner || index === 0}
            onClick={() => swapOrder(table, items, index, -1)}
            title={t('lists.moveUp')}
          >
            ↑
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1.5"
            disabled={!isOwner || index === items.length - 1}
            onClick={() => swapOrder(table, items, index, 1)}
            title={t('lists.moveDown')}
          >
            ↓
          </Button>

          <Button
            variant="secondary"
            className="px-2 py-1.5"
            disabled={!isOwner}
            onClick={() => run(updateRow(table, item.id, { is_active: !item.is_active }))}
          >
            {item.is_active ? t('lists.deactivate') : t('lists.activate')}
          </Button>

          <Button
            variant="ghost"
            className="px-2 py-1.5"
            disabled={!isOwner}
            onClick={() => removeRow(table, item)}
          >
            {t('common.delete')}
          </Button>
        </div>

        {withColor && (usage[item.id] ?? 0) > 0 && (
          <span className="w-full text-xs text-text-secondary">
            {t('lists.inUse', { count: usage[item.id] })}
          </span>
        )}
      </div>
    ))
  }

  return (
    <Card className="mb-6">
      <SectionTitle hint={t('lists.help')}>{t('lists.title')}</SectionTitle>

      {!isOwner && <p className="mb-4 text-sm text-warning">{t('settings.ownerOnly')}</p>}
      <ErrorText>{error}</ErrorText>

      <h3 className="mb-3 mt-4 text-sm font-medium text-text">{t('lists.statuses')}</h3>
      <div className="space-y-2">{renderRows('lead_statuses', statuses, true)}</div>
      <Button
        variant="secondary"
        className="mt-3"
        disabled={!isOwner}
        onClick={() => addRow('lead_statuses', { color: '#b7b7b7' })}
      >
        {t('lists.addStatus')}
      </Button>

      <h3 className="mb-3 mt-8 text-sm font-medium text-text">{t('lists.sources')}</h3>
      <div className="space-y-2">{renderRows('lead_sources', sources, false)}</div>
      <Button
        variant="secondary"
        className="mt-3"
        disabled={!isOwner}
        onClick={() => addRow('lead_sources', {})}
      >
        {t('lists.addSource')}
      </Button>
    </Card>
  )
}
