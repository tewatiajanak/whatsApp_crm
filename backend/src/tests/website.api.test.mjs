// Website Builder API regression test. Needs the API running and a user who may use Setup.
//   npm run website:api-test            (defaults: http://localhost:4001, the seed admin)
//   API=… EMAIL=… PASSWORD=… npm run website:api-test
// It creates its own websites (names start with "__apitest") and deletes them at the end.
import assert from "node:assert/strict";

const BASE = process.env.API || "http://localhost:4001";
const A = `${BASE}/api`;
let token = "";
const results = [];
async function call(method, url, body, headers = {}) {
  const res = await fetch(url.startsWith("http") ? url : A + url, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token && !headers["X-API-Key"] && headers.auth !== false ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json, data: json?.data };
}
const anon = { auth: false };
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name, `${e.message.split("\n").filter(Boolean).slice(0, 6).join(" | ")} (line ${(e.stack.match(/test\.mjs:(\d+)/) || [])[1]})`]); }
}
const page = (children) => ({ schemaVersion: 2, settings: {}, root: { id: "root", type: "Page", props: {}, children } });
const created = [];

const login = await call("POST", "/auth/login", { email: process.env.EMAIL || "priya@greenwood.edu", password: process.env.PASSWORD || "password123" });
assert.equal(login.status, 200, "login failed — is the API running and are the credentials right?");
token = login.data.token;

