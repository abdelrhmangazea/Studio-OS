import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createSupplier,
  deleteSupplier,
  listSupplierProjects,
  listSuppliers,
  updateSupplier,
} from '../lib/suppliers'
import { COUNTRIES } from '../data/countries'
import { listSupplierCategories } from '../lib/quotations'
import { listLabel } from '../lib/useLists'
import { formatPhone } from '../lib/phone'
import { useI18n } from '../i18n'
import { Badge, Button, Card, EmptyState, ErrorText, Field, Input, Loadable, PageTitle, Select, SidePanel, Textarea } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'
import { errorMessage } from '../lib/errorMessage'

const BLANK = {
  name: '',
  category: '',
  address: '',
  website: '',
  phone_country_code: '+20',
  phone_number: '',
  email: '',
  notes: '',
  rating: '',
  active: true,
}

/**
 * The studio's supplier book.
 *
 * A supplier belongs to the studio, not to one job — so the useful
 * thing on each row is which projects they have actually been used on,
 * which is what the panel shows.
 *
 * Rating is deliberately nullable. An unrated supplier is not a
 * one-star supplier, and the list never sorts them as though it were.
 */
export default function Suppliers() {
  useFeatureUse('suppliers')
  const { t, language } = useI18n()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])
  const [filter, setFilter] = useState('')

  async function load() {
    // Reset both, or a successful retry leaves the old error
    // sitting on screen underneath fresh data.
    setLoading(true)
    setLoadFailure(null)
    try {
      setSuppliers(await listSuppliers())
      setCategories(await listSupplierCategories())
    } catch (caught) {
      setLoadFailure(caught)
    } finally {
      // Always. A failed load must never leave the
      // screen spinning with no way out.
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return suppliers
      .filter((s) => (showInactive ? true : s.active))
      .filter((s) => (filter ? s.category === filter : true))
      .filter((s) =>
        !needle
          ? true
          : [s.name, s.category, s.email, s.phone_number]
              .some((v) => (v ?? '').toLowerCase().includes(needle))
      )
  }, [suppliers, search, showInactive, filter])

  function open(supplier) {
    setError('')
    setEditing(supplier ?? 'new')
    setForm(
      supplier
        ? {
            name: supplier.name ?? '',
            category: supplier.category ?? '',
            address: supplier.address ?? '',
            website: supplier.website ?? '',
            phone_country_code: supplier.phone_country_code ?? '+20',
            phone_number: supplier.phone_number ?? '',
            email: supplier.email ?? '',
            notes: supplier.notes ?? '',
            rating: supplier.rating ?? '',
            active: supplier.active,
          }
        : BLANK
    )
    setJobs([])
    if (supplier) listSupplierProjects(supplier.id).then(setJobs)
  }

  async function save() {
    setError('')
    const payload = {
      ...form,
      rating: form.rating === '' ? null : Number(form.rating),
      category: form.category || null,
      email: form.email || null,
      phone_number: form.phone_number || null,
      notes: form.notes || null,
    }

    try {
      if (editing === 'new') await createSupplier(payload)
      else await updateSupplier(editing.id, payload)
      setEditing(null)
      load()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
  }

  if (loading || loadFailure) {
    return (
      <Loadable loading={loading} failure={loadFailure} onRetry={load} t={t} />
    )
  }

  return (
    <div>
      <PageTitle subtitle={t('suppliers.subtitle', { count: visible.length })}>
        {t('nav.suppliers')}
      </PageTitle>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Button onClick={() => open(null)}>{t('suppliers.add')}</Button>
        <div className="w-64">
          <Input
            placeholder={t('suppliers.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-52">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{t('suppliers.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={listLabel(c, language)}>
                {listLabel(c, language)}
              </option>
            ))}
          </Select>
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('suppliers.showInactive')}
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState>{t('suppliers.empty')}</EmptyState>
      ) : (
        <div className="space-y-2">
          {visible.map((supplier) => (
            <button
              key={supplier.id}
              onClick={() => open(supplier)}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-card border border-separator p-3 text-start hover:bg-surface"
            >
              <div className="min-w-0">
                <p className="text-sm text-text">
                  {supplier.name}
                  {!supplier.active && (
                    <span className="ms-2 text-xs text-text-secondary">
                      · {t('suppliers.inactive')}
                    </span>
                  )}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-text-secondary">
                  {supplier.category && <span>{supplier.category}</span>}
                  {supplier.phone_number && (
                    <span dir="ltr">
                      {formatPhone(supplier.phone_country_code, supplier.phone_number)}
                    </span>
                  )}
                  {supplier.email && <span>{supplier.email}</span>}
                </p>
              </div>

              {supplier.rating ? (
                <Badge>
                  {'★'.repeat(supplier.rating)}
                  <span className="opacity-40">{'★'.repeat(5 - supplier.rating)}</span>
                </Badge>
              ) : (
                <span className="text-xs text-text-secondary">{t('suppliers.unrated')}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <SidePanel
        open={Boolean(editing)}
        title={editing === 'new' ? t('suppliers.add') : form.name}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={save}>{t('common.save')}</Button>
            {editing !== 'new' && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await deleteSupplier(editing.id)
                  setEditing(null)
                  load()
                }}
              >
                {t('common.delete')}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('suppliers.name')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field label={t('suppliers.category')} hint={t('suppliers.categoryHint')}>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={listLabel(c, language)}>
                  {listLabel(c, language)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('suppliers.address')}>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>

          <Field label={t('suppliers.website')}>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} dir="ltr" />
          </Field>

          <Field label={t('fields.phone')}>
            <div className="flex gap-2" dir="ltr">
              <Select
                className="w-28 shrink-0 px-2"
                value={form.phone_country_code}
                onChange={(e) => setForm({ ...form, phone_country_code: e.target.value })}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.dial}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </Select>
              <Input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                className="min-w-0 flex-1"
              />
            </div>
          </Field>

          <Field label={t('fields.email')}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>

          <Field label={t('suppliers.rating')} hint={t('suppliers.ratingHint')}>
            <Select
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: e.target.value })}
            >
              <option value="">{t('suppliers.unrated')}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {'★'.repeat(n)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('suppliers.notes')}>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            {t('suppliers.active')}
          </label>

          <ErrorText>{error}</ErrorText>

          {/* Their actual track record with this studio. */}
          {editing !== 'new' && (
            <div className="border-t border-separator pt-4">
              <h3 className="mb-2 t-section">
                {t('suppliers.usedOn')}
              </h3>
              {jobs.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('suppliers.notUsedYet')}</p>
              ) : (
                <ul className="space-y-1">
                  {jobs.map((job) => (
                    <li key={job.id} className="text-sm">
                      <Link
                        to={`/projects/${job.project.id}`}
                        className="text-accent hover:underline"
                      >
                        <span className="font-mono" dir="ltr">
                          {job.project.code}
                        </span>{' '}
                        {job.project.name}
                      </Link>
                      {job.role && (
                        <span className="text-xs text-text-secondary"> · {job.role}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SidePanel>
    </div>
  )
}
