"""Lead CRM — API regression test.

Creates a handful of clearly marked test leads ("ZZ Test …", phones 90000001xx),
exercises the lead API on them and deletes them again. Sends no messages.

  CRM_TEST_ADMIN=admin@example.com CRM_TEST_PASSWORD=... python3 backend/scripts/crm_e2e.py
  (or CRM_TEST_TOKEN=<jwt> to skip the login)
"""
import json, os, sys, urllib.request, urllib.error, urllib.parse, datetime
B = os.environ.get("CRM_TEST_API", "http://localhost:4001/api")

def call(method, path, body=None, token=None, raw=False):
    headers = {}
    data = None
    if token: headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode(); headers["Content-Type"] = "application/json"
    req = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            out = r.read()
            return (r.status, out if raw else json.loads(out))
    except urllib.error.HTTPError as e:
        out = e.read()
        try: return (e.code, json.loads(out))
        except Exception: return (e.code, {"error": out[:160].decode(errors="replace")})

ok_n = 0; bad = []
def check(name, cond, info=""):
    global ok_n
    if cond: ok_n += 1; print("  ok  ", name)
    else: bad.append(name); print("  FAIL", name, str(info)[:300])

T = os.environ.get("CRM_TEST_TOKEN")
if not T:
    s, d = call("POST", "/auth/login", {"email": os.environ.get("CRM_TEST_ADMIN", ""), "password": os.environ.get("CRM_TEST_PASSWORD", "")})
    T = d.get("data", {}).get("token")
    if not T: sys.exit("Could not sign in: set CRM_TEST_ADMIN / CRM_TEST_PASSWORD or CRM_TEST_TOKEN")

def api(method, path, body=None, raw=False): return call(method, path, body, T, raw)
q = urllib.parse.quote
today = datetime.date.today()
day = lambda n: (today + datetime.timedelta(days=n)).isoformat()

def cleanup():
    s, d = api("GET", "/leads?q=" + q("ZZ ") + "&perPage=200")
    ids = [l["_id"] for l in d.get("data", []) if "ZZ " in l["name"]]
    s, w = api("GET", "/workflows"); [api("DELETE", "/workflows/" + x["_id"]) for x in w.get("data", []) if x["name"].startswith("ZZ ")]
    s, k = api("GET", "/crm/api-keys"); [api("DELETE", "/crm/api-keys/" + x["_id"]) for x in k.get("data", []) if x["name"].startswith("ZZ ")]
    if ids: api("POST", "/leads/bulk", {"action": "delete", "ids": ids})
    # deleted leads wait in the recycle bin: empty the test ones out of it too
    s, t = api("GET", "/crm/trash"); [api("DELETE", "/crm/trash/" + x["_id"]) for x in t.get("data", {}).get("items", []) if "ZZ " in x["name"]]
    for kind in ("courses", "branches", "partners"):
        s, k = api("GET", "/crm/" + kind); [api("DELETE", "/crm/" + kind + "/" + x["_id"]) for x in k.get("data", []) if x["name"].startswith("ZZ ")]
    return len(ids)
cleanup()

print("meta + lists")
s, meta = api("GET", "/leads/meta"); m = meta.get("data", {})
check("meta loads", s == 200 and m.get("statuses") and "owners" in m, meta)
statuses = m["statuses"]
open_st = [x for x in statuses if not x.get("isWon") and not x.get("isLost")]
lost_st = next((x for x in statuses if x.get("isLost")), None)
won_st = next((x for x in statuses if x.get("isWon")), None)
s, d = api("GET", "/leads?perPage=5"); check("list is paginated with a total", s == 200 and "total" in d and "pages" in d, d)
s, d = api("GET", "/leads/view-counts"); check("view counts", s == 200 and "all" in d["data"] and "overdue" in d["data"], d)
s, d = api("GET", "/leads?q=" + q("(((")); check("search with regex characters is safe", s == 200, d)
s, d = api("GET", "/leads?owner[$ne]=x"); check("operator in a filter is ignored", s == 200, d)
s, d = call("GET", "/leads"); check("no token → 401", s == 401, d)

print("create + duplicates")
s, d = api("POST", "/leads/convert", {"name": "ZZ Test One", "phone": "+91 90000 00101", "email": "ZZ1@Example.com", "course": "Class XI", "city": "Pune"})
check("lead created", s == 201 and d["data"]["created"], d)
L1 = d["data"]["lead"]["_id"]
check("phone is cleaned", d["data"]["lead"]["phone"] == "+919000000101", d["data"]["lead"]["phone"])
check("email is lower-cased", d["data"]["lead"].get("email") == "zz1@example.com", d["data"]["lead"].get("email"))
s, d = api("GET", "/leads/" + L1); lead = d["data"]
check("first follow-up is set", bool(lead.get("nextFollowUp")), lead.get("nextFollowUp"))
check("score and priority are set", isinstance(lead.get("score"), (int, float)) and lead.get("priority") in ("hot", "warm", "cold"), (lead.get("score"), lead.get("priority")))
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Dup", "phone": "09000000101"})
check("same phone in another format is not a new lead", s == 200 and d["data"]["created"] is False and d["data"]["lead"]["_id"] == L1, d)
s, d = api("GET", "/leads/check-duplicate?phone=" + q("9000000101")); check("duplicate check finds it", d["data"]["duplicate"] is True, d)
s, d = api("GET", "/leads/check-duplicate?phone=" + q("9000000199")); check("duplicate check clears a new number", d["data"]["duplicate"] is False, d)
s, d = api("POST", "/leads/convert", {"name": "", "phone": "9000000102"}); check("name is required", s == 400, d)
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Bad", "phone": "12"}); check("bad phone rejected", s == 400, d)
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Bad", "phone": "9000000102", "email": "nope"}); check("bad email rejected", s == 400, d)
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Two", "phone": "9000000102", "tags": ["zz-tag"]}); L2 = d["data"]["lead"]["_id"]
check("second lead created", s == 201, d)

print("edit")
s, d = api("PATCH", "/leads/" + L1, {"city": "Mumbai", "value": 45000, "tags": ["zz-tag", "zz-vip"], "tenant": "000000000000000000000000", "score": 1})
check("edit saves allowed fields", s == 200 and d["data"]["city"] == "Mumbai" and d["data"]["value"] == 45000 and len(d["data"]["tags"]) == 2, d)
s, d = api("PATCH", "/leads/" + L2, {"phone": "9000000101"}); check("changing phone to an existing one → 409", s == 409, d)
s, d = api("PATCH", "/leads/" + L1, {"priority": "hot"}); check("priority can be set by hand", s == 200 and d["data"]["priority"] == "hot", d)
s, d = api("PATCH", "/leads/" + L1, {"owner": "Nobody Here"}); check("unknown owner rejected", s == 400, d)
if m["owners"]:
    s, d = api("PATCH", "/leads/" + L1, {"owner": m["owners"][0]}); check("owner assigned", s == 200 and d["data"]["owner"] == m["owners"][0], d)
    s, d = api("GET", "/leads/" + L1 + "/followups"); check("open follow-ups move to the new owner", all(f["owner"] == m["owners"][0] for f in d["data"] if not f["done"]), d)

