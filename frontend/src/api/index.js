import { http } from "./client";

// Export http client for direct use
export { http };

// Helper to turn a params object into a query string
const qs = (params = {}) => {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return usable.length ? "?" + new URLSearchParams(usable).toString() : "";
};

export const authApi = {
  login: (email, password) => http.post("/auth/login", { email, password }),
  me: () => http.get("/auth/me"),
  verifyOtp: (challenge, code) => http.post("/auth/verify-otp", { challenge, code }),
  changePassword: (currentPassword, newPassword) => http.post("/auth/change-password", { currentPassword, newPassword }),
};

export const systemApi = {
  status: () => http.get("/system/status"),
};

export const leadsApi = {
  list: (params) => http.get("/leads" + qs(params)),
  get: (id) => http.get(`/leads/${id}`),
  create: (body) => http.post("/leads", body),
  update: (id, body) => http.patch(`/leads/${id}`, body),
  remove: (id) => http.del(`/leads/${id}`),
  convert: (body) => http.post("/leads/convert", body),
  setStatus: (id, statusId, subStatusId, lostReason) => http.post(`/leads/${id}/status`, { statusId, subStatusId, lostReason }),
  addNote: (id, text) => http.post(`/leads/${id}/notes`, { text }),
  logCall: (id, body) => http.post(`/leads/${id}/calls`, body),
  timeline: (id) => http.get(`/leads/${id}/timeline`),
  followUps: (id) => http.get(`/leads/${id}/followups`),
  // filters, pipeline, analytics
  meta: () => http.get("/leads/meta"),
  viewCounts: () => http.get("/leads/view-counts"),
  board: (params) => http.get("/leads/board" + qs(params)),
  analytics: (params) => http.get("/leads/analytics" + qs(params)),
  checkDuplicate: (phone, exclude) => http.get("/leads/check-duplicate" + qs({ phone, exclude })),
  // bulk tools
  bulk: (body) => http.post("/leads/bulk", body),
  importRows: (body) => http.post("/leads/import", body),
  exportCsv: (params) => http.blob("/leads/export" + qs(params)),
  duplicates: () => http.get("/leads/duplicates"),
  merge: (primaryId, duplicateIds) => http.post("/leads/merge", { primaryId, duplicateIds }),
  // multi-service tracks
  addService: (id, serviceId, owner) => http.post(`/leads/${id}/services`, { serviceId, owner }),
  setServiceStatus: (id, serviceId, statusId, subStatusId) => http.post(`/leads/${id}/services/status`, { serviceId, statusId, subStatusId }),
  removeService: (id, serviceId) => http.del(`/leads/${id}/services/${serviceId}`),
  addFollowUp: (id, body) => http.post(`/leads/${id}/followups`, body),
  getServiceStatuses: (id, serviceId) => http.get(`/leads/${id}/service/${serviceId}/statuses`),
};

