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
  setStatus: (id, statusId, subStatusId) => http.post(`/leads/${id}/status`, { statusId, subStatusId }),
  addNote: (id, text) => http.post(`/leads/${id}/notes`, { text }),
  // multi-service tracks
  addService: (id, serviceId, owner) => http.post(`/leads/${id}/services`, { serviceId, owner }),
  setServiceStatus: (id, serviceId, statusId, subStatusId) => http.post(`/leads/${id}/services/status`, { serviceId, statusId, subStatusId }),
  removeService: (id, serviceId) => http.del(`/leads/${id}/services/${serviceId}`),
  addFollowUp: (id, body) => http.post(`/leads/${id}/followups`, body),
  getServiceStatuses: (id, serviceId) => http.get(`/leads/${id}/service/${serviceId}/statuses`),
};

export const servicesApi = {
  list: () => http.get("/services"),
  create: (b) => http.post("/services", b),
  update: (id, b) => http.patch(`/services/${id}`, b),
  remove: (id) => http.del(`/services/${id}`),
};

export const followUpsApi = {
  buckets: (owner) => http.get("/followups/buckets" + qs({ owner })),
  list: (params) => http.get("/followups" + qs(params)),
  create: (body) => http.post("/followups", body),
  complete: (id, outcome) => http.post(`/followups/${id}/complete`, { outcome }),
  reschedule: (id, due) => http.post(`/followups/${id}/reschedule`, { due }),
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
};

export const publicApi = {
  getEnquiryForm: (formId) => http.get(`/public/enquiry-form/${formId}`),
  submitEnquiryForm: (formId, payload) => http.post(`/public/enquiry-form/${formId}`, payload),
  getLandingPage: (pageId) => http.get(`/public/landing-page/${pageId}`),
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
  stats: () => http.get("/conversion/stats"),
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

export const gradesApi = {
  list: () => http.get("/grades"),
  create: (b) => http.post("/grades", b),
  update: (id, b) => http.patch(`/grades/${id}`, b),
  remove: (id) => http.del(`/grades/${id}`),
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

