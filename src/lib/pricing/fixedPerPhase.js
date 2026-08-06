/**
 * Method 4 — a fixed fee per phase, entered directly.
 *
 * No arithmetic beyond the sum. It exists because a great many
 * designers already price this way, and forcing them through a
 * calculator to reach a number they already know would be worse than
 * useless.
 *
 * Because the phases are entered directly, the phase split in Settings
 * is ignored when pushing to the proposal — these ARE the phases.
 */
export default {
  key: 'fixed_per_phase',
  entersPhasesDirectly: true,

  inputs: () => [1, 2, 3, 4, 5].map((n) => ({ name: `phase_${n}`, type: 'number' })),

  calculate(values) {
    const steps = [1, 2, 3, 4, 5]
      .map((n) => ({
        label: `pricing.phase_${n}`,
        detail: null,
        amount: Number(values[`phase_${n}`]) || 0,
      }))
      .filter((s) => s.amount > 0)

    return { steps, base: steps.reduce((sum, s) => sum + s.amount, 0) }
  },
}
