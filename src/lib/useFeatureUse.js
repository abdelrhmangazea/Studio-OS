import { useEffect } from 'react'
import { recordFeatureUse } from './feedback'

/**
 * Counts that a feature was opened. Once per mount.
 *
 * The question it answers is "did anybody ever open the quotations
 * card" — which is what decides whether a feature survives the beta,
 * or gets cut before it has to be maintained forever.
 *
 * It counts the feature, never the content. No client, no project, no
 * amount ever reaches this.
 */
export function useFeatureUse(feature) {
  useEffect(() => {
    if (!feature) return
    recordFeatureUse(feature)
  }, [feature])
}