/* ---- Lead CRM extras: settings, automation, documents, fees, calling, targets, capture keys, applications ---- */
export const crmApi = {
  settings: () => http.get("/crm/settings"),
  saveSettings: (b) => http.put("/crm/settings", b),
  testSms: (b) => http.post("/crm/settings/test-sms", b),
  sendReport: () => http.post("/crm/settings/send-report", {}),
  automationMeta: () => http.get("/crm/automation/meta"),
  automationRuns: (params) => http.get("/crm/automation/runs" + qs(params)),
  documents: (leadId) => http.get(`/leads/${leadId}/documents`),
  uploadDocument: (leadId, file, category) => {
    const fd = new FormData();
    fd.append("category", category || "");
    fd.append("file", file);
    return http.postForm(`/leads/${leadId}/documents`, fd);
  },
  documentFile: (leadId, docId) => http.blob(`/leads/${leadId}/documents/${docId}/file`),
  removeDocument: (leadId, docId) => http.del(`/leads/${leadId}/documents/${docId}`),
  fees: (leadId) => http.get(`/leads/${leadId}/fees`),
  addFee: (leadId, b) => http.post(`/leads/${leadId}/fees`, b),
  payFee: (feeId, b) => http.post(`/lead-fees/${feeId}/pay`, b),
  cancelFee: (feeId) => http.post(`/lead-fees/${feeId}/cancel`, {}),
  call: (leadId) => http.post(`/leads/${leadId}/call`, {}),
  targets: (month) => http.get("/crm/targets" + qs({ month })),
  saveTargets: (month, rows) => http.put("/crm/targets", { month, rows }),
  apiKeys: () => http.get("/crm/api-keys"),
  createApiKey: (b) => http.post("/crm/api-keys", b),
  updateApiKey: (id, b) => http.patch(`/crm/api-keys/${id}`, b),
  removeApiKey: (id) => http.del(`/crm/api-keys/${id}`),
  applications: (params) => http.get("/crm/applications" + qs(params)),
  setApplicationStage: (id, stage, note) => http.patch(`/crm/applications/${id}`, { stage, note }),
  makeOffer: (id, b) => http.post(`/crm/applications/${id}/offer`, b),
  application: (id) => http.get(`/crm/applications/${id}`),
  applicationTemplates: () => http.get("/crm/applications/templates"),
  customFields: () => http.get("/custom-fields?module=crm&perPage=200"),
  createCustomField: (b) => http.post("/custom-fields", { ...b, module: "crm" }),
  updateCustomField: (id, b) => http.patch(`/custom-fields/${id}`, b),
  removeCustomField: (id) => http.del(`/custom-fields/${id}`),
  testInbox: () => http.post("/crm/settings/test-inbox", {}),
  googleConnect: () => http.get("/crm/google/connect"),
  googleDisconnect: () => http.post("/crm/google/disconnect", {}),
  setBranches: (userId, branches) => http.put(`/crm/availability/${userId}`, { branches }),
  applicantCode: (phone) => http.post("/public/applicant/code", { phone }),
  applicantVerify: (phone, code) => http.post("/public/applicant/verify", { phone, code }),
  // custom activity types and the activity register
  activityTypes: () => http.get("/crm/activity-types"),
  createActivityType: (b) => http.post("/crm/activity-types", b),
  updateActivityType: (id, b) => http.patch(`/crm/activity-types/${id}`, b),
  removeActivityType: (id) => http.del(`/crm/activity-types/${id}`),
  logActivity: (leadId, b) => http.post(`/leads/${leadId}/activities`, b),
  activities: (params) => http.get("/crm/activities" + qs(params)),
  // query desk
  queryMeta: () => http.get("/crm/queries/meta"),
  queries: (params) => http.get("/crm/queries" + qs(params)),
  query: (id) => http.get(`/crm/queries/${id}`),
  createQuery: (b) => http.post("/crm/queries", b),
  updateQuery: (id, b) => http.patch(`/crm/queries/${id}`, b),
  replyQuery: (id, b) => http.post(`/crm/queries/${id}/messages`, b),
  removeQuery: (id) => http.del(`/crm/queries/${id}`),
  leadQueries: (leadId) => http.get(`/leads/${leadId}/queries`),
  // lead lists
  lists: () => http.get("/crm/lists"),
  list: (id, params) => http.get(`/crm/lists/${id}` + qs(params)),
  createList: (b) => http.post("/crm/lists", b),
  updateList: (id, b) => http.patch(`/crm/lists/${id}`, b),
  listMembers: (id, b) => http.post(`/crm/lists/${id}/members`, b),
  removeList: (id) => http.del(`/crm/lists/${id}`),
  leadLists: (leadId) => http.get(`/leads/${leadId}/lists`),
  // lead scoring
  scoring: () => http.get("/crm/scoring"),
  rescore: () => http.post("/crm/scoring/recalculate", {}),
  // recycle bin
  trash: () => http.get("/crm/trash"),
  restoreLead: (id) => http.post(`/crm/trash/${id}/restore`, {}),
  purgeLead: (id) => http.del(`/crm/trash/${id}`),
  // masters
  master: (kind) => http.get(`/crm/${kind}`),
  createMaster: (kind, b) => http.post(`/crm/${kind}`, b),
  updateMaster: (kind, id, b) => http.patch(`/crm/${kind}/${id}`, b),
  removeMaster: (kind, id) => http.del(`/crm/${kind}/${id}`),
  courseSeats: () => http.get("/crm/course-seats"),
  // spend per source, approvals
  spend: (month) => http.get("/crm/spend" + qs({ month })),
  saveSpend: (month, rows) => http.put("/crm/spend", { month, rows }),
  approvals: (status, params = {}) => http.get("/crm/approvals" + qs({ status, ...params })),
  decideApproval: (id, approve, note) => http.post(`/crm/approvals/${id}/decide`, { approve, note }),
  bulkDecide: (ids, approve, note) => http.post("/crm/approvals/bulk", { ids, approve, note }),
  cancelApproval: (id) => http.post(`/crm/approvals/${id}/cancel`, {}),
  approvalRules: () => http.get("/crm/approvals/rules"),
  saveApprovalRules: (b) => http.put("/crm/approvals/rules", b),
  requestRefund: (feeId, amount, reason) => http.post(`/lead-fees/${feeId}/refund-request`, { amount, reason }),
  requestQuoteApproval: (quoteId, reason) => http.post(`/crm/quotes/${quoteId}/request-approval`, { reason }),
  // fees: part payment, refund, plan, concession
  refundFee: (feeId, b) => http.post(`/lead-fees/${feeId}/refund`, b),
  feePlan: (leadId, b) => http.post(`/leads/${leadId}/fee-plan`, b),
  requestDiscount: (feeId, b) => http.post(`/lead-fees/${feeId}/discount-request`, b),
  // messaging, chat, insight
  bulkMessage: (b) => http.post("/leads/bulk-message", b),
  conversation: (leadId) => http.get(`/leads/${leadId}/conversation`),
  webActivity: (leadId) => http.get(`/leads/${leadId}/web-activity`),
  brief: (leadId, ai) => http.get(`/leads/${leadId}/brief` + qs({ ai: ai ? 1 : "" })),
  leadApplications: (leadId) => http.get(`/leads/${leadId}/applications`),
  // reports, calendar, availability, push
  report: (params) => http.get("/leads/report" + qs(params)),
  reportCsv: (params) => http.blob("/leads/report" + qs({ ...params, format: "csv" })),
  calendar: (params) => http.get("/followups/calendar" + qs(params)),
  myLinks: () => http.get("/crm/my-links"),
  setAway: (away) => http.post("/crm/me/away", { away }),
  availability: () => http.get("/crm/availability"),
  setAvailability: (userId, away) => http.put(`/crm/availability/${userId}`, { away }),
  pushKey: () => http.get("/crm/push/key"),
  pushSubscribe: (subscription) => http.post("/crm/push/subscribe", { subscription }),
  pushUnsubscribe: (endpoint) => http.post("/crm/push/unsubscribe", { endpoint }),
  // pages opened from a link, without a login
  publicPartner: (token) => http.get(`/public/partner/${token}`),
  publicBooking: (token) => http.get(`/public/book/${token}`),
  book: (token, b) => http.post(`/public/book/${token}`, b),
  uploadApplicantDocument: (token, file, category) => {
    const fd = new FormData();
    fd.append("category", category || "");
    fd.append("file", file);
    return http.postForm(`/public/application/${token}/documents`, fd);
  },
  publicFee: (token) => http.get(`/public/pay/${token}`),
  startFeePayment: (token) => http.post(`/public/pay/${token}/start`, {}),
  publicApplication: (token) => http.get(`/public/application/${token}`),
  answerOffer: (token, response, signedBy) => http.post(`/public/application/${token}/offer`, { response, signedBy }),
};

