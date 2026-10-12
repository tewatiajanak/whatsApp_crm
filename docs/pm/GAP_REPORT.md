# Project Management Module — Gap Report (Phase 0)

Inspected on 2026-10-03 at commit `ddf8806`. No code was changed for this report.

Paths are relative to the repo root. "Shell" means the main app frame in `frontend/src/knowvato-main/` (sidebar, top bar, Configuration).

---

## 1. Stack report

### Frontend (`frontend/`)
| Item | What the project uses |
|---|---|
| React | 19.2, Vite 5.4, ES modules |
| Language | Mixed: CRM pages are `.jsx`; the shell and all newer pages are `.tsx` |
| Bootstrap | 5.3.3 + bootstrap-icons 1.11 (loaded globally in `src/main.jsx`) |
| Tailwind | 4.2 via `@tailwindcss/vite` — already used across the shell |
| Component library | shadcn-style Radix components in `src/knowvato-main/components/ui/` |
| Icons | lucide-react in the shell, bootstrap-icons in CRM pages |
| Router | react-router-dom 6.26; all routes declared in `src/App.jsx` |
| State | React context (`AuthContext`, `ToastContext`, `ThemeContext`); `@tanstack/react-query` is installed but not used |
| Forms | Plain `useState` in almost every page; `react-hook-form` + `zod` only in the event form designer |
| HTTP client | Own `fetch` wrapper `http` in `src/api/client.js` (Bearer token); API groups in `src/api/index.js` |
| Charts | recharts 3.8 (`pages/ReportsPage.tsx`, `routes/index.tsx`) |
| Calendar | No calendar library. Event calendar is hand-built (`routes/modules.events.calendar.tsx`); `react-day-picker` is the date picker |
| Excel | `xlsx` (SheetJS) 0.18, browser side only (`event-manager/pages/EventAttendeesPage.jsx`) |
| PDF | `jspdf` + `html2canvas` (`event-pass/exportPass.tsx`) |
| Toast | `useToast()` from `src/context/ToastContext.jsx`; a few integration pages use `sonner` |
| Drag and drop | Native HTML5 drag events, no library (`routes/modules.events.tasks.tsx`) |
| Rich text | None. Only a `contentEditable` block inside `components/LandingPageBuilder.jsx` |
| Dev proxy | `/api`, `/webhooks`, `/uploads` → `http://localhost:4001` (`vite.config.js`) |

### Backend (`backend/`)
| Item | What the project uses |
|---|---|
| Language / framework | TypeScript 5, Express 4, run with `ts-node-dev` |
| Folder pattern | `src/models`, `src/routes`, `src/controllers`, `src/services`, `src/middleware`, `src/utils` |
| Database / ORM | MongoDB Atlas + Mongoose 8. Every model carries a `tenant` id |
| API style | REST under `/api`; responses `{ ok, data }` or paginated `{ ok, data, page, perPage, total, pages }` (`utils/http.ts`) |
| Auth | JWT Bearer (`utils/jwt.ts`, 7-day expiry), optional email OTP, password policy (`services/userAccess.ts`) |
| Rights | `require_(module, action)` in `middleware/auth.ts` |
| Validation | Hand-written checks; `zod` is installed |
| File upload | `multer` to the OS temp folder, then moved under `backend/uploads/…` and served publicly at `/uploads` |
| Email | `services/email.ts`: simulation unless `EMAIL_MODE=live` + `SMTP_*` env vars. `nodemailer` is **not installed** |
| WhatsApp | Provider adapter layer in `services/providers/` (Meta, Pinnacle, Simulation) picked per tenant from `WhatsAppAccount`. Currently `WHATSAPP_MODE=live` |
| Background jobs | Optional BullMQ worker for campaigns only (`jobs/worker.ts`); `USE_QUEUE=false`, no Redis. **No cron or scheduler anywhere** |
| Encryption | AES helper `encryptSecret` / `decryptSecret` / `maskSecret` in `services/payments/crypto.ts` |
| Rate limit | 600 requests/minute on all of `/api` (`app.ts`) |
| Audit | `AuditLog` model + `audit()` helper |
| Transactions | Not used anywhere yet (Atlas supports them) |
| Tests | None, in backend or frontend |

### Run / build
- Both together: `npm run dev` at the repo root (API on 4001, web on 5173).
- Backend: `npm --prefix backend run dev | build | start | seed | worker`.
- Frontend: `npm --prefix frontend run dev | build | preview`.

---

## 2. UI report (reuse these)

