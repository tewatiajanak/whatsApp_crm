import assert from "node:assert/strict";
import { evaluate, validate, passes } from "./expressions.js";
const ctx = { item: { title: "Hello", price: 1500, tags: ["a", "b"], date: "2026-03-05T10:00:00Z", author: { name: "Ria" }, html: "<b>x</b> y", empty: "" }, query: { q: "<script>" }, site: { name: "S" } };
assert.equal(evaluate("{{ item.title }}", ctx), "Hello");
assert.equal(evaluate("Hi {{ item.title | upper }}!", ctx), "Hi HELLO!");
assert.equal(evaluate("{{ item.price }}", ctx), 1500);
assert.equal(evaluate("{{ item.price | currency:\"INR\" }}", ctx), "₹1,500");
assert.equal(evaluate("{{ item.tags | join:\" / \" }}", ctx), "a / b");
assert.equal(evaluate("{{ item.date | date:\"dd-mm-yyyy\" }}", ctx).length, 10);
assert.equal(evaluate("{{ item.author.name }}", ctx), "Ria");
assert.equal(evaluate("{{ item.tags[1] }}", ctx), "b");
assert.equal(evaluate("{{ item.missing.deep }}", ctx), "");
assert.equal(evaluate("{{ item.empty | default:\"n/a\" }}", ctx), "n/a");
assert.equal(evaluate("{{ item.html | stripHtml }}", ctx), "x y");
assert.equal(evaluate("{{ item.title | truncate:3 }}", ctx), "Hel…");
// safety: no prototype access, no unknown roots, no function calls, no unknown filters
for (const bad of ["{{ item.__proto__ }}", "{{ item.constructor.constructor }}", "{{ item.constructor }}", "{{ window.location }}", "{{ process.env }}", "{{ item.title | eval }}", "{{ item.title.toString() }}", "{{ constructor }}", "{{ item['title'] }}", "{{ item.title; alert(1) }}", "{{ this }}"]) assert.equal(evaluate(bad, ctx), "", bad);
assert.equal(evaluate("x".repeat(600) + "{{ item.title }}", ctx).includes("Hello"), false);
assert.ok(validate("{{ item.nope }}", ["title"]).length === 1);
assert.deepEqual(validate("{{ item.title | upper }}", ["title"]), []);
assert.ok(validate("{{ item.title", ["title"]).length >= 1);
assert.equal(passes({ match: "all", rules: [{ left: "{{ item.price }}", op: "gt", right: "1000" }, { left: "{{ item.title }}", op: "eq", right: "Hello" }] }, ctx), true);
assert.equal(passes({ match: "all", rules: [{ left: "{{ item.price }}", op: "lt", right: "1000" }] }, ctx), false);
assert.equal(passes({ match: "any", rules: [{ left: "{{ item.empty }}", op: "notEmpty", right: "" }, { left: "{{ item.tags }}", op: "contains", right: "b" }] }, ctx), true);
assert.equal(passes(null, ctx), true);
// fuzz: random input never throws and never returns a function
const chars = "{}|:.,[]()\"' itemqueryconstructor__proto__0123abc;=+-*/<>\\\n";
for (let i = 0; i < 20000; i++) { let s = ""; const n = Math.floor(Math.random() * 60); for (let j = 0; j < n; j++) s += chars[Math.floor(Math.random() * chars.length)]; const out = evaluate(Math.random() < 0.7 ? `{{${s}}}` : s, ctx); assert.notEqual(typeof out, "function"); }
console.log("expressions: all checks passed (incl. 20000 fuzz cases)");
