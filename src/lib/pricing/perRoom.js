/**
 * Method 5 — a rate per room, by room type.
 *
 * Room types and their rates come from Settings, so a studio that
 * works mostly on flats can price bedrooms and bathrooms and ignore
 * the rest.
 */
export default {
  key: 'per_room',

  inputs: (config) =>
    Object.keys(config?.per_room?.types ?? {}).map((type) => ({
      name: `count_${type}`,
      type: 'number',
      roomType: type,
    })),

  calculate(values, config) {
    const types = config?.per_room?.types ?? {}

    const steps = Object.entries(types)
      .map(([type, rate]) => {
        const count = Number(values[`count_${type}`]) || 0
        return {
          label: `room.${type}`,
          detail: `${count} × ${Number(rate) || 0}`,
          amount: count * (Number(rate) || 0),
        }
      })
      .filter((s) => s.amount > 0)

    return { steps, base: steps.reduce((sum, s) => sum + s.amount, 0) }
  },
}
