# Website Builder — codebase map

Names used in the Builder Upgrade Track prompts, mapped to the real files in this repository.
There was no earlier CMS in this repo (see GAP_REPORT.md), so most rows point at code written for this track.

| Prompt name | Real location |
|---|---|
| `apps/admin` | `frontend/src` (one Vite + React app; Website Builder code in `frontend/src/website-builder/`) |
| `apps/api` | `backend/src` (Express + Mongoose, TypeScript) |
| `packages/renderer` | `frontend/src/website-builder/registry.jsx` + `elements2.jsx` (registry, elements, render loop, style compiler) and `SiteView.jsx` (site frame, public site, previews) |
| `packages/shared` page schema | checked on the server by `checkPageJson` in `backend/src/routes/website.ts` |
| `packages/expressions` | `frontend/src/website-builder/expressions.js` (tests: `expressions.test.mjs`) |
| theme schema + `compileTheme` | `frontend/src/website-builder/theme.js` |
| `apps/admin/src/builder` | `frontend/src/website-builder/BuilderPage.jsx` |
| `apps/admin/src/designer` | `DesignerPage` in `frontend/src/website-builder/pages.jsx` |
| `app/navigation` sidebar | `websiteSubmenu()` in `frontend/src/knowvato-main/components/app-sidebar.tsx` (the app's sidebar is hard-coded arrays per module) |
| command palette, website switcher | `frontend/src/website-builder/palette.jsx` |
| menus screen | `MenusPage` in `pages.jsx`; resolved by `resolveMenu` in `backend/src/routes/website.ts` |
| `modules/data-sources`, API keys, webhooks UI | `DataApisPage` in `frontend/src/website-builder/dataPages.jsx` |
| content types / records UI | `ContentPage` in `dataPages.jsx` |
| `modules/apps` | `AppsPage` in `dataPages.jsx`; kits in `frontend/src/website-builder/apps.js` |
| `modules/templates`, blocks | `frontend/src/website-builder/blocks.js` (`BLOCKS`, `SITE_TEMPLATES`) |
| models: Website, Page, Menu, Block, ContentType, Record, ApiKey, Webhook, DataSource, PreviewLink | `backend/src/models/Website.ts` (`Website`, `WebPage`, `WebMenu`, `WebBlock`, `WebCollection`, `WebRecord`, `WebApiKey`, `WebWebhook`, `WebDataSource`, `WebShareLink`, `WebSubmission`) |
| `PageVersion` | not present — a page keeps one `draft` and one `published` copy plus a `version` counter |
| Admin API `/api/v1/...` | `/api/websites/...` in `backend/src/routes/website.ts` and `websiteData.ts` |
| Render API `/public/render` | `GET /api/public/site/:siteKey/render?path=` |
| Preview API | `GET /api/websites/:id/preview` (signed in) and `GET /api/public/preview/:token/render` (share link) |
| Content Delivery API | `/api/content/v1/sites/:siteKey/...` in `websiteData.ts` |
| `dataService.resolve` | `resolveSource` / `pageData` in `backend/src/services/websiteData.ts` |
| SSRF guard, secret encryption, webhook delivery | `backend/src/services/websiteData.ts` |
| `requirePermission` | `require_(module, action)` in `backend/src/middleware/auth.ts` — Website Builder uses the existing `setup` module |
| `apiClient` | `http` in `frontend/src/api/client.js`, wrapped by `frontend/src/website-builder/api.js` |
| `auditService` | `audit()` in `backend/src/utils/http.ts` |
| Realtime `/realtime` | not present — live preview uses `BroadcastChannel` between tabs of one browser |
| Old "Website Builder" page | `frontend/src/knowvato-main/pages/WebsiteBuilderPage.tsx`, now at `/modules/website/landing` |
