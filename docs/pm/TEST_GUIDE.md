# Project Management — Test Guide

Simple step-by-step checks. Use the demo data (`npm --prefix backend run pm:demo`); remove it with `npm --prefix backend run pm:demo -- --remove`.

Automatic checks:
- `npm --prefix backend run pm:test` — date engine (8 tests).
- `PM_TEST_ADMIN=… PM_TEST_PASSWORD=… [PM_TEST_NO_RIGHTS=…] python3 backend/scripts/pm_e2e.py` — API rules, limits and forbidden access.

## Phase 1 — Setup
1. **Rights.** Configuration → Roles: open *Employee*. PM rows show nine actions; "Project data visibility" is Own. Sign in as an Employee, a Team Lead and the Administrator: Team Hierarchy shows one person, the team, everyone.
2. **Hierarchy.** Configuration → Users: set reporting managers. Setting someone's own report as their manager is refused. Team Hierarchy shows the tree; search highlights a person; a click opens the profile.
3. **Masters.** PM → Setup → Task Status: add one, drag it, change colour and flags. Deleting a Task Type used by a task template is refused.
4. **Product.** Setup → Products → School ERP: add a task, set a dependency, tick the checklist tab. Make task A depend on a task that depends on A → refused, the loop is named. "Template" downloads the Excel sheet; a sheet with a wrong priority reports the row.
5. **Templates.** PM → Templates → Task Assigned: click a key to insert it, Preview shows real-looking values.
6. **Rules.** In a task template → Auto Messages: add "On task completion → Email → Task Completed → Client primary contact" and a second rule for the internal team.

## Phase 2 — Projects and tasks
1. **Create.** Projects → New project: client, product, incharge → Modules step shows dates; change a TAT and the dates move; untick a task; add a task → Review → Create.
2. **List.** Projects shows progress, Ahead / On Track / Delayed, overdue count; filters and Export Excel work.
3. **Task.** Open a task: tick the checklist (saved at once); Completed is refused until the mandatory items are ticked; paste a screenshot into the comment; attach 3 files, the 4th is refused.
4. **Dependency.** Complete a task late (or early): open a task that depends on it — its due date moved, and History shows it.
5. **Reassign.** Reassign a task: the reason is required; Activity shows from → to. Projects → Transfer work shows the counts before confirming.
6. **Ad-hoc.** "+ Task" without a project: it shows in My Work and in Tasks (type Ad-hoc).
7. **Daily plan.** Daily Plan → Plan My Day → "Date range" + Onsite → save. Team Calendar shows it per person per day; "By project" turns it around.
8. **Phone.** At 375px: My Work, the task drawer (status control at the bottom), Plan My Day, Team Calendar (Day view is a list).

## Phase 3 — Communication, portal, tickets
First: PM → Setup → Email & WhatsApp. Enter SMTP, a test email and a test WhatsApp number, keep **Test mode on**, "Send test" for both.
1. **Auto messages.** Complete a task with the rules from Phase 1: Message Log shows the client email and the team email (sent to the test address, "meant for …").
2. **Reminder / overdue.** A task with a "Before due date" rule and a due date inside the offset: within a minute the message is queued, once.
3. **Alerts.** Assign a task to another user; they see the bell count. Notifications → My settings: tick Email for "Task assigned to me".
4. **Meeting.** Meetings → New: two employees → the invite email carries `invite.ics`; the link in it answers Yes / No / Maybe; after the start time, mark attendance, write minutes, add an action item → Make task.
5. **Verification.** A task with "Client verification": move it to *Waiting for Client*. The client email has Approve / Reject; Approve completes the task; a second click says it was already answered. Reject asks for a comment and sends the task back to In Progress.
6. **Portal.** Clients → edit → a contact with Portal access → Create login. Sign in as the contact: only their projects; no internal comments, files or people's workload.
7. **Sign-off.** A module with all tasks completed → Request sign-off → the link → Accept. The module shows "Signed off". "Raise concern" creates a ticket.
8. **Ticket.** In the portal raise a ticket with a pasted screenshot → internally: assign, add an internal note (the client never sees it), reply, Make task, close → the client rates it and may reopen within the reopen days.
9. **Security.** As the client user call `/api/pm/projects` → 403. A used or expired link → refused. The SMTP password is not in any response.

## Phase 4 — Dashboards and reports
1. **Dashboard.** Tiles match the lists they open (Delayed → Projects filtered to Delayed).
2. **Project overview.** Planned vs actual curve, critical path, overdue list.
3. **Person.** Team Hierarchy → a person → Performance; an employee opens My Work → My performance.
4. **Reports.** "Projects On Time per Person" for the year; "Reassignments"; Export Excel → the file has the title, filters and exported-by on top. Save view → it appears as a chip.
5. **Power.** Ctrl+K finds a task by number; `N` adds a task; Tasks → select several → Change (status / due / priority / labels); Recurring → a weekly task appears on its date; the star on a project pins it to the sidebar.
6. **Existing app.** Open CRM (Leads, Follow-ups, Conversations, Campaigns, Setup → Teams), Event Manager, Configuration → Users / Roles: all work as before.
