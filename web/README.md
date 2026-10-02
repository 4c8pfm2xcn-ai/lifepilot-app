# DAYZERO

**Everything, organized.** DAYZERO is an AI-powered personal operating system: send it screenshots, copied messages, voice notes, reminders, assignments or stray thoughts, and it turns them into organized tasks, calendar events, goals and a realistic plan for today.

> Capture → Understand → Organize → Act → Improve

---

## Features

| Area | What it does |
| --- | --- |
| **Today** | Greeting + dynamic subtitle, top-3 focus, daily progress ring, upcoming events/focus blocks, data-driven suggestions (overdue, unscheduled deadlines, free time, inbox, goals), **Plan my day** with approval before anything changes. |
| **Smart Inbox** | Text, paste, screenshot upload (drag/drop/paste, validated, 5 MB max), voice notes (live on-device transcription), quick notes. Each capture is analysed into tasks / events / ideas / notes with category, priority, duration and **only explicitly stated** dates. Ambiguities are flagged for confirmation. Every extracted item is editable and can be accepted, converted to task/event, kept as a note, or deleted. |
| **Tasks** | Create / edit / delete (with undo) / complete / reopen; due date + optional time, priority, category, estimate, notes, subtasks, goal link. Views: Today, Upcoming, All, Overdue, Completed. Search (`/`), filters, sorting, natural-language quick add. |
| **Calendar** | FullCalendar month / week / day / agenda (agenda default on mobile). Create/edit/delete events, drag & resize events and task blocks, drag unscheduled tasks onto the grid, deadline markers, conflict detection with a clear explanation before anything double-books, and conflict-free "Find time" suggestions. |
| **Assistant** | Conversational assistant with persisted history. Read-only questions are answered directly; changes are returned as **proposed actions** that are validated server-side and only applied when you confirm each one. |
| **Goals** | Goals with description, category, target date, milestones and linked tasks; progress is calculated from milestones + tasks. AI milestone suggestions require approval. |
| **Insights** | Completed this week vs last, overdue, upcoming workload, 8-week trend, day-by-day, category breakdown, goal progress, and a weekly summary — all computed from real records, with a table view for every chart. |
| **Settings** | Profile, timezone, appearance (dark / light / system), planning preferences, notifications, AI preferences, password change, JSON/CSV export, delete all data, delete account (typed confirmation), sign out. |
| **Onboarding** | 5 short, skippable steps: welcome, focus areas, planning preferences, a live capture demo, and dashboard creation. |
| **Quick capture** | Floating button (mobile) / sidebar button and `C` or `⌘K` anywhere. |

Keyboard shortcuts: `C` capture · `N` new task · `E` new event · `P` plan my day · `G` then `T/I/K/C/G/A/N/S` to navigate · `/` search tasks · `?` help.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · Lucide · Supabase (Auth, Postgres, Storage, RLS) · Anthropic API (`@anthropic-ai/sdk`, structured outputs) · React Hook Form + Zod · FullCalendar · Recharts · Playwright.

## Architecture

```
src/
  app/                 routes (App Router)
    (auth)/            login, signup, forgot-password, reset-password
    (app)/             protected app: today, inbox, tasks, calendar, goals, assistant, insights, settings, onboarding
    api/ai/*           server-only AI routes: extract, plan, assistant, milestones, summary, status
    api/account/delete account deletion (service role, server-only)
    auth/callback      Supabase email-link exchange
  middleware.ts        refreshes Supabase session + protects app routes
  components/
    ui/                design-system primitives (button, dialog, toast, menu, inputs, …)
    app/               shell + shared feature components (capture, editors, plan dialog, …)
    screens/           one component per screen
  lib/
    ai/                Anthropic client, prompts, structured schemas, action validation, on-device fallbacks
    data/              DataStore interface + Supabase and local (demo) implementations
    auth/              Supabase auth + demo auth behind one interface
    planner.ts         scheduling engine (plan, validate, find slots)
    insights.ts        statistics from records
    time.ts            timezone-safe date helpers
  providers/           auth, data (optimistic updates with rollback), UI, theme
supabase/
  migrations/          schema, indexes, FKs, RLS, storage bucket + policies
  tests/               RLS + schema verification against real PostgreSQL
tests/
  unit/                extraction, planner, validation, timezones, stats
  e2e/                 user journeys (desktop + mobile), API checks
```

**AI safety model.** All model calls run server-side (`ANTHROPIC_API_KEY` is never sent to the browser). The model cannot write to the database: it returns structured output (Zod-validated), the server checks every referenced id against the user's own data, attaches conflict warnings and marks destructive actions, and the client executes each action only after the user confirms. In Supabase mode the AI routes load data with the user's own session, so row-level security bounds what the AI can see. AI-proposed schedules pass through the same conflict validator as the on-device planner, and extracted dates that don't appear in the source text are discarded and flagged.