let site, W, K, pages, home;
await test("auth: every admin route refuses a missing token", async () => {
  for (const p of ["/websites", "/websites/x/pages", "/websites/x/collections", "/websites/x/api-keys", "/websites/x/webhooks", "/websites/x/data-sources", "/websites/x/submissions", "/websites/x/export"]) assert.equal((await call("GET", p, undefined, anon)).status, 401, p);
});
await test("website: create from a template package", async () => {
  const r = await call("POST", "/websites", { name: "__apitest main", template: { key: "t", theme: { colors: { primary: "#112233" } }, pages: [{ ref: "home", title: "Home", path: "/", isHome: true, content: page([{ id: "n1", type: "Heading", props: { text: "Hello" } }]) }, { ref: "about", title: "About", path: "/about", content: page([]) }], menus: [{ location: "primary", items: [{ label: "Home", type: "page", pageRef: "home" }, { label: "About", type: "page", pageRef: "about" }] }] } });
  assert.equal(r.status, 201); site = r.data; created.push(site._id); W = `/websites/${site._id}`; K = site.siteKey;
  pages = (await call("GET", `${W}/pages`)).data; home = pages.find((p) => p.isHome);
  assert.equal(pages.length, 2); assert.ok(home);
});
await test("website: validation (no name, duplicate page address in template, bad page tree)", async () => {
  assert.equal((await call("POST", "/websites", { name: "" })).status, 400);
  assert.equal((await call("POST", "/websites", { name: "__apitest x", template: { pages: [{ title: "A", path: "/a", isHome: true, content: page([]) }, { title: "B", path: "/b", content: page([]) }, { title: "B2", path: "/b", content: page([]) }] } })).status, 400);
  assert.equal((await call("POST", "/websites", { name: "__apitest y", template: { pages: [{ title: "A", path: "/", isHome: true, content: { root: { id: "root", type: "<x>" } } }] } })).status, 400);
  assert.equal((await call("GET", "/websites")).data.filter((s) => s.name.startsWith("__apitest")).length, 1, "a refused website must leave nothing behind");
});
await test("website: another tenant's / unknown id is 404", async () => assert.equal((await call("GET", "/websites/64b000000000000000000001")).status, 404));
await test("pages: draft save, stale save refused, bad trees refused", async () => {
  const ok = await call("PUT", `${W}/pages/${home._id}/draft`, { version: home.version, content: page([{ id: "n1", type: "Heading", props: { text: "Edited" } }]) });
  assert.equal(ok.status, 200); assert.equal(ok.data.version, home.version + 1);
  assert.equal((await call("PUT", `${W}/pages/${home._id}/draft`, { version: home.version, content: page([]) })).status, 409);
  assert.equal((await call("PUT", `${W}/pages/${home._id}/draft`, { version: home.version + 1, content: page([{ id: "a", type: "Text" }, { id: "a", type: "Text" }]) })).status, 400);
  let deep = { id: "d0", type: "Section", children: [] }; let cur = deep;
  for (let i = 1; i < 40; i++) { const n = { id: `d${i}`, type: "Section", children: [] }; cur.children.push(n); cur = n; }
  assert.equal((await call("PUT", `${W}/pages/${home._id}/draft`, { version: home.version + 1, content: page([deep]) })).status, 400);
});
await test("pages: add, duplicate address refused, duplicate page, make home, delete home refused", async () => {
  assert.equal((await call("POST", `${W}/pages`, { title: "Contact" })).status, 201);
  assert.equal((await call("POST", `${W}/pages`, { title: "Contact" })).status, 409);
  const about = pages.find((p) => p.path === "/about");
  assert.equal((await call("POST", `${W}/pages/${about._id}/duplicate`)).status, 201);
  assert.equal((await call("DELETE", `${W}/pages/${home._id}`)).status, 400);
  assert.equal((await call("PATCH", `${W}/pages/${about._id}`, { seo: { title: "About us", description: "D" } })).data.seo.title, "About us");
});
await test("publish: public site shows published pages only, drafts stay private", async () => {
  assert.equal((await call("GET", `/public/site/${K}/render?path=/`, undefined, anon)).status, 404);
  assert.equal((await call("POST", `${W}/pages/${home._id}/publish`)).data.status, "published");
  const pub = await call("GET", `/public/site/${K}/render?path=/`, undefined, anon);
  assert.equal(pub.data.page.content.root.children[0].props.text, "Edited");
  assert.deepEqual(pub.data.menus.primary.map((m) => m.label), ["Home"], "unpublished pages are not in the public menu");
  assert.equal((await call("GET", `/public/site/${K}/render?path=/about`, undefined, anon)).status, 404);
  const v = (await call("GET", `${W}/pages/${home._id}`)).data.version;
  await call("PUT", `${W}/pages/${home._id}/draft`, { version: v, content: page([{ id: "n1", type: "Heading", props: { text: "Draft only" } }]) });
  assert.equal((await call("GET", `/public/site/${K}/render?path=/`, undefined, anon)).data.page.content.root.children[0].props.text, "Edited");
  assert.equal((await call("GET", `${W}/preview?path=/`)).data.page.content.root.children[0].props.text, "Draft only");
});
await test("theme: draft is private until published", async () => {
  await call("PUT", `${W}/theme`, { theme: { colors: { primary: "#445566" }, stylePresets: [{ id: "sp_1", name: "P", style: { desktop: { color: "#ff0000" } } }] } });
  assert.equal((await call("GET", `/public/site/${K}/render?path=/`, undefined, anon)).data.theme.colors.primary, "#112233");
  await call("POST", `${W}/theme/publish`);
  assert.equal((await call("GET", `/public/site/${K}/render?path=/`, undefined, anon)).data.theme.colors.primary, "#445566");
});
await test("menus: save, nesting capped, unknown location refused", async () => {
  const deep = { label: "A", type: "url", url: "https://a.test", children: [{ label: "B", type: "heading", children: [{ label: "C", type: "url", url: "/c", children: [{ label: "D", type: "url", url: "/d" }] }] }] };
  const r = await call("PUT", `${W}/menus/footer`, { items: [deep] });
  assert.equal(r.data.items[0].children[0].children[0].children.length, 0);
  assert.equal((await call("PUT", `${W}/menus/zzz`, { items: [] })).status, 400);
});
await test("blocks: save, list, delete", async () => {
  const b = await call("POST", `${W}/blocks`, { name: "B1", content: { id: "x1", type: "Section", children: [] } });
  assert.equal(b.status, 201);
  assert.equal((await call("POST", `${W}/blocks`, { name: "Bad", content: { id: "x1", type: "bad type" } })).status, 400);
  assert.equal((await call("GET", `${W}/blocks`)).data.length, 1);
  assert.equal((await call("DELETE", `${W}/blocks/${b.data._id}`)).status, 200);
});