| Need | Existing piece | File |
|---|---|---|
| Page frame | Shell layout with sidebar + top bar | `frontend/src/knowvato-main/routes/__root.tsx` |
| CRM frame | Thin wrapper that renders CRM pages in the same shell | `frontend/src/components/Layout.jsx` |
| Sidebar / menu config | `modules` list (line 59) and one submenu array per module | `frontend/src/knowvato-main/components/app-sidebar.tsx` |
| Route table | All routes | `frontend/src/App.jsx` |
| Theme / colors | CSS variables + theme switcher | `frontend/src/knowvato-main/styles.css`, `frontend/src/styles.css`, `frontend/src/context/ThemeContext.jsx`, `PROJECT_THEME_RULES.md` |
| Buttons, search box, input | `UIButton`, `SearchInput`, `UIInput` | `frontend/src/knowvato-main/components/UIKit.tsx` |
| Simple master screen | `MiniCrudPage` (list + add/edit/delete) | `frontend/src/knowvato-main/components/MiniCrudPage.tsx` |
| Table | `ui/table.tsx`; `DataTable` for CRM pages | `…/components/ui/table.tsx`, `frontend/src/components/ui.jsx` |
| Column chooser | `useColumnPicker` | `…/components/ColumnPicker.tsx` |
| Drawer | `Sheet` (side drawer), `Drawer` (bottom) | `…/components/ui/sheet.tsx`, `ui/drawer.tsx` |
| Modal / confirm | `Dialog`, `AlertDialog`; `Modal` for CRM pages | `…/components/ui/dialog.tsx`, `ui/alert-dialog.tsx`, `components/ui.jsx` |
| Select / dropdown | `Select`, `DropdownMenu`, `Command` (searchable) | `…/components/ui/select.tsx`, `ui/command.tsx` |
| Date / time input | `DateInput` (dd-mm-yyyy), `TimeInput`, `Calendar` | `frontend/src/components/DateInput.jsx`, `TimeInput.jsx`, `…/ui/calendar.tsx` |
| Date formatting | `fmtDate`, `fmtDateTime`, `fmtRelative` | `frontend/src/knowvato-main/utils/date.ts` |
| Badge / status pill | `Pill`, `Badge`, `StatusPill` | `…/user-management/shared.tsx`, `ui/badge.tsx`, `components/ui.jsx` |
| Progress bar | `Progress` | `…/components/ui/progress.tsx` |
| Tabs | `Tabs` | `…/components/ui/tabs.tsx` |
| Cards | `Card` | `…/components/ui/card.tsx` |
| Avatar | `Avatar` | `…/components/ui/avatar.tsx` |
| Toast | `useToast()` | `frontend/src/context/ToastContext.jsx` |
| Rights matrix | `PermissionMatrix`, `Toggle` | `…/user-management/shared.tsx` |
| Row action icons | `ActionColumn` | `frontend/src/components/ActionColumn.jsx` |
| Charts | recharts usage to copy | `…/pages/ReportsPage.tsx` |
| Calendar grid | Month grid to copy | `…/routes/modules.events.calendar.tsx` |
| Kanban drag | Native drag pattern to copy | `…/routes/modules.events.tasks.tsx` |
| Excel export | SheetJS usage to copy | `…/event-manager/pages/EventAttendeesPage.jsx` |
| Mobile check | `useIsMobile` | `…/hooks/use-mobile.tsx` |
| Rights in UI | `can(module, action)` | `frontend/src/context/AuthContext.jsx` |

Missing UI pieces: rich-text editor, org-chart tree, Gantt/timeline, resource-planner grid, file upload with paste. These will be built from the pieces above.

---

## 3. Existing features vs required