print("notes, calls, timeline")
s, d = api("POST", "/leads/" + L1 + "/notes", {"text": "ZZ note"}); check("note added", s == 200, d)
s, d = api("POST", "/leads/" + L1 + "/calls", {"outcome": "Connected", "durationMin": 4, "note": "ZZ call"}); check("call logged", s == 200 and d["data"].get("firstContactedAt"), d)
s, d = api("POST", "/leads/" + L1 + "/calls", {"outcome": "Shouting"}); check("unknown call outcome rejected", s == 400, d)
s, d = api("GET", "/leads/" + L1 + "/timeline"); types = [a["type"] for a in d["data"]]
check("timeline has created, note, call, assignment", all(t in types for t in ["created", "note", "call", "edited"]), types)
check("note appears once on the timeline", types.count("note") == 1, types)

print("follow-ups")
s, d = api("POST", "/leads/" + L1 + "/followups", {"current": {"type": "call", "date": day(0), "time": "11:00", "remark": "ZZ spoke to parent"}, "next": {"type": "whatsapp", "date": day(2), "time": "15:30", "remark": "ZZ send brochure"}})
check("log + schedule next", s == 200 and d["data"]["count"] == 2, d)
s, d = api("GET", "/leads/" + L1 + "/followups"); fus = d["data"]; open_fus = [f for f in fus if not f["done"]]
check("exactly one open follow-up remains", len(open_fus) == 1 and open_fus[0]["type"] == "WhatsApp", [(f["type"], f["done"]) for f in fus])
s, d = api("GET", "/leads/" + L1); check("lead's next follow-up mirrors the open one", d["data"]["nextFollowUp"] == open_fus[0]["due"] and d["data"].get("nextRemark") == "ZZ send brochure", (d["data"]["nextFollowUp"], open_fus[0]["due"]))
s, d = api("POST", "/followups/" + open_fus[0]["_id"] + "/reschedule", {"date": day(5), "time": "10:00"}); check("reschedule", s == 200, d)
s, d = api("POST", "/followups/" + open_fus[0]["_id"] + "/reschedule", {"date": "rubbish"}); check("reschedule needs a real date", s == 400, d)
s, d = api("POST", "/followups/" + open_fus[0]["_id"] + "/complete", {"outcome": "Interested", "note": "ZZ wants a visit", "next": {"date": day(1), "type": "Visit", "note": "ZZ campus visit"}})
check("complete with outcome + next", s == 200 and d["data"]["done"] and d["data"].get("completedAt"), d)
s, d = api("GET", "/leads/" + L1 + "/followups"); open_fus = [f for f in d["data"] if not f["done"]]
check("next follow-up was scheduled", len(open_fus) == 1 and open_fus[0]["type"] == "Visit", d)
s, d = api("POST", "/followups/" + open_fus[0]["_id"] + "/complete", {}); s2, d2 = api("POST", "/followups/" + open_fus[0]["_id"] + "/reschedule", {"date": day(3)})
check("a completed follow-up cannot be rescheduled", s2 == 400, d2)
s, d = api("GET", "/leads/" + L1); check("no open follow-up → lead's next follow-up is cleared", d["data"]["nextFollowUp"] is None, d["data"]["nextFollowUp"])
s, d = api("POST", "/followups", {"lead": L2, "date": day(-2), "type": "call", "note": "ZZ overdue"}); F2 = d.get("data", {}).get("_id")
check("follow-up created for a lead", s == 201 and d["data"]["type"] == "Call", d)
s, d = api("POST", "/followups", {"lead": "000000000000000000000000", "date": day(1)}); check("follow-up for an unknown lead → 404", s == 404, d)
s, d = api("GET", "/followups/buckets"); b = d["data"]
check("buckets have counts and lead details", s == 200 and b["counts"]["overdue"] >= 1 and any(f["_id"] == F2 for f in b["overdue"]), b["counts"])
s, d = api("GET", "/leads?followUp=overdue&q=" + q("ZZ Test")); check("overdue filter finds the lead", any(l["_id"] == L2 for l in d["data"]), d)
s, d = api("GET", "/followups/workload?counsellor=" + q(m["me"])); check("workload", s == 200 and "pending" in d["data"], d)

print("status")
s, d = api("POST", "/leads/" + L1 + "/status", {"statusId": open_st[-1]["_id"]}); check("status changes", s == 200, d)
s, d = api("POST", "/leads/" + L1 + "/status", {"statusId": "000000000000000000000000"}); check("unknown status → 404", s == 404, d)
if lost_st:
    s, d = api("POST", "/leads/" + L2 + "/status", {"statusId": lost_st["_id"], "lostReason": "ZZ too far"})
    check("lost with a reason", s == 200 and d["data"]["lostReason"] == "ZZ too far", d)
    s, d = api("GET", "/leads/" + L2 + "/followups"); check("losing a lead closes its follow-ups", all(f["done"] for f in d["data"]), d)
    s, d = api("GET", "/leads?view=lost&q=" + q("ZZ Test")); check("lost view", any(l["_id"] == L2 for l in d["data"]), d)
    s, d = api("GET", "/leads?view=open&q=" + q("ZZ Test")); check("open view excludes lost", all(l["_id"] != L2 for l in d["data"]), d)

print("bulk, import, export")
s, d = api("POST", "/leads/bulk", {"action": "addTag", "ids": [L1, L2], "tag": "zz-bulk"}); check("bulk tag", s == 200 and d["data"]["done"] == 2, d)
s, d = api("GET", "/leads?tag=zz-bulk"); check("tag filter", d["total"] == 2, d.get("total"))
s, d = api("POST", "/leads/bulk", {"action": "priority", "ids": [L1, L2], "priority": "cold"}); check("bulk priority", s == 200, d)
s, d = api("POST", "/leads/bulk", {"action": "status", "ids": [L1], "statusId": open_st[0]["_id"]}); check("bulk status", s == 200 and d["data"]["done"] == 1, d)
s, d = api("POST", "/leads/bulk", {"action": "nope", "ids": [L1]}); check("unknown bulk action rejected", s == 400, d)
s, d = api("POST", "/leads/bulk", {"action": "addTag", "ids": [], "tag": "x"}); check("bulk needs a selection", s == 400, d)
rows = [
    {"name": "ZZ Test Imp A", "phone": "9000000110", "email": "a@zz.test", "city": "Delhi", "source": "ZZ Test Source", "tags": "zz-imp; zz-a"},
    {"name": "ZZ Test Imp B", "phone": "9000000111"},
    {"name": "ZZ Test Imp B again", "phone": "+91-9000000111"},
    {"name": "", "phone": "9000000112"},
    {"name": "ZZ Test Imp Bad", "phone": "12"},
    {"name": "ZZ Test One again", "phone": "9000000101", "course": "ZZ Other Course", "state": "ZZ State"},
]
s, d = api("POST", "/leads/import", {"rows": rows, "dryRun": True}); sm = d.get("data", {}).get("summary", {})
check("import dry run verdicts", s == 200 and sm == {"total": 6, "created": 2, "updated": 0, "duplicate": 2, "invalid": 2}, d)
s, c = api("GET", "/leads?q=" + q("ZZ Test Imp")); check("dry run saves nothing", c["total"] == 0, c.get("total"))
s, d = api("POST", "/leads/import", {"rows": rows, "onDuplicate": "update"}); sm = d.get("data", {}).get("summary", {})
check("import creates and updates", s == 200 and sm.get("created") == 2 and sm.get("updated") == 1, d)
s, d = api("GET", "/leads/" + L1); check("import fills blanks but overwrites nothing", d["data"].get("state") == "ZZ State" and d["data"]["course"] == "Class XI" and d["data"]["name"] == "ZZ Test One", (d["data"].get("state"), d["data"]["course"], d["data"]["name"]))
s, d = api("GET", "/leads?q=" + q("ZZ Test Imp A")); imp = d["data"][0] if d["data"] else {}
check("imported lead has source, tags, follow-up", imp.get("source", {}).get("name") == "ZZ Test Source" and "zz-imp" in imp.get("tags", []) and imp.get("nextFollowUp"), imp)
s, raw = api("GET", "/leads/export?q=" + q("ZZ Test"), raw=True); text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else ""
check("export is a CSV of the filtered leads", s == 200 and text.startswith('"Name"') and "ZZ Test One" in text and text.count("\r\n") >= 4, text[:200])