export const servicesApi = {
  list: () => http.get("/services"),
  create: (b) => http.post("/services", b),
  update: (id, b) => http.patch(`/services/${id}`, b),
  remove: (id) => http.del(`/services/${id}`),
};

export const followUpsApi = {
  buckets: (params) => http.get("/followups/buckets" + qs(typeof params === "string" ? { owner: params } : params)),
  list: (params) => http.get("/followups" + qs(params)),
  create: (body) => http.post("/followups", body),
  complete: (id, body) => http.post(`/followups/${id}/complete`, typeof body === "string" ? { outcome: body } : body || {}),
  reschedule: (id, body) => http.post(`/followups/${id}/reschedule`, typeof body === "string" ? { due: body } : body),
  remove: (id) => http.del(`/followups/${id}`),
  getWorkload: (counsellor) => http.get("/followups/workload" + qs({ counsellor })),
};

export const contactsApi = {
  list: (params) => http.get("/contacts" + qs(params)),
  get: (id) => http.get(`/contacts/${id}`),
  create: (body) => http.post("/contacts", body),
  update: (id, body) => http.patch(`/contacts/${id}`, body),
  remove: (id) => http.del(`/contacts/${id}`),
};

export const mastersApi = {
  statuses: () => http.get("/masters/statuses"),
  createStatus: (b) => http.post("/masters/statuses", b),
  updateStatus: (id, b) => http.patch(`/masters/statuses/${id}`, b),
  removeStatus: (id) => http.del(`/masters/statuses/${id}`),
  subStatuses: () => http.get("/masters/substatuses"),
  createSubStatus: (b) => http.post("/masters/substatuses", b),
  removeSubStatus: (id) => http.del(`/masters/substatuses/${id}`),
  sources: () => http.get("/masters/sources"),
  createSource: (b) => http.post("/masters/sources", b),
  removeSource: (id) => http.del(`/masters/sources/${id}`),
};

export const usersApi = {
  userTypes: () => http.get("/usertypes"),
  createUserType: (b) => http.post("/usertypes", b),
  updateUserType: (id, b) => http.patch(`/usertypes/${id}`, b),
  removeUserType: (id) => http.del(`/usertypes/${id}`),
  users: () => http.get("/users"),
  createUser: (b) => http.post("/users", b),
  updateUser: (id, b) => http.patch(`/users/${id}`, b),
  removeUser: (id) => http.del(`/users/${id}`),
  setUserPermissions: (id, overrides) => http.put(`/users/${id}/permissions`, { overrides }),
  resetPassword: (id) => http.post(`/users/${id}/reset-password`, {}),
  meta: () => http.get("/user-admin/meta"),
  // "User Type" = whose user this is (own team / client)
  categories: () => http.get("/user-categories"),
  createCategory: (b) => http.post("/user-categories", b),
  updateCategory: (id, b) => http.patch(`/user-categories/${id}`, b),
  removeCategory: (id) => http.del(`/user-categories/${id}`),
  passwordPolicy: () => http.get("/password-policy"),
  savePasswordPolicy: (kind, b) => http.put(`/password-policy/${kind}`, b),
};

