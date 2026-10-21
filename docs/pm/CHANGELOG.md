# Project Management Module — Changelog

Newest first. One entry per part.

<!--
## Phase X, Part XY — YYYY-MM-DD
### Added
### Existing files changed (and why)
### How to test
-->

## CRM: Report builder & dashboards, approvals, UI clean-up — 2026-10-22
### Added
- **Report builder** (CRM → Report builder), rebuilt on one query engine over Leads, Follow-ups, Applications, Deals, Quotations, Form submissions, Fees & payments, Queries and the lead timeline.
  - Reports: summary (group by any field, dates by day / week / month / quarter / year, then by a second field; count, total, average, lowest, highest, unique) or a list of records with the columns you pick; filters by field type (is, is any of, contains, at least, between, is empty …); period presets (today … financial year, custom) on any date field; sort; up to 5,000 rows; bar / line / pie chart; totals row; **Export Excel**; save (private or shared); 8 ready-made reports.
  - **Dashboards**: number cards (with change vs the previous period), bar, line, pie and table widgets, 1–4 columns wide; one period for the whole dashboard; edit mode to add, edit, move, resize, remove; a starter "Admissions overview" with 11 widgets; private or shared.
  - Only whitelisted fields can be read; every source keeps the Leads page visibility (own / team / all, branches).
- **Approvals** made a real workflow: fee concessions, **refunds** and **quotation discounts**.
  - Rules (Approvals → Rules, CRM admins): approve on its own up to an amount; a second approver above an amount (named people, or CRM admins); extra first approvers; refunds and quotation discounts can be switched on, with the allowed discount %.
  - Page: For me / My requests / All, type and status filters, approve or reject (reason required) one or many, withdraw your own request, a trail of who approved each step, who it is waiting on.
  - Nothing changes until the last approval: then the concession is applied, the refund is paid, or the quotation can be sent. A quotation edited to a bigger discount needs approval again.
