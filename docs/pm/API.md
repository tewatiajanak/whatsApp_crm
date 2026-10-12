# Project Management — API

All routes are under `/api/pm` and need `Authorization: Bearer <token>`, except the token links under `/api/pm-public`.
Responses are `{ ok, data }` (lists: `{ ok, data, page, perPage, total, pages }`); errors are `{ ok: false, error }`.

Every route checks, on the server: the login, the right for the action (`pm_<screen>.<action>` of the existing rights system), and the data the user may see (Own / Team / All — `backend/src/services/pm/visibility.ts`). Client users are refused on every internal route and reach only `/api/pm/portal/*`, where every query is limited to their own client.

Generated from the route files; the file name is the first column.


## clients.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/clients` | pm_clients.view |
| GET | `/api/pm/clients/:id` | pm_clients.view |
| POST | `/api/pm/clients` | pm_clients.create |
| PATCH | `/api/pm/clients/:id` | pm_clients.edit |
| DELETE | `/api/pm/clients/:id` | pm_clients.del |

## dashboard.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/dashboard` | pm_dashboard.view |
| GET | `/api/pm/projects/:id/overview` | pm_projects.view |
| GET | `/api/pm/people/:id/performance` | any of pm_team.view, pm_my_tasks.view, pm_dashboard.view) |

## index.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/meta` | signed in |
| GET | `/api/pm/departments` | any of pm_setup.view, pm_team.view, setup.view) |
| POST | `/api/pm/departments` | pm_setup.create |
| PATCH | `/api/pm/departments/:id` | pm_setup.edit |
| DELETE | `/api/pm/departments/:id` | pm_setup.del |
| GET | `/api/pm/employees` | any of ...PM_MODULES.map((m) => [m |
| GET | `/api/pm/hierarchy` | pm_team.view |
| POST | `/api/pm/employees/:id/photo` | signed in |
| DELETE | `/api/pm/employees/:id/photo` | signed in |

## meetings.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/meetings` | pm_meetings.view |
| GET | `/api/pm/meetings/:id` | pm_meetings.view |
| POST | `/api/pm/meetings` | pm_meetings.create |
| PATCH | `/api/pm/meetings/:id` | pm_meetings.view |
| POST | `/api/pm/meetings/:id/cancel` | pm_meetings.view |
| DELETE | `/api/pm/meetings/:id` | pm_meetings.del |
| POST | `/api/pm/meetings/:id/respond` | pm_meetings.view |
| PUT | `/api/pm/meetings/:id/minutes` | pm_meetings.view |
| POST | `/api/pm/meetings/:id/actions/:actionId/task` | pm_meetings.view |
| GET | `/api/pm/meetings-report/training` | pm_meetings.view |

## messaging.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/mail-settings` | pm_setup.view |
| PUT | `/api/pm/mail-settings` | pm_setup.configure |
| POST | `/api/pm/mail-settings/test-email` | pm_setup.configure |
| POST | `/api/pm/mail-settings/test-whatsapp` | pm_setup.configure |
| GET | `/api/pm/messages` | any of pm_notification_rules.view, pm_reports.view, pm_setup.view, pm_ |
| POST | `/api/pm/messages/:id/resend` | message log: view |
| POST | `/api/pm/messages/send-now` | message log: view |
| GET | `/api/pm/notifications` | signed in |
| POST | `/api/pm/notifications/read-all` | signed in |
| POST | `/api/pm/notifications/:id/read` | signed in |
| GET | `/api/pm/notify-prefs` | signed in |
| PUT | `/api/pm/notify-prefs` | signed in |

## plans.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/plans` | pm_daily_plan.view |
| PUT | `/api/pm/plans` | pm_daily_plan.create |
| PATCH | `/api/pm/plans/:id/entries/:entryId` | pm_daily_plan.edit |
| POST | `/api/pm/plans/copy` | pm_daily_plan.create |
| DELETE | `/api/pm/plans/:id` | pm_daily_plan.edit |
| GET | `/api/pm/team-calendar` | pm_team_calendar.view |

## portal.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/portal-users` | pm_portal_users.view |
| POST | `/api/pm/clients/:id/contacts/:contactId/portal-user` | pm_portal_users.create |
| PATCH | `/api/pm/portal-users/:id` | pm_portal_users.edit |
| GET | `/api/pm/tasks/:id/verifications` | signed in |
| POST | `/api/pm/tasks/:id/verifications` | signed in |
| GET | `/api/pm/projects/:id/signoffs` | pm_projects.view |
| POST | `/api/pm/projects/:id/signoffs` | pm_projects.approve |
| GET | `/api/pm/portal/home` | client portal user |
| GET | `/api/pm/portal/projects/:id` | client portal user |
| GET | `/api/pm/portal/verifications` | client portal user |
| POST | `/api/pm/portal/verifications/:id` | client portal user |
| GET | `/api/pm/portal/documents` | client portal user |
| GET | `/api/pm/portal/files/:taskId/:attId` | client portal user |
| POST | `/api/pm/portal/signoffs/:id` | client portal user |
| GET | `/api/pm/portal/meetings` | client portal user |
| GET | `/api/pm/portal/ticket-options` | client portal user |
| GET | `/api/pm/portal/tickets` | client portal user |
| GET | `/api/pm/portal/tickets/:id` | client portal user |
| POST | `/api/pm/portal/tickets` | client portal user |
| POST | `/api/pm/portal/tickets/:id/replies` | client portal user |
| POST | `/api/pm/portal/tickets/:id/reopen` | client portal user |
| POST | `/api/pm/portal/tickets/:id/rating` | client portal user |
| POST | `/api/pm/portal/tickets/:id/files` | client portal user |
| GET | `/api/pm/portal/tickets/:id/files/:fileId` | client portal user |
| GET | `/api/pm/portal/tasks/:id/comments` | client portal user |

## power.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/search` | any PM screen |
| POST | `/api/pm/tasks/bulk` | pm_tasks.edit |
| GET | `/api/pm/labels` | any PM screen |
| POST | `/api/pm/tasks/:id/watch` | any PM screen |
| POST | `/api/pm/tasks/:id/checklist/:itemId/to-task` | any of pm_tasks.create, pm_my_tasks.create) |
| GET | `/api/pm/tasks/:id/time` | any PM screen |
| POST | `/api/pm/tasks/:id/time` | any PM screen |
| DELETE | `/api/pm/time/:id` | any PM screen |
| GET | `/api/pm/timesheet` | any of pm_reports.view, pm_my_tasks.view, pm_team_calendar.view) |
| GET | `/api/pm/people/:id/load` | any PM screen |
| GET | `/api/pm/activity` | any PM screen |
| GET | `/api/pm/recurring` | pm_tasks.view |
| POST | `/api/pm/recurring` | pm_tasks.create |
| PATCH | `/api/pm/recurring/:id` | pm_tasks.edit |
| DELETE | `/api/pm/recurring/:id` | pm_tasks.del |