/* ---- Project Management ---- */
export const pmApi = {
  meta: () => http.get("/pm/meta"),
  departments: () => http.get("/pm/departments"),
  employees: (activeOnly) => http.get(`/pm/employees${activeOnly ? "?active=1" : ""}`),
  hierarchy: () => http.get("/pm/hierarchy"),
  uploadPhoto: (id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.postForm(`/pm/employees/${id}/photo`, fd);
  },
  removePhoto: (id) => http.del(`/pm/employees/${id}/photo`),

  // setup: masters, holidays, settings
  masterTypes: () => http.get("/pm/master-types"),
  masters: () => http.get("/pm/masters"),
  masterList: (type) => http.get(`/pm/masters/${type}`),
  createMaster: (type, b) => http.post(`/pm/masters/${type}`, b),
  updateMaster: (type, id, b) => http.patch(`/pm/masters/${type}/${id}`, b),
  removeMaster: (type, id) => http.del(`/pm/masters/${type}/${id}`),
  orderMasters: (type, ids) => http.put(`/pm/masters/${type}/order`, { ids }),
  holidays: (year) => http.get(`/pm/holidays${year ? `?year=${year}` : ""}`),
  createHoliday: (b) => http.post("/pm/holidays", b),
  importHolidays: (rows) => http.post("/pm/holidays/import", { rows }),
  updateHoliday: (id, b) => http.patch(`/pm/holidays/${id}`, b),
  removeHoliday: (id) => http.del(`/pm/holidays/${id}`),
  settings: () => http.get("/pm/settings"),
  saveSettings: (b) => http.put("/pm/settings", b),

  // product templates
  products: () => http.get("/pm/products"),
  createProduct: (b) => http.post("/pm/products", b),
  updateProduct: (id, b) => http.patch(`/pm/products/${id}`, b),
  removeProduct: (id) => http.del(`/pm/products/${id}`),
  copyProduct: (id, b) => http.post(`/pm/products/${id}/copy`, b),
  productFull: (id) => http.get(`/pm/products/${id}/full`),
  createModule: (productId, b) => http.post(`/pm/products/${productId}/modules`, b),
  updateModule: (id, b) => http.patch(`/pm/modules/${id}`, b),
  removeModule: (id) => http.del(`/pm/modules/${id}`),
  copyModule: (id, b) => http.post(`/pm/modules/${id}/copy`, b || {}),
  orderModules: (productId, ids) => http.put(`/pm/products/${productId}/modules/order`, { ids }),
  createTaskTemplate: (productId, b) => http.post(`/pm/products/${productId}/tasks`, b),
  updateTaskTemplate: (id, b) => http.patch(`/pm/task-templates/${id}`, b),
  removeTaskTemplate: (id) => http.del(`/pm/task-templates/${id}`),
  orderTaskTemplates: (moduleId, ids) => http.put(`/pm/modules/${moduleId}/tasks/order`, { ids }),
  importTaskTemplates: (productId, rows, dryRun = false) => http.post(`/pm/products/${productId}/import`, { rows, dryRun }),

  // communication templates + auto-message rules
  templateMeta: () => http.get("/pm/template-meta"),
  templates: () => http.get("/pm/templates"),
  createTemplate: (b) => http.post("/pm/templates", b),
  updateTemplate: (id, b) => http.patch(`/pm/templates/${id}`, b),
  removeTemplate: (id) => http.del(`/pm/templates/${id}`),
  previewTemplate: (b) => http.post("/pm/templates/preview", b),
  testTemplate: (id, b) => http.post(`/pm/templates/${id}/test`, b),
  submitTemplate: (id) => http.post(`/pm/templates/${id}/submit`),
  templateWaStatus: () => http.post("/pm/templates/wa-status"),
  uploadWaMedia: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.postForm("/pm/templates/wa-media", fd);
  },

  // projects
  projects: (query = "") => http.get(`/pm/projects?perPage=200${query ? `&${query}` : ""}`),
  project: (id) => http.get(`/pm/projects/${id}`),
  previewProject: (b) => http.post("/pm/projects/preview", b),
  createProject: (b) => http.post("/pm/projects", b),
  updateProject: (id, b) => http.patch(`/pm/projects/${id}`, b),
  removeProject: (id) => http.del(`/pm/projects/${id}`),
  addProjectModule: (id, b) => http.post(`/pm/projects/${id}/modules`, b),
  saveProjectAsTemplate: (id, b) => http.post(`/pm/projects/${id}/save-as-template`, b),
  reassignProject: (id, b) => http.post(`/pm/projects/${id}/reassign`, b),
  reassignModule: (id, b) => http.post(`/pm/project-modules/${id}/reassign`, b),
  projectTeam: (id) => http.get(`/pm/projects/${id}/team`),
  projectFiles: (id) => http.get(`/pm/projects/${id}/files`),
  projectActivity: (id) => http.get(`/pm/projects/${id}/activity`),
  transferWork: (b) => http.post("/pm/transfer", b),

  // tasks
  tasks: (query = "") => http.get(`/pm/tasks?${query}`),
  task: (id) => http.get(`/pm/tasks/${id}`),
  createTask: (b) => http.post("/pm/tasks", b),
  updateTask: (id, b) => http.patch(`/pm/tasks/${id}`, b),
  removeTask: (id) => http.del(`/pm/tasks/${id}`),
  setTaskStatus: (id, status) => http.post(`/pm/tasks/${id}/status`, { status }),
  tickChecklist: (id, itemId, done) => http.post(`/pm/tasks/${id}/checklist/${itemId}`, { done }),
  reassignTask: (id, b) => http.post(`/pm/tasks/${id}/reassign`, b),
  bulkReassign: (b) => http.post("/pm/tasks/bulk-reassign", b),
  addComment: (id, b) => http.post(`/pm/tasks/${id}/comments`, b),
  removeComment: (id) => http.del(`/pm/comments/${id}`),
  uploadAttachment: (id, file, opts = {}) => {
    const fd = new FormData();
    fd.append("file", file, file.name || "pasted.png");
    if (opts.pasted) fd.append("pasted", "1");
    if (opts.clientVisible) fd.append("clientVisible", "1");
    return http.postForm(`/pm/tasks/${id}/attachments`, fd);
  },
  attachmentBlob: (taskId, attId, download) => http.blob(`/pm/tasks/${taskId}/attachments/${attId}${download ? "?download=1" : ""}`),
  updateAttachment: (taskId, attId, b) => http.patch(`/pm/tasks/${taskId}/attachments/${attId}`, b),
  removeAttachment: (taskId, attId) => http.del(`/pm/tasks/${taskId}/attachments/${attId}`),
  myWork: () => http.get("/pm/my-work"),

  // daily plan + team calendar
  plans: (from, to, employee) => http.get(`/pm/plans?from=${from}&to=${to}${employee ? `&employee=${employee}` : ""}`),
  savePlan: (b) => http.put("/pm/plans", b),
  updatePlanEntry: (planId, entryId, b) => http.patch(`/pm/plans/${planId}/entries/${entryId}`, b),
  copyPlan: (from, to) => http.post("/pm/plans/copy", { from, to }),
  removePlan: (id) => http.del(`/pm/plans/${id}`),
  teamCalendar: (query) => http.get(`/pm/team-calendar?${query}`),

  // sending settings, message log, notifications
  mailSettings: () => http.get("/pm/mail-settings"),
  saveMailSettings: (b) => http.put("/pm/mail-settings", b),
  testEmail: (to) => http.post("/pm/mail-settings/test-email", { to }),
  testWhatsapp: (to) => http.post("/pm/mail-settings/test-whatsapp", { to }),
  messages: (query = "") => http.get(`/pm/messages?${query}`),
  resendMessage: (id) => http.post(`/pm/messages/${id}/resend`, {}),
  notifications: (query = "") => http.get(`/pm/notifications?${query}`),
  readNotification: (id) => http.post(`/pm/notifications/${id}/read`, {}),
  readAllNotifications: () => http.post("/pm/notifications/read-all", {}),
  notifyPrefs: () => http.get("/pm/notify-prefs"),
  saveNotifyPrefs: (b) => http.put("/pm/notify-prefs", b),

  // meetings & trainings
  meetings: (query = "") => http.get(`/pm/meetings?${query}`),
  meeting: (id) => http.get(`/pm/meetings/${id}`),
  createMeeting: (b) => http.post("/pm/meetings", b),
  updateMeeting: (id, b) => http.patch(`/pm/meetings/${id}`, b),
  cancelMeeting: (id) => http.post(`/pm/meetings/${id}/cancel`, {}),
  respondMeeting: (id, response) => http.post(`/pm/meetings/${id}/respond`, { response }),
  saveMinutes: (id, b) => http.put(`/pm/meetings/${id}/minutes`, b),
  actionToTask: (id, actionId) => http.post(`/pm/meetings/${id}/actions/${actionId}/task`, {}),
  trainingReport: (query = "") => http.get(`/pm/meetings-report/training?${query}`),
  // links opened without a login
  publicGet: (path) => http.get(`/pm-public/${path}`),
  publicPost: (path, b) => http.post(`/pm-public/${path}`, b),

  // tickets (internal)
  tickets: (query = "") => http.get(`/pm/tickets?${query}`),
  ticket: (id) => http.get(`/pm/tickets/${id}`),
  createTicket: (b) => http.post("/pm/tickets", b),
  updateTicket: (id, b) => http.patch(`/pm/tickets/${id}`, b),
  assignTicket: (id, b) => http.post(`/pm/tickets/${id}/assign`, b),
  replyTicket: (id, b) => http.post(`/pm/tickets/${id}/replies`, b),
  ticketToTask: (id, b) => http.post(`/pm/tickets/${id}/task`, b || {}),
  mergeTicket: (id, into) => http.post(`/pm/tickets/${id}/merge`, { into }),
  ticketFile: (id, fileId) => http.blob(`/pm/tickets/${id}/files/${fileId}`),

  // client portal users, verification, sign-off
  portalUsers: () => http.get("/pm/portal-users"),
  createPortalUser: (clientId, contactId) => http.post(`/pm/clients/${clientId}/contacts/${contactId}/portal-user`, {}),
  updatePortalUser: (id, b) => http.patch(`/pm/portal-users/${id}`, b),
  taskVerifications: (taskId) => http.get(`/pm/tasks/${taskId}/verifications`),
  resendVerification: (taskId) => http.post(`/pm/tasks/${taskId}/verifications`, {}),
  signoffs: (projectId) => http.get(`/pm/projects/${projectId}/signoffs`),
  requestSignoff: (projectId, module) => http.post(`/pm/projects/${projectId}/signoffs`, { module }),

  // dashboards, reports, power features
  dashboard: (query = "") => http.get(`/pm/dashboard?${query}`),
  projectOverview: (id) => http.get(`/pm/projects/${id}/overview`),
  performance: (id) => http.get(`/pm/people/${id}/performance`),
  personLoad: (id, date) => http.get(`/pm/people/${id}/load${date ? `?date=${date}` : ""}`),
  reports: () => http.get("/pm/reports"),
  report: (key, query = "") => http.get(`/pm/reports/${key}?${query}`),
  reportFile: (key, query = "") => http.blob(`/pm/reports/${key}/export?${query}`),
  views: (screen) => http.get(`/pm/views?screen=${encodeURIComponent(screen)}`),
  saveView: (b) => http.post("/pm/views", b),
  removeView: (id) => http.del(`/pm/views/${id}`),
  search: (q) => http.get(`/pm/search?q=${encodeURIComponent(q)}`),
  bulkTasks: (b) => http.post("/pm/tasks/bulk", b),
  labels: () => http.get("/pm/labels"),
  watchTask: (id, on) => http.post(`/pm/tasks/${id}/watch`, { on }),
  checklistToTask: (id, itemId) => http.post(`/pm/tasks/${id}/checklist/${itemId}/to-task`, {}),
  taskTime: (id) => http.get(`/pm/tasks/${id}/time`),
  logTime: (id, b) => http.post(`/pm/tasks/${id}/time`, b),
  removeTime: (id) => http.del(`/pm/time/${id}`),
  timesheet: (query) => http.get(`/pm/timesheet?${query}`),
  activity: (query = "") => http.get(`/pm/activity?${query}`),
  recurring: () => http.get("/pm/recurring"),
  createRecurring: (b) => http.post("/pm/recurring", b),
  updateRecurring: (id, b) => http.patch(`/pm/recurring/${id}`, b),
  removeRecurring: (id) => http.del(`/pm/recurring/${id}`),

  // clients
  clients: (query = "") => http.get(`/pm/clients?perPage=200${query ? `&${query}` : ""}`),
  createClient: (b) => http.post("/pm/clients", b),
  updateClient: (id, b) => http.patch(`/pm/clients/${id}`, b),
  removeClient: (id) => http.del(`/pm/clients/${id}`),
};

