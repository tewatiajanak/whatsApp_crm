# PM_RULES.md — Project Management Module: Rules for the AI (read before every task)

> Save this file in the root of your EXISTING project as `PM_RULES.md`.
> If the project already has a `CLAUDE.md`, add this line at the end of it: `Also read and follow PM_RULES.md for all project-management work.`
> If there is no `CLAUDE.md`, create one that contains only that line.

---

## 1. Golden rules for working inside the EXISTING project

1. **Always check first.** Before writing any code, inspect what already exists: routes, pages, components, APIs, database tables/collections, auth, roles/rights, employee management, settings, notifications, email/WhatsApp code. Report: **Exists / Partially exists / Missing**.
2. **Reuse, don't duplicate.** If employees, roles, user rights, login, teams, clients, settings, file upload, email or a notification system already exist, EXTEND them. Never create a second employee table, a second login, a second role system or a second settings page.
3. **Additive changes only.** You may update existing code to ADD capability. You must NEVER remove or reduce existing features, fields, columns, routes, menu items, permissions or data. Database changes must be additive and backward compatible (new tables/columns with defaults, migration scripts, no destructive drops).
4. **Follow the existing stack.** The frontend is **React JS + Bootstrap** (and whatever Bootstrap-based component library the project already uses). Use the project's existing backend language/framework, database, ORM, folder structure, API style, state management, form library, toast/modal components and naming conventions. Do not introduce Tailwind, MUI, Ant Design, shadcn or TypeScript. Add a new library only when nothing existing can do the job, and record it in `/docs/pm/DECISIONS.md`.
5. **Follow the existing UI exactly.** Same layout, sidebar, header, colors, fonts, buttons, tables, modals, forms and icons as the current project. New screens must look like they were always part of it.
6. **No mock data or placeholder screens.** Everything is wired to real APIs and real tables.
7. **Nothing business-related is hard-coded.** Statuses, priorities, task types, work locations, meeting types, ticket categories, TAT values, templates, notification rules and roles all come from Setup masters. Code checks **flags** (e.g. `isCompleted`), never names (e.g. `"Completed"`).
8. **Permissions on the server.** Every new API checks login + the user's right for that action + data visibility. Hiding a button in the UI is not security.
9. After every part: run the app/build/tests, fix errors, update `/docs/pm/CHANGELOG.md`, and give a short summary — what was added, which existing files were changed and why, and how to test.

---

## 2. UI rules (very important)

- **Simple and clean.** Minimum text on every page.
- **No descriptions under headings.** Page title + action buttons only.
- **No placeholders in form fields,** except the search box ("Search") and date-format hints where truly needed. Labels must be short (1–3 words).
- No helper paragraphs, no instructional banners, no tooltips explaining obvious things. Use icons + short labels.
- Empty states: one short line + one button (e.g. "No tasks" + "Add Task").
- Status is shown as **colored badges** (color from the status master). Progress is shown as **progress bars**. Health is shown as a **colored dot/badge: On Track / Delayed / Ahead / Overdue**.
- A person should understand a project's or employee's status **in 3 seconds**: big numbers, colors, one progress bar.
- Forms: use a drawer/modal for small forms and a full page only for big forms (Project creation, Product template). Required fields marked with `*`. Inline error messages.
- Tables: clean, paginated, sortable, with a search box + filters + an **Export Excel** button.
- **Mobile responsive** on every screen: tables turn into cards, drawers go full screen, and buttons stay large enough to tap.
- Confirm before delete. Show a toast after save.

---

## 3. Data hierarchy

```
SETUP (templates)                          RUNTIME (actual projects)
Product (ERP, CRM, ...)                    Project (Client + Product + Project Incharge)
 └ Module (Admission, Fee, ...)             └ Project Module (+ Module Incharge)
    └ Task Template                            └ Task (+ Assignee, TAT, planned/actual dates)
       ├ default assignee, TAT                    ├ Checklist items (tick)
       ├ depends on (other tasks)                 ├ Status (from master), comments, attachments (max 3)
       ├ checklist items                          ├ Dependencies → dates auto-calculated
       ├ client verification required?            ├ Client verification (portal / email / WhatsApp)
       └ auto Email/WhatsApp rules                └ Auto Email/WhatsApp rules (copied, editable)
+ Ad-hoc tasks (not from a template; can be linked to a project/module or be standalone)
```
- When a project is created, the setup template is **copied** into the project. Later template changes do not affect running projects.
- Every task stores `clientId, productId, projectId, projectModuleId` for fast filtering and security.

---

## 4. Roles & visibility (extend the existing role/rights system)

Typical roles (they are data, not code): Admin, Implementation Manager, Project Manager, Project Incharge, Module Incharge, Team Lead, Employee, Client User.
- Rights are per screen/action: view, add, edit, delete, assign, reassign, approve, export, configure.
- Data visibility per role: **Own** (my tasks/projects) / **Team** (me + my team members via the reporting hierarchy) / **All**.
- A manager automatically sees everyone below them in the reporting hierarchy.
- Client users log in to the **Client Portal** and see ONLY their own client's data, and only items marked client-visible. Internal notes are never visible to clients.

---

## 5. Key calculations (server side)

- **TAT**: value + unit (Hours / Days / Working Days). Working days skip weekends + holidays (from Setup).
- **Dependency**: a task with predecessors starts when ALL predecessors complete (planned: the latest predecessor planned end; actual: the latest predecessor actual completion). Planned due = start + TAT. When a predecessor finishes late or early, recalculate the dependent tasks in a chain and log it.
- **Task overdue** = not completed and now > due date.
- **Project progress** = completed tasks ÷ total tasks (weighted by TAT if a setting says so). Checklist ticks drive task progress.
- **Project schedule status**: compare actual progress with planned progress (expected % complete by today, based on planned task dates):
  - **Ahead** if actual > planned + 5%
  - **On Track** if within ±5%
  - **Delayed** if below − 5% or any critical task is overdue
  - **Completed On Time / Completed Late** at closure
  - The thresholds are settings.

---

## 6. Docs to maintain
`/docs/pm/CHANGELOG.md`, `/docs/pm/DECISIONS.md`, `/docs/pm/GAP_REPORT.md` (from Phase 0), `/docs/pm/API.md`, `/docs/pm/TEST_GUIDE.md`.
