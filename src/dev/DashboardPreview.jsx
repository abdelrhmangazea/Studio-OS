import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePrefs } from '../lib/PrefsContext'
import { useAuth } from '../lib/AuthContext'
import { DashboardView } from '../pages/Dashboard'
import { buildFixture } from './dashboardFixture'

/**
 * /dev/dashboard?lang=ar&theme=dark&empty=1
 *
 * The dashboard on fixture rows, with no account — so the layout can
 * be checked in both languages and both themes, full and empty,
 * without touching a database. Development builds only.
 */
export default function DashboardPreview() {
  const [params] = useSearchParams()
  const { setLanguage, setTheme } = usePrefs()
  // A signed-in profile re-applies its own prefs when it loads, so the
  // query string is re-applied after it.
  const { profile } = useAuth()
  const lang = params.get('lang') === 'ar' ? 'ar' : 'en'
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
  const empty = params.get('empty') === '1'

  // Deferred a tick: a child's effect runs BEFORE its provider's, and
  // PrefsProvider re-applies the profile's prefs in its own effect on
  // the same commit — applied synchronously, the query string would
  // lose every time.
  useEffect(() => {
    const id = setTimeout(() => {
      setLanguage(lang, { persist: false })
      setTheme(theme, { persist: false })
    }, 0)
    return () => clearTimeout(id)
  }, [lang, theme, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leave the browser the way it was found.
  useEffect(() => {
    const before = {
      language: localStorage.getItem('studio-os.language'),
      theme: localStorage.getItem('studio-os.theme'),
    }
    return () => {
      if (before.language) setLanguage(before.language, { persist: false })
      if (before.theme) setTheme(before.theme, { persist: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => buildFixture({ empty }), [empty])

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-[1280px]">
        <DashboardView data={data} onChanged={() => {}} refreshing={false} />
      </div>
    </div>
  )
}