print("board, analytics, merge")
s, d = api("GET", "/leads/board?q=" + q("ZZ Test")); cols = d.get("data", {}).get("columns", [])
check("board has a column per status with counts", s == 200 and len(cols) == len(statuses) and sum(c["count"] for c in cols) == 4, [(c["status"]["name"], c["count"]) for c in cols])
s, d = api("GET", "/leads/analytics"); a = d.get("data", {})
check("analytics", s == 200 and all(k in a for k in ["totals", "funnel", "bySource", "byOwner", "trend", "lostReasons", "aging"]) and a["totals"]["leads"] >= 4, list(a.keys()))
s, d = api("GET", "/conversion/stats"); check("conversion stats keeps its shape", s == 200 and "convRate" in d["data"]["totals"] and isinstance(d["data"]["funnel"], list), d)
s, d = api("PATCH", "/leads/" + L2, {"email": "zz1@example.com"})
s, d = api("GET", "/leads/duplicates"); sets = [g for g in d["data"] if any(l["_id"] == L1 for l in g["leads"])]
check("duplicates found by email", s == 200 and len(sets) == 1 and len(sets[0]["leads"]) == 2, d)
s, d = api("POST", "/leads/merge", {"primaryId": L1, "duplicateIds": [L2]}); check("merge", s == 200 and "zz-bulk" in d["data"]["tags"] and d["data"].get("altPhone"), d)
s, d = api("GET", "/leads/" + L2); check("merged duplicate is gone", s == 404, d)
s, d = api("GET", "/leads/" + L1 + "/timeline"); check("merge is on the timeline, with the duplicate's history", "merged" in [a["type"] for a in d["data"]], [a["type"] for a in d["data"]])

print("registration + public capture")
if won_st:
    s, d = api("POST", "/registrations", {"lead": L1, "course": "ZZ Course", "status": won_st["_id"]})
    check("registration saved against the lead", s == 201 and d["data"]["name"] == "ZZ Test One", d)
    s, d = api("GET", "/leads/" + L1); check("registration moves the lead's status", d["data"]["status"]["_id"] == won_st["_id"] and d["data"]["score"] == 100, (d["data"]["status"], d["data"]["score"]))
    s, d = api("GET", "/registrations?q=" + q("ZZ Test")); [api("DELETE", "/registrations/" + r["_id"]) for r in d.get("data", [])]
s, d = call("POST", "/public/enquiry-form/does-not-exist", {"name": "ZZ Test Public", "phone": "9000000120"}); check("unknown public form → 404", s == 404, d)
s, d = call("POST", "/public/landing-page/does-not-exist/enquiry", {"name": "ZZ Test Public", "phone": "9000000120"}); check("unknown landing page → 404", s == 404, d)

print("settings, automation, fees, documents, targets, capture, applications")
s, d = api("GET", "/crm/settings"); st0 = d.get("data", {})
check("settings load with secrets masked", s == 200 and "reminders" in st0 and "telephonyCallbackUrl" in st0 and not str(st0["sms"]["authKey"]).startswith("v1:"), d)
s, d = api("PUT", "/crm/settings", {"reports": {"enabled": False, "recipients": ["not-an-email"]}}); check("bad report recipient rejected", s == 400, d)
s, d = api("PUT", "/crm/settings", {"sms": {**st0["sms"], "customHeaders": "not json"}}); check("bad header JSON rejected", s == 400, d)
s, d = api("PUT", "/crm/settings", {"reminders": st0["reminders"], "sla": st0["sla"]}); check("settings save", s == 200, d)
s, d = api("POST", "/leads/" + L1 + "/call", {}); check("click-to-call without a provider explains itself", s == 400 and "not set up" in d.get("error", ""), d)
if st0["sms"]["provider"] == "none":
    s, d = api("POST", "/messages/send", {"channel": "sms", "to": "9000000101", "text": "ZZ"}); check("SMS without a gateway explains itself", s == 400 and "not set up" in d.get("error", ""), d)

s, d = api("GET", "/crm/automation/meta"); check("automation meta", s == 200 and "users" in d["data"], d)
wf = {"name": "ZZ Test Rule", "type": "Alert", "active": True, "event": "lead.note_added",
      "conditions": [{"field": "name", "operator": "contains", "value": "zz test one"}],
      "actions": [{"kind": "tag", "params": {"tag": "zz-auto"}}, {"kind": "priority", "params": {"priority": "hot"}}, {"kind": "followup", "params": {"type": "Visit", "note": "ZZ auto for {{first_name}}", "daysFromNow": 3}},
                  {"kind": "tag", "params": {"tag": "zz-later"}, "delayMinutes": 600}, {"kind": "sms", "params": {"message": "Hi {{name}}"}}]}
s, d = api("POST", "/workflows", wf); WF = d.get("data", {}).get("_id"); check("automation rule saved", s == 201 and len(d["data"]["actions"]) == 5, d)
s, d = api("POST", "/workflows", {**wf, "actions": [{"kind": "explode", "params": {}}]}); check("unknown action kind rejected", s >= 400, d)
s, d = api("POST", "/leads/" + L1 + "/notes", {"text": "ZZ trigger"})
s, d = api("GET", "/leads/" + L1); ld = d["data"]
check("rule ran: tag + priority", "zz-auto" in ld["tags"] and ld["priority"] == "hot" and "zz-later" not in ld["tags"], (ld["tags"], ld["priority"]))
s, d = api("GET", "/leads/" + L1 + "/followups"); check("rule ran: follow-up with the lead's name filled in", any(f.get("note") == "ZZ auto for ZZ" and f["type"] == "Visit" for f in d["data"]), [f.get("note") for f in d["data"]])
s, d = api("POST", "/leads/convert", {"name": "ZZ Other Person", "phone": "9000000150"}); L3 = d["data"]["lead"]["_id"]
s, d = api("POST", "/leads/" + L3 + "/notes", {"text": "ZZ no trigger"}); s, d = api("GET", "/leads/" + L3); check("rule skipped when the condition does not match", "zz-auto" not in d["data"]["tags"], d["data"]["tags"])
s, d = api("GET", "/crm/automation/runs?workflow=" + WF); runs = d["data"]["runs"]
check("run log: 3 done, SMS failure recorded, 1 step waiting", s == 200 and sum(1 for x in runs if x["ok"]) == 3 and any(x["action"] == "sms" and not x["ok"] for x in runs) == (st0["sms"]["provider"] == "none") and d["data"]["waiting"] >= 1, [(x["action"], x["ok"]) for x in runs])
api("DELETE", "/workflows/" + WF)

