/**
 * Method 3 — hours by role.
 *
 * Reads the five role rates already entered for the contract, so a
 * studio that filled in the Legal tab has nothing more to set up, and
 * the rate quoted in a fee can never differ from the rate written into
 * the contract.
 */
const ROLES = [
  'lead_designer',
  'senior_assistant',
  'design_manager',
  'office_designer',
  'office_admin',
]

export default {
  key: 'hourly',
  roles: ROLES,

  inputs: () => ROLES.map((role) => ({ name: `hours_${role}`, type: 'number' })),

  calculate(values, config, settings) {
    const rates = settings?.hourly_rates ?? {}

    const steps = ROLES.map((role) => {
      const hours = Number(values[`hours_${role}`]) || 0
      const rate = Number(rates[role]) || 0
      return {
        label: `legal.rate_${role}`,
        detail: `${hours} × ${rate}`,
        amount: hours * rate,
      }
    }).filter((s) => s.amount > 0)

    return { steps, base: steps.reduce((sum, s) => sum + s.amount, 0) }
  },
}