let recs = [];
await test("collections: create, reserved field keys dropped, records typed and required", async () => {
  const c = await call("POST", `${W}/collections`, { name: "Posts", fields: [{ key: "title", label: "Title", type: "text", required: true }, { key: "price", label: "Price", type: "number" }, { key: "secret", label: "Secret", type: "text", hiddenFromApi: true }, { key: "when", label: "When", type: "date" }, { key: "__proto__", label: "x" }, { key: "slug", label: "x" }] });
  assert.deepEqual(c.data.fields.map((f) => f.key), ["title", "price", "secret", "when"]);
  for (let i = 1; i <= 5; i++) recs.push((await call("POST", `${W}/collections/posts/records`, { status: "published", data: { title: `Post ${i}`, price: i * 100, secret: `s${i}`, when: new Date(Date.now() + i * 86400000).toISOString() } })).data);
  assert.equal((await call("POST", `${W}/collections/posts/records`, { data: { title: "Draft post" } })).data.status, "draft");
  assert.equal((await call("POST", `${W}/collections/posts/records`, { data: { price: 1 } })).status, 400);
  assert.equal((await call("POST", `${W}/collections/posts/records`, { data: { title: "x", price: "abc" } })).status, 400);
  assert.equal((await call("POST", `${W}/collections/posts/records`, { status: "published", data: { title: "Post 1" } })).data.slug, "post-1-2", "slugs stay unique");
  assert.equal((await call("GET", `${W}/collections/posts/records?search=draft`)).data.total, 1);
});
await test("import: dry run reports problems and writes nothing; real run creates", async () => {
  const rows = [{ title: "Imp 1", price: "10" }, { title: "", price: "5" }, { title: "Imp 3", price: "x" }];
  const before = (await call("GET", `${W}/collections/posts/records`)).data.total;
  const dry = await call("POST", `${W}/collections/posts/import`, { rows, dryRun: true });
  assert.deepEqual([dry.data.total, dry.data.valid, dry.data.errors.length], [3, 1, 2]);
  assert.equal((await call("GET", `${W}/collections/posts/records`)).data.total, before);
  assert.equal((await call("POST", `${W}/collections/posts/import`, { rows })).data.created, 1);
});

