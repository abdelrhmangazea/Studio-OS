import perSquareMetre from './perSquareMetre'
import percentageOfBudget from './percentageOfBudget'
import hourly from './hourly'
import fixedPerPhase from './fixedPerPhase'
import perRoom from './perRoom'
import costPlus from './costPlus'

/**
 * The pricing methods on offer.
 *
 * This list is the ONLY place that knows all six exist. Beta will show
 * which ones designers actually reach for; removing the rest afterwards
 * means deleting a file and a line here. Nothing else — not the
 * screen, not the schema, not the other methods.
 */
export const METHODS = [
  perSquareMetre,
  percentageOfBudget,
  hourly,
  fixedPerPhase,
  perRoom,
  costPlus,
]

export const METHOD_BY_KEY = Object.fromEntries(METHODS.map((m) => [m.key, m]))
