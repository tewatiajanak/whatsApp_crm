# Website Builder — gap report

Checked on 2026-10-12. "Exists" means built and exercised by an API test, a unit test or a browser check;
"Partial" means a working subset; "Missing" means not built.

**Starting point.** Before this track the "Website Builder" menu opened one page with hard-coded demo rows
(`WebsiteBuilderPage.tsx`) around the CRM landing-page builder. There were no website, page, theme, menu or
content models on the server. The track assumes an existing CMS to upgrade; here it had to be built first.

| Area | Capability | State | Notes |
|---|---|---|---|
| Navigation | Website Builder left menu, per-website screens | Exists | hard-coded per module like the rest of the app, not a config registry |
| Navigation | Website switcher, command palette (Ctrl+K) | Exists | palette searches screens, pages, collections, websites |
| Navigation | Pinned items, collapse memory, badges | Missing | |
| Navigation | Public menu builder, nesting to 3 levels, mega menu | Exists | a top item whose children have children renders as columns |
| Navigation | Auto menus | Partial | newest records of a collection; no "child pages" source |
| Designer | Theme tokens, 16 presets, fonts, scale, buttons, contrast warnings, draft/publish | Exists | |
| Designer | Style presets | Partial | save from an element, apply, rename, delete; no "detach everywhere" |
| Designer | Custom font upload, custom CSS, theme variations, theme import/export | Missing | theme travels inside the website export |
| Builder core | Page JSON v2, server validation, undo/redo, autosave with conflict check | Exists | |
| Builder core | Plugin registry (`registerComponent`) | Partial | no `registerPlugin`/`registerControl`, no per-component `migrate` |
| Builder core | Canvas iframe + message bridge, normalised store, perf panel | Missing | canvas is the renderer inline, isolated by a first-declared cascade layer |
| Editing | Inline text edit, multi-select, copy/paste across pages, layers, canvas drag-drop, device modes | Exists | canvas drag-drop is not covered by a browser check |
| Editing | Entrance animations | Partial | in-view animations only; no click/hover actions, popups, scroll effects |
| Editing | Copy / paste style | Exists | buttons in the Style tab and Ctrl+Alt+C / V; whole style, no per-group options |
| Editing | Grid editor, spacing handles, smart guides, context menu, custom breakpoints | Missing | |
| Elements | 57 elements | Partial | track asks for 80+; no charts, lottie, hotspots, comparison slider, image lightbox |
| Blocks | 85 blocks + saved blocks | Partial | track asks for 90+ with generated thumbnails; no thumbnails |
| Data | Collections, 12 field types, records, CSV import with dry run | Exists | no relations populate, revisions, scheduling |
| Data | Query engine with field/operator allow-list | Exists | |
| Data | Content Delivery API with hashed API keys, origins, rate limit | Exists | no OpenAPI document or explorer |
| Data | Webhooks with HMAC signature, retries, delivery log, SSRF guard | Exists | retries run in-process (lost on restart) |
| Data | External REST sources: encrypted headers, field mapping, cache, stale-on-error, circuit breaker | Exists | GET only; no parameters, pagination or presets |
| Data | Binding expressions, repeaters, conditions | Exists | 14 filters; no nested-repeat limit check, no page data sources |
| Dynamic pages | `/x/:slug` item pages, list with search + paging in the URL | Exists | no filter elements, no slug-change redirects |
| Forms | Form element, public submit, inbox, `form.submitted` webhook | Exists | optional per website: a submission with a name and phone also becomes a CRM lead (off by default; not exercised end to end because the CRM runs in live messaging mode) |
| Preview | In-app draft preview with devices, live updates from the editor tab, share links | Exists | live updates only between tabs of one browser |
| Preview | QR device preview, comments, password on links | Missing | needs a websocket server |
| Apps | 6 kits (Blog, Events, Team, Catalogue, Announcements, Courses), install / remove | Partial | track lists 10; no update flow or per-app structured data. RSS (`/site/<address>/feed/<collection>.xml`) and calendar files (`/calendar/<collection>/<slug>.ics`) work for any collection with an item page |
| Templates | 30 full-site templates (29 + blank, 4–6 pages each), "Website Templates" gallery with live thumbnails, full preview and page switcher; export a website, import a file | Exists | pictures are built-in abstract artwork (`frontend/public/wb-art`, generated, no licences needed), not photographs; every template is installed, published and server-rendered by a check script, but there are no axe / Lighthouse gates and no install wizard with placeholders |
| Renderer | One renderer for canvas, previews and public site; theme CSS variables | Exists | |
| Renderer | Server rendering of every public page (static, list, item) | Exists | `/site/<address>/…` is drawn by the API and hydrated in the browser by a separate public bundle (`site.html`, about 336 KB of script against 4.9 MB for the admin app) |
| Renderer | HTML cache with ETag/304, purged per website on publish, record, menu and theme changes | Exists | in process memory; purge is per website, not per page |
| Renderer | Open Graph, canonical, JSON-LD (WebSite/WebPage/BreadcrumbList), robots.txt, sitemap | Exists | no per-collection structured data (Article, Product, Event) |
| Renderer | Content-Security-Policy for site pages | Exists | enforced in production, report-only in development (`SITE_CSP=report` / `enforce` overrides). Checked in a browser against the built public bundle: no violations |
| Renderer | Site health (cache hits, render time, slowest pages) | Partial | counters since the API last started; no broken-link crawl or Lighthouse run |
| Renderer | Islands (ship no JS for static sections), atomic site releases + rollback, image variants, font self-hosting, cache warm-up, CDN purge | Missing | the whole page is hydrated, not just its interactive parts |
| SEO | Per-page title/description, sitemap | Partial | no Open Graph, JSON-LD, robots.txt, redirects |
| QA | Unit tests (`npm run website:test`, `npm run test:website`) and an API regression suite of 25 tests (`npm run website:api-test`, needs the API running) | Partial | browser checks were done by hand through automation, not saved as Playwright tests; no render snapshots, axe or Lighthouse runs |