- **Automation rule editor**: When → Only if → Then do, step cards with "Right away / After a wait", AND / OR toggle, move steps, labelled message boxes with click-to-insert name / course / city / owner, Active switch, and a one-line summary of the rule.
- Buttons styled as cards keep their rounded corners everywhere (Bootstrap's reboot was resetting them); New form template picker restyled.
- Fees, refunds, concessions, lost reason, follow-up notes, targets, saved views, custom fields: hints inside boxes replaced by labels.
- API: `routes/crmReports.ts`, `routes/crmApprovals.ts`, model `models/CrmReport.ts`; tests `npm --prefix backend run reports:api-test` (13 checks).
### Existing files changed (and why)
- `models/CrmMore.ts` (Approval: kinds, levels, trail — additive; lead and fee no longer required for quotation requests), `models/CrmExtras.ts` (`approvals` rules), `models/CrmSales.ts` (quotation `approval`).
- `routes/crm2.ts` — concession requests follow the rules; direct refunds need approval when the rule is on (CRM admins excepted); approval list/decide moved to `crmApprovals.ts` (same URLs). `routes/crmSales.ts` — send checks the discount rule.
- Frontend: `pages/ReportBuilder.jsx` (new, replaces the fixed lead report at `/crm/reports`), `pages/CrmMorePages.jsx` (Approvals), `pages/Automation.jsx`, `pages/Sales.jsx`, `components/lead/LeadFees.jsx`, `styles.css`, `api/index.js`, `App.jsx`.
### How to test
- `npm --prefix backend run reports:api-test`, `forms:api-test`, `crm:api-test`.
- CRM → Report builder → pick a ready-made report → change Group by → Export Excel → Save; Dashboards → Make a starter dashboard.
- Approvals → Rules → set "approve on its own up to ₹100" and a second approver above ₹1,000 → ask for a concession on a lead's fee.

## CRM: Applications made workable, offers by email and WhatsApp — 2026-10-21
### Added
- **Applications** list: stage tabs with counts, search, course / owner / date filters, Clear, Excel export; table on desktop, cards on phones; offer status and fee (paid / due) on every row.
- **Application drawer** (row click or `?app=`): applicant, call / WhatsApp / lead / form links, stage move with a note and a stage bar, offer status, fees with pay links, the answers filled in, documents (open), stage history.
- **Offer**: letter, fee to confirm, valid till; send by **Email** and/or **WhatsApp** using the CRM templates from Setup → Communication Templates. Each {{1}}, {{2}} is filled from applicant name, course, fee, valid till, offer link, payment link, organisation or your own text; live preview for both. A WhatsApp template goes as an approved WhatsApp template when Meta approved one with that name, otherwise as a normal message. Sending again updates the same fee instead of adding another. Do-not-contact settings are respected; each channel's result is shown.
- API: `routes/crmApplications.ts` (list, `GET /crm/applications/templates`, `GET /crm/applications/:id`, stage, offer) — moved out of `routes/crm.ts`, same URLs.
### How to test
- `npm --prefix backend run forms:api-test` (21 checks; sends nothing).
- Setup → Communication Templates → Email Template with {{1}} {{2}} → Applications → Offer → pick it → map the values → Make offer & send.

## CRM: Forms builder, Sales (deals, companies, products, quotations) — 2026-10-21
### Added
- **Forms** (CRM → Forms, also Setup → Forms → Application & Registration Forms): one simple builder for enquiry, application, registration, event, feedback and other forms. Start from a template (Enquiry, Admission application, Event registration, Job application, Contact us, Feedback) or blank.
  - **Build**: click or drag 18 field types (text, long text, email, phone, number, date, time, link, dropdown, single / multiple choice, yes/no, rating, file upload, signature, consent, section title, hidden value); multi-step forms; drag to reorder, move between steps, duplicate, delete; half / full width; required; options typed or taken from Courses / Branches / Grades / Academic sessions; each answer can fill a lead field; default value and URL name (prefill from the link); validation (min/max, length, PIN / PAN / Aadhaar / custom pattern with its own error text); file type, size and count; **show only if** conditions. Live preview on desktop and phone.
  - **Settings**: heading, button text, progress bar, save and continue later (resume link, emailed when an email is given), thank-you message with {name} {ref}, redirect link, open / close time, most submissions, one per phone, closed message, reference prefix (ENQ-/APP-/REG-… by default), create/update lead (source, status, owner or auto-assign, course, tags), add to **Applications**, **fee** (fixed or by a dropdown answer → payment link through the existing gateway), notify the owner and other emails, email / WhatsApp a copy to the person, colour / background / logo / cover / width.
  - **Share**: link, copy, open, WhatsApp, custom link name, campaign (UTM) link, QR code download, embed code (auto-height iframe), prefill parameters.
  - **Submissions**: status tiles, search, status / payment / date filters, bulk mark / delete, Excel export of every answer; detail drawer with answers by step, file view / download (login only), lead and application links, payment status and pay link, receipt / resume links, notes and history.
  - **Analytics**: views, starts, submissions, conversion, leads, money collected, per-day chart, sources, where unfinished forms stopped.
  - Public pages: `/f/:slug` (mobile-first, steps, inline errors, signature pad, honeypot spam check) and `/f/receipt/:token` (printable copy, pay button, track application).
  - Every answer is checked again on the server (types, options, conditions, patterns, files); files go to the lead's documents.
- **Sales** (CRM → Sales):
  - **Deals**: pipeline board with drag and drop (and a Move-to menu on phones), list view, deal stages as a master (name, colour, probability, open / won / lost — Deals → Stages), value from product lines, weighted forecast, expected close and overdue, days in stage, owner / priority / source / tags, lost reason required, notes and stage history, by-owner table, Excel export. **Deal** button on every lead opens a new deal from it.
  - **Companies**: accounts with industry, size, GSTIN, address, owner, tags, people (with a main contact), notes, their deals and quotations.
  - **Products**: catalogue with SKU, category, unit, price, GST %, HSN/SAC; used products are switched off instead of deleted.
  - **Quotations**: from a deal or blank, product lines with discount and tax, adjustment / round off, valid till, terms, note; send by email or copy link; the customer opens `/quote/:token`, prints / saves PDF, accepts (with their name) or declines; views are counted; accepted / rejected quotations are locked (duplicate to change); the owner is notified.
- API: `routes/crmForms.ts`, `routes/crmSales.ts`, models `models/CrmForm.ts`, `models/CrmSales.ts`; test `npm --prefix backend run forms:api-test` (20 checks, cleans up after itself).
### Existing files changed (and why)
- `backend/src/routes/index.ts` — mounts the new public and signed-in routes. `backend/package.json` — test script.
- `frontend/src/App.jsx` — routes; `api/index.js` — `formsApi`, `salesApi`; sidebar (Forms under CRM, new Sales group); `BreadcrumbNav.jsx`; `Setup.jsx` — Forms group links to the new builder (old Registration Form builder kept); `LeadDrawer.jsx` — Deal button.
- Rights: Forms building uses `setup`; submissions, deals, companies and quotations use `leads`, with the same lead visibility (own / team / all) by owner.
### How to test
- `npm --prefix backend run forms:api-test` with the API running.
- CRM → Forms → New form → Admission application → Settings → Publish → Share → Open; fill it in on a phone, upload a file, sign, submit, pay. Back in Submissions / Analytics / Applications / the lead.
- CRM → Deals → New deal with a product line → drag across the board → Quotation → Send → open the link → Accept.

## Bulk Campaigns: recipient lists, delivery report, resend — 2026-10-15
### Added
- **Recipient Lists** tab (CRM → Bulk Campaigns): import a CSV / Excel file (pick the phone and name columns, check valid / invalid / duplicate, import), view, search, remove a number, add more numbers from another file, rename, Excel export, Send. Other columns are kept to fill template variables.
- **New Campaign** now picks who it goes to: an imported list, a CRM lead list, or opted-in contacts. Template preview, template variables ({{1}}… from name / phone / a list column / fixed text), send now or schedule.
- **Report** on every campaign (row click or chart icon): recipients, sent, delivered, read, failed with percentages, a delivery bar, every recipient with their latest status and times, filters, search, Excel export.
- **Resend**: from the report, pick Failed / Sent not delivered / Delivered not read / Read / Not sent → a new campaign (own name, template, schedule) linked to the original. **Resend history** in the report; the list shows "Resend of …".
- Live counts: list and report numbers come from the delivery log (real webhook receipts, not only simulation) and refresh while sending.
- API: `routes/campaigns.ts`, model `models/CampaignPro.ts`; test `npm --prefix backend run campaigns:api-test` (14 checks, sends nothing, cleans up).
### Existing files changed (and why)
- `models/Messaging.ts` — Campaign gets audience, resend link, variables, launch/complete times (additive, with defaults); Message index on campaign + phone.
- `services/campaignService.ts` — resolves the audience, freezes it at launch, sends in the background (the launch request no longer waits for every send), pause really stops and resume continues, campaigns finish as Completed, template language and variables are passed.
- `services/crmScheduler.ts` — scheduled campaigns now actually go out when their time comes (before, nothing sent them).
- `controllers/messagingController.ts` — delivery receipts arriving out of order no longer move "read" back to "delivered".
- `routes/index.ts` — campaign routes moved to the new router (same URLs).
- Frontend: `pages/Campaigns.jsx`, `api/index.js`.
### How to test
- `npm --prefix backend run campaigns:api-test` with the API running.
- Bulk Campaigns → Recipient Lists → Import List → Sample → import; New Campaign → Imported list → Send now; open the campaign → Report → Resend.

## WhatsApp Manager: theme pass — 2026-10-15
### Added
- **Conversations** (`/crm/chat`) redesigned on the app theme: chat list with All / Unread / Open / Closed filters, unread counts and window-status dots; thread header with time left in the 24h window; theme-coloured bubbles, reply buttons and template tags; closed-window bar with a Template shortcut; pill composer with emoji picker, interactive buttons and template menu; collapsible details panel. Mobile: list → thread with a back button.
### Existing files changed (and why)
- `pages/Conversations.jsx`, `styles.css` (old hard-coded WhatsApp-green chat CSS replaced by `.wa-*` styles that use only theme tokens).
- `flowchat/flowchat.css`, `flowchat/data/nodeTypes.js`, `FlowCanvas.jsx`, `NodeCard.jsx`, `NodeConfigPanel.jsx`, `WhatsAppPreview.jsx` — bot builder, canvas, nodes and phone preview use theme colours; builder gets the theme classes.
- `flowchat/pages/Dashboard.jsx`, `FormsManager.jsx`, `MediaManager.jsx`, `pages/ChatbotRules.jsx`, `pages/Templates.jsx`, `components/WhatsAppTemplateBuilder.jsx` — shared page header, theme colours, shorter labels, filler text removed.
- `styles.css` — Bootstrap colour utilities (text/bg/subtle/alerts/badges/outline buttons) mapped to theme tokens on CRM pages; icon-action hovers no longer Bootstrap blue.
### How to test
- `npx vite build` in `frontend`. Open CRM → WhatsApp Manager pages; switch theme preset — all colours follow it.

## Lead CRM: Meritto / LeadSquared features — 2026-10-14
### Added
- **Queries** (`/crm/queries`): student/customer query desk. Number per tenant (#1001…), category, priority, status (Open → Waiting on customer → Resolved / Closed), assignee, reply-by time from the category, thread with replies, internal notes and "customer said", optional send by WhatsApp or email, Excel export. Also a **Queries** tab on every lead.
- **Activity types** (CRM settings → Activity types): custom activities like "Campus visit" with their own fields (text, number, date, dropdown, yes/no) and score points. Logged from the lead timeline (**Activity** mode); shown on the timeline; listed on the new **Activities** page (`/crm/activities`) with filters and Excel export.
- **Lead scoring** (CRM settings → Lead scoring): every weight and the hot/warm bands are now settings (defaults = the old fixed numbers), activity points count, "Rescore all leads".
- **Lead lists** (`/crm/lists`): static lists (Leads → select → **Add to list**) and smart lists (saved filters). Open in Leads (`?list=`), message all, Excel export, list chips on the lead.
- **Source history**: every enquiry's source is kept; lead Details shows primary / secondary / tertiary source.
- API: `routes/crm3.ts`, model `models/CrmPro.ts`; test `npm run crm:api-test` (13 checks, cleans up after itself).
### Existing files changed (and why)
- `models/Lead.ts` (`sourceHistory`), `models/LeadActivity.ts` (types `activity`, `query`, `list`), `models/CrmExtras.ts` (`scoring`, `queries` settings) — additive fields with defaults.
- `services/leadService.ts` — score reads the settings and activity points; enquiries record their source.
- `controllers/leadController.ts` — `list` filter; `routes/crm.ts` — saves the new settings; `routes/index.ts` — mounts the routes.
- Frontend: `LeadDrawer.jsx`, `Leads.jsx`, `CrmSettings.jsx`, `App.jsx`, sidebar, breadcrumbs, `api/index.js`.
- `AICopilotWidget.jsx` + `styles.css` — the floating Ask button is hidden while a drawer/modal is open (it covered the Save buttons on every drawer).
### How to test
- `npm --prefix backend run crm:api-test` with the API running.
- CRM → Queries → New query; CRM settings → Activity types → Add, then a lead → Timeline → Activity; Leads → select → Add to list.

## Planner: one page for tasks, plan and calendar — 2026-10-06
### Added
- `pm/WorkTabs.tsx`: the **Planner** title with the tabs **My Task · Team Task · Daily Plan · Team Calendar**. A tab is shown only to a user with the right of that screen (the rights themselves are unchanged).

### Existing files changed (and why)
- `components/app-sidebar.tsx`: My Work, Tasks, Daily Plan and Team Calendar are **one menu entry, Planner**; it opens the first tab the user may see.
- `pm/MyWorkPage.tsx`, `pm/TasksPage.tsx`, `pm/DailyPlanPage.tsx`, `pm/TeamCalendarPage.tsx`: the shared title and tabs replace their own titles. The addresses are the same as before, so links in notifications and emails keep working.
- `components/BreadcrumbNav.jsx`: the four pages are named Planner. `pm/pm.css`: `.pm-tabs`.

### Not checked
- In a browser (build and type-check only).

## Planner: two tabs — 2026-10-06
### Existing files changed (and why)
- `pm/WorkTabs.tsx`, `pm/pm.css`: the Planner has two tabs. **My Task** = Tasks | Daily Plan (mine). **Team Task** = Tasks | Calendar (the team). The switch of the open tab is at the end of the tab row; tabs and views follow the screen rights as before, and the addresses are unchanged.
- `pm/DailyPlanPage.tsx`: shows **my plans only** (the employee filter is removed). The team's plans, with result and remarks, are in Team Task › Calendar. `GET /pm/plans?employee=` stays in the API.

### Not checked
- In a browser (build and type-check only).

## Projects: new project in a drawer, client instead of project name — 2026-10-06
### Existing files changed (and why)
- `components/app-sidebar.tsx`: menu order Dashboard · Projects · Planner · Meetings & Trainings.
- `pm/ProjectsPage.tsx`: **New project opens in a drawer** on the right. The **Project column is removed** (a project is named "Client – Product"); the first column is the client with the project code, also on the phone cards and in the Excel export.
- `pm/ProjectWizardPage.tsx`: `onClose` — the drawer form (steps on top, Back / Next fixed at the bottom). `App.jsx`: the old address `/modules/projects/new` opens the Projects page with the drawer.

- In the drawer a task row of the Modules step has two lines — the task and its dates, then assignee and TAT — instead of four squeezed columns; the review tiles are two per row. The drawer has no card around the first step and the same footer as the other drawers.

- New project › Modules: the TAT unit offers **h** and **d** only, and **d is a working day** (the value stays `working_days`, so no date changes); "cd" appears only for a task the template counts in calendar days. The assignee field of a task is narrower and sits under the task name.

### Not checked
- In a browser (build and type-check only).

## Planner › Daily Plan: list only — 2026-10-06
### Existing files changed (and why)
- `pm/DailyPlanPage.tsx`: the calendar view and its switch are removed — the same calendar is the Team Calendar tab. The list of plans stays.

## Employee filter is named — 2026-10-06
### Existing files changed (and why)
- `pm/EmployeePicker.tsx`: `emptyLabel`. The employee filter on Tasks, Tickets, Team Calendar, Dashboard and Reports reads "All employees" / "All incharges" instead of "—", so it is seen as a filter.

## Setup › Settings hidden — 2026-10-06
### Existing files changed (and why)
- `pm/PmSetupPage.tsx`: the **Settings** sub-menu (Calendar group) is hidden for now, like Sending Settings. The page (`setup/Settings.tsx`) and `/api/pm/settings` stay; the saved values keep applying.

## Holidays: import from Excel — 2026-10-06
### Added
- **Setup › Holidays › Import**: download the sample (Date, Name), choose an .xlsx / .xls / .csv file, see which rows are ready and which are skipped (date not understood, name missing, date repeated), then import. Dates may be Excel dates, dd-mm-yyyy, dd/mm/yyyy or yyyy-mm-dd.
- `POST /api/pm/holidays/import` (pm_setup.create): up to 400 rows; a date that already has a holiday gets the new name. Answers `{ added, updated }`.

### Existing files changed (and why)
- `pm/setup/Holidays.tsx`, `routes/pm/setup.ts`, `api/index.js`.

### Not checked
- In a browser and with a real file (build and type-check only).

## Templates: one menu entry — 2026-10-06
### Existing files changed (and why)
- `components/app-sidebar.tsx`: **Templates removed from the Project Management menu** — it is under Setup › Templates. `App.jsx`: the old address `/modules/projects/templates` goes to Setup › Templates.
- `pm/TemplatesPage.tsx`: **Create** sits with the page title, on the right.

## Client form: SPOC — 2026-10-06
### Existing files changed (and why)
- `pm/ClientsPage.tsx`: the contacts of a client are called **SPOC** (form, table, Excel). A new client opens with one SPOC to fill in — Name, Mobile number, Email, Designation — and **Add SPOC** adds more; a SPOC left empty is not saved. The drawer has the same width as the other forms.
- `routes/pm/clients.ts`: error messages say "SPOC 1: …".
- **Date of agreement** on the client (`agreementDate`, optional): model, API, form and Excel export.

### Not checked
- In a browser (build and type-check only).

## Team Calendar toolbar — 2026-10-06
### Existing files changed (and why)
- `pm/TeamCalendarPage.tsx`: the Daily plans / Tasks due / Meetings / Holidays switches are theme chips at the end of the filter row (they were square, solid blocks on a row of their own).
- `pm/pm.css`: `.pm-chips.is-sm`; raw buttons get back the radius and font size of their `rounded-*` / `text-[..px]` classes (file chips in Tickets, Portal, Project overview; tabs).

### Not checked
- In a browser (build and type-check only).

## Meetings: Online + Offline, email invite switch — 2026-10-06
### Added
- Meeting mode **Online + Offline** (`hybrid`): the form asks for both the location and the meeting link.
- Meeting / Training Types **Client Meeting, Internal Meeting, Client Training, Internal Training, Internal Review Meeting** added to the master (existing tenant and the defaults in `services/pm/masters.ts`); the two trainings are flagged as training. The earlier types are kept.
- **Email invite** switch on the meeting form. Off → no email for that meeting (invite, update, cancellation, reminders); WhatsApp and in-app notifications still go. Its default comes from **Setup › Settings › Meeting email invite** (`meetingEmail`, on by default).
- The invite of an online or online + offline meeting now carries the joining link: `{{meeting.location}}` reads "Room 2 + Online: https://…", and the new key `{{meeting.join}}` holds the link alone. The email itself is the Meeting / Training template in Setup › Templates.

### Existing files changed (and why)
- `models/pm/Meeting.ts` (`mode` + `hybrid`, `emailInvite`), `models/pm/Setup.ts` + `routes/pm/setup.ts` (`meetingEmail`), `routes/pm/meetings.ts`, `services/pm/meetings.ts`, `services/pm/keys.ts`.
- `routes/pm/public.ts`, `routes/pm/portal.ts`: the joining link is also given for an online + offline meeting.
- `pm/MeetingsPage.tsx`, `pm/setup/Settings.tsx`, `pm/PortalApp.tsx`, `pm/PublicPages.tsx`, `pm/shared.tsx` (`MEETING_MODES`, `meetingMode`, `meetingWhere`).

### How to test
- New meeting → Mode Online + Offline, enter a location and a link, choose employees, Email invite on → each employee gets the invite with the link (Message Log shows it).
- Same with Email invite off → no email in the Message Log; the in-app notification still arrives.

### Not checked
- In a browser, and a real send (build and type-check only).

## Plan My Day form, My Work — 2026-10-06
### Added
- `pm/pm.css`: `.pm-chips` (choice chips, tinted with the master colour) and `.pm-seg` (segmented switch). Bootstrap's `button` reset overrides Tailwind's radius and font-size utilities, so these buttons need real classes.

### Existing files changed (and why)
- **Daily Plan follows the role's data visibility.** `GET /pm/plans` takes `employee=all` or `employee=<id>` and returns only the people the role may see (Own / Team / All); each plan carries `employee` and `mine`. The page shows an employee filter (Everyone by default) to anyone who may see others, with the name on every plan. Edit, delete and the end-of-day result stay with the owner of the plan, in the UI and on the server.
- `pm/DailyPlanPage.tsx`: the form takes a **date range only** (One date / Several dates removed), the **Hours and From / To time fields are removed**, the drawer has the same width as Add task, location buttons and the Done / Partial / Not done switch use the theme classes. Hours are shown only where a plan has them.
- `routes/pm/plans.ts`: the hours of an entry are worked out from its From–To times; hours sent without times are still accepted.
- `pm/MeetingsPage.tsx` (teams, contacts, reminders) and `pm/TeamCalendarPage.tsx` (Day / Week / Month, By person / By project): same theme classes.
- `pm/MyWorkPage.tsx`: the project cards under the tiles are removed.

### How to test
- Daily Plan → Plan My Day: choose From and To dates → saved for every day of the range.
- Sign in with a role whose data visibility is All → every employee's plans, filter by employee; Team → own team only; Own → only own plans and no filter.

### Not checked
- In a browser, and the save through the API (build and type-check only).

## Number tiles everywhere, New project form — 2026-10-06
### Added
- `StatTile` (`pm/shared.tsx`, styles in `pm/pm.css`): one tile for every number strip — theme colours, icon chip, muted zero, a compact form for cards and drawers.

### Existing files changed (and why)
- Tiles replaced with `StatTile`: Dashboard, My Work (the chosen filter stays highlighted), Person / My performance (6 tiles + daily plan), Project page (task counts, team cards), Team Hierarchy profile, Projects › Transfer work, Import Excel › Verify.
- `pm/shared.tsx`: schedule and TAT badges use the theme colours instead of fixed hex values; also the delayed ring / bars in `ProjectOverview.tsx`, the timeline legend in `TaskViews.tsx` and the chart in `PersonPage.tsx`.
- `pm/ProjectWizardPage.tsx`: **Project name removed** — a project is named "Client – Product" by the server (as it already did for an empty name). Steps shown as numbered circles; the form, the module list and Back / Next share one centred width.

### How to test
- New project: choose client and product, Next → the review step shows "Client – Product" as the name.

### Not checked
- In a browser (build and type-check only).

## WhatsApp templates with approval — 2026-10-06
### Added
- **Setup › Templates › WhatsApp**: the form now has everything the CRM template builder has — WhatsApp template name, type (Utility / Marketing / Authentication), language, header (text, image, video, PDF; upload or link), message, footer, up to 3 buttons (quick reply, link, call) and a live preview. **Save & submit** sends the template to WhatsApp for approval; the table shows the approval (Not submitted / Pending / Approved / Rejected, with the reason).
- Messages are written with the PM keys (`{{task.title}}`); they are turned into WhatsApp's numbered variables with example values when submitted, and filled per message when sent (`services/pm/waTemplate.ts`).
- API: `POST /pm/templates/:id/submit`, `POST /pm/templates/wa-status`, `POST /pm/templates/wa-media`.

### Existing files changed (and why)
- `models/pm/Template.ts` (`wa`), `models/pm/Message.ts` (`waComponents`): new fields with defaults.
- `services/pm/messages.ts`: a template that is submitted but not yet approved is sent as plain text; header and link-button values are sent with the message.
- `routes/pm/templates.ts`: saves the WhatsApp fields; changing an approved template marks it "Changed" until it is submitted again.
- `pm/PmSetupPage.tsx`: **Sending Settings is commented out** of the Setup menu (page and API kept).

### How to test
- WhatsApp tab › Create › fill name and message with a key › Save & submit. With a live Meta account the row shows Pending, then Approved after the review (the page asks WhatsApp when it opens).
- A template whose name was typed by hand and never submitted shows "Linked" and is sent as that template, as before.

### Not checked
- Against Meta (needs the live account), and in a browser. Build, type-check and a script run of the key → variable conversion only.

## Setup › Templates — 2026-10-06
### Added
- **Setup › Templates** (Communication group): two tabs, Email and WhatsApp, each a table (Sr No, Name, Category, Subject / Message, Status, Actions). **Create** at the top right opens the drawer; the template is saved into the open tab. Phones get cards.

### Existing files changed (and why)
- `pm/TemplatesPage.tsx`: the card grid became tabs + table; the Channel field left the form (the tab decides it). Same API and collection (`/pm/templates`), so existing templates and auto-message rules are untouched.
- `pm/PmSetupPage.tsx`, `pm/setup/Messaging.tsx`: "Email & WhatsApp" is now **Sending Settings** (SMTP, test mode — unchanged), listed under Templates.
- The sidebar item Project Management › Templates still opens the same page (for users who have the Templates right but not Setup).

### How to test
- Setup › Templates › WhatsApp tab › Create: save; the row appears in the WhatsApp table and is offered in an auto-message rule with channel WhatsApp.

### Not checked
- In a browser (build and type-check only).

## Product builder: task form and Excel import wizard — 2026-10-06
### Added
- **Import Excel wizard** (Setup › Products › a product): File (with **Download sample**) → Fields (map sheet columns, auto-matched by heading) → Verify (counts of modules, tasks, checklist items and row-by-row problems; nothing is saved) → Import. `pm/ImportTasksDialog.tsx`.
- Import can set the incharge of a new module (`Module Incharge Email`) and mark a checklist item mandatory (item ends with `*`).
- Task template and task: new field `attachmentRequired`. "Attachment required" is now separate from "Attachment mandatory" (which still blocks completion).
- `pm/MultiPicker.tsx`: dropdown with multiple selection (auto-message recipients and employees).

### Existing files changed (and why)
- `pm/ProductBuilderPage.tsx`: task form — "Title" is now "Task", the module is shown under the drawer title instead of a field, Priority removed from the form, unit list is Hour / Day, attachment has two toggles. The separate Template button moved into the wizard.
- `backend/src/routes/pm/products.ts`: import accepts `dryRun` and returns a `summary`; in a sheet "Day" now means a working day ("Calendar Days" for calendar days).
- `backend/src/models/pm/Product.ts`, `Project.ts`, `routes/pm/projects.ts`: `attachmentRequired` added and copied into projects. Existing tasks with a mandatory attachment count as required.
- `pm/RulesEditor.tsx`: "When" is now "Trigger"; Trigger and Recipients share a row.
- `pm/DashboardPage.tsx`, `pm/HeaderTools.tsx`, `pm/pm.css`: dashboard tiles and the top-bar search use the theme colours.

### How to test
- Open a product, **Import Excel**, download the sample, choose it, Verify, Import: the module, both tasks and their checklists appear.
- Change a module name in the sheet to a new one: Verify shows it with **New**. Put an unknown task type: Verify lists the row and Import stays disabled.
- Add a task: turn on Attachment required → the Attachment mandatory toggle appears.

### Not checked
- In a browser, and the import endpoint against the database (build and type-check only).

## UI check and fixes — 2026-10-03
Opened in a browser at desktop width: Dashboard, Projects, project page (Overview, Timeline, Board), New project wizard (steps 1–2), My Work, task drawer, Tasks, Daily Plan, Team Calendar, Meetings, Tickets, Clients, Reports, Templates, Setup (masters, Email & WhatsApp), product builder with Auto Messages, Notifications, My performance. No console errors. At phone width (375px): My Work, Daily Plan, Team Calendar.

### Fixed
- Setup menu and client portal tabs: the selected item was unreadable. A global rule (`event-manager/styles/custom.css`) paints every link in the primary colour; PM links that need their own colour now use the class `pm-link` (`pm/pm.css`).
- **Whole app, phone width:** the hidden desktop sidebar still took a full screen of empty space above every page. `frontend/src/styles.css` now hides it below 768px (the menu button opens the drawer as before).
- PM pages had doubled side padding on phones.
- Projects table: columns no longer wrap the names.

### Added
- Sign-off record as a PDF (project page › Files, and the client portal › Documents).
- Team Calendar: layers that can be switched on and off (daily plans, tasks due, meetings, holidays).

### Not checked in a browser
- Client portal and the three no-login pages (tested through the API only), the remaining screens at phone width, and the task drawer on a phone.

## Phase 4 — 2026-10-03
Dashboards, reports, Excel export, power features, hardening.

### Added
- **4A** `routes/pm/dashboard.ts`: management dashboard (10 tiles, charts, lists; every number opens the filtered list), project Overview tab (progress ring, planned vs actual curve, critical path, milestones), person performance page. Team Hierarchy now shows real task and project numbers.
- **4B** `routes/pm/reports.ts`: 12 reports from one registry (project delivery, projects on time per person per year, tasks per person, reassignments, overdue, TAT compliance, module planned vs actual, pending with client, daily plan, meetings, tickets, communication log). Excel export is made on the server with the same filters and visibility, has the title / filters / exported-by on top and a frozen heading, and is written to the audit log. Saved views per user, optionally shared.
- **4C** `routes/pm/power.ts`: global search (Ctrl+K), quick add task from the header (and `N`), `/` focuses the search box, saved views and bulk change on the task list, watchers, labels, milestone flag, checklist item → task, recurring tasks, time logging, activity feed, workload shown before reassigning. Projects can be pinned to the sidebar (the existing bookmarks).
- **4D** `backend/scripts/pm_e2e.py` — API regression test (97 checks passed on the demo data: rules, limits, links, portal isolation, forbidden access).
- Settings: workload limit, ticket reopen days, time logging. Master flags `isOnsite` (work location) and `isTraining` (meeting type).
- Frontend: `DashboardPage`, `PersonPage`, `ReportsPage`, `ProjectOverview`, `HeaderTools`, `RecurringTasks`.

### Existing files changed (and why)
- `frontend/src/knowvato-main/routes/__root.tsx` — a slot in the top bar for the PM search and quick-add buttons.
- `backend/package.json` — `xlsx` (server-side Excel).

## Phase 3 — 2026-10-03
Sending, alerts, meetings, client portal, verification, sign-off, tickets.

### Added
- **3A** `services/pm/messages.ts`: message queue (`pm_messages`), scheduler every minute (time-based rules fire once, 3 attempts with back-off, atomic claims so two servers never send twice), event rules, recipients, in-app notifications with per-person channel preferences, daily digest, plan reminder. `routes/pm/messaging.ts`: Email & WhatsApp settings (SMTP password encrypted, never returned), **test mode on by default**, message log with resend. Bell in the top bar.
- **3B** `routes/pm/meetings.ts`, `services/pm/meetings.ts`: meetings and trainings, recurring series, invites by Email (with `.ics`) and WhatsApp, Yes / No / Maybe in the app and by link, reminders, attendance, minutes, action items → tasks, training report. Meetings appear in the Team Calendar.
- **3C** `routes/pm/portal.ts`, `services/pm/verification.ts`: client portal (Projects, Verifications, Tickets, Meetings, Documents) for client contacts given a login; task verification by portal, by email link and by WhatsApp buttons (first answer wins, links are random tokens, single-use, expiring); reminders; module and project sign-off (a concern becomes a ticket).
- **3D** `routes/pm/tickets.ts`, `services/pm/tickets.ts`: tickets with number, SLA from the priority in working hours, list and board, assign with history, internal notes vs replies, convert to / link a task, merge, SLA alerts, reopen window and rating for the client.
- Frontend: `MessageLogPage`, `Notifications` (bell, page, my settings, activity), `MeetingsPage`, `TicketsPage`, `PortalApp`, `PublicPages`, `setup/Messaging`.

### Existing files changed (and why)
- `backend/src/server.ts` — starts the PM message engine and the verification listeners.
- `backend/src/services/email.ts` — `sendEmail` accepts SMTP settings saved in the app and attachments; the env-based behaviour is unchanged.
- `backend/src/controllers/messagingController.ts` — the WhatsApp webhook also hands each event to Project Management (delivery receipts, button replies).
- `backend/src/controllers/authController.ts` — login returns `pmClient` and `photo`.
- `backend/src/middleware/auth.ts`, `backend/src/models/User.ts` — a portal user belongs to one client (`pmClient`, `req.clientId`).
- `backend/src/routes/index.ts` — mounts the token-link routes before the login check.
- `frontend/src/App.jsx` — portal and link routes; a client's user is always sent to the portal.
- `backend/package.json` — `nodemailer`.

### Not verified
- No real email or WhatsApp message was sent: SMTP is not configured and test mode has no test recipient yet. Delivery to a mail server and to WhatsApp (including the Approve / Reject buttons and the reply-with-reason step) is untested. Everything up to the queue is tested.

## Phase 2 — 2026-10-03
Projects, tasks, employee portal, daily plan, calendars.

### Added
- **2A** `services/pm/dateEngine.ts` with tests (`npm run pm:test`, 8 pass): TAT in hours / days / working days, dependency schedule, loop detection. `routes/pm/projects.ts`: 3-step project wizard with live dates, project copy of modules / tasks / checklists / dependencies / rules, list with progress and schedule status, reassignment with reason and history, bulk reassign, transfer all work, add module, save as template.
- **2B** `routes/pm/tasks.ts`, `services/pm/taskStatus.ts`: task list and detail, status flow, mandatory checklist and attachment, TAT pause, completion → dependents rescheduled, comments with @mentions and pasted images, attachments (limit, types, size; private folder `backend/pm-files`, served only through the API), ad-hoc tasks.
- **2C** `routes/pm/plans.ts`: daily plan for one date, several dates or a range, end-of-day update, copy yesterday; team calendar by person and by project, who is where today.
- **2D** `npm run pm:demo`: 3 clients, 6 projects (ahead, on track, delayed, completed), ad-hoc tasks, two weeks of plans — all tagged and removable.
- Frontend: `ProjectsPage`, `ProjectWizardPage`, `ProjectDetailPage` (Modules, Tasks, Board, Timeline, Calendar, Team, Files, Activity), `TaskDrawer`, `TaskViews`, `QuickTask`, `MyWorkPage`, `TasksPage`, `DailyPlanPage`, `TeamCalendarPage`, `ReassignDialog`.

### Existing files changed (and why)
- `frontend/src/api/client.js` — `http.blob()` for files that need the login.
- `.gitignore` — `backend/pm-files/`.

## Phase 1, Parts 1B–1D — 2026-10-03
Masters, product templates, clients, communication templates, auto-message rules.

### Added
- **1B** `routes/pm/setup.ts`: one generic master (project status, task status, priority, task type, work location, meeting type, ticket category / status / priority) with colour, drag order, flags; status flow; holidays; settings. `routes/pm/products.ts`: Product → Module → Task → Checklist builder, dependencies with loop check, duration preview, copy module / product, Excel import with a row-by-row error report. `routes/pm/clients.ts`: clients and contacts.
- **1C** `routes/pm/templates.ts`, `services/pm/keys.ts`, `services/pm/rules.ts`: templates with dynamic keys from one registry, preview, send test; auto-message rules on tasks, modules and products.
- Frontend: `PmSetupPage` and `setup/*`, `ProductBuilderPage`, `ClientsPage`, `TemplatesPage`, `RulesEditor`, `RichText`, `EmployeePicker`.

## Phase 1, Part 1A — 2026-10-03
Employees, roles & rights, team hierarchy.

### Added
- Rights: 15 Project Management modules (`pm_*`) in the existing rights list, five extra actions (assign, reassign, approve, export, configure) and a per-role data visibility (Own / Team / All).
- `backend/src/services/pm/visibility.ts` — `getVisibleEmployeeIds(req)`, `visibleFilter`, `pmRight(screen, action)`, `anyRight`, manager and team loop checks.
- `backend/src/routes/pm/index.ts` — `/api/pm/meta`, `/departments`, `/employees`, `/hierarchy`, `/employees/:id/photo`.
- `backend/src/models/pm/Department.ts` — department master (`pm_departments`).
- `backend/src/seed/pmSetup.ts` + `npm run pm:setup` — adds PM rights to administrator roles and creates the roles Implementation Manager, Project Manager, Team Lead, Employee, Client User. Adds only; `-- --dry` prints without writing.
- Frontend `frontend/src/knowvato-main/pm/`: `PmLayout.tsx`, `TeamHierarchyPage.tsx`, `PmSetupPage.tsx` (Departments), `shared.tsx`, `pm.css`.
- Sidebar entry "Project Management" below CRM, shown to users with any PM right.
- `hasRight(screen, action)` and `hasPm` on `useAuth()`; `pmApi` in `frontend/src/api/index.js`.

### Existing files changed (and why)
- `backend/src/models/User.ts` — PM modules and actions on the permission row; `dataVisibility` on the role; employee fields `code`, `department`, `reportingManager`, `joiningDate`, `photo`. All optional with defaults.
- `backend/src/models/Team.ts` — optional `parent` team.
- `backend/src/middleware/auth.ts` — `req.visibility`, `req.isClientUser`; `require_` accepts the new actions.
- `backend/src/routes/userAdmin.ts` — reads and validates the new employee fields (unique code, manager loop check), keeps the new actions when saving rights, audits role and manager changes with old/new value.
- `backend/src/routes/index.ts` — mounts `/pm`; team create/update accept `parent` (loop check) and write an audit entry.
- `backend/package.json` — `pm:setup` script.
- `frontend/src/knowvato-main/user-management/shared.tsx` — PM modules and actions in the rights matrix (extra actions only on PM rows).
- `frontend/src/knowvato-main/pages/RolesPage.tsx` — uses the shared module list; visibility selector; extra action columns.
- `frontend/src/knowvato-main/pages/UsersPage.tsx` — employee code, joining date, department, reporting manager, photo.
- `frontend/src/pages/Setup.jsx` — parent team on the team form; the edit form now pre-selects the team's members (they were not being read from the saved team).
- `frontend/src/context/AuthContext.jsx`, `frontend/src/api/index.js`, `frontend/src/App.jsx`, `frontend/src/components/BreadcrumbNav.jsx`, `frontend/src/knowvato-main/components/app-sidebar.tsx` — helper, API group, routes, breadcrumb, menu.

### How to test
1. `npm --prefix backend run pm:setup -- --dry`, then without `--dry`. Sign out and in again.
2. Sidebar → Project Management appears below CRM for the Administrator.
3. Project Management → Setup → Departments: add two departments; deleting one that has employees is refused.
4. Configuration → Users → edit a user: set code, department, joining date, reporting manager, photo. Setting a person's own report as their manager is refused.
5. Project Management → Team Hierarchy: tree matches the managers set; search highlights a person; clicking opens the profile (task numbers are 0 until Phase 2). At phone width it is an indented list.
6. Configuration → Roles: PM rows show nine actions; change "Project data visibility". Sign in as a Team Lead (Team) and an Employee (Own): Team Hierarchy shows only their own people.
7. CRM → Setup → Teams: set a parent team; a team cannot be placed under its own sub-team.
8. Configuration → Audit Logs: role, manager and team changes are listed.

### Not verified
- `pm:setup` has not been run on the online database, so the Team Hierarchy and Users screens were not exercised with PM rights. Backend type-check and frontend build pass; `/api/pm/*` respond and refuse users without rights.

## Phase 0 — 2026-10-03
### Added
- `PM_RULES.md`, `CLAUDE.md`
- `docs/pm/GAP_REPORT.md`, `docs/pm/CHANGELOG.md`, `docs/pm/DECISIONS.md`
### Existing files changed (and why)
- None.

## 2026-10-16 — Campaign recipient lists: Source + contact fields
- Recipient lists have a **Source** from the Setup Source master (set on import, change in the list view, Source column + filter in the Lists tab). New `GET /campaign-lists/sources` (blast view right); `PATCH /campaign-lists/:id` accepts `source`.
- Standard contact fields on every row: Name, Mobile Number, Email ID, Father Name/Mobile/Email, Mother Name/Mobile/Email, Location, City, State, Country, Address. Import auto-maps them from file headers; sample file includes them; **Add contact** form in the list view; Export Excel includes all; usable as template variables.
- List search also matches these fields.
- Files: `backend/src/models/CampaignPro.ts`, `backend/src/routes/campaigns.ts`, `frontend/src/api/index.js`, `frontend/src/pages/Campaigns.jsx`, `backend/src/tests/campaigns.api.test.mjs`.
- **New List (manual entry)** in Recipient Lists: list name + list source, enter contacts one by one ("Add another"), then Create list. "Add contact" in a list now has "Save & add another".
- Per-contact **Source** field (from the Source master) on manual entry, import mapping and sample file; imported rows with no Source column take the list's source.
- **New List** now only creates the list: List name, Source, **Owner** (active employees only — client users excluded). `POST /campaign-lists`, `GET /campaign-lists/owners`; `owner` on PATCH/import, owner filter + column.
- Recipients are added from the list row actions: **Upload recipients** (file) and **Add recipient** (manual form with Save & add another). Edit action changes name/source/owner. Send shows only when the list has recipients.
- Import is only inside a list now (row action + "Import recipients" in the list view); the top-level Import List button is removed. The campaign form's list picker offers New List instead of Import.

## 2026-10-18 — Follow-ups page: tabs + actions
- Follow-ups now in tabs with counts: Today, Upcoming, Overdue, Completed (+ search). Lead Status column.
- Row actions: Done (with optional next follow-up), Call, Communication (WhatsApp/SMS/Email slider), Update status (status, sub-status, lost reason), New follow-up, Reschedule, Cancel. Completed rows keep Communication / Status / New follow-up.
- Dialogs use the shared Modal. File: `frontend/src/pages/FollowUps.jsx`.

## 2026-10-18 — Button visibility fix (all pages)
- Global `.btn` teal fill (styles.css) no longer overrides outline / light / secondary / danger / link / icon-only (`btn border-0`, `icon-only-action`) buttons or buttons with their own inline background. Icon row actions are now ghost icons (grey, tinted on hover; delete turns red). Setup → Enquiry Forms rows also get a Preview action.
- Row icon actions (`btn border-0`) are now tinted, clearly visible buttons: teal icon on a light teal background; delete red on light red.
- Tables scroll sideways again: global `.table-responsive` had `overflow: hidden` (now `overflow-x: auto`). Action cells don't wrap; row icons are plain (no fill), danger icons red.
- Setup → Landing Pages table: Hero CTA and Highlights columns removed so it fits without scrolling; dates don't wrap (also in Forms tables).

## 2026-10-18 — Landing page builder cleanup
- Toolbar rebuilt (wraps, nothing cut off): Back, page name, Desktop/Tablet/Mobile + Undo/Redo segmented controls, HTML, JSON, Preview, Save. Canvas W/H moved to the Page panel only.
- Fixed-width side panels (Elements 248px, Properties 300px), canvas fills the rest; each pane scrolls on its own; builder fits the viewport.
- Element categories as chips, element tiles larger/readable; property tabs restyled; clicking empty canvas deselects.
- Block toolbar now sits inside the block (name, Duplicate, Delete; coordinates only while dragging); hover/selected use outlines (no layout shift).
- Custom HTML renders in a self-sizing iframe in the builder so its CSS/scripts work (no washed-out buttons / stuck animations).
- Shortcuts: Ctrl/Cmd+S save, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Y redo, Ctrl/Cmd+D duplicate, Delete remove, Esc deselect. Fixed a crash on Delete (`toast.show` didn't exist).
- Preset style drawer shows a live, scaled-down render of each section in that style (real look, not a generic mock); click a card to add it. Drawer widened to 340px. Old wireframe mockups removed.
- Main app menu folds away while the Landing Page wizard/editor, Registration Form editor or WhatsApp Template editor is open and comes back on save/exit (restored only if it was open before). `useSidebarOptional` added to ui/sidebar.tsx.

## 2026-10-18 — Grade sequence + edit
- Setup → Grades: Seq column, drag to reorder, Edit (name + sequence), delete. New grades go to the end.
- `GET /grades` now sorts by sequence (`order`, then created) so every screen using grades (fee heads, document types, registration/enquiry forms) follows it; `PUT /grades/reorder` saves a new order; `crud()` takes an optional `defaultSort`.

## 2026-10-18 — Fee Head slider + checkbox fix
- Setup → Fee Heads: Add/Edit opens as the right-side slider (shared Modal). Classes in a 2-column grid with ₹ amount per class (no scrolling for typical grade lists), 'All classes' checkbox, 'Same amount for all' + Apply (selects every class and sets the amount — previously only updated already-ticked classes and was disabled until one was ticked), class count + total, inline name error.
- Global CSS: checkboxes/radios no longer inherit the text-input min-height (were stretched into tall bars app-wide); checked colour = theme primary.
- Remaining Setup pop-ups (User Type, User, WhatsApp account, Team, Team Members, Document Type) converted from old centred Bootstrap modals to the theme right-side slider.

## 2026-10-18 — Implementation › Pre-requisites (client questionnaire)
- Setup gets an **Implementation** group with **Pre-requisites**: state badge (Not started / Opened / In progress / Submitted), progress (sections received of 13), per-section Received/Pending with a summary of what came in and when, Client URL (link is built on it, e.g. https://dps.knowvato.in/prerequisites/<token>), copy/open link, new link (old one stops working, answers kept), View answers (read-only), Reopen after submit, **Email link** slider (email template or default message, `{{link}}` `{{name}}` `{{institute}}`), sent-email log.
- Client form at `/prerequisites/:token` (no login): the supplied admission pre-requisite form, re-themed; every change autosaves, Save & Next marks the section received, the link resumes where they left, Final Submit (name + confirmation, pending sections listed) locks it read-only.
- Backend: `models/Prerequisite.ts` (one per tenant), `routes/prerequisites.ts` — admin `GET/PATCH /prerequisites`, `GET /prerequisites/data`, `POST /prerequisites/regenerate|reopen|send`; public `GET/PUT /public/prereq/:token`, `POST /public/prereq/:token/submit` (40-hex token, rate-limited, 2 MB cap, 409 after submit).
- Frontend: `public/prerequisite-form.html`, `pages/PrerequisitePages.jsx`, Setup category + breadcrumb, `prerequisitesApi`.
- Tests: `npm run prereq:api-test` (18 checks); headless-Chrome run of the full client + team flow (24 checks: save/resume/autosave/submit lock/reopen/email/read-only view/bad link/mobile width).

## 2026-10-18 — PM Planner
- Renamed to **Task Planner** (page title, sidebar, breadcrumbs).
- Fixed invisible text on the active view button (Tasks / Calendar) and teal unselected tabs: the app-wide `a { color }` rule is unlayered and beat pm.css; Planner tab/segment link colours now use !important.

## 2026-10-18 — Campaigns: multiple lists
- New Campaign → Recipients: pick **several imported lists or several lead lists** (searchable checklist, Select all, New List). Footer shows lists picked and the **unique** number count (shared numbers sent once).
- Backend: `Campaign.audienceRefs` (additive; `audienceRef` = first list for older readers). `resolveAudience` merges all lists and de-duplicates by last 10 digits. Label "A + B" / "A, B +n more" and re-labelled on list rename. List usage count, delete guard and rename cover lists used with others. `POST /campaigns/audience-preview` returns the unique count. Template variables can use columns from any picked list.
- Tests: campaigns API test 19/19 (3 new multi-list cases).

## 2026-10-18 — One slider width across the app
- Two widths only, as CSS tokens in styles.css: `--slider-w` 520px (all forms; was 640px, felt too wide) and `--slider-w-wide` 960px (full records / big tables / previews); phones get full screen.
- Shared components follow them: CRM `Modal` (size="wide"/"xl" → wide, everything else standard), Radix `SheetContent` (right side ignores width classes passed in; `size="wide"` opt-in), Bootstrap `.offcanvas-end`, RegistrationSlider, Roles permission drawer.
- Wide: lead detail, duplicate leads, Import leads, recipient-list contents, campaign report, form/page previews, user-type / user access rights, role permissions, PM task detail, ticket detail, template manager. Everything else (40+ sliders) is standard.
- Verified in headless Chrome on 16 sliders (Campaigns, Setup, Follow-ups, Leads, PM Planner/Tickets/Clients, phone).

## 2026-10-18 — Campaigns table, report, resend name
- Campaign table: Audience and Template columns removed (template + recipients shown under the name); Sent/Delivered/Read/Failed shown as small numbers under the Delivery bar → no horizontal scroll.
- Campaign report: one row of compact clickable tiles (Recipients / Read / Delivered / Sent / Failed / Not sent) replaces the big stat cards + duplicate filter chips; legend shows only non-zero parts; duplicate Resend button in the empty history removed.
- Resend asks for the **new campaign name** first (empty, required, inline error). Server: resend name required; campaign names unique per tenant (any case) on create, resend and rename (409).
- Campaigns API test 19/19.

## 2026-10-18 — All sliders one width
- `--slider-w-wide` now equals `--slider-w` (520px): every right slider in the app is the same width; tables inside scroll. Slider footers wrap. Recipient-list view header stacked (Name / Source + Owner / Search) and shows 2 extra columns. Checked in headless Chrome: list view, campaign report, lead detail, PM task detail, duplicates — all 520px, nothing overflowing.

## 2026-10-19 — Campaign failure reasons + bot builder
- **Failure reasons explained**: `services/waErrors.ts` decodes Meta errors (35+ codes: 131030 test-mode allowed list, 131026 undeliverable, 131047 24h window, 132001 template missing, 190 token expired, …) into a plain reason + how to fix. Campaign report: "Why messages failed" box (grouped, counts), Reason column shows reason + fix + code, Excel export adds reason / fix / code / raw. Delivery webhooks now keep Meta's code (`(#code) title — details`). Event Manager communication log shows the plain reason.
- **Bot builder**: Connect Sub-Bot lists every other chatbot (older bots had no clientId and were filtered out). Palette 210px with icons and readable names, filler text removed; top bar uses theme buttons (Blocks / Phone preview toggle, Meta API, Publish); block panel header with close + delete, slider width token.
