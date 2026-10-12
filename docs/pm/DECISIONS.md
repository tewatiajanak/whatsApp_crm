# Project Management Module — Decisions

One entry per decision: what was decided, why, and when. New libraries are recorded here.

<!--
## D-00 — Title
- Status: Open | Decided (YYYY-MM-DD)
- Decision:
- Why:
-->

## D-01 — UI stack for PM screens
- Status: Decided (2026-10-03)
- Decision: PM screens are built with the shell's existing components (UIKit, Sheet, Pill, tables — the same ones Users, Roles and Event Manager use), written as `.tsx` like those pages. The backend stays TypeScript. No new UI library.
- Why: `PM_RULES.md` rule 4 assumes a Bootstrap-only JavaScript project, but this app's shell and recent pages already run on Tailwind, shadcn/Radix and TypeScript. Rule 5 (look identical to the existing app) and the first sentence of rule 4 (follow the existing stack) can only be met this way.

## D-02 — Where setup data, demo data and test messages go
- Status: Decided (2026-10-03)
- Decision:
  - PM setup data (roles, default masters) is written by `backend/src/seed/pmSetup.ts`, which only adds missing records and never deletes or overwrites. It is safe to run repeatedly on the online database.
  - Demo data (products, clients, projects) is written by a separate script, every record tagged `isDemo: true`, with a matching remove command.
  - `npm --prefix backend run seed` wipes the database and must not be run against the online database.
  - Phase 3 test sends go only to an explicitly configured test email / number.
- Why: development is connected to the online MongoDB Atlas database and WhatsApp runs in live mode.

## D-03 — PM rights extend the existing permission rows
- Status: Decided (2026-10-03)
- Decision: PM screens are new entries in the existing `MODULES` list (`pm_*`), and the existing permission row gains five optional actions (assign, reassign, approve, export, configure), default off. Data visibility (Own / Team / All) is one field on the role.
- Why: one rights system, one Roles screen; existing roles and their saved rights are unchanged.

## D-04 — PM templates are their own collection
- Status: Decided (2026-10-03)
- Decision: `pm_templates`, not the existing `ModuleTemplate`.
- Why: the existing templates use numbered placeholders (`{{1}}`) and Meta approval states; PM needs named keys, categories and an HTML email body. The existing collections are untouched.

## D-05 — New library: nodemailer (backend)
- Status: Decided (2026-10-03)
- Why: `services/email.ts` was already written for it but it was not installed; nothing else in the project sends SMTP mail.

## D-06 — New library: xlsx / SheetJS (backend)
- Status: Decided (2026-10-03)
- Decision: the same library and version the frontend already uses, for the server-side report export.
- Note: list screens (projects, tasks, clients, tickets, meetings, message log, team calendar) export in the browser from the rows the API returned, so they carry the same filters and visibility. Only the Reports export is built on the server.

## D-07 — Scheduler runs inside the API process
- Status: Decided (2026-10-03)
- Decision: a one-minute timer in the API process; every send and every once-only rule is claimed with an atomic database update.
- Why: the project has no cron and Redis is not in use. With several API instances nothing is sent twice.

## D-08 — Test mode is on until switched off
- Status: Decided (2026-10-03)
- Decision: PM messages go to the test recipients of Setup › Email & WhatsApp; with none set they are recorded as Skipped. Demo records never send.
- Why: WhatsApp is live and the database is the online one.

## D-09 — Attachments are private
- Status: Decided (2026-10-03)
- Decision: files are stored in `backend/pm-files/<tenant>/`, outside the public `/uploads` folder, and served only by routes that check the login and the visibility. Employee photos stay in `/uploads/user-photos`.

## D-10 — "Critical task" for the Delayed status
- Status: Decided (2026-10-03)
- Decision: an overdue task counts as critical when another open task waits for it, or when it is a milestone.
- Why: `PM_RULES.md` section 5 names critical tasks without defining them; a priority name cannot be used (rule 7).
