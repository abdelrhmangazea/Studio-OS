import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listSupplierCategories } from '../../lib/quotations'
import { useI18n } from '../../i18n'
import { Button, Card, Field, Input, SectionTitle } from '../ui'

/** Supplier categories — the same editable-list pattern as lead statuses. */
export default function SupplierCategories() {
  const { t } = useI18n()
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState({ name_ar: '', name_en: '' })

  const load = () => listSupplierCategories().then(setRows)
  useEffect(() => { load() }, [])

  async function add() {
    if (!draft.name_ar.trim() || !draft.name_en.trim()) return
    await supabase.from('supplier_categories').insert({
      name_ar: draft.name_ar.trim(),
      name_en: draft.name_en.trim(),
      sort_order: rows.length + 1,
    })
    setDraft({ name_ar: '', name_en: '' })
    load()
  }

  return (
    <Card className="mb-4">
      <SectionTitle hint={t('supplierCategories.help')}>
        {t('supplierCategories.title')}
      </SectionTitle>

      <ul className="mb-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
            <Input
              className="w-40"
              defaultValue={row.name_ar}
              onBlur={async (e) => {
                if (e.target.value === row.name_ar) return
                await supabase.from('supplier_categories').update({ name_ar: e.target.value }).eq('id', row.id)
                load()
              }}
            />
            <Input
              className="w-40"
              defaultValue={row.name_en}
              dir="ltr"
              onBlur={async (e) => {
                if (e.target.value === row.name_en) return
                await supabase.from('supplier_categories').update({ name_en: e.target.value }).eq('id', row.id)
                load()
              }}
            />
            <Button
              variant="ghost"
              className="px-2 py-1"
              onClick={async () => {
                await supabase.from('supplier_categories').delete().eq('id', row.id)
                load()
              }}
            >
              {t('common.delete')}
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="w-40">
          <Field label={t('lists.labelAr')}>
            <Input value={draft.name_ar} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} />
          </Field>
        </div>
        <div className="w-40">
          <Field label={t('lists.labelEn')}>
            <Input value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} dir="ltr" />
          </Field>
        </div>
        <Button onClick={add}>{t('common.add')}</Button>
      </div>
    </Card>
  )
}