| Feature | Status | Where | Notes |
|---|---|---|---|
| Employee management | Partial | `backend/src/models/User.ts`, `routes/userAdmin.ts`, `pages/UsersPage.tsx` | A user is the employee. Has name, email, mobile, DOB, designation, role, user type, status. Missing: code, department, reporting manager, joining date, photo |
| Roles | Exists | `UserType` in `models/User.ts`, `/usertypes`, `pages/RolesPage.tsx` | The `usertypes` collection is the role |
| User rights — screen/action | Partial | `MODULES` + `IPermission` in `models/User.ts`, `require_` in `middleware/auth.ts` | 10 fixed modules × view/create/edit/del, plus per-user overrides and a cap by user type. Missing: assign, reassign, approve, export, configure; no PM screens |
| Data visibility Own / Team / All | Missing | — | No visibility rule anywhere; every API returns the whole tenant's data |
| Departments | Missing | `pages/DepartmentsPage.tsx` | The "Departments" screen actually edits **designations** (`/designations`). There is no department record |
| Designations | Exists | `Designation` in `models/Masters.ts` | |
| Teams | Partial | `models/Team.ts`, `/teams` | Name, manager, members, lead sources, active. Missing: parent team. Built for lead assignment |
| Reporting manager / hierarchy | Missing | — | |
| Clients (companies) | Missing | — | `Contact` is a CRM lead contact, not a client company. `Tenant` is our own organisation |
| Client contacts (SPOCs) | Missing | — | |
| Client login | Partial | `UserCategory.kind = "client"`, password policy per kind | A client user type exists, but a client user is not linked to any client and no API limits what they see |
| Products / modules | Missing | — | `Service` is a CRM lead pipeline, not a product template |
| Projects | Missing | — | |
| Tasks, statuses, checklists | Partial (events only) | `routes/modules.events.tasks.tsx`, `lib/task-statuses.ts`, `lib/task-checklists.ts` | Event tasks only, saved as JSON blobs in `AppStore` (`em_tasks`, `em_task_statuses`, `em_task_checklists`). Not usable for PM; left untouched |
| Attachments, comments | Missing | — | Upload plumbing (multer) exists |
| Holidays / working days | Missing | — | |
| Email sending | Partial | `backend/src/services/email.ts` | Works only with SMTP env vars and after installing nodemailer; otherwise simulated |
| Email settings screen | Partial | `pages/EmailIntegrationPage.tsx` | Screen exists but saves nothing to the server |
| Email / WhatsApp templates | Exists | `ModuleTemplate` in `models/ModuleSetup.ts` (per module), `Template` in `models/Messaging.ts` (CRM) | Placeholders are numbered `{{1}}`; named dynamic keys do not exist |
| WhatsApp sending | Exists | `services/whatsapp.ts`, `services/providers/*` | Text, template, media, interactive buttons; adapter layer already present; Meta template sync exists |
| WhatsApp webhook | Exists | `routes/webhooks.ts` → `/webhooks/whatsapp/:tenantId` | Status updates and inbound messages handled per tenant |
| Message log | Exists | `Message` in `models/Messaging.ts`, `/messages` | No scheduled send time or retry count |
| In-app notifications | Partial | `routes/modules.communication.notification-center.tsx` | Stored in `AppStore` from the browser; no server-side notifications, no per-user delivery |
| Calendar | Partial | `routes/modules.events.calendar.tsx` | Events only |
| Meetings / trainings | Missing | — | |
| Tickets | Missing | — | |
| Dashboards | Exists (other modules) | `routes/index.tsx`, `pages/Dashboard.jsx` | None for PM |
| Reports | Partial | `routes/modules.reports.*`, `pages/ReportsPage.tsx` | Reports module exists; no PM reports |
| Excel export | Partial | SheetJS in the browser | No server-side export |
| Audit log | Exists | `AuditLog` in `models/System.ts`, `audit()` in `utils/http.ts`, `/audit`, `pages/AuditLogsPage.tsx` | Stores user name, action, module, entity, prev, next as text |
| Settings / master pattern | Exists | `controllers/crudFactory.ts`, `MiniCrudPage.tsx`, Configuration in `routes/modules.$module.tsx` | Per-module Setup pages exist for events, crm, website, front-office |
| Background scheduler | Missing | — | Needed for reminders, overdue alerts, retries |
| Encrypted secrets | Exists | `services/payments/crypto.ts` | Reusable for SMTP password and tokens |

---

## 4. Risks