s, d = api("POST", "/leads/" + L1 + "/fees", {"title": "ZZ Registration fee", "amount": 5000, "dueDate": day(5)}); F1 = d.get("data", {}).get("_id"); tok = d.get("data", {}).get("token")
check("fee added with a payment link", s == 201 and "/pay/" in d["data"]["link"], d)
s, d = api("POST", "/leads/" + L1 + "/fees", {"title": "", "amount": -1}); check("fee needs a title and amount", s == 400, d)
s, d = call("GET", "/public/pay/" + tok); check("public payment page: only what the payer needs", s == 200 and d["data"]["amount"] == 5000 and d["data"]["status"] == "pending" and "lead" not in d["data"] and "tenant" not in d["data"], d)
s, d = call("GET", "/public/pay/nope"); check("unknown payment link → 404", s == 404, d)
s, d = api("POST", "/lead-fees/" + F1 + "/pay", {"mode": "UPI", "reference": "ZZ-UTR"}); check("manual payment gives a receipt", s == 200 and d["data"]["status"] == "paid" and d["data"]["receiptNo"], d)
s, d = api("POST", "/lead-fees/" + F1 + "/pay", {"mode": "Cash"}); check("a fee cannot be paid twice", s == 400, d)
s, d = api("POST", "/lead-fees/" + F1 + "/cancel", {}); check("a paid fee cannot be cancelled", s == 400, d)
s, d = call("POST", "/public/pay/" + tok + "/start", {}); check("paid link will not start another payment", s == 400, d)
s, d = api("GET", "/leads/" + L1 + "/fees"); check("fee totals", d["data"]["paid"] == 5000 and d["data"]["pending"] == 0, d["data"])