export const integrationsApi = {
  list: () => http.get("/integrations"),
  update: (id, b) => http.patch(`/integrations/${id}`, b),
};

export const waAccountsApi = {
  list: () => http.get("/whatsapp-accounts"),
  create: (b) => http.post("/whatsapp-accounts", b),
  update: (id, b) => http.patch(`/whatsapp-accounts/${id}`, b),
  remove: (id) => http.del(`/whatsapp-accounts/${id}`),
  activate: (id) => http.post(`/whatsapp-accounts/${id}/activate`),
  getMetaProfile: () => http.get("/whatsapp-accounts/meta-profile"),
  updateMetaProfile: (b) => http.post("/whatsapp-accounts/meta-profile", b),
};

export const facebookApi = {
  list: () => http.get("/facebook-accounts"),
  create: (b) => http.post("/facebook-accounts", b),
  update: (id, b) => http.patch(`/facebook-accounts/${id}`, b),
  remove: (id) => http.del(`/facebook-accounts/${id}`),
  activate: (id) => http.post(`/facebook-accounts/${id}/activate`),
  testConnection: (id, b) => http.post(`/facebook-accounts/${id}/test`, b),
  fetchLeadForms: (id) => http.post(`/facebook-accounts/${id}/fetch-forms`),
};

export const templatesApi = {
  list: (params) => http.get("/templates" + qs(params)),
  create: (b) => http.post("/templates", b),
  createMeta: (b) => http.post("/templates/create-meta", b),
  editMeta: (id, b) => http.patch(`/templates/${id}/meta`, b),
  uploadTestMedia: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http.postForm("/templates/test-media/upload", fd);
  },
  metaSyncCandidates: () => http.get("/templates/meta-sync-candidates"),
  syncMeta: (names) => http.post("/templates/sync-meta", { names }),
  deleteMeta: (name) => http.del(`/templates/${encodeURIComponent(name)}/meta`),
  update: (id, b) => http.patch(`/templates/${id}`, b),
  remove: (id) => http.del(`/templates/${id}`),
};