## products.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/products` | setup / projects / templates: view |
| POST | `/api/pm/products` | pm_setup.create |
| PATCH | `/api/pm/products/:id` | pm_setup.edit |
| DELETE | `/api/pm/products/:id` | pm_setup.del |
| GET | `/api/pm/products/:id/full` | setup / projects / templates: view |
| POST | `/api/pm/products/:id/modules` | pm_setup.create |
| PUT | `/api/pm/products/:id/modules/order` | pm_setup.edit |
| PATCH | `/api/pm/modules/:id` | pm_setup.edit |
| DELETE | `/api/pm/modules/:id` | pm_setup.del |
| POST | `/api/pm/products/:id/tasks` | pm_setup.create |
| PUT | `/api/pm/modules/:id/tasks/order` | pm_setup.edit |
| PATCH | `/api/pm/task-templates/:id` | pm_setup.edit |
| DELETE | `/api/pm/task-templates/:id` | pm_setup.del |
| POST | `/api/pm/modules/:id/copy` | pm_setup.create |
| POST | `/api/pm/products/:id/copy` | pm_setup.create |
| POST | `/api/pm/products/:id/import` | pm_setup.create |

## projects.ts

| Method | Path | Right |
|---|---|---|
| POST | `/api/pm/projects/preview` | pm_projects.create |
| POST | `/api/pm/projects` | pm_projects.create |
| GET | `/api/pm/projects` | pm_projects.view |
| GET | `/api/pm/projects/:id` | pm_projects.view |
| PATCH | `/api/pm/projects/:id` | pm_projects.edit |
| DELETE | `/api/pm/projects/:id` | pm_projects.del |
| POST | `/api/pm/projects/:id/modules` | pm_projects.edit |
| POST | `/api/pm/projects/:id/save-as-template` | pm_setup.create |
| POST | `/api/pm/projects/:id/reassign` | pm_projects.reassign |
| POST | `/api/pm/project-modules/:id/reassign` | pm_projects.reassign |
| POST | `/api/pm/tasks/bulk-reassign` | pm_tasks.reassign |
| POST | `/api/pm/transfer` | pm_tasks.reassign |
| GET | `/api/pm/projects/:id/team` | pm_projects.view |
| GET | `/api/pm/projects/:id/files` | pm_projects.view |
| GET | `/api/pm/projects/:id/activity` | pm_projects.view |