import uuid
def upload(path, name, content, mime, token=T):
    bnd = uuid.uuid4().hex
    body = (f'--{bnd}\r\nContent-Disposition: form-data; name="category"\r\n\r\nID proof\r\n--{bnd}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n').encode() + content + f"\r\n--{bnd}--\r\n".encode()
    req = urllib.request.Request(B + path, data=body, method="POST", headers={"Authorization": "Bearer " + token, "Content-Type": f"multipart/form-data; boundary={bnd}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
s, d = upload("/leads/" + L1 + "/documents", "zz-marksheet.pdf", b"%PDF-1.4 zz test", "application/pdf"); D1 = d.get("data", {}).get("_id")
check("document attached", s == 201 and d["data"]["category"] == "ID proof", d)
s, d = upload("/leads/" + L1 + "/documents", "zz.exe", b"MZ", "application/x-msdownload"); check("unsafe file type rejected", s == 400, d)
s, raw = api("GET", "/leads/" + L1 + "/documents/" + D1 + "/file", raw=True); check("document downloads for a signed-in user", s == 200 and raw == b"%PDF-1.4 zz test", raw[:30])
s, d = call("GET", "/leads/" + L1 + "/documents/" + D1 + "/file"); check("document is not public", s == 401, d)
s, d = api("DELETE", "/leads/" + L1 + "/documents/" + D1); check("document removed", s == 200, d)

month = today.isoformat()[:7]
if m["owners"]:
    s, d = api("PUT", "/crm/targets", {"month": month, "rows": [{"owner": m["owners"][0], "wins": 999999, "calls": 5}, {"owner": "Nobody Here", "wins": 3}]}); check("targets saved for real users only", s == 200 and d["data"]["saved"] == 1, d)
    s, d = api("GET", "/crm/targets?month=" + month); row = next(x for x in d["data"]["rows"] if x["owner"] == m["owners"][0])
    check("leaderboard shows target and achieved", row["target"]["wins"] == 999999 and "calls" in row["achieved"] and row["progress"] is not None, row)
    api("PUT", "/crm/targets", {"month": month, "rows": [{"owner": m["owners"][0], "wins": 0, "calls": 0}]})

s, d = api("POST", "/crm/api-keys", {"name": "ZZ Test Key"}); K = d.get("data", {}); check("capture key created and shown once", s == 201 and K.get("key", "").startswith("lk_"), d)
WH = B.replace("/api", "/webhooks")
def hook(path, body, headers=None):
    req = urllib.request.Request(WH + path, data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
s, d = hook("/leads/" + K["key"], {"name": "ZZ Test Hook", "mobile": "9000000140", "city": "Nagpur", "utm_campaign": "zz-camp"}); check("lead pushed in with a key", s == 200 and d["created"] == 1, d)
s, d = hook("/leads", {"google_key": K["key"], "campaign_id": 77, "user_column_data": [{"column_id": "FULL_NAME", "string_value": "ZZ Test Google"}, {"column_id": "PHONE_NUMBER", "string_value": "+919000000141"}, {"column_id": "EMAIL", "string_value": "g@zz.test"}]})
check("Google Ads lead form format accepted", s == 200 and d["created"] == 1, d)
s, d = hook("/leads/lk_wrong", {"name": "ZZ Test Bad", "phone": "9000000142"}); check("wrong key → 401", s == 401, d)
s, d = hook("/leads/" + K["key"], {"foo": "bar"}); check("push without name/phone → 400", s == 400, d)
s, d = api("GET", "/leads?q=" + q("ZZ Test Google")); g = d["data"][0] if d["data"] else {}
check("pushed lead carries source of capture and campaign", g.get("capturedFrom") == "API: ZZ Test Key" and g.get("email") == "g@zz.test", g)
s, d = api("PATCH", "/crm/api-keys/" + K["_id"], {"active": False}); s, d = hook("/leads/" + K["key"], {"name": "ZZ Test Off", "phone": "9000000143"}); check("switched-off key stops working", s == 401, d)
s, d = api("GET", "/crm/api-keys"); check("key list never returns the key", all("key" not in x and "keyHash" not in x for x in d["data"]), d)
api("DELETE", "/crm/api-keys/" + K["_id"])
s, d = hook("/telephony/" + st0["tenant"] + "?k=wrong", {"CallSid": "x"}); check("telephony callback needs its secret", s == 401, d)

s, d = api("POST", "/leads/" + L1 + "/status", {"statusId": open_st[0]["_id"]})
s, d = api("POST", "/registrations", {"lead": L1, "course": "ZZ App Course"}); A = d.get("data", {})
check("application gets a number and a status link", s == 201 and A.get("appNo", "").startswith("APP-") and A.get("token") and A.get("stage") == "Submitted", d)
s, d = api("GET", "/crm/applications?q=" + q("ZZ Test")); check("applications list with stage counts", s == 200 and any(x["_id"] == A["_id"] for x in d["data"]["items"]) and "Submitted" in d["data"]["counts"], d)
s, d = api("PATCH", "/crm/applications/" + A["_id"], {"stage": "Nonsense"}); check("unknown stage rejected", s == 400, d)
s, d = api("PATCH", "/crm/applications/" + A["_id"], {"stage": "Under review", "note": "ZZ"}); check("stage moves", s == 200 and d["data"]["stage"] == "Under review", d)
s, d = api("POST", "/crm/applications/" + A["_id"] + "/offer", {"text": "ZZ offer", "amount": 12000, "validTill": day(7)}); check("offer made", s == 200 and d["data"]["stage"] == "Offer made", d)
s, d = call("GET", "/public/application/" + A["token"]); pa = d.get("data", {})
check("applicant page: stage, offer and the fee to pay", s == 200 and pa["stage"] == "Offer made" and pa["offer"]["amount"] == 12000 and any(f["amount"] == 12000 and f["status"] == "pending" for f in pa["fees"]) and "phone" not in pa, d)
s, d = call("POST", "/public/application/" + A["token"] + "/offer", {"response": "accept"}); check("accepting needs a typed name", s == 400, d)
s, d = call("POST", "/public/application/" + A["token"] + "/offer", {"response": "accept", "signedBy": "ZZ Test One"}); check("applicant accepts the offer", s == 200 and d["data"]["stage"] == "Offer accepted", d)
s, d = call("POST", "/public/application/" + A["token"] + "/offer", {"response": "decline"}); check("offer can be answered once", s == 400, d)
if won_st:
    s, d = api("PATCH", "/crm/applications/" + A["_id"], {"stage": "Enrolled"}); s, d = api("GET", "/leads/" + L1); check("enrolling wins the lead", d["data"]["status"]["isWon"] is True, d["data"]["status"])
s, d = api("GET", "/registrations?q=" + q("ZZ Test")); [api("DELETE", "/registrations/" + x["_id"]) for x in d.get("data", [])]

print("recycle bin, masters, partners, fee plans, approvals, reports, calendar, tracking")
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Bin", "phone": "9000000160", "email": "bin@zz.test"}); LB = d["data"]["lead"]["_id"]
api("POST", "/leads/" + LB + "/notes", {"text": "ZZ keep me"})
s, d = api("DELETE", "/leads/" + LB); s, d = api("GET", "/leads/" + LB); check("deleted lead is gone from the list", s == 404, d)
s, d = api("GET", "/crm/trash"); tb = next((x for x in d["data"]["items"] if x["leadId"] == LB), None); check("deleted lead waits in the recycle bin", tb is not None and "snapshot" not in tb, d)
s, d = api("POST", "/crm/trash/" + tb["_id"] + "/restore", {}); check("restore from the recycle bin", s == 200, d)
s, d = api("GET", "/leads/" + LB + "/timeline"); types = [a["type"] for a in d.get("data", [])]
check("restored lead has its history back", s == 200 and "note" in types and "restored" in types, types)
s, d = api("GET", "/leads/" + LB + "/followups"); check("restored lead has its follow-ups back", s == 200 and len(d["data"]) >= 1, d)

s, d = api("POST", "/crm/courses", {"name": "ZZ Course A", "fee": 50000, "seats": 2}); C1 = d.get("data", {}).get("_id"); check("course added", s == 201, d)
s, d = api("POST", "/crm/courses", {"name": "ZZ Course A"}); check("same course twice → 409", s == 409, d)
s, d = api("POST", "/crm/branches", {"name": "ZZ Branch North", "city": "Delhi"}); check("branch added", s == 201, d)
s, d = api("PATCH", "/leads/" + LB, {"course": "ZZ Course A", "branch": "ZZ Branch North"}); check("lead takes course and branch", s == 200 and d["data"]["branch"] == "ZZ Branch North", d)
s, d = api("GET", "/leads?branch=" + q("ZZ Branch North")); check("branch filter", d["total"] == 1, d.get("total"))
s, d = api("GET", "/crm/course-seats"); row = next(x for x in d["data"] if x["name"] == "ZZ Course A"); check("course shows its leads and seats left", row["leads"] == 1 and row["left"] == 2, row)
s, d = api("GET", "/leads/meta"); check("meta carries courses, branches, partners", any(c["name"] == "ZZ Course A" for c in d["data"]["courses"]) and "partners" in d["data"], list(d["data"].keys()))

s, d = api("POST", "/crm/partners", {"name": "ZZ Partner", "commissionType": "per_win", "rate": 1000, "code": "ZZREF"}); P = d.get("data", {}); check("partner added with a code and link token", s == 201 and P.get("code") == "ZZREF" and P.get("token"), d)
s, d = api("POST", "/crm/api-keys", {"name": "ZZ Test Key2"}); K2 = d["data"]
s, d = hook("/leads/" + K2["key"], {"name": "ZZ Test Referred", "phone": "9000000161", "ref": "zzref", "visitor_id": "zzvisitor01"}); check("capture with a referral code", s == 200 and d["created"] == 1, d)
s, d = api("GET", "/leads?partner=" + P["_id"]); LR = d["data"][0]["_id"] if d["data"] else None; check("lead is credited to the partner", d["total"] == 1, d.get("total"))
if won_st: api("POST", "/leads/" + LR + "/status", {"statusId": won_st["_id"]})
s, d = api("GET", "/crm/partners"); pr = next(x for x in d["data"] if x["_id"] == P["_id"]); check("partner earnings from wins", pr["leads"] == 1 and pr["won"] == 1 and pr["earned"] == 1000 and pr["due"] == 1000, pr)
s, d = api("PATCH", "/crm/partners/" + P["_id"], {"payout": 400}); s, d = api("GET", "/crm/partners"); pr = next(x for x in d["data"] if x["_id"] == P["_id"]); check("payout reduces what is due", pr["due"] == 600, pr)
s, d = call("GET", "/public/partner/" + P["token"]); pp = d.get("data", {}); check("partner page: counts and statuses, no contact details", s == 200 and pp["leads"] == 1 and pp["due"] == 600 and all("phone" not in x for x in pp["list"]), d)
s, d = call("GET", "/public/partner/nope"); check("unknown partner link → 404", s == 404, d)

# website tracking
def hookraw(method, path, body=None):
    req = urllib.request.Request(WH + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={"Content-Type": "application/json", "Origin": "https://some-school-site.example"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e: return e.code, e.read(), dict(e.headers)
s, raw, h = hookraw("GET", "/track.js?k=" + K2["key"]); check("tracking script is served", s == 200 and b"crmTrack" in raw and K2["key"].encode() in raw, raw[:80])
s, raw, h = hookraw("POST", "/track", {"k": K2["key"], "v": "zzvisitor01", "url": "https://x.example/fees", "title": "ZZ Fees"}); check("page view accepted from another site", s == 200 and h.get("Access-Control-Allow-Origin") == "https://some-school-site.example", h)
import time; time.sleep(1.5)
s, d = api("GET", "/leads/" + LR + "/web-activity"); check("page view lands on the lead", any(v["title"] == "ZZ Fees" for v in d["data"]["visits"]), d)
api("DELETE", "/crm/api-keys/" + K2["_id"])

# fee plan, part payment, refund, concession approval
s, d = api("POST", "/leads/" + LB + "/fee-plan", {"title": "ZZ Tuition", "total": 10000, "instalments": 3, "firstDue": day(10), "everyDays": 30}); plan = d.get("data", [])
check("instalment plan adds up to the total", s == 201 and len(plan) == 3 and round(sum(f["amount"] for f in plan), 2) == 10000, [f["amount"] for f in plan])
FP = plan[0]["_id"]
s, d = api("POST", "/lead-fees/" + FP + "/pay", {"mode": "Cash", "amount": 1000}); check("part payment keeps the fee open", s == 200 and d["data"]["status"] == "pending" and d["data"]["paidAmount"] == 1000 and len(d["data"]["payments"]) == 1, d)
s, d = api("POST", "/lead-fees/" + FP + "/pay", {"mode": "Cash", "amount": 999999}); check("cannot pay more than is left", s == 400, d)
s, d = api("POST", "/lead-fees/" + FP + "/cancel", {}); check("a part-paid fee cannot be cancelled", s == 400, d)
s, d = api("POST", "/lead-fees/" + FP + "/discount-request", {"amount": 500, "reason": "ZZ sibling"}); AP = d.get("data", {}).get("_id"); check("concession requested", s == 201, d)
s, d = api("POST", "/lead-fees/" + FP + "/discount-request", {"amount": 100, "reason": "ZZ again"}); check("one request at a time per fee", s == 400, d)
s, d = api("POST", "/crm/approvals/" + AP + "/decide", {"approve": True}); check("you cannot approve your own request", s == 403, d)
s, d = api("GET", "/crm/approvals?status=pending"); mine_ap = next((x for x in d["data"]["items"] if x["_id"] == AP), None); check("request is listed, not decidable by its requester", mine_ap is not None and mine_ap["canDecide"] is False, d)
s, d = api("POST", "/lead-fees/" + FP + "/refund", {"amount": 400, "reason": "ZZ overpaid"}); check("refund", s == 200 and d["data"]["paidAmount"] == 600 and len(d["data"]["refunds"]) == 1, d)
s, d = api("POST", "/lead-fees/" + FP + "/refund", {"amount": 5000, "reason": "ZZ"}); check("cannot refund more than was paid", s == 400, d)
s, d = api("GET", "/leads/" + LB + "/fees"); f0 = next(x for x in d["data"]["fees"] if x["_id"] == FP); check("fee list shows the balance", f0["balance"] == f0["amount"] - 600 and d["data"]["paid"] == 600, (f0["balance"], d["data"]["paid"]))
s, d = call("GET", "/public/pay/" + f0["token"]); check("pay page charges the balance and shows the tax block", s == 200 and d["data"]["balance"] == f0["balance"] and "billing" in d["data"], d)

# bulk message, chat, brief, report, calendar, links
s, d = api("POST", "/leads/bulk-message", {"channel": "email", "ids": [LB, LR], "text": "Hi {{first_name}}", "subject": "ZZ"}); check("bulk email: sends where it can, skips leads without an email", s == 200 and d["data"]["sent"] == 1 and d["data"]["skipped"] == 1, d)
s, d = api("PATCH", "/leads/" + LB, {"doNotContact": {"email": True}}); check("do-not-contact saved", s == 200 and d["data"]["doNotContact"]["email"] is True, d)
s, d = api("POST", "/leads/bulk-message", {"channel": "email", "ids": [LB], "text": "x"}); check("do-not-contact is respected", s == 200 and d["data"]["sent"] == 0 and d["data"]["skipped"] == 1, d)
s, d = api("POST", "/leads/bulk-message", {"channel": "fax", "ids": [LB], "text": "x"}); check("unknown channel rejected", s == 400, d)
s, d = api("GET", "/leads/" + LB + "/web-activity"); check("sent email is tracked", len(d["data"]["emails"]) >= 1 and d["data"]["emails"][0]["opens"] == 0, d)
s, d = api("GET", "/leads/" + LB + "/conversation"); check("lead chat loads (empty when there is none)", s == 200 and "messages" in d["data"], d)
s, d = api("GET", "/leads/" + LB + "/brief"); check("next best action", s == 200 and d["data"]["action"]["text"] and isinstance(d["data"]["facts"], list), d)
s, d = api("GET", "/leads/report?groupBy=owner&groupBy2=status&q=" + q("ZZ Test")); check("report builder groups by two fields", s == 200 and d["data"]["rows"] and "b" in d["data"]["rows"][0] and sum(x["leads"] for x in d["data"]["rows"]) >= 2, d)
s, raw = api("GET", "/leads/report?groupBy=month&format=csv&q=" + q("ZZ Test"), raw=True); check("report exports as CSV", s == 200 and raw.decode("utf-8-sig").startswith('"Month created"'), raw[:60])
s, d = api("GET", "/leads/report?groupBy=$where"); check("unknown grouping falls back safely", s == 200 and d["data"]["groupBy"] == "status", d)
s, d = api("GET", "/followups/calendar?from=" + day(-1) + "&to=" + day(40)); check("follow-up calendar", s == 200 and any(f["leadName"] == "ZZ Test Bin" for f in d["data"]), len(d.get("data", [])))
s, d = api("GET", "/crm/my-links"); links = d.get("data", {}); check("personal calendar and booking links", s == 200 and links["calendarUrl"].endswith(".ics") and "/book/" in links["bookingUrl"], d)
tok_me = links["calendarUrl"].rsplit("/", 1)[1][:-4]
s, raw, h = hookraw("GET", "/calendar/" + tok_me + ".ics"); check("calendar feed is valid iCalendar", s == 200 and raw.startswith(b"BEGIN:VCALENDAR") and raw.rstrip().endswith(b"END:VCALENDAR"), raw[:60])
s, raw, h = hookraw("GET", "/calendar/wrongtoken.ics"); check("calendar feed needs the right token", s == 404, s)
s, d = api("PUT", "/crm/settings", {"booking": {"enabled": True, "slotMinutes": 30, "startHour": 10, "endHour": 18, "days": [0, 1, 2, 3, 4, 5, 6]}})
s, d = call("GET", "/public/book/" + tok_me); bk = d.get("data", {}); check("booking page offers free slots", s == 200 and bk.get("days") and bk["days"][0]["times"], d)
slot = bk["days"][-1]; when = {"date": slot["date"], "time": slot["times"][0]}
s, d = call("POST", "/public/book/" + tok_me, {"name": "ZZ Test Booker", "phone": "9000000162", **when, "kind": "Visit"}); check("slot booked: lead + follow-up created", s == 200 and d["data"]["booked"], d)
s, d = call("POST", "/public/book/" + tok_me, {"name": "ZZ Test Booker2", "phone": "9000000163", **when}); check("a taken slot cannot be booked twice", s == 409, d)
s, d = api("PUT", "/crm/settings", {"booking": {**st0.get("booking", {}), "enabled": bool(st0.get("booking", {}).get("enabled"))}})
if not st0.get("booking", {}).get("enabled"):
    s, d = call("GET", "/public/book/" + tok_me); check("booking page is off when the setting is off", s == 403, d)
s, d = api("GET", "/crm/availability"); check("availability shows open leads per person", s == 200 and d["data"]["users"] and "openLeads" in d["data"]["users"][0], d)
s, d = api("GET", "/crm/push/key"); check("push key available", s == 200 and len(d["data"]["publicKey"]) > 40, d)
s, d = api("POST", "/crm/push/subscribe", {"subscription": {"endpoint": "http://not-https", "keys": {}}}); check("bad push subscription rejected", s == 400, d)
s, d = api("GET", "/crm/settings"); check("push private key never leaves the server", "privateKey" not in d["data"].get("push", {}), d["data"].get("push"))
s, d = call("POST", "/media/convert", {}); check("media conversion now needs a login", s == 401, d)
s, d = hook("/telephony/" + st0["tenant"] + "/incoming?k=wrong", {"From": "9000000164"}); check("incoming-call hook needs its secret", s == 401, d)
api("DELETE", "/crm/courses/" + C1)

print("duplicate rules, IVR, applicant sign-in, new settings")
s, d = api("PUT", "/crm/settings", {"duplicates": {"matchEmail": False, "matchAltPhone": True, "action": "block"}}); check("duplicate rules saved", s == 200 and d["data"]["duplicates"]["action"] == "block", d)
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Again", "phone": "9000000101"}); check("block: adding an existing person by hand is stopped", s == 409, d)
s, d = api("PATCH", "/leads/" + L1, {"altPhone": "9000000170"})
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Alt", "phone": "9000000170"}); check("block: an alternate number counts too", s == 409, d)
s, d = api("POST", "/crm/api-keys", {"name": "ZZ Test Key3"}); K3 = d["data"]
s, d = hook("/leads/" + K3["key"], {"name": "ZZ Test One web", "phone": "9000000101"}); check("block does not turn away website / portal enquiries", s == 200 and d["created"] == 0, d)
s, d = hook("/leads/" + K3["key"], {"prefix": "Mr", "student_name": "ZZ Test Portal", "student_mobile": "9000000171", "course_name": "ZZ BBA", "preferred_city": "Indore"}); check("portal field names are understood", s == 200 and d["created"] == 1, d)
s, d = api("GET", "/leads?q=" + q("ZZ Test Portal")); pl = d["data"][0] if d["data"] else {}; check("portal lead mapped to name, course, city", pl.get("name") == "Mr ZZ Test Portal" and pl.get("course") == "ZZ BBA" and pl.get("city") == "Indore", pl)
api("DELETE", "/crm/api-keys/" + K3["_id"])
s, d = api("PUT", "/crm/settings", {"duplicates": {"matchEmail": False, "matchAltPhone": False, "action": "allow"}})
s, d = api("POST", "/leads/convert", {"name": "ZZ Test Twin", "phone": "9000000101"}); check("allow: a second lead with the same number", s == 201, d)
s, d = api("PUT", "/crm/settings", {"duplicates": st0.get("duplicates", {"matchEmail": False, "matchAltPhone": False, "action": "enquiry"})}); check("duplicate rules put back", s == 200 and d["data"]["duplicates"]["action"] == st0.get("duplicates", {}).get("action", "enquiry"), d["data"]["duplicates"])

s, d = api("GET", "/crm/settings"); stn = d["data"]
check("settings carry IVR, mailbox, Google and pull sections with secrets masked", all(k in stn for k in ["ivr", "inbox", "google", "pulls", "ivrUrl", "googleRedirectUrl"]) and not str(stn["inbox"]["pass"]).startswith("v1:") and not str(stn["google"]["clientSecret"]).startswith("v1:"), list(stn.keys()))
ivr_before = stn["ivr"]
s, d = api("PUT", "/crm/settings", {"ivr": {"enabled": True, "greeting": "ZZ press 1 or 2", "options": [{"digit": "1", "label": "Admissions", "target": "+919000000180"}, {"digit": "2", "label": "My counsellor", "target": "owner"}, {"digit": "x", "label": "bad", "target": "1"}]}})
check("IVR menu saved, bad key dropped", s == 200 and len(d["data"]["ivr"]["options"]) == 2, d["data"].get("ivr"))
ivr_path = stn["ivrUrl"].split("/webhooks", 1)[1]
def ivr(extra=""):
    req = urllib.request.Request(WH + ivr_path + extra, data=b"", method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
s, body = ivr(); check("IVR: menu as JSON", s == 200 and json.loads(body)["say"] == "ZZ press 1 or 2" and len(json.loads(body)["options"]) == 2, body)
s, body = ivr("&format=xml"); check("IVR: menu as XML with a Gather", s == 200 and "<Gather" in body and "ZZ press 1 or 2" in body, body)
s, body = ivr("&digits=1"); check("IVR: key 1 rings the set number", s == 200 and body == "+919000000180", body)
s, body = ivr("&digits=1&format=xml"); check("IVR: XML dial", "<Dial>+919000000180</Dial>" in body, body)
s, body = ivr("&digits=9&format=xml"); check("IVR: unknown key is handled", s == 200 and "<Dial>" not in body, body)
s, body = ivr("&digits=2&From=9000000101"); check("IVR: 'my counsellor' answers without error", s == 200, body)
req = urllib.request.Request(WH + ivr_path.replace("k=", "k=x"), data=b"", method="POST")
try: urllib.request.urlopen(req, timeout=30); ivr_code = 200
except urllib.error.HTTPError as e: ivr_code = e.code
check("IVR needs its secret", ivr_code == 401, ivr_code)
api("PUT", "/crm/settings", {"ivr": ivr_before})

s, d = api("PUT", "/crm/settings", {"pulls": [{"name": "ZZ Portal", "url": "http://insecure.example/leads"}]}); check("portal pull must be https", s == 400, d)
s, d = api("PUT", "/crm/settings", {"pulls": [{"name": "ZZ Portal", "url": "https://example.invalid/leads", "listPath": "data", "map": {"phone": "mobile"}, "headers": '{"X-Key":"secret-zz"}', "enabled": False}]})
check("portal pull saved with its headers hidden", s == 200 and d["data"]["pulls"][0]["map"]["phone"] == "mobile" and "secret-zz" not in json.dumps(d["data"]), d["data"].get("pulls"))
api("PUT", "/crm/settings", {"pulls": []})
s, d = api("POST", "/crm/settings/test-inbox", {}); check("mailbox test explains what is missing", s == 400, d)
s, d = api("GET", "/crm/google/connect"); check("Google connect explains it is not set up", (s == 400 and "not set up" in d.get("error", "")) or (s == 200 and "accounts.google.com" in d["data"]["url"]), d)
s, d = call("POST", "/public/applicant/code", {"phone": "9000000199"}); check("applicant code: same reply for an unknown number", s == 200 and d["data"]["sent"] is True, d)
s, d = call("POST", "/public/applicant/code", {"phone": "12"}); check("applicant code needs a real number", s == 400, d)
s, d = call("POST", "/public/applicant/verify", {"phone": "9000000199", "code": "000000"}); check("applicant verify without a code → refused", s in (401, 429), d)

# Lead visibility per role. Needs a second, non-admin user: CRM_TEST_SCOPED_TOKEN (or CRM_TEST_SCOPED_USER + password).
# The user's role is switched to "own" / "team" for a moment and put back afterwards.
T2 = os.environ.get("CRM_TEST_SCOPED_TOKEN")
if not T2 and os.environ.get("CRM_TEST_SCOPED_USER"):
    s, d = call("POST", "/auth/login", {"email": os.environ["CRM_TEST_SCOPED_USER"], "password": os.environ.get("CRM_TEST_SCOPED_PASSWORD", "")})
    T2 = d.get("data", {}).get("token")
if T2:
    print("lead visibility")
    def as2(method, path, body=None): return call(method, path, body, T2)
    s, me = as2("GET", "/auth/me"); u2 = me["data"]["user"]; role = u2["userType"]; role_id = role["_id"] if isinstance(role, dict) else role
    s, roles = api("GET", "/usertypes"); before = next(r for r in roles["data"] if r["_id"] == role_id).get("leadVisibility", "all")
    try:
        s, d = api("POST", "/leads/convert", {"name": "ZZ Test Theirs", "phone": "9000000130", "owner": next((o for o in m["owners"] if o != u2["name"]), "")}); other = d["data"]["lead"]["_id"]
        s, d = api("POST", "/leads/convert", {"name": "ZZ Test Nobody", "phone": "9000000131"}); nobody = d["data"]["lead"]["_id"]
        s, d = api("PATCH", "/usertypes/" + role_id, {"leadVisibility": "own"}); check("role can be set to own leads only", s == 200 and d["data"]["leadVisibility"] == "own", d)
        s, d = as2("POST", "/leads/convert", {"name": "ZZ Test Mine", "phone": "9000000132"}); mine_id = d["data"]["lead"]["_id"]
        check("own: a lead they add is theirs", d["data"]["lead"]["owner"] == u2["name"], d["data"]["lead"]["owner"])
        s, d = as2("GET", "/leads?perPage=200"); owners = {l["owner"] for l in d["data"]}
        check("own: list shows only their leads", s == 200 and owners <= {u2["name"]} and any(l["_id"] == mine_id for l in d["data"]), owners)
        s, d = as2("GET", "/leads/" + other); check("own: another person's lead → 404", s == 404, d)
        s, d = as2("PATCH", "/leads/" + other, {"city": "X"}); check("own: cannot edit another person's lead", s == 404, d)
        s, d = as2("POST", "/leads/" + other + "/notes", {"text": "x"}); check("own: cannot add a note to it", s == 404, d)
        s, d = as2("POST", "/leads/bulk", {"action": "addTag", "ids": [other, mine_id], "tag": "zz-scope"}); check("own: bulk touches only their leads", s == 200 and d["data"]["matched"] == 1, d)
        s, d = api("GET", "/leads?q=" + q("ZZ Test") + "&owner=" + q(u2["name"])); theirs = d["total"]
        s, d = api("GET", "/leads?q=" + q("ZZ Test")); everyone = d["total"]
        s, d = as2("GET", "/leads/board?q=" + q("ZZ Test")); n = sum(c["count"] for c in d["data"]["columns"])
        check("own: board counts only their leads", n == theirs and theirs < everyone, (n, theirs, everyone))
        s, d = as2("GET", "/leads/analytics?q=" + q("ZZ Test")); check("own: analytics counts only their leads", d["data"]["totals"]["leads"] == theirs, d["data"]["totals"])
        s, raw = call("GET", "/leads/export?q=" + q("ZZ Test"), None, T2, True); check("own: export holds only their leads", b"ZZ Test Mine" in raw and b"ZZ Test Theirs" not in raw, raw[:200])
        s, d = as2("GET", "/followups/buckets"); allf = d["data"]["overdue"] + d["data"]["today"] + d["data"]["upcoming"] + d["data"]["done"]
        check("own: follow-ups are only theirs", s == 200 and all(u2["name"] in (f.get("owner"), f.get("assignedTo")) for f in allf), {f.get("owner") for f in allf})
        s, d = api("GET", "/leads/" + other + "/followups"); fo = d["data"][0]["_id"]
        s, d = as2("POST", "/followups/" + fo + "/complete", {}); check("own: cannot complete someone else's follow-up", s == 404, d)
        s, d = as2("GET", "/leads/check-duplicate?phone=9000000130"); check("own: duplicate check still sees every lead", d["data"]["duplicate"] is True, d)
        s, d = api("PATCH", "/usertypes/" + role_id, {"leadVisibility": "team"})
        s, d = as2("GET", "/leads/" + nobody); check("team: unassigned leads are visible", s == 200, d)
        s, d = as2("GET", "/leads/" + other); check("team: a lead outside the team is not", s == 404, d)
        s, d = api("PATCH", "/usertypes/" + role_id, {"leadVisibility": "all"})
        s, d = as2("GET", "/leads/" + other); check("all: every lead is visible", s == 200, d)
        # field rules: hidden fields are left out, locked fields cannot be changed
        s, d = api("PATCH", "/usertypes/" + role_id, {"leadFieldRules": {"hidden": ["value"], "readOnly": ["course"]}, "maskContacts": True})
        s, d = as2("GET", "/leads/" + other); lead2 = d["data"]
        check("field rules: hidden field is not sent, contacts are masked", "value" not in lead2 and "X" in lead2["phone"] and lead2.get("contactsHidden"), {k: lead2.get(k) for k in ["value", "phone"]})
        s, d = as2("PATCH", "/leads/" + other, {"course": "ZZ nope"}); check("field rules: locked field cannot be changed", s == 403, d)
        s, d = as2("PATCH", "/leads/" + other, {"value": 5}); check("field rules: hidden field cannot be changed", s == 403, d)
        s, d = as2("PATCH", "/leads/" + other, {"city": "ZZ City", "phone": "9000000999"}); check("field rules: other fields still save, masked phone is not overwritten", s == 200 and d["data"]["city"] == "ZZ City", d)
        s, d = api("GET", "/leads/" + other); check("the real phone number is untouched", d["data"]["phone"].endswith("9000000130") and d["data"]["value"] == 0, d["data"]["phone"])
        s, raw = call("GET", "/leads/export?q=" + q("ZZ Test Theirs"), None, T2, True); check("export is masked for this role", b"9000000130" not in raw, raw[-200:])
        s, d = api("PATCH", "/usertypes/" + role_id, {"leadFieldRules": {"hidden": [], "readOnly": []}, "maskContacts": False})
        # branch limit
        s, d = api("POST", "/crm/branches", {"name": "ZZ Branch East"}); s, d = api("PATCH", "/leads/" + other, {"branch": "ZZ Branch East"})
        s, av = api("GET", "/crm/availability"); u2id = next(x["_id"] for x in av["data"]["users"] if x["name"] == u2["name"])
        s, d = api("PUT", "/crm/availability/" + u2id, {"branches": ["ZZ Branch East"]}); check("branches set for a person", s == 200 and d["data"]["crmBranches"] == ["ZZ Branch East"], d)
        s, d = as2("GET", "/leads?perPage=200"); bset = {l.get("branch") for l in d["data"]}
        check("branch limit: only that branch's leads", s == 200 and bset == {"ZZ Branch East"}, bset)
        s, d = as2("GET", "/leads/" + mine_id); check("branch limit: a lead of another branch → 404", s == 404, d)
        s, d = as2("POST", "/leads/convert", {"name": "ZZ Test Branchy", "phone": "9000000172"}); check("branch limit: their new lead takes their branch", s == 201 and d["data"]["lead"]["branch"] == "ZZ Branch East", d)
        s, d = as2("PATCH", "/leads/" + other, {"branch": "Somewhere Else"}); check("branch limit: cannot move a lead to another branch", s == 403, d)
        s, d = api("PUT", "/crm/availability/" + u2id, {"branches": []}); check("branch limit removed", s == 200 and d["data"]["crmBranches"] == [], d)
    finally:
        api("PATCH", "/usertypes/" + role_id, {"leadFieldRules": {"hidden": [], "readOnly": []}, "maskContacts": False})
        s, av = api("GET", "/crm/availability"); [api("PUT", "/crm/availability/" + x["_id"], {"branches": []}) for x in av.get("data", {}).get("users", []) if x["name"] == u2["name"] and x.get("branches")]
        s, d = api("PATCH", "/usertypes/" + role_id, {"leadVisibility": before}); check("role put back", s == 200 and d["data"]["leadVisibility"] == before, d)

print("delete")
s, d = api("DELETE", "/leads/" + L1); check("delete", s == 200, d)
s, d = api("GET", "/leads/" + L1 + "/followups"); check("deleted lead's follow-ups are gone", s == 404, d)
left = cleanup()
s, d = api("GET", "/leads?q=" + q("ZZ Test")); check("test leads removed", d["total"] == 0, d.get("total"))
s, d = api("GET", "/masters/sources"); src = next((x for x in d.get("data", []) if x["name"] == "ZZ Test Source"), None)
if src: api("DELETE", "/masters/sources/" + src["_id"])

print(f"\n{ok_n} passed, {len(bad)} failed")
if bad: print("failed:", *bad, sep="\n  "); sys.exit(1)