export const chatbotApi = {
  list: () => http.get("/chatbot-rules"),
  create: (b) => http.post("/chatbot-rules", b),
  update: (id, b) => http.patch(`/chatbot-rules/${id}`, b),
  remove: (id) => http.del(`/chatbot-rules/${id}`),
  test: (b) => http.post("/chatbot-rules/test", b),
};

export const campaignsApi = {
  list: (params) => http.get("/campaigns" + qs(params)),
  get: (id) => http.get(`/campaigns/${id}`),
  create: (b) => http.post("/campaigns", b),
  update: (id, b) => http.patch(`/campaigns/${id}`, b),
  remove: (id) => http.del(`/campaigns/${id}`),
  launch: (id) => http.post(`/campaigns/${id}/launch`),
  pause: (id, statusVal) => http.post(`/campaigns/${id}/pause`, { status: statusVal }),
  report: (id, params) => http.get(`/campaigns/${id}/report` + qs(params)),
  resend: (id, b) => http.post(`/campaigns/${id}/resend`, b),
};

// Recipient lists imported from CSV / Excel for bulk campaigns
export const campaignsAudienceApi = {
  preview: (b) => http.post("/campaigns/audience-preview", b),
};

export const campaignListsApi = {
  list: (params) => http.get("/campaign-lists" + qs(params)),
  get: (id, params) => http.get(`/campaign-lists/${id}` + qs(params)),
  importRows: (b) => http.post("/campaign-lists/import", b),
  append: (id, b) => http.post(`/campaign-lists/${id}/append`, b),
  rename: (id, name) => http.patch(`/campaign-lists/${id}`, { name }),
  update: (id, b) => http.patch(`/campaign-lists/${id}`, b),
  sources: () => http.get("/campaign-lists/sources"),
  owners: () => http.get("/campaign-lists/owners"),
  create: (b) => http.post("/campaign-lists", b),
  removeRow: (id, phone) => http.del(`/campaign-lists/${id}/rows/${encodeURIComponent(phone)}`),
  remove: (id) => http.del(`/campaign-lists/${id}`),
};

// Campaign tags on the page's own address (?utm_source=…) travel with the enquiry.
const utmFromUrl = () => {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  return Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"].filter((k) => q.get(k)).map((k) => [k, q.get(k)]));
};

export const publicApi = {
  getEnquiryForm: (formId) => http.get(`/public/enquiry-form/${formId}`),
  submitEnquiryForm: (formId, payload) => http.post(`/public/enquiry-form/${formId}`, { ...utmFromUrl(), ...payload }),
  getLandingPage: (pageId) => http.get(`/public/landing-page/${pageId}`),
  submitLandingEnquiry: (pageId, payload) => http.post(`/public/landing-page/${pageId}/enquiry`, { ...utmFromUrl(), ...payload }),
};

