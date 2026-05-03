# Mathstub

Multi-tool framework hosting small utility web tools, monetized via display ads
and affiliate links. First tool: **RSU Tax Withholding Shortfall Calculator**.

Lives at https://mathstub.com (after launch).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS + Vitest

## Local development

```bash
npm install
cp .env.example .env.local   # edit if needed; defaults render placeholders
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                  | What it does                              |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Next.js dev server                        |
| `npm run build`         | Production build                          |
| `npm run start`         | Serve production build                    |
| `npm run lint`          | next lint                                 |
| `npm run typecheck`     | `tsc --noEmit`                            |
| `npm run test`          | Vitest (pure modules under `lib/`)        |
| `npm run test:coverage` | Vitest + V8 coverage report               |
| `npm run check`         | typecheck + lint + tests                  |

## Adding a new tool

1. Add an entry to `lib/tools.ts` (registry drives nav, sitemap, homepage).
2. Add `app/<slug>/page.tsx` (server component) + `<slug>/<Tool>.tsx` (client island).
3. Add `content/<slug>.ts` (title, description, FAQs, HowTo steps).
4. Add the pure calc module under `lib/<topic>/` with exhaustive Vitest tests.
5. Add at least one OG image under `public/og-<slug>.png` (or use a dynamic
   `app/<slug>/opengraph-image.tsx`).

The shell (Header, Footer, Sitemap, ToolShell) requires no changes.

## Environment variables

See `.env.example`. Anything `NEXT_PUBLIC_*ID` left blank renders a dev
placeholder; the production build only injects the real `<script>` tags / ads
when the corresponding env var is present.

## Deploy

Vercel project, Root Directory = blank (project is at repo root after the
subtree split — see LAUNCH.md). Node 20. Set production env vars in the
Vercel dashboard. Set `ROBOTS_NOINDEX=1` on preview deploys.

## Launch checklist

See [LAUNCH.md](./LAUNCH.md) for the full step-by-step from "code merged" to
"first dollar earned" — covers domain, repo split, Vercel, DNS, Search Console,
GA4, AdSense, and affiliate program signups.
