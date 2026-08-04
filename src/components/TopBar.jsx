import { useAuth } from '../lib/AuthContext'
import { usePrefs } from '../lib/PrefsContext'
import { useI18n } from '../i18n'
import GlobalSearch from './GlobalSearch'
import { Button } from './ui'

export default function TopBar() {
  const { profile, session, signOut } = useAuth()
  const { theme, language, toggleTheme, toggleLanguage } = usePrefs()
  const { t } = useI18n()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="whitespace-nowrap text-sm text-text">
          {profile?.name || session?.user?.email}
        </span>
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={toggleTheme} title={t('theme.toggle')}>
          {theme === 'dark' ? t('theme.light') : t('theme.dark')}
        </Button>

        <Button variant="secondary" onClick={toggleLanguage} title={t('language.toggle')}>
          {language === 'ar' ? t('language.en') : t('language.ar')}
        </Button>

        <Button variant="ghost" onClick={signOut}>
          {t('common.signOut')}
        </Button>
      </div>
    </header>
  )
}
