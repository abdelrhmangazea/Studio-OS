import { useEffect, useState } from 'react'
import { deleteFile, fileUrl, listFiles, setFilePublished, uploadFile } from '../../lib/portal'
import { formatDate } from '../../lib/format'
import { useI18n } from '../../i18n'
import { Button } from '../ui'
import { errorMessage } from '../../lib/errorMessage'

/**
 * Block 5 of 5 — the files this stage produced.
 *
 * Publishing is deliberate and per file. An upload lands unpublished,
 * so nothing reaches the client by accident; the toggle is the only
 * thing that puts a file in the portal.
 *
 * Like the other four, this block is ALWAYS rendered so every stage
 * reads identically.
 */
export default function FilesBlock({ project, stageKey, onChanged }) {
  const { t, language } = useI18n()
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [links, setLinks] = useState({})

  async function load() {
    try {
      const rows = await listFiles(project.id)
      setFiles(rows.filter((row) => row.stage_key === stageKey))
    } catch (caught) {
      setError(errorMessage(caught, t))
    }
  }

  useEffect(() => {
    load()
  }, [project.id, stageKey])

  useEffect(() => {
    // Private bucket, so the designer's own preview needs signing too.
    ;(async () => {
      const next = {}
      for (const file of files) next[file.id] = await fileUrl(file.file_url)
      setLinks(next)
    })()
  }, [files])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError('')
    try {
      await uploadFile({ projectId: project.id, stageKey, file })
      await load()
      onChanged?.()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy(false)
    event.target.value = ''
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-card border border-separator px-3 py-1.5 text-sm text-text hover:bg-bg">
          {busy ? t('files.uploading') : t('files.upload')}
          <input type="file" className="hidden" onChange={handleUpload} disabled={busy} />
        </label>
        <span className="text-xs text-text-secondary">{t('files.uploadHint')}</span>
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {files.length === 0 ? (
        <div className="rounded-card border border-dashed border-separator p-5 text-center">
          <p className="text-sm text-text-secondary">{t('files.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-separator p-3"
            >
              <div className="min-w-0">
                {links[file.id] ? (
                  <a
                    href={links[file.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-accent hover:underline"
                  >
                    {file.filename}
                  </a>
                ) : (
                  <span className="block truncate text-sm text-text">{file.filename}</span>
                )}
                <span className="text-xs text-text-secondary">
                  {formatDate(file.uploaded_at, language)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={file.is_published_to_portal}
                    onChange={async () => {
                      await setFilePublished(file.id, !file.is_published_to_portal)
                      load()
                    }}
                  />
                  {t('files.publish')}
                </label>

                <Button
                  variant="ghost"
                  className="px-2 py-1"
                  onClick={async () => {
                    await deleteFile(file)
                    load()
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
