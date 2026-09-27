# VELORA

**Turn ideas into video.**

Velora is an AI video creation platform. Users write a prompt, optionally upload a reference image, choose settings supported by the selected model, and generate a video through an official provider API. Generations are tracked asynchronously and saved to a private library, where they can be favorited, organized into projects, downloaded, regenerated and deleted. A server-side credit ledger meters usage.

There are no mock generations. If a provider isn't configured, the UI shows which environment variable is missing and generation stays disabled.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Auth / DB / Storage | Supabase Auth, PostgreSQL (RLS), Supabase Storage (private buckets) |
| Validation | Zod |
| Video provider | Runway API via the official `@runwayml/sdk` (v4.20.x, API version `2024-11-06`) |
| Prompt enhancement | Claude API via the official `@anthropic-ai/sdk` (pluggable) |
| Tests | Vitest (unit tests, plus database tests against a real PostgreSQL) |
| Hosting | Vercel |

## Project structure

```
app/
  page.tsx                  Landing page
  auth/                     Sign in / sign up / reset / update password, PKCE callback, server actions
  (app)/                    Authenticated shell (sidebar, mobile tab bar)
    dashboard/ create/ library/ favorites/ projects/ projects/[id]/ generations/[id]/ settings/
  api/
    generate/               POST: validate -> charge credits -> submit provider task
    generation/[id]/        GET status (+ provider sync), PATCH project, DELETE
      cancel/ favorite/ regenerate/ download/
    uploads/                POST: signed upload URL for images
    enhance/                POST: LLM prompt enhancement
    projects/ projects/[id]/ profile/
    cron/sync/              Background status sweep (CRON_SECRET)
    webhook/[provider]/     Verified webhooks for providers that support them
components/  ui/ generation/ video/ library/ dashboard/ projects/ settings/ auth/
lib/
  video/        types.ts, catalog.ts (capabilities), provider.ts (interface + errors),
                registry.ts, providers/runway.ts
  generations/  service.ts (create / sync / cancel / regenerate), deps.ts (Supabase repo)
  credits/      pricing.ts (the only place prices live), account.ts
  prompts/      directions.ts (style/camera -> prompt), enhancer.ts, anthropic.ts
  validation/   schemas.ts (Zod)
  storage/      buckets, signed URLs, upload verification, video persistence
  security/     rate-limit.ts (Postgres-backed), image.ts (magic-byte sniffing)
  supabase/     server / admin (service role) / browser / proxy clients
  data/         RLS-scoped read models for pages
supabase/
  migrations/   schema, RLS + functions, storage buckets/policies
  config.toml   local Supabase CLI config
tests/
  unit/         pricing, validation, provider, generation service, API auth, security
  db/           RLS and credit-ledger tests against a real Postgres
```

---

## Local setup

Requirements: Node.js 20.9+ and npm. For a local Supabase stack you also need Docker.

```bash
cd velora
npm install
cp .env.example .env.local
```

### Option A: local Supabase (Docker)

```bash
npx supabase start          # starts Postgres, Auth, Storage, and runs supabase/migrations
npx supabase status -o env  # prints API_URL, ANON_KEY, SERVICE_ROLE_KEY
```

Put the printed values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

Local email confirmation is off (`supabase/config.toml`), so sign-up signs you in straight away.

### Option B: hosted Supabase project

1. Create a project at https://supabase.com/dashboard.
2. Link it and push the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Or paste the three files in `supabase/migrations/` into the SQL editor, in order.
3. Copy the Project URL, the anon key and the service_role key into `.env.local`.
4. Under **Authentication → URL Configuration**, set the Site URL to your app URL and add `<app-url>/auth/callback` to the redirect URLs. Email confirmation and password-reset links go through that route.

### Run

```bash
npm run dev          # http://localhost:3000
```

Checks:

```bash
npm run lint
npm run typecheck
npm test             # unit + database tests
npm run build
```

`npm test` runs the database suite against a throwaway PostgreSQL cluster when PostgreSQL server binaries (`initdb`, `pg_ctl`) are installed. It looks in `PG_BIN` and `/usr/lib/postgresql/*/bin`. You can set `TEST_DATABASE_URL` to point at an empty database instead. If neither is available, the database suite is skipped with a message. Use `npm run test:unit` or `npm run test:db` to run one suite.

---