let apiKey, keyId;
const C = () => `/content/v1/sites/${K}`;
await test("content API: needs a key, hides private fields and drafts, filters/sorts/pages", async () => {
  assert.equal((await call("GET", `${C()}/collections/posts/items`, undefined, anon)).status, 404, "collection is not API-enabled yet");
  await call("PATCH", `${W}/collections/posts`, { settings: { apiEnabled: true, titleField: "title" } });
  assert.equal((await call("GET", `${C()}/collections/posts/items`, undefined, anon)).status, 401);
  const k = await call("POST", `${W}/api-keys`, { name: "k1", allowedOrigins: ["https://ok.test"] });
  apiKey = k.data.key; keyId = k.data._id;
  assert.ok(apiKey.startsWith("wbk_live_"));
  assert.ok(!JSON.stringify((await call("GET", `${W}/api-keys`)).data).includes(apiKey), "the full key is never listed again");
  const H = { "X-API-Key": apiKey };
  const list = await call("GET", `${C()}/collections/posts/items?filter[price][gte]=300&sort=-price&limit=2`, undefined, H);
  assert.deepEqual(list.data.items.map((i) => i.price), [500, 400]); assert.equal(list.data.total, 3);
  assert.ok(list.data.items.every((i) => !("secret" in i) && !("status" in i)));
  // ascending: the record without a price comes first, so page 2 starts at 200
  assert.deepEqual((await call("GET", `${C()}/collections/posts/items?page=2&limit=2&sort=price`, undefined, H)).data.items.map((i) => i.price), [200, 300]);
  assert.equal((await call("GET", `${C()}/collections/posts/items?search=draft`, undefined, H)).data.total, 0);
  assert.equal((await call("GET", `${C()}/collections/posts/items?filter[price][$where]=1&filter[secret]=s1&filter[status]=draft`, undefined, H)).data.total, 6, "unknown operators and private fields are ignored");
  assert.equal((await call("GET", `${C()}/collections/posts/items/post-2`, undefined, H)).data.item.title, "Post 2");
  assert.equal((await call("GET", `${C()}/collections/posts/items/draft-post`, undefined, H)).status, 404);
  assert.equal((await call("GET", `${C()}/collections/posts/items`, undefined, { ...H, Origin: "https://ok.test" })).headers.get("access-control-allow-origin"), "https://ok.test");
  assert.equal((await call("GET", `${C()}/collections/posts/items`, undefined, { ...H, Origin: "https://evil.test" })).headers.get("access-control-allow-origin"), null);
  assert.equal((await call("GET", `${C()}/collections/posts/items`, undefined, { "X-API-Key": "wbk_live_wrong" })).status, 401);
});
await test("content API: a key of another website is refused; revoked key is refused", async () => {
  const other = await call("POST", "/websites", { name: "__apitest other" }); created.push(other.data._id);
  const k2 = (await call("POST", `/websites/${other.data._id}/api-keys`, { name: "k2" })).data.key;
  assert.equal((await call("GET", `${C()}/collections/posts/items`, undefined, { "X-API-Key": k2 })).status, 401);
  assert.equal((await call("GET", `/websites/${other.data._id}/collections/posts/records`)).status, 404, "collections do not leak between websites");
  await call("POST", `${W}/api-keys/${keyId}/revoke`);
  assert.equal((await call("GET", `${C()}/collections/posts/items`, undefined, { "X-API-Key": apiKey })).status, 401);
});
await test("webhooks + data sources: private and non-https addresses refused; secrets never returned", async () => {
  for (const url of ["http://example.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/x", "https://10.0.0.1/x", "https://[::1]/x", "https://user:pw@example.com/x"]) {
    assert.equal((await call("POST", `${W}/webhooks`, { name: "w", url, events: ["record.created"] })).status, 400, url);
    assert.equal((await call("POST", `${W}/data-sources`, { name: "Source", url })).status, 400, url);
    assert.equal((await call("POST", `${W}/data-sources/test`, { url })).status, 400, url);
  }
  assert.equal((await call("POST", `${W}/webhooks`, { name: "w", url: "https://example.com/hook", events: ["nope"] })).status, 400);
  const h = await call("POST", `${W}/webhooks`, { name: "w", url: "https://example.com/hook", events: ["record.created", "nope"] });
  assert.equal(h.status, 201); assert.deepEqual(h.data.events, ["record.created"]); assert.ok(h.data.secret.startsWith("whsec_"));
  assert.ok(!JSON.stringify((await call("GET", `${W}/webhooks`)).data).includes(h.data.secret));
  assert.equal((await call("PATCH", `${W}/webhooks/${h.data._id}`, { url: "https://10.1.1.1/x" })).status, 400);
  await call("DELETE", `${W}/webhooks/${h.data._id}`);
  const s = await call("POST", `${W}/data-sources`, { name: "Remote list", url: "https://example.com/data.json", headers: { Authorization: "Bearer topsecret", "Bad\nName": "x", Host: "evil" }, fields: [{ key: "name", path: "name" }, { key: "bad", path: "__proto__.x" }] });
  assert.equal(s.status, 201); assert.equal(s.data.hasHeaders, true); assert.deepEqual(s.data.fields.map((f) => f.key), ["name"]);
  assert.ok(!JSON.stringify((await call("GET", `${W}/data-sources`)).data).includes("topsecret"));
});

