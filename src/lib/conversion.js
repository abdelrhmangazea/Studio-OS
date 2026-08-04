/**
 * Lead → client conversion.
 *
 * The rule: a contact is a client exactly when their status is a won
 * one. Booking the consultation IS the conversion — there is no separate
 * "convert" step, which matches F1 in the spec: "Booking is the
 * conversion trigger."
 *
 * Everything keys off the `is_won` flag, never off the label "Booked".
 * The studio can rename that status, translate it, or add a second won
 * status from Settings → Lists, and this keeps working.
 */

export function isWonStatus(statuses, statusId) {
  if (!statusId) return false
  return statuses.find((status) => status.id === statusId)?.is_won === true
}

/**
 * The extra columns to write alongside a status change.
 *
 * - moving onto a won status converts the lead to a client
 * - moving off a won status returns the client to the leads views
 * - anything else writes nothing extra
 */
export function conversionPatch(contact, nextStatusId, statuses) {
  const willBeWon = isWonStatus(statuses, nextStatusId)

  if (willBeWon && !contact.is_client) {
    return { is_client: true, converted_at: new Date().toISOString() }
  }

  if (!willBeWon && contact.is_client) {
    return { is_client: false, converted_at: null }
  }

  return {}
}

/** True when this status change would send a client back to the leads views. */
export function isReverting(contact, nextStatusId, statuses) {
  return contact.is_client && !isWonStatus(statuses, nextStatusId)
}
