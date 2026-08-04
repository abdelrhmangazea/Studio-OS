import { useMemo } from 'react'
import { setChecklistItemDone } from '../../lib/projects'
import { useAuth } from '../../lib/AuthContext'
import { useI18n } from '../../i18n'
import { EmptyState } from '../ui'

/**
 * Block 1 of 4 — the stage's checklist.
 *
 * Items are grouped back into their sections, with the coaching note
 * shown under the section it belongs to. Ticking updates progress live.
 */
export default function ChecklistBlock({ items, onChanged }) {
  const { t, language } = useI18n()
  const { profile } = useAuth()

  const sections = useMemo(() => {
    const grouped = []
    for (const item of items) {
      const title = language === 'ar' ? item.section_title_ar : item.section_title_en
      const note = language === 'ar' ? item.note_ar : item.note_en
      let section = grouped.at(-1)
      if (!section || section.title !== title) {
        section = { title, note, items: [] }
        grouped.push(section)
      }
      section.items.push(item)
    }
    return grouped
  }, [items, language])

  if (items.length === 0) return <EmptyState>{t('project.noChecklist')}</EmptyState>

  async function toggle(item) {
    onChanged(items.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)))
    try {
      await setChecklistItemDone(item.id, !item.is_done, profile?.id)
    } catch {
      onChanged(items) // put it back if the database refused
    }
  }

  return (
    <div className="space-y-5">
      {sections.map((section, index) => (
        <div key={`${section.title}-${index}`}>
          <h4 className="mb-2 text-sm font-medium text-text">{section.title}</h4>

          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded px-2 py-1.5 hover:bg-bg">
                  <input
                    type="checkbox"
                    checked={item.is_done}
                    onChange={() => toggle(item)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span
                    className={
                      'text-sm ' +
                      (item.is_done ? 'text-text-secondary line-through' : 'text-text')
                    }
                  >
                    {language === 'ar' ? item.label_ar : item.label_en}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {/* The coaching note belongs to the section, not to an item. */}
          {section.note && (
            <p className="mt-2 border-s-2 border-warning bg-surface px-3 py-2 text-xs text-text-secondary">
              {section.note}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