## Per phase

| Phase | Done here | Still open |
|---|---|---|
| U00 | these four documents, two unit-test scripts | fixture export, render snapshots, API contract test |
| U01 | left menu, switcher, palette, mega menus, auto menus (collection) | config registry, pins, badges, breadcrumbs hook, menu live preview strip |
| U02 | schema v2 fields, server validation, registry, error boundary per element | iframe canvas + bridge, normalised store, migrations runner (nothing to migrate yet) |
| U03 | designer, presets, compiler, draft/publish, contrast | fonts upload, custom CSS, variations, hard-coded-colour lint |
| U04 | inline edit, multi-select, drag-drop, animations | grid editor, context menu, copy style, guides, breakpoints |
| U05 | 57 elements, allow-listed embeds, sanitised HTML | ~25 elements, per-element help pages, axe and Lighthouse runs |
| U06 | 85 blocks, saved blocks | thumbnails, block manager screen, block import/export |
| U07 | collections, query engine, content API, keys, webhooks, CSV import | relations, revisions, datasets, OpenAPI, usage charts |
| U08 | sources with SSRF guard, encryption, mapping, cache, breaker | parameters, auth presets, logs screen, scheduled refresh |
| U09 | expressions, repeaters, conditions, item + list pages, sitemap | filter elements, related items, redirects, structured data |
| U10 | draft preview, same-browser live updates, share links | websocket stream, QR, comments, split view |
| U11 | 6 apps | 4 apps, update flow, RSS/ICS |
| U12 | export / import of a whole website, template install | gallery with live preview, wizard with placeholders, merge/replace modes |
| U13 | 30 templates with built-in artwork | real photography, per-template colour variants, QA gates (axe, Lighthouse) |
| U14 | server rendering, HTML cache + purge, SEO head tags, robots, sitemap, CSP (report-only), health counters | separate light public bundle, releases/rollback, images, enforced CSP, load test |
| U15 | — | rehearsal, e2e suite, security review document, user and developer guides |

## Risks worth knowing
- Rights: every Website Builder route uses the existing `setup` permission. The track's fine-grained keys (`designer.update`, `theme.publish`, …) are not modelled.
- Production must route `/site/` to the API server and give it the built files: `frontend/dist` with `site.html` (or `WEB_DIST_DIR`) and `frontend/dist-ssr/site-ssr.cjs` (or `SITE_SSR_BUNDLE`). If the renderer file is missing the API logs a warning and pages fall back to browser rendering.
- Webhook retries and the external-source cache live in the API process memory.
