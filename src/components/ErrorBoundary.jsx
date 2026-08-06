import { Component } from 'react'

/**
 * Stops one broken screen taking the whole app with it.
 *
 * A class component because React only offers componentDidCatch here —
 * there is no hook equivalent.
 *
 * The user sees a sentence and a way out. The stack goes to the
 * console, where it is useful to us and invisible to them.
 */
export default class ErrorBoundary extends Component {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[studio-os] screen crashed', error, info)
  }

  render() {
    if (!this.state.crashed) return this.props.children

    // Deliberately not translated: the i18n provider may be the thing
    // that just died, and a crash screen that itself crashes is worse
    // than one in the wrong language.
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md rounded border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold text-text">
            حصل خطأ في هذه الشاشة · Something broke on this screen
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            باقي التطبيق شغّال. جرّب تحديث الصفحة أو ارجع للرئيسية.
            <br />
            The rest of the app is fine. Reload, or go back to the dashboard.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-accent px-4 py-2 text-sm text-white"
            >
              تحديث · Reload
            </button>
            <button
              onClick={() => {
                this.setState({ crashed: false })
                window.location.href = '/dashboard'
              }}
              className="rounded border border-border px-4 py-2 text-sm text-text"
            >
              الرئيسية · Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}
