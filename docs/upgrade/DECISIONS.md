# Website Builder — decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-11 | Build the CMS foundation instead of "upgrading" one | none existed; the old page was a mock |
| 2026-10-11 | Keep the old page at `/modules/website/landing` | additive-only rule; it still wraps the landing-page builder |
| 2026-10-11 | Guard all routes with the existing `setup` permission | a new permission module would lock out every existing role until an admin granted it |
| 2026-10-11 | Website code in `frontend/src/website-builder/` as JSX with the knowvato UI kit | matches the neighbouring module screens |
| 2026-10-11 | Responsive rules use CSS container queries (`@container wb`) | the canvas can show tablet and mobile layouts by changing its width, no iframe needed |
| 2026-10-11 | Desktop canvas is drawn 1280px wide and scaled with `zoom` | a narrow editor window must still show the desktop layout |
| 2026-10-11 | Site CSS overrides live in a first-declared cascade layer (`@layer wb-site-first` in `index.html`) | the admin app sets fonts and link/heading colours globally with `!important`; an earlier layer is the only way to outrank them without an iframe |
| 2026-10-11 | Draft and published copies on the page document, with a `version` counter | simple conflict control without a versions collection |
| 2026-10-12 | Any text property may contain `{{ … }}`; a separate `bindings` map is also honoured | one mental model for users: type or pick a field where the text goes |
| 2026-10-12 | Repeat data is resolved on the server into the render bundle | public pages draw with data in one request; private fields never reach the browser |
| 2026-10-12 | API keys stored as SHA-256 hashes; source headers and webhook secrets sealed with AES-256-GCM (`DATA_SOURCE_SECRET_KEY`, falling back to `JWT_SECRET`) | secrets must not be readable from the database |
| 2026-10-12 | Live preview through `BroadcastChannel`, not websockets | no socket server exists; covers the editor's own second window |
| 2026-10-12 | Apps and templates are code packages in the frontend, installed through validated API calls | no platform-level template store exists yet |
| 2026-10-12 | Server rendering = the API renders HTML with the frontend renderer built as one CommonJS file (`npm run build:ssr`), then the web app redraws the page from the bundle embedded in the HTML | the app is a client SPA with `createRoot`; full hydration would need a second, public-only entry. Content, title and tags are in the HTML either way |
| 2026-10-12 | Rich text is sent as plain text in server HTML | the sanitiser needs a DOM; the browser redraws it with formatting. Avoids trusting a regex sanitiser on the server |
| 2026-10-12 | Cache purge is per website | simple and always correct; per-page dependency tracking can replace it when sites get large |
| 2026-10-12 | CSP for site pages is Report-Only by default | an enforced policy has not been tested against the production build of the admin app |
| 2026-10-12 | Published websites get their own browser entry (`site.html` → `site-entry.jsx`) and are hydrated with `hydrateRoot` | replaces the earlier "admin app redraws the page" approach; visitors no longer download the admin app |
| 2026-10-12 | Rich text is written into the page by an effect after hydration (`RichHtml`) | server sends text only; React would otherwise keep the server's unformatted HTML |
| 2026-10-12 | Form → CRM lead is opt-in per website | creating a lead can start CRM workflows and messages; the owner must choose it |
| 2026-10-13 | Template pictures are generated SVG artwork shipped in `frontend/public/wb-art` | no hot-linking and nothing to license; owners replace them with their own photos |
| 2026-10-13 | Every drawn site scopes its theme CSS to its own `data-wb-site` id | the template gallery draws many sites on one screen; an unscoped theme made them all take the last one's colours |
