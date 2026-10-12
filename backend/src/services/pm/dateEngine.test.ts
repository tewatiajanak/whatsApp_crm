/* Date engine tests — run with `npm run pm:test`. Times are India time (+05:30). */
import assert from "node:assert/strict";
import { WorkCalendar, addTat, calculateSchedule, findCycle } from "./dateEngine";

const ist = (s: string) => new Date(`${s}:00+05:30`);
const show = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16).replace("T", " ");
const cal: WorkCalendar = { workingDays: [1, 2, 3, 4, 5, 6], workStart: "09:30", workEnd: "18:30", holidays: new Set(["2026-10-03"]) };

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log("date engine");

test("working days skip the weekend and a holiday", () => {
  // Fri 2 Oct → Sat 3 is a holiday, Sun 4 is off → Mon 5, Tue 6
  assert.equal(show(addTat(ist("2026-10-02T10:00"), 2, "working_days", cal)), "2026-10-06 10:00");
});

test("calendar days do not skip anything", () => {
  assert.equal(show(addTat(ist("2026-10-02T10:00"), 2, "days", cal)), "2026-10-04 10:00");
});

test("hours count only working hours", () => {
  // 17:30 + 2h → 1h today, then 1h on the next working day (Mon 5, as Sat is a holiday)
  assert.equal(show(addTat(ist("2026-10-02T17:30"), 2, "hours", cal)), "2026-10-05 10:30");
  // started before opening time → counted from 09:30
  assert.equal(show(addTat(ist("2026-10-05T07:00"), 3, "hours", cal)), "2026-10-05 12:30");
});

const chain = [
  { id: "a", tatValue: 2, tatUnit: "working_days" as const, dependsOn: [] },
  { id: "b", tatValue: 1, tatUnit: "working_days" as const, dependsOn: ["a"] },
  { id: "c", tatValue: 3, tatUnit: "working_days" as const, dependsOn: ["b"] },
];
const start = ist("2026-10-05T09:30"); // Monday

test("a chain of 3 dependent tasks", () => {
  const s = calculateSchedule(chain, start, cal);
  assert.equal(show(s.get("a")!.due), "2026-10-07 09:30");
  assert.equal(show(s.get("b")!.start), "2026-10-07 09:30");
  assert.equal(show(s.get("b")!.due), "2026-10-08 09:30");
  assert.equal(show(s.get("c")!.due), "2026-10-12 09:30"); // Fri 9, Sat 10, (Sun off) Mon 12
});

test("a task waits for its LATEST predecessor", () => {
  const s = calculateSchedule(
    [
      { id: "x", tatValue: 1, tatUnit: "working_days", dependsOn: [] },
      { id: "y", tatValue: 4, tatUnit: "working_days", dependsOn: [] },
      { id: "z", tatValue: 1, tatUnit: "working_days", dependsOn: ["x", "y"] },
    ],
    start,
    cal
  );
  assert.equal(show(s.get("z")!.start), "2026-10-09 09:30");
});

test("predecessor finished 2 days late → dependents shift", () => {
  const late = new Map([["a", { start, due: ist("2026-10-09T09:30") }]]);
  const s = calculateSchedule(chain, start, cal, late);
  assert.equal(show(s.get("b")!.start), "2026-10-09 09:30");
  assert.equal(show(s.get("b")!.due), "2026-10-10 09:30");
  assert.equal(show(s.get("c")!.due), "2026-10-14 09:30");
});

test("predecessor finished early → dependents move earlier", () => {
  const early = new Map([["a", { start, due: ist("2026-10-06T09:30") }]]);
  const s = calculateSchedule(chain, start, cal, early);
  assert.equal(show(s.get("b")!.due), "2026-10-07 09:30");
});

test("a dependency loop is found and reported", () => {
  const loop = findCycle([
    { id: "a", dependsOn: ["c"] },
    { id: "b", dependsOn: ["a"] },
    { id: "c", dependsOn: ["b"] },
  ]);
  assert.equal(loop.length, 4);
  assert.throws(() => calculateSchedule([{ id: "a", tatValue: 1, tatUnit: "days", dependsOn: ["a"] }], start, cal));
});

console.log(`\n${passed} passed`);