## Environment variables

| Variable | Required | Where it is used |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Browser + server. Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser + server. Public anon key (RLS applies). |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server only.** Credit functions, storage signing, status sync. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute base for auth email links. |
| `RUNWAYML_API_SECRET` | for generation | **Server only.** Runway API key. This is the name the official SDK reads. |
| `LLM_PROVIDER` | no | Prompt enhancer backend. `anthropic` (default). |
| `LLM_API_KEY` | for enhancement | **Server only.** Claude API key. |
| `LLM_MODEL` | no | Model override. Defaults to `claude-opus-5`. |
| `VELORA_SIGNUP_CREDITS` | no | One-time credits for new accounts. Defaults to `100`. |
| `CRON_SECRET` | recommended | Protects `/api/cron/sync`. Vercel Cron sends it as a Bearer token. |

`NEXT_PUBLIC_SUPABASE_URL` must be set at **build** time as well. It is used to build the Content-Security-Policy (`img-src` / `media-src` / `connect-src`).

---

## Database

Three migrations live in `supabase/migrations/`:

1. **`…0100_core_schema.sql`**: `profiles`, `projects`, `generations`, `favorites`, `credits`, `credit_transactions`, `rate_limits`, plus enums, indexes and constraints.
   - Composite foreign keys `(project_id, user_id)` and `(generation_id, user_id)` stop a row from referencing another user's project or generation, even through the service role.
   - Partial unique indexes allow at most one charge and one refund per generation, and one signup grant per user.
2. **`…0200_functions_and_rls.sql`**: RLS policies, minimal column-level grants, and `security definer` functions that only `service_role` can execute:
   - `create_generation_with_charge`: locks the user's credit row, checks idempotency, checks the balance, then inserts the generation, debits the balance and writes the ledger entry, all in one transaction. Raises `VL402` when credits are insufficient.
   - `refund_generation`: idempotent refund.
   - `grant_signup_credits`: idempotent one-time grant.
   - `claim_generation_sync`: single-flight lease for provider polling.
   - `check_rate_limit`: fixed-window counter.
   - `handle_new_user` trigger: creates a profile and a zero-balance credit account on sign-up.
3. **`…0300_storage.sql`**: private buckets and per-user folder policies.

Column note: `generations.input_image_url`, `output_video_url`, `thumbnail_url` and `projects.cover_url` store **storage object paths**, not public URLs. Signed URLs are minted on demand, server-side, after an RLS-scoped read has confirmed ownership.

### What end users can and cannot do (enforced in Postgres, covered by `tests/db/rls.test.ts`)

- They can read only their own rows in every table. Anonymous users can read nothing.
- They cannot insert generations. Generations are created only through the charging function.
- They cannot change their balance or the ledger.
- They cannot change a generation's status, output or charge. They can only move it between their own projects.
- They cannot favorite another user's generation or attach anything to another user's project.

## Storage

| Bucket | Public | Limit | Types | Path |
| --- | --- | --- | --- | --- |
| `input-images` | no | 5 MB | jpeg / png / webp | `<user_id>/<uuid>.<ext>` |
| `generated-videos` | no | 50 MB | mp4 | `<user_id>/<generation_id>.mp4` |
| `thumbnails` | no | 5 MB | jpeg / png / webp | `<user_id>/covers/<uuid>.<ext>` (project covers) |

Upload flow:

1. The client asks `/api/uploads` for a one-time signed upload URL. The server validates the declared type and size.
2. The browser uploads directly to Storage, which avoids serverless body-size limits. The bucket enforces the MIME type and size again.
3. Before an image is used, the server downloads it, checks the path belongs to the user, checks the size and **sniffs the magic bytes**. Files that fail are deleted.

The migration creates the buckets, so nothing needs to be set up by hand. If your hosted plan's global upload limit is lower than 50 MB, raise it under **Storage → Settings**.

---

## Provider: Runway

**API documentation used:** Runway's official API spec, as shipped in the official Node SDK **`@runwayml/sdk` v4.20.1** (published 2026-09-23, generated from Runway's OpenAPI spec). Reference: https://docs.dev.runwayml.com/api/. That docs host could not be reached from the build environment, so every endpoint, model, field and enum used here was taken from the SDK's generated types in `node_modules/@runwayml/sdk/src/resources/*`.

