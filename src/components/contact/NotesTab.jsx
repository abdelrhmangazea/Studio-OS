import { useEffect, useState } from 'react'
import { addNote, deleteNote, listNotes } from '../../lib/contacts'
import { formatDateTime } from '../../lib/format'
import { useI18n } from '../../i18n'
import { Button, EmptyState, ErrorText, Textarea } from '../ui'

/**
 * The communication log: timestamped notes, newest first.
 *
 * Adding one bumps the contact's last_contact_at. That happens in a
 * database trigger, not here, so it holds however the note was created.
 */
export default function NotesTab({ contact, onContactTouched }) {
  const { t, language } = useI18n()

  const [notes, setNotes] = useState([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    listNotes(contact.id).then((data) => {
      setNotes(data)
      setLoading(false)
    })
  }, [contact.id])

  async function handleAdd() {
    const text = body.trim()
    if (!text) return

    setBusy(true)
    setFailed('')
    try {
      const created = await addNote(contact.id, text)
      setNotes((current) => [created, ...current])
      setBody('')
      onContactTouched(created.created_at)
    } catch (error) {
      setFailed(error.message)
    }
    setBusy(false)
  }

  async function handleDelete(id) {
    if (!window.confirm(t('contact.deleteNoteConfirm'))) return
    await deleteNote(id)
    setNotes((current) => current.filter((note) => note.id !== id))
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Textarea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t('contact.notePlaceholder')}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={handleAdd} disabled={busy || !body.trim()}>
            {busy ? t('common.saving') : t('contact.addNote')}
          </Button>
          <ErrorText>{failed}</ErrorText>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">{t('common.loading')}</p>
      ) : notes.length === 0 ? (
        <EmptyState>{t('contact.noNotes')}</EmptyState>
      ) : (
        <ol className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-card border border-separator bg-surface p-4">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <time className="text-xs text-text-secondary">
                  {formatDateTime(note.created_at, language)}
                </time>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-xs text-text-secondary hover:text-danger"
                >
                  {t('common.delete')}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-text">{note.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
