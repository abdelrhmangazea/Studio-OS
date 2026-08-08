import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { copy } from '../marketing/copy'
import { listPlans, yearlyPrice } from '../lib/subscription'

/**
 * The public site at the root of the domain.
 *
 * FULL INTERIOR ZONE IDENTITY — dark, #0077B6, flat, no shadows, no
 * gradients, large numbers, generous spacing. This is deliberately
 * NOT white-label: white-label applies to the booking page and the
 * client portal inside the app, which carry the STUDIO's brand. This
 * page carries ours.
 *
 * Mobile first, because most of this audience arrives from an
 * Instagram link on a phone. Every layout starts single column and
 * earns its second column at sm/md.
 *
 * No image library, no animation library, no icon package. The
 * diagrams are CSS boxes and inline SVG, so the page is a few
 * kilobytes and loads on a slow connection.
 *
 * Its own language switch, independent of the app's — a visitor has
 * no profile and no preference stored anywhere yet.
 */
export default function Marketing() {
  const [lang, setLang] = useState(() => localStorage.getItem('studio-os.language') || 'ar')
  const [plans, setPlans] = useState([])
  const t = copy[lang]
  const rtl = lang === 'ar'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    document.documentElement.dataset.theme = 'dark'
    localStorage.setItem('studio-os.language', lang)

    // Meta per language, not one set for both. A page that says it is
    // English while showing Arabic is a page search engines and link
    // previews both get wrong.
    document.title = rtl
      ? 'استوديو أو إس — نظام إدارة استوديو التصميم الداخلي'
      : 'Studio OS — run your interior design studio'

    const meta = (attr, key, value) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }

    meta('name', 'description', t.hero.title)
    meta('property', 'og:title', document.title)
    meta('property', 'og:description', t.hero.sub)
    meta('property', 'og:type', 'website')
    meta('property', 'og:url', 'https://interiorstudioos.com')
    meta('property', 'og:image', 'https://interiorstudioos.com/og.png')
    meta('property', 'og:locale', rtl ? 'ar_EG' : 'en_US')
    meta('name', 'twitter:card', 'summary_large_image')
  }, [lang, rtl, t])

  useEffect(() => {
    listPlans().then(setPlans).catch(() => setPlans([]))
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text" dir={rtl ? 'rtl' : 'ltr'} lang={lang}>
      {/* ---------------- nav ---------------- */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <span className="text-sm font-semibold tracking-wide">{t.footer.rights}</span>

          <nav className="hidden items-center gap-6 text-sm text-text-secondary md:flex">
            <a href="#how" className="hover:text-text">{t.nav.how}</a>
            <a href="#features" className="hover:text-text">{t.nav.features}</a>
            <a href="#pricing" className="hover:text-text">{t.nav.pricing}</a>
            <a href="#faq" className="hover:text-text">{t.nav.faq}</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(rtl ? 'en' : 'ar')}
              className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text"
            >
              {rtl ? 'English' : 'العربية'}
            </button>
            <Link to="/login" className="text-sm text-text-secondary hover:text-text">
              {t.nav.signIn}
            </Link>
            <Link
              to="/signup"
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              {t.nav.start}
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- 1 · hero ---------------- */}
      <section className="mx-auto max-w-4xl px-5 py-20 sm:py-28">
        <h1 className="text-3xl font-semibold leading-snug sm:text-5xl sm:leading-tight">
          {t.hero.title}
        </h1>
        <p className="mt-6 max-w-2xl text-base text-text-secondary sm:text-lg">{t.hero.sub}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/signup" className="rounded bg-accent px-5 py-3 text-sm font-medium text-white">
            {t.hero.primary}
          </Link>
          <a
            href="#how"
            className="rounded border border-border px-5 py-3 text-sm text-text hover:bg-surface"
          >
            {t.hero.secondary}
          </a>
        </div>
        <p className="mt-4 text-xs text-text-secondary">{t.hero.note}</p>
      </section>

      {/* ---------------- 2 · the problem ---------------- */}
      <Section id="problem" title={t.problem.title} lead={t.problem.lead}>
        <div className="mb-10 flex flex-wrap gap-2">
          {t.problem.tools.map((tool) => (
            <span
              key={tool}
              className="rounded border border-border px-3 py-1.5 text-sm text-text-secondary"
            >
              {tool}
            </span>
          ))}
        </div>

        <h3 className="mb-4 text-sm uppercase tracking-wider text-text-secondary">
          {t.problem.consequencesTitle}
        </h3>
        <div className="grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2">
          {t.problem.consequences.map((c) => (
            <div key={c.t} className="bg-bg p-5">
              <p className="font-medium">{c.t}</p>
              <p className="mt-1 text-sm text-text-secondary">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- 3 · how it works ---------------- */}
      <Section id="how" title={t.how.title} lead={t.how.lead}>
        <div className="grid gap-4 md:grid-cols-3">
          {t.how.phases.map((phase, i) => (
            <div key={phase.name} className="rounded border border-border p-5">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold text-accent" dir="ltr">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="font-medium">{phase.name}</p>
              </div>
              <ol className="mt-4 space-y-2">
                {phase.stages.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded border border-border p-5">
          <h3 className="text-sm font-medium">{t.how.blocksTitle}</h3>
          <div className="mt-4 grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-5">
            {t.how.blocks.map((b) => (
              <div key={b.t} className="bg-bg p-4">
                <p className="text-sm font-medium">{b.t}</p>
                <p className="mt-1 text-xs text-text-secondary">{b.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-text-secondary">{t.how.blocksNote}</p>
        </div>
      </Section>

      {/* ---------------- 4 · the four pillars ---------------- */}
      <Section id="pillars" title={t.pillars.title}>
        <div className="grid gap-4 md:grid-cols-2">
          {t.pillars.items.map((item, i) => (
            <div key={item.t} className="rounded border border-border p-6">
              <span className="text-4xl font-semibold text-accent" dir="ltr">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-3 text-lg font-medium">{item.t}</p>
              <p className="mt-2 text-sm text-text-secondary">{item.d}</p>
              <p className="mt-3 border-s-2 border-accent ps-3 text-sm">{item.k}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- 5 · features ---------------- */}
      <Section id="features" title={t.features.title}>
        <div className="grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {t.features.groups.map((g) => (
            <div key={g.t} className="bg-bg p-5">
              <p className="text-sm font-medium">{g.t}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{g.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- 6 · Arabic first ---------------- */}
      <Section id="arabic" title={t.arabic.title}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {t.arabic.points.map((p) => (
            <li key={p} className="flex gap-3 text-sm text-text-secondary">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-text-secondary">{t.arabic.note}</p>
      </Section>

      {/* ---------------- 7 · pricing ---------------- */}
      <Section id="pricing" title={t.pricing.title} lead={t.pricing.lead}>
        <div className="mb-6 rounded border border-accent/50 bg-accent/10 p-5">
          <p className="text-sm font-medium">{t.pricing.betaTitle}</p>
          <p className="mt-1 text-sm text-text-secondary">{t.pricing.betaBody}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.key} className="rounded border border-border p-6">
              <p className="text-sm font-medium">{rtl ? p.name_ar : p.name_en}</p>

              {/* No price is hardcoded anywhere. Until a plan is
                  reconciled with the processor it says so rather than
                  showing a number nobody has confirmed. */}
              <p className="mt-2 text-3xl font-semibold" dir="ltr">
                {Number(p.price_monthly) === 0
                  ? t.pricing.free
                  : p.is_live
                    ? `${p.currency} ${p.price_monthly}`
                    : t.pricing.soon}
                {Number(p.price_monthly) > 0 && p.is_live && (
                  <span className="text-sm text-text-secondary">{t.pricing.month}</span>
                )}
              </p>
              {Number(p.price_monthly) > 0 && p.is_live && (
                <p className="mt-1 text-xs text-text-secondary" dir="ltr">
                  {p.currency} {yearlyPrice(p)}/year
                </p>
              )}

              <ul className="mt-4 space-y-1.5 text-xs text-text-secondary">
                <li>{p.max_team_seats ?? '∞'} {rtl ? 'مقعد' : 'seats'}</li>
                <li>{p.max_contacts ?? '∞'} {rtl ? 'جهة اتصال' : 'contacts'}</li>
                <li>{p.max_active_projects ?? '∞'} {rtl ? 'مشروع نشط' : 'active projects'}</li>
                <li>{p.client_portal_enabled ? '✓' : '—'} {rtl ? 'بوابة العميل' : 'Client portal'}</li>
                <li>{p.document_generator_enabled ? '✓' : '—'} {rtl ? 'مولّد المستندات' : 'Documents'}</li>
                <li>{p.fee_calculator_enabled ? '✓' : '—'} {rtl ? 'حاسبة الأتعاب' : 'Fee calculator'}</li>
                <li>{p.reports_enabled ? '✓' : '—'} {rtl ? 'التقارير' : 'Reports'}</li>
              </ul>

              <Link
                to="/signup"
                className="mt-5 block rounded border border-border px-4 py-2 text-center text-sm hover:bg-surface"
              >
                {t.pricing.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-text-secondary">{t.pricing.codeLabel}</p>

        {/* Marked as a placeholder in the markup, not dressed up as a
            quote. Nothing invented. */}
        <div className="mt-8 rounded border border-dashed border-border p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-text-secondary">
            {t.testimonialPlaceholder}
          </p>
        </div>
      </Section>

      {/* ---------------- 8 · FAQ ---------------- */}
      <Section id="faq" title={t.faq.title}>
        <div className="space-y-3">
          {t.faq.items.map((item) => (
            <details key={item.q} className="rounded border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">{item.q}</summary>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ---------------- 9 · final CTA ---------------- */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.finalCta.title}</h2>
          <p className="mt-3 text-sm text-text-secondary">{t.finalCta.body}</p>
          <Link
            to="/signup"
            className="mt-6 inline-block rounded bg-accent px-6 py-3 text-sm font-medium text-white"
          >
            {t.finalCta.cta}
          </Link>
          <p className="mt-3 text-xs text-text-secondary">{t.pricing.codeLabel}</p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-text-secondary">
          <span>{t.footer.built}</span>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-text">{t.footer.terms}</Link>
            <Link to="/privacy" className="hover:text-text">{t.footer.privacy}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Section({ id, title, lead, children }) {
  return (
    <section id={id} className="border-t border-border">
      <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
        {lead && <p className="mb-8 mt-3 max-w-2xl text-sm text-text-secondary sm:text-base">{lead}</p>}
        {!lead && <div className="mb-8" />}
        {children}
      </div>
    </section>
  )
}