| | |
| --- | --- |
| Auth | `Authorization: Bearer $RUNWAYML_API_SECRET`. The SDK also sends `X-Runway-Version: 2024-11-06`. |
| Create | `POST /v1/text_to_video`, `POST /v1/image_to_video` → `{ id }` |
| Status | `GET /v1/tasks/{id}` → `PENDING` / `THROTTLED` / `RUNNING` (`progress`) / `SUCCEEDED` (`output[]`) / `FAILED` (`failure`, `failureCode`) / `CANCELLED` |
| Cancel | `DELETE /v1/tasks/{id}` |
| Webhooks | Not offered by the API. Velora polls. |
| Poll guidance | Runway says not to expect updates more often than every 5 s per task. |
| Output | URLs expire in 24–48 h. Velora copies each video into its own private storage. |

Models Velora exposes, with only the options the API accepts:

| Model | Mode | Durations offered | Aspect ratios (→ API `ratio`) |
| --- | --- | --- | --- |
| `gen4.5` | text→video | 5, 10 s (API accepts integers 2–10) | 16:9 (`1280:720`), 9:16 (`720:1280`) |
| `gen4.5` | image→video | 5, 10 s | 16:9, 9:16, 1:1 (`960:960`), 4:3 (`1104:832`), 3:4 (`832:1104`), 21:9 (`1584:672`) |
| `veo3.1` | text/image→video | 4, 6, 8 s | 16:9 (`1920:1080`), 9:16 (`1080:1920`) |

- **15 seconds is not offered** because neither model supports it.
- Prompts are limited to 1000 UTF-16 code units, including the style and camera directions Velora appends. The limit is enforced client-side and server-side.
- `veo3.1` is sent with `audio: false`, because audio changes pricing and Velora does not expose it yet.
- Reference images are sent as a 1-hour signed HTTPS URL. When Supabase isn't publicly reachable (local `http://` dev), Velora sends a base64 data URI instead, which the API accepts up to 5 MB.

To change which models or durations are offered, edit `lib/video/catalog.ts`. Validation, the UI, and the provider mapping all read from it.

## How video generation works

```
Create page ── POST /api/generate (Idempotency-Key header)
   │  auth (server session) → same-origin check → rate limits → Zod + capability validation
   │  verify uploaded image (ownership, size, magic bytes)
   │  optional LLM enhancement → compose final prompt (style/camera directions)
   │  price from lib/credits/pricing.ts
   │  create_generation_with_charge()   ← atomic, idempotent, no double charge
   │  provider.createGeneration()       ← on failure: mark failed + refund
   ▼
/generations/[id] ── polls GET /api/generation/[id] every 5 s (backs off, pauses when tab hidden)
   │  claim_generation_sync() lease → provider.getGenerationStatus()
   │   queued / processing → update progress
   │   completed → download output → private storage → completed
   │   failed / cancelled / timed out (30 min) → mark + refund
   ▼
Video player · Download (signed URL) · Favorite · Regenerate · Edit & regenerate · Delete
```

`/api/cron/sync` sweeps generations still in progress, for users who closed the tab.

## Adding another provider

