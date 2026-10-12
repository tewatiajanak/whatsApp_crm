import { http } from "../api/client";

const data = (p) => p.then((r) => (r && Object.prototype.hasOwnProperty.call(r, "data") ? r.data : r));
const s = (siteId) => `/websites/${siteId}`;
const qs = (o) => { const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""); return p.length ? "?" + p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") : ""; };

export const wbApi = {
  sites: () => data(http.get("/websites")),
  createSite: (body) => data(http.post("/websites", body)),
  site: (siteId) => data(http.get(s(siteId))),
  updateSite: (siteId, body) => data(http.patch(s(siteId), body)),
  removeSite: (siteId) => data(http.del(s(siteId))),

  saveTheme: (siteId, theme) => data(http.put(`${s(siteId)}/theme`, { theme })),
  publishTheme: (siteId) => data(http.post(`${s(siteId)}/theme/publish`)),

  pages: (siteId) => data(http.get(`${s(siteId)}/pages`)),
  createPage: (siteId, body) => data(http.post(`${s(siteId)}/pages`, body)),
  page: (siteId, pageId) => data(http.get(`${s(siteId)}/pages/${pageId}`)),
  updatePage: (siteId, pageId, body) => data(http.patch(`${s(siteId)}/pages/${pageId}`, body)),
  saveDraft: (siteId, pageId, content, version) => data(http.put(`${s(siteId)}/pages/${pageId}/draft`, { content, version })),
  publishPage: (siteId, pageId) => data(http.post(`${s(siteId)}/pages/${pageId}/publish`)),
  unpublishPage: (siteId, pageId) => data(http.post(`${s(siteId)}/pages/${pageId}/unpublish`)),
  duplicatePage: (siteId, pageId) => data(http.post(`${s(siteId)}/pages/${pageId}/duplicate`)),
  removePage: (siteId, pageId) => data(http.del(`${s(siteId)}/pages/${pageId}`)),

  menus: (siteId) => data(http.get(`${s(siteId)}/menus`)),
  saveMenu: (siteId, location, items) => data(http.put(`${s(siteId)}/menus/${location}`, { items })),

  blocks: (siteId) => data(http.get(`${s(siteId)}/blocks`)),
  saveBlock: (siteId, body) => data(http.post(`${s(siteId)}/blocks`, body)),
  removeBlock: (siteId, blockId) => data(http.del(`${s(siteId)}/blocks/${blockId}`)),

  /* content */
  collections: (siteId) => data(http.get(`${s(siteId)}/collections`)),
  createCollection: (siteId, body) => data(http.post(`${s(siteId)}/collections`, body)),
  updateCollection: (siteId, key, body) => data(http.patch(`${s(siteId)}/collections/${key}`, body)),
  removeCollection: (siteId, key) => data(http.del(`${s(siteId)}/collections/${key}`)),
  records: (siteId, key, query = {}) => data(http.get(`${s(siteId)}/collections/${key}/records${qs(query)}`)),
  createRecord: (siteId, key, body) => data(http.post(`${s(siteId)}/collections/${key}/records`, body)),
  updateRecord: (siteId, key, id, body) => data(http.patch(`${s(siteId)}/collections/${key}/records/${id}`, body)),
  removeRecord: (siteId, key, id) => data(http.del(`${s(siteId)}/collections/${key}/records/${id}`)),
  importRecords: (siteId, key, body) => data(http.post(`${s(siteId)}/collections/${key}/import`, body)),

  /* data for the builder */
  sources: (siteId) => data(http.get(`${s(siteId)}/data/sources`)),
  resolve: (siteId, sourceRef, query) => data(http.post(`${s(siteId)}/data/resolve`, { sourceRef, query })),
  search: (siteId, q) => data(http.get(`${s(siteId)}/search${qs({ q })}`)),

  /* API keys, webhooks, external sources */
  apiKeys: (siteId) => data(http.get(`${s(siteId)}/api-keys`)),
  createApiKey: (siteId, body) => data(http.post(`${s(siteId)}/api-keys`, body)),
  revokeApiKey: (siteId, id) => data(http.post(`${s(siteId)}/api-keys/${id}/revoke`)),
  removeApiKey: (siteId, id) => data(http.del(`${s(siteId)}/api-keys/${id}`)),
  webhooks: (siteId) => data(http.get(`${s(siteId)}/webhooks`)),
  createWebhook: (siteId, body) => data(http.post(`${s(siteId)}/webhooks`, body)),
  updateWebhook: (siteId, id, body) => data(http.patch(`${s(siteId)}/webhooks/${id}`, body)),
  testWebhook: (siteId, id) => data(http.post(`${s(siteId)}/webhooks/${id}/test`)),
  removeWebhook: (siteId, id) => data(http.del(`${s(siteId)}/webhooks/${id}`)),
  dataSources: (siteId) => data(http.get(`${s(siteId)}/data-sources`)),
  testDataSource: (siteId, body) => data(http.post(`${s(siteId)}/data-sources/test`, body)),
  createDataSource: (siteId, body) => data(http.post(`${s(siteId)}/data-sources`, body)),
  updateDataSource: (siteId, id, body) => data(http.patch(`${s(siteId)}/data-sources/${id}`, body)),
  refreshDataSource: (siteId, id) => data(http.post(`${s(siteId)}/data-sources/${id}/refresh`)),
  removeDataSource: (siteId, id) => data(http.del(`${s(siteId)}/data-sources/${id}`)),

  /* form inbox, share links, apps, export */
  submissions: (siteId, page = 1) => data(http.get(`${s(siteId)}/submissions${qs({ page })}`)),
  markSubmission: (siteId, id, read) => data(http.patch(`${s(siteId)}/submissions/${id}`, { read })),
  removeSubmission: (siteId, id) => data(http.del(`${s(siteId)}/submissions/${id}`)),
  shareLinks: (siteId) => data(http.get(`${s(siteId)}/share-links`)),
  createShareLink: (siteId, body) => data(http.post(`${s(siteId)}/share-links`, body)),
  revokeShareLink: (siteId, id) => data(http.del(`${s(siteId)}/share-links/${id}`)),
  installApp: (siteId, app, sample = true) => data(http.post(`${s(siteId)}/apps/install`, { app, sample })),
  uninstallApp: (siteId, key, removeContent) => data(http.post(`${s(siteId)}/apps/${key}/uninstall`, { removeContent })),
  exportSite: (siteId) => data(http.get(`${s(siteId)}/export`)),
  health: (siteId) => data(http.get(`${s(siteId)}/health`)),

  /** draft render bundle (signed-in preview) */
  preview: (siteId, path, query = {}) => data(http.get(`${s(siteId)}/preview${qs({ path, ...query })}`)),
  /** published render bundle (public site) */
  publicRender: (siteKey, path, query = {}) => data(http.get(`/public/site/${encodeURIComponent(siteKey)}/render${qs({ path, ...query })}`)),
  /** draft render bundle through a share link */
  sharedRender: (token, path, query = {}) => data(http.get(`/public/preview/${encodeURIComponent(token)}/render${qs({ path, ...query })}`)),
  submitForm: (siteKey, body) => data(http.post(`/public/site/${encodeURIComponent(siteKey)}/forms`, body)),
};
