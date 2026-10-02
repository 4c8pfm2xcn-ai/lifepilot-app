# DAYZERO

**Everything, organized.** An AI-powered personal operating system.

This repository contains two apps:

| Directory | What it is |
| --- | --- |
| [`web/`](web/README.md) | **DAYZERO** — the production web app (Next.js, Supabase, Anthropic). Start here: setup, environment variables, migrations, testing and deployment are documented in [`web/README.md`](web/README.md). |
| repository root (`App.tsx`, `src/`) | The earlier **LifePilot** React Native / Expo prototype, kept unchanged for reference. |

```bash
cd web && npm install && npm run dev
```

DAYZERO runs without any credentials in a clearly-labelled demo mode; add Supabase and Anthropic keys to enable real accounts and full AI features.
