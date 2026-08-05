import registry from './seed/merge-fields.json'

/**
 * The merge-field registry.
 *
 * merge-fields.json is the single source of truth — this module only
 * indexes it. Two kinds of field, and the distinction matters:
 *
 *   source: "auto"   resolved from the database
 *   source: "prompt" has NO database source. The generator asks the
 *                    designer for it before generating, using the
 *                    field's own `ask_user` text as the label. These
 *                    are never auto-filled and never left blank.
 */

export const MERGE_FIELDS = registry

export const FIELD_BY_NAME = Object.fromEntries(registry.map((f) => [f.field, f]))

export const AUTO_FIELDS = registry.filter((f) => f.source === 'auto').map((f) => f.field)

export const PROMPT_FIELDS = registry.filter((f) => f.source === 'prompt')

export const PROMPT_FIELD_NAMES = new Set(PROMPT_FIELDS.map((f) => f.field))

export function isKnownField(name) {
  return Object.hasOwn(FIELD_BY_NAME, name)
}

export function isPromptField(name) {
  return PROMPT_FIELD_NAMES.has(name)
}

/**
 * Fields whose data lives in tables that do not exist yet. They resolve
 * to nothing until those buckets are built, and show as [[field]] with a
 * warning — the specified behaviour, not a bug. The Templates screen
 * uses this list to say so plainly rather than letting it look broken.
 *
 * The five project fields came off this list in Bucket 4. They resolve
 * whenever a document is generated from inside a project; generated from
 * the Templates screen with no project, they are simply empty.
 */
export const NOT_YET_AVAILABLE = new Set([
  // Empty as of Bucket 6. portal_link was the last one waiting on a
  // later bucket; it now resolves whenever the project has a live
  // portal link, and is simply blank when it does not.
])
