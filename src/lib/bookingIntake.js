import { supabase } from './supabase'
import { listTemplates, pairByKey, saveGeneratedDocument } from './templates'
import { listChecklistItems } from './projects'
import { renderTemplate, resolveAutoFields } from './mergeEngine'
import { textToHtml, highlightUnresolved } from './documentHtml'
import { buildPrepSheet } from './prepSheet'

/**
 * Steps 6 and 7 of the booking intake: the confirmation script and the
 * prep sheet, filed without anyone clicking Generate.
 *
 * WHY THIS RUNS HERE AND NOT INSIDE THE BOOKING TRANSACTION
 *
 * The spec asks for both at submit time, inside the all-or-nothing
 * transaction. The merge engine is JavaScript; doing it in SQL would
 * mean a second merge engine in plpgsql, and two engines drift. So the
 * transaction still guarantees the things that must not be half-done —
 * booking, contact, project, requirements, log — and these two are
 * built from that committed data the first time the booking is opened.
 *
 * The designer never presses Generate; the difference is only *when*.
 *
 * Both writes are idempotent: if a document with the same key already
 * exists for this project, nothing is written again.
 */
export async function generateBookingDocuments({ booking, settings, profile, language }) {
  if (!booking?.contact_id || !booking?.project_id) return { created: [] }

  const created = []

  if (await alreadyFiled(booking.project_id, 'consultation_confirmation')) {
    // nothing to do
  } else {
    const saved = await fileConfirmation({ booking, settings, profile, language })
    if (saved) created.push('consultation_confirmation')
  }

  if (!(await alreadyFiled(booking.project_id, 'consultation_prep_sheet'))) {
    await filePrepSheet({ booking, language })
    created.push('consultation_prep_sheet')
  }

  return { created }
}

/** Has this project already had this document generated once? */
async function alreadyFiled(projectId, templateKey) {
  const { count } = await supabase
    .from('generated_documents')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('template_key', templateKey)

  return (count ?? 0) > 0
}

async function fileConfirmation({ booking, settings, profile, language }) {
  const pair = pairByKey(await listTemplates()).find((p) => p.key === 'consultation_confirmation')
  const row = pair?.[language] ?? pair?.ar ?? pair?.en
  if (!row) return null

  const values = await resolveAutoFields({
    contact: booking.contact,
    settings,
    profile,
    project: booking.project,
    booking,
    language,
  })

  // Highlight once, here, so this reads exactly like a hand-generated one.
  const finalBody = highlightUnresolved(
    textToHtml(renderTemplate(row.body, values), language)
  )

  return saveGeneratedDocument({
    contact_id: booking.contact_id,
    project_id: booking.project_id,
    template_key: 'consultation_confirmation',
    type: row.type,
    language,
    title: row.title,
    final_body: finalBody,
    field_values: values,
  })
}

async function filePrepSheet({ booking, language }) {
  const items = (await listChecklistItems(booking.project_id)).filter(
    (row) => row.stage_key === '01_consultation'
  )

  const { title, bodyHtml } = buildPrepSheet({ booking, items, language })

  return saveGeneratedDocument({
    contact_id: booking.contact_id,
    project_id: booking.project_id,
    template_key: 'consultation_prep_sheet',
    type: 'document',
    language,
    title,
    final_body: bodyHtml,
    field_values: {},
  })
}
