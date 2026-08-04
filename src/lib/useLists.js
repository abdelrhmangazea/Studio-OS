import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Lead statuses and lead sources.
 *
 * Both are per-workspace and editable in Settings → Lists, so nothing
 * anywhere else in the app should hardcode a status name.
 */

export function useLists() {
  const [statuses, setStatuses] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [statusResult, sourceResult] = await Promise.all([
      supabase.from('lead_statuses').select('*').order('sort_order'),
      supabase.from('lead_sources').select('*').order('sort_order'),
    ])
    setStatuses(statusResult.data ?? [])
    setSources(sourceResult.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { statuses, sources, loading, reload }
}

/** The right label for the reader's language. */
export function listLabel(item, language) {
  if (!item) return ''
  return language === 'ar' ? item.label_ar || item.label_en : item.label_en || item.label_ar
}

/**
 * Dropdowns show active entries only, plus whichever entry the record
 * already uses — so deactivating a status never blanks out the records
 * that still carry it.
 */
export function selectableList(items, currentId) {
  return items.filter((item) => item.is_active || item.id === currentId)
}