## Getting started

```bash
cd web
cp .env.example .env.local   # optional — the app runs without any credentials
npm install
npm run dev                  # http://localhost:3000
```

### Demo mode (no credentials)

With no environment variables, DAYZERO runs fully in **demo mode**:

- Accounts and data are stored in the browser's `localStorage`, namespaced per account (accounts are password-protected with PBKDF2, but this is not a security boundary — it's for local evaluation).
- "Try the demo" on the landing page opens a clearly-labelled sample workspace.
- AI features fall back to on-device engines, labelled **On-device** in the UI: rule-based extraction (multi-item splitting, relative dates, ambiguity detection), the deterministic planner, and an offline assistant that handles common requests. Screenshot understanding and milestone suggestions need an API key and say so.
- Password recovery and permanent account deletion need Supabase and explain this.

### Integrations requiring credentials

| Integration | Variables | Enables |
| --- | --- | --- |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real accounts, email confirmation, password recovery, Postgres persistence with RLS, private image storage, server-side route protection |
| Supabase service role (optional) | `SUPABASE_SERVICE_ROLE_KEY` (server-only) | Permanent account deletion from Settings |
| **Anthropic** | `ANTHROPIC_API_KEY` (server-only), optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`) | AI extraction (including screenshots), AI daily planning, the full assistant, milestone suggestions, AI weekly summary |
| App URL | `NEXT_PUBLIC_SITE_URL` | Correct redirect links in auth emails |

AI requests use structured outputs and the server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), so a request declined by the primary model is retried on a fallback model automatically.

### Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in `supabase/migrations/` — either `supabase link && supabase db push` with the Supabase CLI, or paste both files (in order) into the SQL editor.
3. In **Authentication → URL configuration**, set the Site URL to your app URL and add `https://<your-domain>/auth/callback` to the redirect URLs.
4. Copy the project URL and anon key into `.env.local`.

The migration creates `profiles`, `tasks`, `events`, `inbox_items`, `goals`, `goal_milestones`, `conversations` and `messages` with foreign keys, check constraints, indexes, `updated_at` triggers, a signup trigger that creates profiles, owner-only RLS policies on every table, composite foreign keys that prevent linking to another user's goal/inbox item/conversation, and a private `captures` storage bucket restricted to `<user_id>/…` paths.

## Testing

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # production build
npm run test:unit      # 15 unit tests (no browser)
npm run test:rls       # schema + RLS assertions on a throwaway PostgreSQL (needs postgres binaries)
npm run test:e2e       # 19 browser tests against the production build (run `npm run build` first)
```

If Playwright's bundled Chromium isn't installed, point it at an existing one with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome`.

The E2E suite runs in demo mode and covers: sign up → onboarding (with a live capture) → create/complete/reopen a task → persistence across reload → natural-language quick add and undo → calendar event creation and conflict warnings → inbox capture, editing extracted fields, accepting → unsupported upload rejection → plan my day and applying it → assistant proposal requiring confirmation → goals and milestone progress → insights from real records → sign out / sign in → a second account sees none of the first account's data → export and typed-confirmation deletion → mobile layout (no horizontal overflow on any screen), bottom navigation and floating capture.

The RLS suite verifies on real PostgreSQL that users can't read, update, delete or forge rows (or storage objects) belonging to another user, can't link records to another user's goal or conversation, anonymous access is denied, and deleting a user cascades.

## Deployment (Vercel)

1. Import the repository in Vercel and set **Root Directory** to `web`.
2. Add the environment variables above (mark `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as server-only — never prefix them with `NEXT_PUBLIC_`).
3. Deploy. AI routes declare `maxDuration = 60`; on the Hobby plan lower it if needed.
4. Update the Supabase auth Site URL / redirect URLs to the production domain.

Rate limiting on AI routes is per-instance and in-memory (30 requests/minute per user or IP). For strict global limits, put a shared limiter (e.g. Upstash Redis) in front. Without Supabase, AI routes cannot authenticate callers, so only expose a demo deployment with an API key if you accept that usage.

## Known limitations

- Reminders are delivered while the app is open (in-app toasts or system notifications if permitted); background push would need a service worker and push server.
- Voice capture uses the browser's Web Speech API (Chrome, Edge, Safari); audio isn't stored or uploaded.
- Images are analysed by the AI only when `ANTHROPIC_API_KEY` is set. PDFs and HEIC aren't accepted.
- The live AI paths (with a real key) and Supabase mode were not exercised by the automated suite in this environment, which had no credentials; the schema and RLS were verified against PostgreSQL directly.
