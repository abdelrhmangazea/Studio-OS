/**
 * Method 2 — a percentage of the construction budget.
 *
 * Supports a sliding scale: the percentage falls as the budget rises,
 * because a project twice the size is not twice the work. Bands are
 * set in Settings; with none set it falls back to one flat percentage.
 *
 * The band is chosen by the FIRST ceiling the budget fits under, so
 * the order of the bands in Settings is the order they are read.
 */
export default {
  key: 'percentage',

  inputs: (config) => [
    { name: 'budget', type: 'number' },
    {
      name: 'percent',
      type: 'number',
      default: config?.percentage?.flat ?? 10,
      // Only asked for when there is no scale to read it from.
      hideWhen: () => (config?.percentage?.bands ?? []).length > 0,
    },
  ],

  calculate(values, config) {
    const budget = Number(values.budget) || 0
    const bands = config?.percentage?.bands ?? []

    if (bands.length === 0) {
      const percent = Number(values.percent) || 0
      const base = budget * (percent / 100)
      return {
        steps: [
          { label: 'pricing.flatPercent', detail: `${budget} × ${percent}%`, amount: base },
        ],
        base,
      }
    }

    // `upTo: null` is the open-ended top band.
    const band =
      bands.find((b) => b.upTo === null || b.upTo === undefined || budget <= Number(b.upTo)) ??
      bands.at(-1)
    const percent = Number(band?.percent) || 0
    const base = budget * (percent / 100)

    return {
      steps: [
        {
          label: 'pricing.bandChosen',
          detail:
            band?.upTo === null || band?.upTo === undefined
              ? `> ${bands.at(-2)?.upTo ?? 0} → ${percent}%`
              : `≤ ${band.upTo} → ${percent}%`,
          amount: null,
        },
        { label: 'pricing.budgetByPercent', detail: `${budget} × ${percent}%`, amount: base },
      ],
      base,
    }
  },
}
