/**
 * Method 1 — per square metre.
 *
 * Simple mode multiplies one rate by the whole area. Detailed mode
 * prices each space type separately, for studios whose kitchens and
 * bathrooms cost more per metre than their bedrooms.
 *
 * Self-contained: delete this file and its line in index.js and no
 * other method changes.
 */
export default {
  key: 'per_sqm',

  /** What the screen draws. `from` pre-fills out of the project. */
  inputs: (config) => [
    {
      name: 'mode',
      type: 'choice',
      options: ['simple', 'by_space'],
      default: 'simple',
    },
    { name: 'area', type: 'number', from: 'area_sqm', showWhen: { mode: 'simple' } },
    { name: 'rate', type: 'number', default: config?.per_sqm?.simple ?? 0, showWhen: { mode: 'simple' } },

    ...['living', 'kitchen', 'bathroom', 'outdoor'].flatMap((space) => [
      { name: `area_${space}`, type: 'number', showWhen: { mode: 'by_space' } },
      {
        name: `rate_${space}`,
        type: 'number',
        default: config?.per_sqm?.by_space?.[space] ?? 0,
        showWhen: { mode: 'by_space' },
      },
    ]),
  ],

  calculate(values) {
    const n = (v) => Number(v) || 0

    if (values.mode === 'by_space') {
      const steps = ['living', 'kitchen', 'bathroom', 'outdoor']
        .map((space) => ({
          label: `space.${space}`,
          detail: `${n(values[`area_${space}`])} × ${n(values[`rate_${space}`])}`,
          amount: n(values[`area_${space}`]) * n(values[`rate_${space}`]),
        }))
        .filter((s) => s.amount > 0)

      return { steps, base: steps.reduce((sum, s) => sum + s.amount, 0) }
    }

    const base = n(values.area) * n(values.rate)
    return {
      steps: [
        { label: 'pricing.areaByRate', detail: `${n(values.area)} م² × ${n(values.rate)}`, amount: base },
      ],
      base,
    }
  },
}
