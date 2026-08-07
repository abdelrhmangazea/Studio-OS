/**
 * The origin that emailed links should come back to.
 *
 * Not window.location.origin, which is wherever the person happened to
 * be standing. Request a password reset from a Vercel preview URL and
 * the link in your inbox points at that preview forever; do it from a
 * dev server and it points at localhost.
 *
 * VITE_SITE_URL pins it. Set it in the Vercel environment to
 * https://interiorstudioos.com and every link is a production link no
 * matter which build sent it. Unset — a local dev machine — it falls
 * back to the current origin, which is what you want there.
 *
 * NOTE: this only controls what we ASK for. Supabase validates
 * redirect_to against Authentication -> URL Configuration -> Redirect
 * URLs, and if it does not match it does not complain: it silently
 * uses the project's Site URL instead. Whose default is
 * http://localhost:3000. That is a dashboard setting and no amount of
 * code here can override it — see DEPLOY.md.
 */
export function siteUrl() {
  const configured = import.meta.env.VITE_SITE_URL
  if (configured) return String(configured).replace(/\/+$/, '')
  return window.location.origin
}

export const authRedirect = (path) => `${siteUrl()}${path}`