let itemPage;
await test("dynamic pages: /posts/:slug shows one record; lists page and search; private data stays out", async () => {
  assert.equal((await call("POST", `${W}/pages`, { title: "Bad", path: "/x/:slug", collectionKey: "nope" })).status, 400);
  itemPage = (await call("POST", `${W}/pages`, { title: "Post", path: "/posts/:slug", collectionKey: "posts", content: page([{ id: "h", type: "Heading", props: { text: "{{ item.title }}" } }, { id: "rp", type: "Repeater", repeat: { source: "collection:posts", limit: 2, sort: "price", paginate: true }, children: [{ id: "c", type: "ImageCard", props: { title: "{{ item.title }}", href: "{{ item.url }}" } }] }]) })).data;
  assert.equal(itemPage.pageType, "collectionItem");
  await call("POST", `${W}/pages/${itemPage._id}/publish`);
  const r = await call("GET", `/public/site/${K}/render?path=/posts/post-3&page=2`, undefined, anon);
  assert.equal(r.data.item.title, "Post 3"); assert.ok(!("secret" in r.data.item));
  assert.equal(r.data.data.rp.page, 2); assert.deepEqual(r.data.data.rp.items.map((i) => i.price), [200, 300]);
  assert.ok(r.data.data.rp.items.every((i) => !("secret" in i)));
  assert.equal(r.data.itemPaths.posts, "/posts/:slug");
  assert.equal((await call("GET", `/public/site/${K}/render?path=/posts/post-3&q=post%204`, undefined, anon)).data.data.rp.total, 1);
  assert.equal((await call("GET", `/public/site/${K}/render?path=/posts/draft-post`, undefined, anon)).status, 404);
  assert.equal((await call("GET", `/public/site/${K}/render?path=/posts/:slug`, undefined, anon)).status, 404);
  assert.ok((await call("GET", `${W}/preview?path=/posts/:slug`)).data.item, "the editor gets a sample record");
  assert.equal((await call("DELETE", `${W}/collections/posts`)).status, 409, "a collection in use by a page cannot be deleted");
});
await test("auto menu: lists the newest published records with their page addresses", async () => {
  await call("PUT", `${W}/menus/primary`, { items: [{ label: "Home", type: "page", pageId: home._id }, { label: "Latest", type: "auto", collectionKey: "posts", limit: 3 }] });
  const m = (await call("GET", `/public/site/${K}/render?path=/`, undefined, anon)).data.menus.primary;
  assert.equal(m[1].label, "Latest"); assert.equal(m[1].children.length, 3); assert.match(m[1].children[0].href, /^\/posts\/[a-z0-9-]+$/);
});
await test("server rendering: content, title, tags in the HTML; 304; 404; script injection escaped", async () => {
  const r = await call("GET", `${BASE}/site/${K}/posts/post-2`, undefined, anon);
  assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /text\/html/);
  assert.ok(r.text.includes(">Post 2</h2>") || r.text.includes(">Post 2<"), "heading is in the HTML");
  assert.match(r.text, /<title>Post 2 \| __apitest main<\/title>/); assert.ok(r.text.includes('property="og:title"')); assert.ok(r.text.includes("BreadcrumbList")); assert.ok(r.text.includes('rel="canonical"'));
  // the page data travels along in a JSON block; only the drawn page is checked for leftovers
  assert.ok(!r.text.replace(/<script type="application\/json" id="wb-bundle">[\s\S]*?<\/script>/, "").includes("{{ item"), "no unresolved expressions in the drawn page");
  assert.ok(r.headers.get("etag")); assert.ok(r.headers.get("content-security-policy-report-only") || r.headers.get("content-security-policy"));
  assert.equal((await call("GET", `${BASE}/site/${K}/posts/post-2`, undefined, { ...anon, "If-None-Match": r.headers.get("etag") })).status, 304);
  assert.equal((await call("GET", `${BASE}/site/${K}/nope`, undefined, anon)).status, 404);
  assert.equal((await call("GET", `${BASE}/site/zz-no-such-site`, undefined, anon)).status, 404);
  const x = await call("GET", `${BASE}/site/${K}/posts/post-2?q=${encodeURIComponent("</script><script>alert(1)</script>")}`, undefined, anon);
  assert.ok(!x.text.includes("<script>alert(1)"));
});
await test("cache: an edit to a record shows on the next request", async () => {
  await call("GET", `${BASE}/site/${K}/posts/post-5`, undefined, anon);
  const rec = recs[4];
  await call("PATCH", `${W}/collections/posts/records/${rec.id}`, { data: { title: "Post five renamed", price: 500, secret: "s5", when: rec.when } });
  assert.ok((await call("GET", `${BASE}/site/${K}/posts/post-5`, undefined, anon)).text.includes("Post five renamed"));
  const h = (await call("GET", `${W}/health`)).data;
  assert.ok(h.renders >= 2 && h.lastPurgedAt);
});
await test("feeds: sitemap, robots, RSS and calendar file", async () => {
  const sm = await call("GET", `${BASE}/site/${K}/sitemap.xml`, undefined, anon);
  assert.equal(sm.status, 200); assert.ok((sm.text.match(/<loc>/g) || []).length >= 7); assert.ok(!sm.text.includes("draft-post"));
  assert.match((await call("GET", `${BASE}/site/${K}/robots.txt`, undefined, anon)).text, /Sitemap: http/);
  const rss = await call("GET", `${BASE}/site/${K}/feed/posts.xml`, undefined, anon);
  assert.equal(rss.status, 200); assert.ok(rss.text.includes("<item>")); assert.ok(!rss.text.includes("Draft post")); assert.ok(!rss.text.includes(">s1<"));
  const ics = await call("GET", `${BASE}/site/${K}/calendar/posts/post-2.ics`, undefined, anon);
  assert.equal(ics.status, 200); assert.match(ics.headers.get("content-type"), /text\/calendar/); assert.match(ics.text, /BEGIN:VEVENT[\s\S]*DTSTART:\d{8}T\d{6}Z[\s\S]*SUMMARY:Post 2[\s\S]*END:VEVENT/);
  assert.equal((await call("GET", `${BASE}/site/${K}/feed/nope.xml`, undefined, anon)).status, 404);
  assert.equal((await call("GET", `${BASE}/site/${K}/calendar/posts/draft-post.ics`, undefined, anon)).status, 404);
});
await test("forms: stored as text, operators stripped, honeypot and empty forms dropped", async () => {
  assert.equal((await call("POST", `/public/site/${K}/forms`, { form: "Contact", page: "/", data: { Name: "A", $where: "x", "a.b": "c", Obj: { x: 1 }, Msg: "hi" } }, anon)).status, 201);
  const inbox = (await call("GET", `${W}/submissions`)).data;
  assert.equal(inbox.total, 1); assert.deepEqual(Object.keys(inbox.items[0].data).sort(), ["Msg", "Name", "a b", "where"]); assert.equal(inbox.items[0].leadCreated, false);
  await call("POST", `/public/site/${K}/forms`, { form: "Bot", data: { Name: "Bot" }, website_url: "http://spam" }, anon);
  assert.equal((await call("POST", `/public/site/${K}/forms`, { form: "Empty", data: {} }, anon)).status, 400);
  assert.equal((await call("GET", `${W}/submissions`)).data.total, 1);
  assert.equal((await call("POST", `/public/site/zz-no-such-site/forms`, { data: { a: "b" } }, anon)).status, 404);
  const id = inbox.items[0]._id;
  assert.equal((await call("PATCH", `${W}/submissions/${id}`, { read: true })).data.read, true);
  assert.equal((await call("DELETE", `${W}/submissions/${id}`)).status, 200);
});
await test("share links: draft visible with the link, gone after revoke, never indexed", async () => {
  const l = (await call("POST", `${W}/share-links`, { hours: 1 })).data;
  const r = await call("GET", `/public/preview/${l.token}/render?path=/`, undefined, anon);
  assert.equal(r.status, 200); assert.equal(r.data.page.content.root.children[0].props.text, "Draft only"); assert.match(r.headers.get("x-robots-tag"), /noindex/); assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal((await call("GET", `/public/preview/wrong-token/render?path=/`, undefined, anon)).status, 404);
  await call("DELETE", `${W}/share-links/${l._id}`);
  assert.equal((await call("GET", `/public/preview/${l.token}/render?path=/`, undefined, anon)).status, 404);
});
await test("apps: install creates collection, records and pages; second install adds nothing; uninstall removes", async () => {
  const app = { key: "events", name: "Events", collections: [{ key: "events", name: "Events", settings: { titleField: "title" }, fields: [{ key: "title", label: "Title", type: "text", required: true }, { key: "startsAt", label: "Starts", type: "date" }] }], records: { events: [{ title: "Open day", startsAt: new Date(Date.now() + 86400000).toISOString() }] }, pages: [{ title: "Events", path: "/events", content: page([]) }, { title: "Event", path: "/events/:slug", collectionKey: "events", content: page([]) }, { title: "Bad", path: "/../etc", content: page([]) }] };
  assert.deepEqual((await call("POST", `${W}/apps/install`, { app })).data, { collections: ["events"], pages: 2 });
  assert.deepEqual((await call("POST", `${W}/apps/install`, { app })).data, { collections: [], pages: 0 });
  assert.equal((await call("GET", `${W}/collections/events/records`)).data.total, 1);
  assert.equal((await call("POST", `${W}/apps/events/uninstall`, { removeContent: true })).status, 200);
  assert.equal((await call("GET", `${W}/collections/events/records`)).status, 404);
  assert.ok(!(await call("GET", `${W}/pages`)).data.some((p) => p.path.startsWith("/events")));
});
await test("export → import: pages, menus, collections and records survive; secrets and inbox do not travel", async () => {
  const pkg = (await call("GET", `${W}/export`)).data;
  const dump = JSON.stringify(pkg);
  assert.ok(!dump.includes("topsecret") && !dump.includes("wbk_live_") && !dump.includes("whsec_"));
  const copy = await call("POST", "/websites", { name: "__apitest copy", template: pkg });
  assert.equal(copy.status, 201); created.push(copy.data._id);
  const W2 = `/websites/${copy.data._id}`;
  const p2 = (await call("GET", `${W2}/pages`)).data;
  assert.deepEqual(p2.map((p) => p.path).sort(), (await call("GET", `${W}/pages`)).data.map((p) => p.path).sort());
  assert.equal(p2.find((p) => p.path === "/posts/:slug").pageType, "collectionItem");
  assert.equal((await call("GET", `${W2}/collections/posts/records`)).data.total, (await call("GET", `${W}/collections/posts/records`)).data.total);
  const m2 = (await call("GET", `${W2}/menus`)).data.find((m) => m.location === "primary").items;
  assert.ok(p2.some((p) => p._id === m2[0].pageId), "menu links point at the new website's pages");
  assert.equal((await call("GET", `${W2}/api-keys`)).data.length, 0); assert.equal((await call("GET", `${W2}/submissions`)).data.total, 0);
});
await test("cleanup: deleting a website removes everything it owns and takes the site offline", async () => {
  for (const id of created) assert.equal((await call("DELETE", `/websites/${id}`)).status, 200);
  assert.equal((await call("GET", "/websites")).data.filter((s) => s.name.startsWith("__apitest")).length, 0);
  assert.equal((await call("GET", `/public/site/${K}/render?path=/`, undefined, anon)).status, 404);
  assert.equal((await call("GET", `${BASE}/site/${K}`, undefined, anon)).status, 404);
  assert.equal((await call("GET", `/content/v1/sites/${K}/collections`, undefined, anon)).status, 404);
});

// safety net: never leave test websites behind, even after a failed test
for (const s of (await call("GET", "/websites")).data.filter((x) => x.name.startsWith("__apitest"))) await call("DELETE", `/websites/${s._id}`);
for (const [ok, name, err] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${err ? `\n      ${err}` : ""}`);
const failed = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
