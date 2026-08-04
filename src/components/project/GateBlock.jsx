import { useState } from 'react'
import { completeStage, overrideGate, setGateFlag } from '../../lib/projects'
import { useI18n } from '../../i18n'
import { Button, ErrorText, Modal, Textarea, WarningText } from '../ui'

/**
 * Block 4 of 4 — the gate.
 *
 * States plainly what is blocking the next stage, offers the action
 * that satisfies each condition, and allows an override that demands a
 * written reason. The rule itself is enforced in the database; this is
 * only the way in.
 */
export default function GateBlock({ definition, stage, onChanged }) {
  const { t, language } = useI18n()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [overriding, setOverriding] = useState(false)
  const [reason, setReason] = useState('')

  const flags = definition.gate_flags ?? []
  const isActive = stage.status === 'active'
  const outstanding = flags.filter((f) => stage.gate_state?.[f.key] !== true)

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      await onChanged()
    } catch (failure) {
      setError(failure.message)
    }
    setBusy(false)
  }

  if (definition.never_closes) {
    return (
      <div className="rounded border border-border p-4">
        <p className="text-sm text-text">{t('project.neverCloses')}</p>
      </div>
    )
  }

  return (
    <div className="rounded border border-border p-4">
      {/* What is blocking, in plain words */}
      {stage.gate_met ? (
        <p className="text-sm text-success">{t('project.gateMet')}</p>
      ) : (
        <p className="text-sm text-warning">
          {t('project.gateBlocking', { count: outstanding.length })}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {flags.map((flag) => {
          const done = stage.gate_state?.[flag.key] === true
          return (
            <li key={flag.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <span className={done ? 'text-success' : 'text-text-secondary'}>
                  {done ? '✓' : '○'}
                </span>
                <span className={done ? 'text-text-secondary' : 'text-text'}>
                  {language === 'ar' ? flag.label_ar : flag.label_en}
                </span>
              </span>

              <Button
                variant="secondary"
                className="shrink-0 px-2 py-1"
                disabled={busy || !isActive}
                onClick={() => run(() => setGateFlag(stage.id, flag.key, !done))}
              >
                {done ? t('project.undo') : t('project.markDone')}
              </Button>
            </li>
          )
        })}
      </ul>

      {/* An override is permanent and stays visible on the timeline. */}
      {stage.gate_override && (
        <div className="mt-3">
          <WarningText>
            {t('project.overrideNotice', { reason: stage.override_reason })}
          </WarningText>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          disabled={busy || !isActive || !stage.gate_met}
          onClick={() => run(() => completeStage(stage.id))}
        >
          {t('project.completeStage')}
        </Button>

        {definition.skippable && isActive && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await setGateFlag(stage.id, flags[0].key, true)
                await setGateFlag(stage.id, 'skipped', true)
              })
            }
          >
            {t('project.skipStage')}
          </Button>
        )}

        {!stage.gate_override && isActive && !stage.gate_met && (
          <Button variant="ghost" disabled={busy} onClick={() => setOverriding(true)}>
            {t('project.override')}
          </Button>
        )}

        <ErrorText>{error}</ErrorText>
      </div>

      <Modal
        open={overriding}
        title={t('project.overrideTitle')}
        onClose={() => setOverriding(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverriding(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={busy || !reason.trim()}
              onClick={async () => {
                await run(() => overrideGate(stage.id, reason))
                setOverriding(false)
                setReason('')
              }}
            >
              {t('project.overrideConfirm')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-text-secondary">{t('project.overrideHelp')}</p>
        <Textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('project.overridePlaceholder')}
        />
      </Modal>
    </div>
  )
}
