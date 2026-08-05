import { useEffect } from 'react'

/**
 * Sets the browser tab title.
 *
 * Used only by the client-facing pages. They are white-label: the tab
 * is part of what the client sees, so leaving it as "Studio OS" named
 * the platform on a page that is meant to carry the studio's brand
 * alone. Inside the app the product name is correct and this is not
 * used.
 */
export function usePageTitle(title) {
  useEffect(() => {
    if (!title) return

    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
