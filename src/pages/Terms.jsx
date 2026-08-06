import LegalPage from '../components/LegalPage'
import { useI18n } from '../i18n'

/**
 * Terms of Service — PLACEHOLDER.
 *
 * Deliberately not written. Terms are a legal instrument and this
 * product is used across Egypt and the Gulf; text invented here would
 * read as real and bind nobody usefully. A lawyer writes this.
 */
export default function Terms() {
  const { t } = useI18n()
  return <LegalPage titleKey="legal.terms" bodyKey="legal.termsPlaceholder" />
}
