/**
 * Method 6 — internal cost plus a markup.
 *
 * Cost is the same hours-by-role sum the hourly method uses, plus any
 * direct expenses. The markup is what turns cost into a price.
 *
 * It reuses the hourly method's arithmetic rather than copying it, so
 * the two can never disagree about what an hour of a design manager
 * costs. Deleting the hourly method would leave this one importing a
 * missing file — the one coupling between methods, and a deliberate
 * one.
 */
import hourly from './hourly'

export default {
  key: 'cost_plus',

  inputs: (config) => [
    ...hourly.inputs(config),
    { name: 'expenses', type: 'number' },
    { name: 'markup', type: 'number', default: config?.cost_plus?.markup ?? 30 },
  ],

  calculate(values, config, settings) {
    const labour = hourly.calculate(values, config, settings)
    const expenses = Number(values.expenses) || 0
    const markup = Number(values.markup) || 0

    const cost = labour.base + expenses
    const base = cost * (1 + markup / 100)

    return {
      steps: [
        ...labour.steps,
        ...(expenses ? [{ label: 'pricing.expenses', detail: null, amount: expenses }] : []),
        { label: 'pricing.internalCost', detail: null, amount: cost },
        { label: 'pricing.markup', detail: `+${markup}%`, amount: base - cost },
      ],
      base,
    }
  },
}
