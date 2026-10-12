/* Website Builder data layer checks: run with `npm run website:test`. No database needed. */
import assert from "assert";
import { isPrivateAddress, assertPublicUrl, buildRecordFilter, cleanRecordData, seal, unseal, shapeRecord } from "./websiteData";

async function main() {
  // SSRF guard: private, loopback, link-local and metadata addresses are refused
  for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.5.4", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
  for (const url of ["http://example.com/", "https://localhost/", "https://127.0.0.1/", "https://169.254.169.254/latest", "https://[::1]/", "https://user:pw@example.com/", "ftp://example.com/", "not a url"]) await assert.rejects(() => assertPublicUrl(url), Error, url);

  // secrets round-trip and are not stored as plain text
  const sealed = seal("Bearer abc123");
  assert.ok(sealed && !sealed.includes("abc123"));
  assert.equal(unseal(sealed), "Bearer abc123");
  assert.equal(unseal("garbage"), "");

  const col: any = { website: "w1", key: "posts", fields: [{ key: "title", label: "Title", type: "text", required: true }, { key: "price", label: "Price", type: "number" }, { key: "secret", label: "Secret", type: "text", hiddenFromApi: true }] };
  // query filter: only declared fields and known operators reach the database
  const f = buildRecordFilter(col, { filter: { price: { gte: "100", $where: "1" }, nope: { eq: 1 }, secret: "x", $or: [{}] }, sort: "-price", limit: 500, page: -3, search: "a.b*" }, "public").mongo;
  assert.deepEqual(f["data.price"], { $gte: 100 });
  assert.equal(f["data.nope"], undefined);
  assert.equal(f["data.secret"], undefined);
  assert.equal(f.$or, undefined);
  assert.equal(f.status, "published");
  assert.equal(String(f.searchText.$regex), "/a\\.b\\*/");
  const q = buildRecordFilter(col, { limit: 500, page: -3, sort: "$where" }, "admin");
  assert.equal(q.limit, 100); assert.equal(q.page, 1); assert.deepEqual(Object.keys(q.sort), ["publishedAt", "_id"]); assert.equal(q.mongo.status, undefined);

  // record values: typed, required enforced, unknown keys dropped
  assert.deepEqual(cleanRecordData(col.fields, { title: " Hi ", price: "12", extra: 1, __proto__: { x: 1 } }), { title: " Hi ", price: 12, secret: "" });
  assert.throws(() => cleanRecordData(col.fields, { price: 1 }), /Title is required/);
  assert.throws(() => cleanRecordData(col.fields, { title: "a", price: "abc" }), /must be a number/);
  assert.throws(() => cleanRecordData([{ key: "img", label: "Image", type: "image" }], { img: "javascript:alert(1)" }), /https/);

  // private fields never leave through the public shape
  const pub = shapeRecord(col, { _id: "1", slug: "a", status: "draft", data: { title: "T", secret: "S" } }, "public");
  assert.equal(pub.secret, undefined); assert.equal(pub.status, undefined); assert.equal(pub.title, "T");
  console.log("websiteData: all checks passed");
}
main().catch((e) => { console.error(e); process.exit(1); });
