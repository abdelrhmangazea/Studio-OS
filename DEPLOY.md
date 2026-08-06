# Deploying Studio OS

The app is a static Vite build. Everything it needs at runtime is the
Supabase URL and publishable key, supplied as build-time environment
variables — never committed.

## Vercel, from this repo

1. **vercel.com → Add New → Project → Import** `abdelrhmangazea/Studio-OS`
2. Framework preset: **Vite** (auto-detected). Leave build command and
   output directory as they are — `npm run build` into `dist`.
3. Add two Environment Variables, for **all** environments:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase **publishable** key |

   Use the publishable key, never the service-role key. The publishable
   key is designed to sit in a browser: every table is behind RLS and
   every policy filters on the caller's workspace, so the key alone
   reaches nothing.

4. **Deploy.** Every push to `main` redeploys from then on.

## Already configured in the repo

- `vercel.json` rewrites every path to `index.html`. Without it,
  `/portal/<token>` and `/book/<slug>` would 404 on a refresh or when
  a client opens the link cold — which is exactly how clients arrive.
- `public/fonts/*.woff2` are the Cairo subsets the PDF and Word export
  embeds. They must be served from `/fonts/…`; the export references
  them by absolute path.
- `.env` and `.env.local` are gitignored. `.env.example` is the only
  env file in the repo.

## After the first deploy

Nothing needs changing in Supabase. Email/password auth is
origin-independent, and the booking and portal links are built from
`window.location.origin` at read time, so they point at whatever host
served the page.

One thing to check, unrelated to hosting: **Authentication → Sign In /
Providers → Email → Confirm email** is still ON, so a brand-new signup
waits for a confirmation mail. Existing accounts sign in normally.
