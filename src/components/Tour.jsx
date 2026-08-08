import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Button, Modal } from './ui'

/**
 * The first-run tour. Five steps, skippable at every one, replayable
 * from Help.
 *
 * It teaches the SHAPE of the product rather than the location of
 * buttons, because the shape is the part that is not obvious: a lead
 * becomes a client by booking, a project moves through ten stages with
 * gates that will not open early, and the studio never sends anything
 * itself — it writes the message and you send it.
 *
 * Deliberately not tied to highlighted elements on screen. Those break
 * the moment a layout changes, and they force the reader through the
 * app in one fixed order. Five short cards do the same job and survive.
 */
const STEPS = ['pipeline', 'booking', 'stages', 'documents', 'portal']

export default function Tour() {
  const { t } = useI18n()
  const { profile, refresh } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const hidden = !profile || profile.tour_done

  // Back to the beginning whenever it is re-opened.
  //
  // This component returns null when the tour is done, but it never
  // unmounts — so `step` survived. Replaying from Help brought it back
  // on step 5 of 5, which is the one screen that is not an
  // introduction to anything.
  //
  // The hook has to sit above the early return; React does not allow
  // one to be skipped.
  useEffect(() => {
    if (!hidden) setStep(0)
  }, [hidden])

  // Not while the profile is still loading, and not once it is done.
  if (hidden) return null

  async function finish(goTo) {
    await supabase.from('profiles').update({ tour_done: true }).eq('id', profile.id)
    await refresh()
    if (goTo) navigate(goTo)
  }

  const key = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <Modal
      open
      title={t(`tour.${key}Title`)}
      onClose={() => finish()}
      footer={
        <>
          <Button onClick={() => (last ? finish('/leads') : setStep(step + 1))}>
            {last ? t('tour.start') : t('common.next')}
          </Button>
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              {t('common.back')}
            </Button>
          )}
          {/* Skippable at every step, not only the first. */}
          <Button variant="ghost" onClick={() => finish()}>
            {t('tour.skip')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text">{t(`tour.${key}Body`)}</p>
      <p className="mt-4 text-xs text-text-secondary">
        {t('tour.step', { current: step + 1, total: STEPS.length })}
      </p>
    </Modal>
  )
}

/** Lets Help put the tour back on screen. */
export async function replayTour(profileId) {
  await supabase.from('profiles').update({ tour_done: false }).eq('id', profileId)
}