export const messagesApi = {
  list: (params) => http.get("/messages" + qs(params)),
  convert: (id) => http.post(`/messages/${id}/convert`),
  send: (payload) => http.post("/messages/send", payload), // { channel, to, template, params, text, subject }
};

export const conversationsApi = {
  list: (params) => http.get("/conversations" + qs(params)),
  get: (id) => http.get(`/conversations/${id}`),
  reply: (id, payload) => http.post(`/conversations/${id}/reply`, payload),
  markRead: (id) => http.post(`/conversations/${id}/read`),
};

export const conversionApi = {
  stats: (params) => http.get("/conversion/stats" + qs(params)),
};

export const auditApi = {
  list: (params) => http.get("/audit" + qs(params)),
};

export const sessionsApi = {
  list: () => http.get("/masters/sessions"),
  create: (b) => http.post("/masters/sessions", b),
  update: (id, b) => http.patch(`/masters/sessions/${id}`, b),
  remove: (id) => http.del(`/masters/sessions/${id}`),
};

// Setup › Implementation › Pre-requisites (the client fills the form from a public link)
export const prerequisitesApi = {
  get: (params) => http.get("/prerequisites" + qs(params)),
  update: (b) => http.patch("/prerequisites", b),
  regenerate: (b) => http.post("/prerequisites/regenerate", b || {}),
  reopen: (b) => http.post("/prerequisites/reopen", b || {}),
  send: (b) => http.post("/prerequisites/send", b),
};

export const gradesApi = {
  list: (params) => http.get("/grades" + qs({ perPage: 200, ...params })),
  create: (b) => http.post("/grades", b),
  update: (id, b) => http.patch(`/grades/${id}`, b),
  reorder: (ids) => http.put("/grades/reorder", { ids }),
  remove: (id) => http.del(`/grades/${id}`),
};

export const feeHeadsApi = {
  list: () => http.get("/fee-heads?perPage=200&sort=order"),
  create: (b) => http.post("/fee-heads", b),
  update: (id, b) => http.patch(`/fee-heads/${id}`, b),
  remove: (id) => http.del(`/fee-heads/${id}`),
};

export const documentTypesApi = {
  list: () => http.get("/document-types?perPage=200&sort=order"),
  create: (b) => http.post("/document-types", b),
  update: (id, b) => http.patch(`/document-types/${id}`, b),
  remove: (id) => http.del(`/document-types/${id}`),
};

export const designationsApi = {
  list: () => http.get("/designations"),
  create: (b) => http.post("/designations", b),
  update: (id, b) => http.patch(`/designations/${id}`, b),
  remove: (id) => http.del(`/designations/${id}`),
};

export const teamsApi = {
  list: () => http.get("/teams"),
  create: (b) => http.post("/teams", b),
  update: (id, b) => http.patch(`/teams/${id}`, b),
  remove: (id) => http.del(`/teams/${id}`),
};

export const workflowsApi = {
  list: () => http.get("/workflows"),
  create: (b) => http.post("/workflows", b),
  update: (id, b) => http.patch(`/workflows/${id}`, b),
  remove: (id) => http.del(`/workflows/${id}`),
};

export const workflowConfigApi = {
  get: (configKey) => http.get(`/workflow-config/${configKey || "default"}`),
  save: (configKey, data) => http.post(`/workflow-config/${configKey}`, data),
};

export const flowStudioApi = {
  getState: () => http.get("/flowchat/state"),
  saveState: (payload) => http.put("/flowchat/state", payload),
};

export const flowMediaApi = {
  list: () => http.get("/flowchat/media"),
  create: ({ name, type, file }) => {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("type", type);
    fd.append("file", file);
    return http.postForm("/flowchat/media", fd);
  },
  update: (id, body) => http.patch(`/flowchat/media/${id}`, body),
  remove: (id) => http.del(`/flowchat/media/${id}`),
};

export const registrationsApi = {
  list: (params) => http.get("/registrations" + qs(params)),
  get: (id) => http.get(`/registrations/${id}`),
  create: (b) => http.post("/registrations", b),
  update: (id, b) => http.patch(`/registrations/${id}`, b),
  remove: (id) => http.del(`/registrations/${id}`),
};

export const aiApi = {
  getConfig: () => http.get("/ai/config"),
  saveConfig: (payload) => http.post("/ai/config", payload),
  testConnection: (payload) => http.post("/ai/test-connection", payload),
  executeCommand: (payload) => http.post("/ai/execute", payload),
};


/* ---- Client portal: what a client's own user may see and do ---- */
export const portalApi = {
  home: () => http.get("/pm/portal/home"),
  project: (id) => http.get(`/pm/portal/projects/${id}`),
  verifications: () => http.get("/pm/portal/verifications"),
  answerVerification: (id, b) => http.post(`/pm/portal/verifications/${id}`, b),
  documents: () => http.get("/pm/portal/documents"),
  file: (taskId, attId) => http.blob(`/pm/portal/files/${taskId}/${attId}`),
  answerSignoff: (id, b) => http.post(`/pm/portal/signoffs/${id}`, b),
  meetings: () => http.get("/pm/portal/meetings"),
  ticketOptions: () => http.get("/pm/portal/ticket-options"),
  tickets: () => http.get("/pm/portal/tickets"),
  ticket: (id) => http.get(`/pm/portal/tickets/${id}`),
  createTicket: (b) => http.post("/pm/portal/tickets", b),
  replyTicket: (id, text) => http.post(`/pm/portal/tickets/${id}/replies`, { text }),
  reopenTicket: (id, reason) => http.post(`/pm/portal/tickets/${id}/reopen`, { reason }),
  rateTicket: (id, b) => http.post(`/pm/portal/tickets/${id}/rating`, b),
  uploadTicketFile: (id, file) => {
    const fd = new FormData();
    fd.append("file", file, file.name || "image.png");
    return http.postForm(`/pm/portal/tickets/${id}/files`, fd);
  },
  ticketFile: (id, fileId) => http.blob(`/pm/portal/tickets/${id}/files/${fileId}`),
};