1. **PM_RULES rule 4 does not match this project.** The rule says React JS + Bootstrap, no Tailwind, shadcn or TypeScript. The project already runs on Tailwind 4, shadcn/Radix and TypeScript in the shell and in every recent page, and the backend is TypeScript. Bootstrap-only pages would look different from the rest of the app, which breaks rule 5. Needs a decision — see `DECISIONS.md` D-01.
2. **Development runs against the online database.** `backend/.env` points at MongoDB Atlas. Demo seeds (Parts 1B, 2D) would write into that database.
3. **`npm --prefix backend run seed` deletes everything.** `seed/seed.ts` wipes tenants, users, roles, leads, messages and more before seeding. PM seeds must be separate, additive scripts; this script must never be run against the online database.
4. **WhatsApp is in live mode.** Test sends in Phase 3 would reach real numbers unless a test account or simulation mode is used.
5. **Rights list is fixed in code.** `MODULES` is a constant and `effectivePerms` only returns those modules. New PM modules must be appended (additive). Existing roles will get no PM rights until granted, so the Administrator role needs a one-time additive update.
6. **No data visibility layer.** Own / Team / All is new and has to be applied in every PM API through one helper.
7. **`crudFactory` is too open for PM data.** It copies any query parameter into the Mongo filter and saves the whole request body. Fine for simple masters; not safe for projects, tasks, client data.
8. **Uploads are public.** Anything under `backend/uploads` is served at `/uploads` without login. PM attachments (internal vs client-visible) need an authenticated download route and a folder that is not served statically.
9. **`routes/index.ts` is one 834-line file** with the catch-all `authenticate` in the middle. PM routes go in their own router file mounted after `authenticate`; public PM links (verification, sign-off) must mount before it, like `publicEvents`.
10. **Frontend catch-all route.** `modules/:module` in `App.jsx` renders `ModulePage`; PM routes must be declared before it.
11. **No tests, no migration tool.** Verification is build + manual testing. Mongo needs no schema migration; new fields get defaults, and one-off backfill scripts cover existing records.
12. **Team requires at least one member and a manager**; parent team and hierarchy must be added without breaking lead-assignment workflows that read `Team`.
13. **No scheduler.** Reminders and overdue alerts need a new in-process timer; with more than one server instance it must not send twice.

### Naming conflicts to avoid
- "Tasks", "Task Statuses", "Task Checklist" already exist for events (`em_*` keys, Configuration → Events). PM uses its own collections and screens.
- `Template` (CRM) and `ModuleTemplate` (per-module) already exist.
- `Service` (lead pipeline), `Contact` (lead contact), `Team` (lead assignment), `Workflow` (lead alerts) — PM's Product, Client, Client Contact are separate records.
- Sidebar slug `whatsapp` is the CRM; `/modules/:module` is a generic page.
- All new collections get a `pm_` prefix; all new API paths start with `/api/pm/`.

---

## 5. Plan per phase

Placement: a new "Project Management" entry directly below CRM in the sidebar module list, with its own submenu; pages under `/modules/projects/…`; backend in `backend/src/models/pm/`, `backend/src/routes/pm/`, `backend/src/services/pm/`.

### Phase 1 — Setup
| Reuse / extend | New |
|---|---|
| `User` (add code, department, reporting manager, joining date, photo) | Department master |
| `UserType` roles + `MODULES` + `IPermission` (add PM modules and the extra actions, default off) | Visibility (Own/Team/All) on the role; `getVisibleEmployeeIds(user)` helper; `hasRight()` on the frontend |
| `Team` (add parent team) | Team Hierarchy page (org chart) |
| `AuditLog` + `audit()` | PM masters (statuses, priority, task type, work location, meeting type, ticket masters, holidays, working days, PM settings) |
| `MiniCrudPage`, `crudFactory` for simple masters | Product → Module → Task template → Checklist builder, dependency check, Excel import |
| `ModuleTemplate` (add module `projects`), `PermissionMatrix`, Users / Roles screens | Clients + contacts (SPOCs); dynamic key registry; template preview; auto-message rules |

### Phase 2 — Projects and tasks
| Reuse / extend | New |
|---|---|
| Sheet/drawer, table, pills, progress, native drag, event calendar grid | Date engine (TAT, working days, dependencies) with unit tests |
| multer upload plumbing | Projects, project modules, tasks, checklist, comments, attachments (private storage), assignment history |
| SheetJS | Project wizard, project detail, board, timeline, My Work, Daily Plan, Team Calendar |

### Phase 3 — Communication, portal, tickets
| Reuse / extend | New |
|---|---|
| `services/email.ts` (add nodemailer + saved SMTP settings), `EmailIntegrationPage` | Message queue collection + in-process scheduler with retries |
| `services/whatsapp.ts` + provider adapters, WhatsApp webhook, `WhatsAppAccount` | Server-side notifications + bell |
| `services/payments/crypto.ts` for secrets | Meetings & trainings (+ .ics) |
| `UserCategory.kind = "client"` login, OTP, password policy | Client portal, client-scoped APIs, verification links, sign-off, tickets with SLA |
| `jspdf` for the sign-off PDF | |

### Phase 4 — Dashboards and reports
| Reuse / extend | New |
|---|---|
| recharts, Reports module shell | PM dashboards (management, project, person) |
| SheetJS (add to backend for server-side export) | PM reports, saved views, global search, recurring tasks, time logging, bulk actions, milestones |

Nothing existing is planned for removal in any phase.
