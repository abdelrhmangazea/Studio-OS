import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  attachSupplier,
  detachSupplier,
  listProjectSuppliers,
  listSuppliers,
} from '../../lib/suppliers'
import { formatPhone } from '../../lib/phone'
import { useI18n } from '../../i18n'
import { Button, Card, ErrorText, Field, Input, Select } from '../ui'
import { errorMessage } from '../../lib/errorMessage'

/**
 * Who worked on this project.
 *
 * Not a stage block — a supplier is engaged for the job, not for a
 * step of it, so this sits with the project rather than repeating
 * inside all ten stages.
 */
export default function SuppliersCard({ project }) {
  const { t } = useI18n()
  const [rows, setRows] = useState([])
  const [all, setAll] = useState([])
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const [attached, everyone] = await Promise.all([
        listProjectSuppliers(project.id),
        listSuppliers(),
      ])
      setRows(attached)
      setAll(everyone.filter((s) => s.active))
    } catch (caught) {
      setError(errorMessage(caught, t))
    }
  }

  useEffect(() => {
    load()
  }, [project.id])

  const unattached = all.filter((s) => !rows.some((r) => r.supplier_id === s.id))

  async function add() {
    setError('')
    try {
      await attachSupplier(project.id, pick, role)
      setPick('')
      setRole('')
      setAdding(false)
      load()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
        {t('nav.suppliers')}
      </h3>
      <p className="mb-3 text-xs text-text-secondary">{t('suppliers.onProjectHelp')}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('suppliers.noneOnProject')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-text">{row.supplier?.name}</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-text-secondary">
                  {row.role && <span>{row.role}</span>}
                  {row.supplier?.specialty && <span>{row.supplier.specialty}</span>}
                  {row.supplier?.phone_number && (
                    <span dir="ltr">
                      {formatPhone(row.supplier.phone_country_code, row.supplier.phone_number)}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                className="px-2 py-1"
                onClick={async () => {
                  await detachSupplier(row.id)
                  load()
                }}
              >
                {t('suppliers.remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <Field label={t('suppliers.pick')}>
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">—</option>
              {unattached.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.specialty ? ` · ${s.specialty}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('suppliers.role')} hint={t('suppliers.roleHint')}>
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button disabled={!pick} onClick={add}>
              {t('common.add')}
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      ) : (
        <div className="mt-3">
          {all.length === 0 ? (
            <Link to="/suppliers" className="text-sm text-accent hover:underline">
              {t('suppliers.addFirst')}
            </Link>
          ) : (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              {t('suppliers.attach')}
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
