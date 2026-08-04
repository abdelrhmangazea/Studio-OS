# Studio OS

Multi-tenant SaaS for interior designers: lead → paid consultation → project → delivery → follow-up.

## Stack

- **Frontend:** React + Tailwind, built with Vite. A responsive **website** — there is no mobile app.
- **Backend:** Supabase (Postgres, Auth, Row Level Security, Storage)
- **Hosting:** Vercel

## The one rule

Every table carries `workspace_id`, and every RLS policy filters on the caller's
workspace. No query can cross workspaces. See `supabase/migrations/0001_foundation.sql`
— that file is the definition of tenant isolation, and it is worth reading before
adding any table.

## Setup

1. Install [Node.js](https://nodejs.org) (LTS). This is a build tool that runs on
   your own machine to assemble the website. It is not shipped to users.
2. `npm install`
3. `cp .env.example .env.local` and fill in your Supabase URL and anon key.
   Never put these in code.
4. `npm run dev`

## Build order

Built in seven buckets, one at a time, never ahead:

| # | Bucket | Status |
|---|---|---|
| 1 | Foundation — auth, workspaces, RLS, settings, theme, AR/EN + RTL | in progress |
| 2 | Leads & Clients | not started |
| 3 | Template Engine | not started |
| 4 | Projects & Stages | not started |
| 5 | Booking | not started |
| 6 | Client Portal | not started |
| 7 | Operations | not started |

## Constraints

- **No payment gateway.** Invoice → uploaded receipt → manual confirmation.
- **The system sends nothing.** It generates content to copy or export; the
  designer sends it from their own email or WhatsApp.
- Fully bilingual AR/EN with true RTL mirroring. Dark and light themes.
  Both are user settings, not build-time choices.