// CRM → Forms: builder, submissions, analytics, and the public fill-in page
export const formsApi = {
  templates: () => http.get("/crm/forms/templates"),
  meta: () => http.get("/crm/forms/meta"),
  list: (params) => http.get("/crm/forms" + qs(params)),
  create: (b) => http.post("/crm/forms", b),
  get: (id) => http.get(`/crm/forms/${id}`),
  update: (id, b) => http.patch(`/crm/forms/${id}`, b),
  duplicate: (id) => http.post(`/crm/forms/${id}/duplicate`),
  remove: (id) => http.del(`/crm/forms/${id}`),
  submissions: (id, params) => http.get(`/crm/forms/${id}/submissions` + qs(params)),
  analytics: (id, params) => http.get(`/crm/forms/${id}/analytics` + qs(params)),
  submission: (sid) => http.get(`/crm/form-submissions/${sid}`),
  updateSubmission: (sid, b) => http.patch(`/crm/form-submissions/${sid}`, b),
  removeSubmission: (sid) => http.del(`/crm/form-submissions/${sid}`),
  bulk: (ids, action) => http.post("/crm/form-submissions/bulk", { ids, action }),
  file: (sid, fileId) => http.blob(`/crm/form-submissions/${sid}/files/${fileId}`),
  // public
  publicForm: (slug, params) => http.get(`/public/forms/${slug}` + qs(params)),
  start: (slug) => http.post(`/public/forms/${slug}/start`, {}),
  draft: (slug, b) => http.post(`/public/forms/${slug}/draft`, b),
  submit: (slug, fd) => http.postForm(`/public/forms/${slug}/submit`, fd),
  receipt: (token) => http.get(`/public/form-receipt/${token}`),
};

// Sales: companies, deals, products, quotations
export const salesApi = {
  companies: (params) => http.get("/crm/companies" + qs(params)),
  company: (id) => http.get(`/crm/companies/${id}`),
  createCompany: (b) => http.post("/crm/companies", b),
  updateCompany: (id, b) => http.patch(`/crm/companies/${id}`, b),
  removeCompany: (id) => http.del(`/crm/companies/${id}`),
  stages: () => http.get("/crm/deal-stages"),
  createStage: (b) => http.post("/crm/deal-stages", b),
  updateStage: (id, b) => http.patch(`/crm/deal-stages/${id}`, b),
  removeStage: (id) => http.del(`/crm/deal-stages/${id}`),
  orderStages: (ids) => http.put("/crm/deal-stages/order", { ids }),
  deals: (params) => http.get("/crm/deals" + qs(params)),
  board: (params) => http.get("/crm/deals/board" + qs(params)),
  summary: (params) => http.get("/crm/deals/summary" + qs(params)),
  deal: (id) => http.get(`/crm/deals/${id}`),
  createDeal: (b) => http.post("/crm/deals", b),
  updateDeal: (id, b) => http.patch(`/crm/deals/${id}`, b),
  removeDeal: (id) => http.del(`/crm/deals/${id}`),
  products: (params) => http.get("/crm/products" + qs(params)),
  createProduct: (b) => http.post("/crm/products", b),
  updateProduct: (id, b) => http.patch(`/crm/products/${id}`, b),
  removeProduct: (id) => http.del(`/crm/products/${id}`),
  quotes: (params) => http.get("/crm/quotes" + qs(params)),
  quote: (id) => http.get(`/crm/quotes/${id}`),
  createQuote: (b) => http.post("/crm/quotes", b),
  updateQuote: (id, b) => http.patch(`/crm/quotes/${id}`, b),
  duplicateQuote: (id) => http.post(`/crm/quotes/${id}/duplicate`),
  sendQuote: (id, b) => http.post(`/crm/quotes/${id}/send`, b),
  removeQuote: (id) => http.del(`/crm/quotes/${id}`),
  publicQuote: (token, params) => http.get(`/public/quote/${token}` + qs(params)),
  respondQuote: (token, b) => http.post(`/public/quote/${token}/respond`, b),
};

// CRM → Report builder: reports, dashboards, cards
export const reportsApi = {
  meta: () => http.get("/crm/reports/meta"),
  run: (spec) => http.post("/crm/reports/run", spec),
  exportRows: (spec) => http.post("/crm/reports/export", spec),
  saved: (kind) => http.get("/crm/reports/saved" + qs({ kind })),
  get: (id) => http.get(`/crm/reports/saved/${id}`),
  create: (b) => http.post("/crm/reports/saved", b),
  update: (id, b) => http.patch(`/crm/reports/saved/${id}`, b),
  remove: (id) => http.del(`/crm/reports/saved/${id}`),
};