## public.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm-public/meeting/:token` | no login (token link) |
| POST | `/api/pm-public/meeting/:token` | no login (token link) |
| GET | `/api/pm-public/verify/:token` | no login (token link) |
| POST | `/api/pm-public/verify/:token` | no login (token link) |
| GET | `/api/pm-public/signoff/:token` | no login (token link) |
| POST | `/api/pm-public/signoff/:token` | no login (token link) |

## reports.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/reports` | pm_reports.view |
| GET | `/api/pm/reports/:key` | pm_reports.view |
| GET | `/api/pm/reports/:key/export` | pm_reports.export |
| GET | `/api/pm/views` | signed in |
| POST | `/api/pm/views` | signed in |
| DELETE | `/api/pm/views/:id` | signed in |

## setup.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/master-types` | any PM screen |
| GET | `/api/pm/masters` | any PM screen |
| GET | `/api/pm/masters/:type` | any PM screen |
| POST | `/api/pm/masters/:type` | pm_setup.create |
| PUT | `/api/pm/masters/:type/order` | pm_setup.edit |
| PATCH | `/api/pm/masters/:type/:id` | pm_setup.edit |
| DELETE | `/api/pm/masters/:type/:id` | pm_setup.del |
| GET | `/api/pm/holidays` | any PM screen |
| POST | `/api/pm/holidays` | pm_setup.create |
| PATCH | `/api/pm/holidays/:id` | pm_setup.edit |
| DELETE | `/api/pm/holidays/:id` | pm_setup.del |
| GET | `/api/pm/settings` | any PM screen |
| PUT | `/api/pm/settings` | pm_setup.configure |

## tasks.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/tasks` | tasks or my tasks: view |
| GET | `/api/pm/my-work` | any of pm_my_tasks.view, pm_tasks.view) |
| GET | `/api/pm/tasks/:id` | tasks or my tasks: view |
| POST | `/api/pm/tasks` | tasks or my tasks: create |
| PATCH | `/api/pm/tasks/:id` | tasks or my tasks: view |
| POST | `/api/pm/tasks/:id/reassign` | any of pm_tasks.reassign, pm_tasks.assign) |
| POST | `/api/pm/tasks/:id/status` | tasks or my tasks: view |
| POST | `/api/pm/tasks/:id/checklist/:itemId` | tasks or my tasks: view |
| POST | `/api/pm/tasks/:id/comments` | tasks or my tasks: view |
| DELETE | `/api/pm/comments/:id` | tasks or my tasks: view |
| POST | `/api/pm/tasks/:id/attachments` | tasks or my tasks: view |
| GET | `/api/pm/tasks/:id/attachments/:attId` | tasks or my tasks: view |
| PATCH | `/api/pm/tasks/:id/attachments/:attId` | tasks or my tasks: view |
| DELETE | `/api/pm/tasks/:id/attachments/:attId` | tasks or my tasks: view |
| DELETE | `/api/pm/tasks/:id` | tasks or my tasks: view |

## templates.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/template-meta` | setup / projects / templates: view |
| GET | `/api/pm/templates` | setup / projects / templates: view |
| POST | `/api/pm/templates` | pm_templates.create |
| PATCH | `/api/pm/templates/:id` | pm_templates.edit |
| DELETE | `/api/pm/templates/:id` | pm_templates.del |
| POST | `/api/pm/templates/preview` | setup / projects / templates: view |
| POST | `/api/pm/templates/:id/test` | pm_templates.edit |

## tickets.ts

| Method | Path | Right |
|---|---|---|
| GET | `/api/pm/tickets` | pm_tickets.view |
| GET | `/api/pm/tickets/:id` | pm_tickets.view |
| POST | `/api/pm/tickets` | pm_tickets.create |
| PATCH | `/api/pm/tickets/:id` | pm_tickets.edit |
| POST | `/api/pm/tickets/:id/assign` | pm_tickets.assign |
| POST | `/api/pm/tickets/:id/replies` | pm_tickets.edit |
| POST | `/api/pm/tickets/:id/task` | pm_tickets.edit |
| POST | `/api/pm/tickets/:id/merge` | pm_tickets.edit |
| DELETE | `/api/pm/tickets/:id` | pm_tickets.del |
| POST | `/api/pm/tickets/:id/files` | pm_tickets.edit |
| GET | `/api/pm/tickets/:id/files/:fileId` | pm_tickets.view |

## Existing routes that were extended

- `POST/PATCH /api/users` accept `code`, `department`, `reportingManager`, `joiningDate`.
- `POST/PATCH /api/usertypes` accept `dataVisibility` (`own` / `team` / `all`) and the actions `assign`, `reassign`, `approve`, `export`, `configure` on permission rows.
- `POST/PATCH /api/teams` accept `parent`.
- `POST /api/auth/login` returns `pmClient` and `photo` on the user.
- `POST /webhooks/whatsapp/:tenantId` also passes delivery receipts and button replies to Project Management.
