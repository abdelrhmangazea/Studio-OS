import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

/**
 * Theme and language.
 *
 * Both are per-user settings stored on the profile row, so a team
 * member can work in English on a light theme while the owner uses
 * Arabic on dark. studio_settings holds the workspace *defaults*,
 * which is what a new member starts with.
 *
 * Signed-out visitors get their choice remembered in localStorage,
 * so the sign-in screen respects it too.
 */

const PrefsContext = createContext(null)

const STORAGE_LANGUAGE = 'studio-os.language'
const STORAGE_THEME = 'studio-os.theme'

export function PrefsProvider({ children }) {
  const { profile } = useAuth()

  const [language, setLanguageState] = useState(
    () => localStorage.getItem(STORAGE_LANGUAGE) || 'ar'
  )
  // Light is the default for anyone who has not chosen. An existing
  // profile always carries an explicit theme, so nobody who has
  // already picked dark is moved off it by this.
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_THEME) || 'light')

  // Once signed in, the profile is the source of truth.
  useEffect(() => {
    if (!profile) return
    setLanguageState(profile.language)
    setThemeState(profile.theme)
  }, [profile])

  // Arabic mirrors the whole layout to RTL.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem(STORAGE_LANGUAGE, language)
  }, [language])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_THEME, theme)
  }, [theme])

  async function persist(column, value) {
    if (!profile) return
    await supabase.from('profiles').update({ [column]: value }).eq('id', profile.id)
  }

  const value = {
    language,
    theme,
    isRtl: language === 'ar',
    setLanguage: (next) => {
      setLanguageState(next)
      persist('language', next)
    },
    setTheme: (next) => {
      setThemeState(next)
      persist('theme', next)
    },
    toggleLanguage: () => {
      const next = language === 'ar' ? 'en' : 'ar'
      setLanguageState(next)
      persist('language', next)
    },
    toggleTheme: () => {
      const next = theme === 'dark' ? 'light' : 'dark'
      setThemeState(next)
      persist('theme', next)
    },
  }

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  const context = useContext(PrefsContext)
  if (!context) throw new Error('usePrefs must be used inside <PrefsProvider>')
  return context
}
