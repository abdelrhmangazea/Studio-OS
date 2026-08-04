import { createContext, useContext, useMemo } from 'react'
import { usePrefs } from '../lib/PrefsContext'
import en from './en.json'
import ar from './ar.json'

/**
 * The translation layer.
 *
 * Every visible string in the app comes from ar.json or en.json.
 * Nothing is hardcoded in a component. To add a string, add the same
 * key to BOTH files.
 *
 * Usage:  const { t } = useI18n()
 *         t('nav.dashboard')
 *         t('onboarding.step', { current: 1, total: 4 })
 */

const dictionaries = { en, ar }

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const { language } = usePrefs()

  const value = useMemo(() => {
    const dictionary = dictionaries[language] ?? dictionaries.en

    function t(key, variables) {
      const text = key.split('.').reduce((branch, part) => branch?.[part], dictionary)

      // A missing key shows the key itself, which makes it obvious in the UI.
      if (typeof text !== 'string') return key
      if (!variables) return text

      return text.replace(/\{(\w+)\}/g, (whole, name) =>
        variables[name] === undefined ? whole : String(variables[name])
      )
    }

    return { t, language }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>')
  return context
}
