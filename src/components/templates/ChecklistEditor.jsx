import { useEffect, useState } from 'react'
import { updateTemplate } from '../../lib/templates'
import { useI18n } from '../../i18n'
import { Button, ErrorText, Input, SidePanel, Textarea, WarningText } from '../ui'

/**
 * Edits a checklist template.
 *
 * Both languages are edited TOGETHER, one row per item with an Arabic
 * field and an English one. That is what keeps the stable ids paired —
 * editing the two language rows separately would let them drift, and
 * instantiation pairs items by id.
 *
 * Editing here does NOT touch any project already in progress. Projects
 * hold their own instantiated copy of the items; changes apply to
 * projects created afterwards.
 */
export default function ChecklistEditor({ open, pair, onClose, onSaved }) {
  const { t } = useI18n()

  const [sections, setSections] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !pair) return
    setError('')

    const ar = pair.ar?.structure?.sections ?? []
    const en = pair.en?.structure?.sections ?? []

    setSections(
      ar.map((section) => {
        const match = en.find((s) => s.id === section.id)
        return {
          id: section.id,
          title_ar: section.title ?? '',
          title_en: match?.title ?? '',
          note_ar: section.note ?? '',
          note_en: match?.note ?? '',
          items: (section.items ?? []).map((item) => ({
            id: item.id,
            label_ar: item.label ?? '',
            label_en: match?.items?.find((i) => i.id === item.id)?.label ?? '',
          })),
        }
      })
    )
  }, [open, pair])

  const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

  function updateSection(index, patch) {
    setSections((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function updateItem(sectionIndex, itemIndex, patch) {
    setSections((current) =>
      current.map((s, i) =>
        i !== sectionIndex
          ? s
          : { ...s, items: s.items.map((it, j) => (j === itemIndex ? { ...it, ...patch } : it)) }
      )
    )
  }

  function move(list, index, direction, setter) {
    const target = index + direction
    if (target < 0 || target >= list.length) return
    const copy = [...list]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    setter(copy)
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    try {
      const build = (lang) => ({
        sections: sections.map((section) => ({
          id: section.id,
          title: lang === 'ar' ? section.title_ar : section.title_en,
          note: (lang === 'ar' ? section.note_ar : section.note_en) || null,
          items: section.items.map((item) => ({
            id: item.id,
            label: lang === 'ar' ? item.label_ar : item.label_en,
          })),
        })),
      })

      const plain = (lang) =>
        build(lang)
          .sections.flatMap((s) => [
            `## ${s.title}`,
            ...s.items.map((i) => `- ${i.label}`),
            ...(s.note ? [`> ${s.note}`] : []),
            '',
          ])
          .join('\n')
          .trim()

      if (pair.ar) {
        await updateTemplate(pair.ar.id, { structure: build('ar'), body: plain('ar') })
      }
      if (pair.en) {
        await updateTemplate(pair.en.id, { structure: build('en'), body: plain('en') })
      }

      await onSaved()
      onClose()
    } catch (failure) {
      setError(failure.message)
    }
    setBusy(false)
  }

  const itemCount = sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <SidePanel
      open={open}
      title={t('templates.checklistEditor')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <ErrorText>{error}</ErrorText>
        </>
      }
    >
      <WarningText>{t('templates.checklistEditNotice')}</WarningText>

      <p className="mb-4 mt-2 text-xs text-text-secondary">
        {t('templates.checklistCounts', { sections: sections.length, items: itemCount })}
      </p>

      <div className="space-y-5">
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className="rounded border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-text-secondary">
                {t('templates.section')} {sectionIndex + 1}
              </span>
              <span className="flex gap-1">
                <Button
                  variant="secondary"
                  className="px-2 py-0.5"
                  onClick={() => move(sections, sectionIndex, -1, setSections)}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  className="px-2 py-0.5"
                  onClick={() => move(sections, sectionIndex, 1, setSections)}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-0.5"
                  onClick={() =>
                    setSections(sections.filter((_, i) => i !== sectionIndex))
                  }
                >
                  {t('common.delete')}
                </Button>
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                dir="rtl"
                value={section.title_ar}
                placeholder={t('templates.arabic')}
                onChange={(e) => updateSection(sectionIndex, { title_ar: e.target.value })}
              />
              <Input
                value={section.title_en}
                placeholder={t('templates.english')}
                onChange={(e) => updateSection(sectionIndex, { title_en: e.target.value })}
              />
            </div>

            <ul className="mt-3 space-y-2">
              {section.items.map((item, itemIndex) => (
                <li key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    dir="rtl"
                    className="px-2 py-1 text-xs"
                    value={item.label_ar}
                    onChange={(e) =>
                      updateItem(sectionIndex, itemIndex, { label_ar: e.target.value })
                    }
                  />
                  <Input
                    className="px-2 py-1 text-xs"
                    value={item.label_en}
                    onChange={(e) =>
                      updateItem(sectionIndex, itemIndex, { label_en: e.target.value })
                    }
                  />
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    onClick={() =>
                      updateSection(sectionIndex, {
                        items: section.items.filter((_, j) => j !== itemIndex),
                      })
                    }
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              variant="secondary"
              className="mt-2 px-2 py-1"
              onClick={() =>
                updateSection(sectionIndex, {
                  items: [
                    ...section.items,
                    { id: newId(`${section.id}i`), label_ar: '', label_en: '' },
                  ],
                })
              }
            >
              {t('templates.addItem')}
            </Button>

            {/* The coaching note belongs to the section. */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Textarea
                dir="rtl"
                rows={2}
                className="text-xs"
                placeholder={t('templates.noteAr')}
                value={section.note_ar}
                onChange={(e) => updateSection(sectionIndex, { note_ar: e.target.value })}
              />
              <Textarea
                rows={2}
                className="text-xs"
                placeholder={t('templates.noteEn')}
                value={section.note_en}
                onChange={(e) => updateSection(sectionIndex, { note_en: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        className="mt-4"
        onClick={() =>
          setSections([
            ...sections,
            {
              id: newId('s'),
              title_ar: '',
              title_en: '',
              note_ar: '',
              note_en: '',
              items: [],
            },
          ])
        }
      >
        {t('templates.addSection')}
      </Button>
    </SidePanel>
  )
}