1. Add a `VideoProviderDefinition` to `PROVIDER_CATALOG` in `lib/video/catalog.ts`: models, per-mode durations and aspect ratios (mapped to the provider's values), prompt limit, required env vars, poll interval, webhook support.
2. Implement `VideoProvider` (`lib/video/provider.ts`) in `lib/video/providers/<name>.ts`. Map the provider's errors to `ProviderError` kinds and its task states to `ProviderTaskState`. If it supports webhooks, implement `parseWebhook` **with signature verification**.
3. Register a factory in `lib/video/registry.ts`.
4. Add prices in `lib/credits/pricing.ts`. A test fails if any catalog model has no price.

The Create page, validation, library and settings pick the provider up automatically. It appears only when its env vars are set.

## How credits work

- On first sign-in, each new account gets `VELORA_SIGNUP_CREDITS` once (idempotent).
- Prices are in `lib/credits/pricing.ts`: `gen4.5` costs 5 credits/s (5 s = 25, 10 s = 50) and `veo3.1` costs 10 credits/s. Velora credits are an internal unit, independent of Runway's billing.
- Credits are deducted when the generation is created, in the same transaction as the insert. Concurrent requests are serialized per user, so the balance cannot go negative (`check (balance >= 0)`).
- The client sends an `Idempotency-Key` per Generate click. Retries and double-clicks return the same generation and are never charged twice.
- Refunds happen automatically, exactly once, when the provider rejects the request, the task fails, it is cancelled, it times out, or it never starts.
- Every change is recorded in `credit_transactions`, which is visible under Settings → Credits.
- Payments are not implemented. To add them later, grant credits by inserting `adjustment` rows through a new service-role function that mirrors `grant_signup_credits`.

## Security summary

- Identity always comes from the server-side Supabase session (`auth.getUser()`). Request bodies are `.strict()`, so a client-supplied `userId` is rejected.
- RLS applies to every table. Ownership is double-checked with composite foreign keys. Privileged functions can be executed only by `service_role`.
- The service-role key, Runway key and LLM key are server-only (`import "server-only"`). Provider error details are logged, never returned to users.
- Other users' rows return 404 (not 403), so IDs cannot be probed.
- State-changing API routes reject cross-origin requests. Server actions use Next.js's built-in origin check.
- Rate limits are Postgres-backed and work across serverless instances: generate 6/min and 60/day, enhance 15/min, upload 20/min, status 90/min, other mutations 60/min.
- Uploads are validated three ways: declared type/size, bucket MIME/size limits, and magic-byte sniffing. Buckets are private and every URL is short-lived.
- Headers: CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, Referrer-Policy, Permissions-Policy.
- Auth rate limiting (sign-in and sign-up attempts) comes from Supabase Auth's built-in limits.

---

## Deploy to Vercel

1. **Create a Supabase project** at https://supabase.com/dashboard.
2. **Run the migrations**:
   ```bash
   cd velora
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. **Storage:** the migration creates the buckets. No manual step is needed unless your plan's global upload limit is under 50 MB.
4. **Auth URLs:** under Supabase **Authentication → URL Configuration**, set the Site URL to `https://<your-domain>` and add `https://<your-domain>/auth/callback` to the redirect URLs.
5. **Create the Vercel project:** import the repository and set **Root Directory = `velora`**. The framework preset is Next.js.
6. **Environment variables** (Project → Settings → Environment Variables): set all of the variables above for Production (and Preview if you use it). Generate `CRON_SECRET` with `openssl rand -hex 32`.
7. **Provider credentials:** create an API key at https://dev.runwayml.com, add credits to that Runway organization, and set `RUNWAYML_API_SECRET`. Optionally set `LLM_API_KEY`.
8. **Deploy:**
   ```bash
   npm i -g vercel
   vercel link          # choose the project; Root Directory: velora
   vercel --prod
   ```
9. **Webhooks:** none are needed. Runway has no webhook API, so Velora polls. `vercel.json` schedules `/api/cron/sync` daily, which is the Hobby-plan limit. On Pro, change the schedule to `*/5 * * * *` so abandoned in-progress generations finish promptly.
10. **Test:** sign up, check that Settings → Providers shows Runway as configured, generate a 5-second text-to-video, and watch it complete in the library.

## Known limitations

- **No webhooks:** the Runway API does not offer them, so status comes from polling. It runs at most once per 5 s per task, while a viewer has the page open, plus the cron sweep.
- **Durations and ratios:** neither model supports 15 seconds. Text-to-video with `gen4.5` supports only 16:9 and 9:16; square and other ratios require a reference image.
- **Style and camera:** Runway has no dedicated parameters for these, so they are applied as prompt instructions.
- **Thumbnails:** Runway returns only the video. Cards use the video's first frame (`preload="metadata"`), and image-to-video cards also use the reference image as a poster. No server-side frame extraction is done.
- **Audio:** Veo 3.1 audio is not exposed, and requests are sent with `audio: false`.
- **Output size:** generated videos over 50 MB are not stored. That is the bucket limit, and it is well above typical 720p/1080p clips of 10 s or less.
- **Payments:** not implemented, by design. The credit ledger is ready for them.
- **Failure messages:** Runway `failureCode` prefixes (`SAFETY`, `INPUT_PREPROCESSING`, `INTERNAL`) map to friendly messages. Unknown codes show a generic message, and the raw code is logged server-side only.
- **Status sync on Vercel:** the sync that finishes a generation (copying the video into storage) runs inside the status request, so it must finish within the function's `maxDuration` (60 s is configured).
