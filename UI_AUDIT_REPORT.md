# UI Audit Report

_Working file — updated as the audit progresses. Last update: 2026-10-18._

## 1. Project & UI stack (Phase 1)

| Area | What the project uses |
|---|---|
| Framework | React 18 SPA (Vite 5), React Router 6. Backend Node/Express + MongoDB (not touched by this audit except where noted). |
| Styling | Mix of **Bootstrap 5 classes** (older CRM / Setup pages), **Tailwind v4** utilities + **shadcn/ui** (Radix) components in `src/knowvato-main/**` (Event Manager, PM, Website, Users/Roles…), and the app's own kit `.ui-btn / .ui-input / .ui-search` in `src/styles.css`. |
| Design tokens | CSS variables in `src/styles.css` `:root` — colours (`--background #FAF8F5`, `--foreground #253338`, `--primary #217E79`, `--accent`, `--success`, `--warning`, `--info`, `--destructive` + `-bg` pairs, `--border`, `--muted-*`), radius (`--radius*`), shadows, input/button heights, and slider widths (`--slider-w`). Bootstrap's `--bs-primary` is mapped to the brand teal. Tailwind theme in `src/knowvato-main/styles.css` reads the same variables. |
| Typography | DM Sans (Google Fonts) everywhere; scale set in `styles.css` (base 13px UI, `.form-label` 11.5px uppercase, page titles via `PageHeader` / PM `PageTitle`). |
| Icons | Bootstrap Icons (`bi-*`) in CRM/Setup pages; lucide-react in `knowvato-main/**`. |
| Shared components | `src/components/ui.jsx` (PageHeader, Tabs, FilterBar, DataTable, **Modal = right slider**, Confirm, StatCard, Chip, IconBtn, Spinner, EmptyState, ErrorBox); shadcn set in `src/knowvato-main/components/ui/*` (Sheet = right slider, Dialog, Select, Tabs, Table, Switch, …); PM helpers `src/knowvato-main/pm/shared.tsx`; app shell `knowvato-main/routes/__root.tsx` + `components/app-sidebar.tsx` + `components/BreadcrumbNav.jsx`. |
| Run locally | Backend: `cd backend && npm run dev` (port 4001). Frontend: `cd frontend && npm run dev` (port 5173, proxies `/api`). Seed login: `priya@greenwood.edu` / `password123` (Administrator). |
| Checks available | `vite build` (no lint script, no frontend type-check config); backend `tsc --noEmit`; API test scripts in `backend/src/tests/*.mjs`. |
| Visual checks | Headless Chrome (system Chrome driven by `puppeteer-core` installed in a scratch folder — **no project dependency added**). Script visits every route at 1440 / 1024 / 768 / 375 px, records console errors, failed requests, horizontal overflow, elements poking past the viewport, broken images, placeholder text, unlabeled icon buttons / inputs, small tap targets, and saves screenshots to `ui-audit-screenshots/` (git-ignored). |

## 2. Inventory

_(filled in from the sweep — see below)_
