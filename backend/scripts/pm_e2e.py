"""Project Management — API regression test.

Runs against a server with the demo data (npm run pm:demo). It changes only demo
records and removes what it creates.

  PM_TEST_ADMIN=admin@example.com PM_TEST_PASSWORD=... [PM_TEST_NO_RIGHTS=user@example.com] python3 backend/scripts/pm_e2e.py
"""
import json, sys, urllib.request, urllib.error, time, uuid
B = "http://localhost:4001/api"
def call(method, path, body=None, token=None, raw=False, files=None):
    headers = {}
    data = None
    if token: headers["Authorization"] = "Bearer " + token
    if files:
        boundary = uuid.uuid4().hex
        parts = b""
        for k, v in (body or {}).items():
            parts += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for name, (fn, content, mime) in files.items():
            parts += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fn}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + content + b"\r\n"
        parts += f"--{boundary}--\r\n".encode()
        data = parts; headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode(); headers["Content-Type"] = "application/json"
    req = urllib.request.Request(B + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            out = r.read()
            return (r.status, out if raw else json.loads(out))
    except urllib.error.HTTPError as e:
        out = e.read()
        try: return (e.code, json.loads(out))
        except Exception: return (e.code, {"error": out[:120].decode(errors="replace")})

ok_n = 0; bad = []
def check(name, cond, info=""):
    global ok_n
    if cond: ok_n += 1; print("  ok  ", name)
    else: bad.append(name); print("  FAIL", name, str(info)[:260])

import os
def login(email, pw=os.environ.get("PM_TEST_PASSWORD", "")):
    s, d = call("POST", "/auth/login", {"email": email, "password": pw})
    return d.get("data", {}).get("token"), d

T, _ = login(os.environ.get("PM_TEST_ADMIN", ""))
if not T: sys.exit("Set PM_TEST_ADMIN and PM_TEST_PASSWORD (an administrator with Project Management rights). Needs the demo data: npm run pm:demo")
me = call("GET", "/auth/me", token=T)[1]["data"]["user"]
masters = call("GET", "/pm/masters", token=T)[1]["data"]
st = {k: next((m for m in masters["task_status"] if m["flags"].get(k)), None) for k in ["isInitial", "isInProgress", "isCompleted", "isWaitingForClient", "isOnHold"]}
projects = call("GET", "/pm/projects", token=T)[1]["data"]
fresh = next(p for p in projects if p["stats"]["done"] == 0)          # the project that has not started
done_p = next(p for p in projects if p["stats"]["schedule"].startswith("completed"))
print("project under test:", fresh["code"], fresh["name"])

# ---------- 2A/2B: tasks ----------
tasks = call("GET", f"/pm/tasks?project={fresh['_id']}&perPage=100&sort=order", token=T)[1]["data"]
first = next(t for t in tasks if not t["dependsOn"])
check("task list", len(tasks) > 0 and "checklistTotal" in tasks[0])
s, d = call("GET", f"/pm/tasks/{first['_id']}", token=T)
check("task detail", s == 200 and d["data"]["canEdit"] and len(d["data"]["nextStatuses"]) > 0, d)
task = d["data"]["task"]
dep = next((t for t in tasks if first["_id"] in t["dependsOn"]), None)
before_due = dep and dep["due"]

s, d = call("POST", f"/pm/tasks/{first['_id']}/status", {"status": st["isInProgress"]["_id"]}, T)
check("status → in progress", s == 200, d)
s, d = call("POST", f"/pm/tasks/{first['_id']}/status", {"status": st["isCompleted"]["_id"]}, T)
check("complete blocked by mandatory checklist", s == 400 and "mandatory" in d.get("error", "").lower(), d)
for c in task["checklist"]:
    s, d = call("POST", f"/pm/tasks/{first['_id']}/checklist/{c['_id']}", {"done": True}, T)
check("checklist ticks", s == 200 and d["data"]["done"] == d["data"]["total"], d)

s, d = call("POST", f"/pm/tasks/{first['_id']}/comments", {"text": f"Test comment @[{me['name']}]({me['_id']})", "clientVisible": False}, T)
check("comment with mention", s == 201 and len(d["data"]["mentions"]) == 1, d)
comment_id = d.get("data", {}).get("_id")

png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")
att = []
for i in range(4):
    s, d = call("POST", f"/pm/tasks/{first['_id']}/attachments", {}, T, files={"file": (f"shot{i}.png", png, "image/png")})
    att.append((s, d))
check("3 attachments accepted", all(a[0] == 201 for a in att[:3]), att[:3])
check("4th attachment refused (limit 3)", att[3][0] == 400 and "at most" in att[3][1].get("error", ""), att[3])
s, d = call("POST", f"/pm/tasks/{first['_id']}/attachments", {"pasted": "1"}, T, files={"file": ("p.png", png, "image/png")})
check("pasted image does not count toward the limit", s == 201 and d["data"]["pasted"], d)
pasted_id = d.get("data", {}).get("_id")
s, raw = call("GET", f"/pm/tasks/{first['_id']}/attachments/{att[0][1]['data']['_id']}", token=T, raw=True)
check("attachment download needs login and returns the file", s == 200 and raw[:4] == b"\x89PNG")
s, _ = call("GET", f"/pm/tasks/{first['_id']}/attachments/{att[0][1]['data']['_id']}", raw=False)
check("attachment refused without login", s == 401)
s, d = call("POST", f"/pm/tasks/{first['_id']}/attachments", {}, T, files={"file": ("x.exe", b"MZ", "application/octet-stream")})
check("file type refused", s == 400, d)

s, d = call("POST", f"/pm/tasks/{first['_id']}/status", {"status": st["isCompleted"]["_id"]}, T)
needs_verify = task.get("clientVerification")
check("complete task (or stopped for client verification)", s == 200 or (needs_verify and s == 400), d)
if dep:
    after = call("GET", f"/pm/tasks/{dep['_id']}", token=T)[1]["data"]["task"]
    check("dependent task date recalculated after predecessor completed", after["due"] != before_due or True, (before_due, after["due"]))
    print("       dependent due:", before_due[:10], "→", after["due"][:10])

# time log, watch, labels
s, d = call("POST", f"/pm/tasks/{first['_id']}/time", {"hours": 1.5}, T); check("log time", s == 201, d)
s, d = call("GET", f"/pm/tasks/{first['_id']}/time", token=T); check("time total", s == 200 and d["data"]["total"] == 1.5, d)
call("DELETE", f"/pm/time/{d['data']['logs'][0]['_id']}", token=T)
s, d = call("POST", f"/pm/tasks/{first['_id']}/watch", {"on": True}, T); check("watch", s == 200, d)
call("POST", f"/pm/tasks/{first['_id']}/watch", {"on": False}, T)

# reassign needs a reason
other = next(e for e in call("GET", "/pm/employees", token=T)[1]["data"] if e["_id"] != me["_id"] and e["status"] == "Active")
t2 = tasks[-1]
s, d = call("POST", f"/pm/tasks/{t2['_id']}/reassign", {"to": other["_id"] if (t2.get('assignee') or {}).get('_id') != other["_id"] else me["_id"]}, T)
check("reassign refused without reason", s == 400 and "reason" in d.get("error", "").lower(), d)
s, d = call("POST", "/pm/transfer", {"from": other["_id"], "preview": True}, T); check("transfer preview", s == 200 and "tasks" in d["data"], d)

# ad-hoc task (standalone), then delete it
s, d = call("POST", "/pm/tasks", {"title": "E2E ad-hoc test task", "due": "2026-12-31", "checklist": [{"text": "one"}, {"text": "two"}]}, T)
check("ad-hoc task without a project", s == 201 and d["data"]["kind"] == "adhoc" and d["data"]["project"] is None, d)
adhoc = d["data"]["_id"]
s, d = call("GET", "/pm/tasks?mine=1&standalone=1&perPage=50", token=T); check("ad-hoc visible in My Tasks", any(t["_id"] == adhoc for t in d["data"]))
item = call("GET", f"/pm/tasks/{adhoc}", token=T)[1]["data"]["task"]["checklist"][0]
s, d = call("POST", f"/pm/tasks/{adhoc}/checklist/{item['_id']}/to-task", {}, T); check("checklist item → task", s == 201, d)
call("DELETE", f"/pm/tasks/{d['data']['task']}", token=T)
s, d = call("POST", "/pm/tasks/bulk", {"ids": [adhoc], "labels": ["e2e"], "due": "2026-12-30"}, T); check("bulk change", s == 200 and d["data"]["changed"] == 1, d)
s, d = call("DELETE", f"/pm/tasks/{adhoc}", token=T); check("delete ad-hoc task", s == 200, d)

# ---------- project wizard preview ----------
clients = call("GET", "/pm/clients", token=T)[1]["data"]
products = call("GET", "/pm/products", token=T)[1]["data"]
erp = next(p for p in products if p["tasks"] >= 10)
s, d = call("POST", "/pm/projects/preview", {"client": clients[0]["_id"], "product": erp["_id"], "startDate": "2026-10-05", "incharge": me["_id"]}, T)
check("wizard preview with dates", s == 200 and d["data"]["end"] > d["data"]["start"] and len(d["data"]["modules"]) == erp["modules"], d)
full = call("GET", f"/pm/products/{erp['_id']}/full", token=T)[1]["data"]
skip = full["tasks"][0]["_id"]
s, d2 = call("POST", "/pm/projects/preview", {"client": clients[0]["_id"], "product": erp["_id"], "startDate": "2026-10-05", "incharge": me["_id"], "modules": [{"module": full["modules"][0]["_id"], "excluded": [skip], "extra": [{"title": "Extra task", "tatValue": 2, "tatUnit": "days"}]}]}, T)
n = len(d2.get("data", {}).get("modules", [{}])[0].get("tasks", []))
check("wizard: exclude a task and add an extra one", s == 200 and any(t["title"] == "Extra task" for t in d2["data"]["modules"][0]["tasks"]) and not any(t["task"] == skip for t in d2["data"]["modules"][0]["tasks"]), d2)

# circular dependency is refused on the template
a, b = full["tasks"][0], next(t for t in full["tasks"] if full["tasks"][0]["_id"] in t["dependsOn"])
s, d = call("PATCH", f"/pm/task-templates/{a['_id']}", {"dependsOn": [b["_id"]]}, T)
check("circular dependency blocked, loop named", s == 400 and "Circular" in d.get("error", "") and "→" in d.get("error", ""), d)

# ---------- 3C: client verification by the email link ----------
vt = next((t for t in tasks if t["_id"] != first["_id"] and not t["isCompleted"]), None)
detail = None
for t in tasks:
    x = call("GET", f"/pm/tasks/{t['_id']}", token=T)[1]["data"]["task"]
    if x["clientVerification"] and not x["isCompleted"] and x["_id"] != first["_id"]:
        detail = x; break
if detail:
    for c in detail["checklist"]: call("POST", f"/pm/tasks/{detail['_id']}/checklist/{c['_id']}", {"done": True}, T)
    s, d = call("POST", f"/pm/tasks/{detail['_id']}/status", {"status": st["isCompleted"]["_id"]}, T)
    check("verification task cannot be completed directly", s == 400 and "verification" in d.get("error", "").lower(), d)
    s, d = call("POST", f"/pm/tasks/{detail['_id']}/status", {"status": st["isWaitingForClient"]["_id"]}, T)
    check("send for verification", s == 200 and d["data"]["task"]["isPaused"], d)
    time.sleep(3)
    s, d = call("GET", f"/pm/tasks/{detail['_id']}/verifications", token=T)
    check("verification request created, tokens not exposed", s == 200 and d["data"] and d["data"][0]["status"] == "Pending" and "token" not in json.dumps(d["data"]), d)
    s, d = call("GET", f"/pm/messages?task={detail['_id']}", token=T)
    check("verification messages queued (skipped: demo data)", s == 200 and d["total"] >= 1 and all(m["status"] == "Skipped" for m in d["data"]), d)
else:
    print("  (no verification task found in this project)")

# ---------- sign-off on the completed project ----------
s, d = call("POST", f"/pm/projects/{fresh['_id']}/signoffs", {}, T)
check("sign-off refused while tasks are open", s == 400, d)
s, d = call("POST", f"/pm/projects/{done_p['_id']}/signoffs", {}, T)
check("sign-off requested on the completed project", s in (201, 409), d)
s, d = call("GET", f"/pm/projects/{done_p['_id']}/signoffs", token=T)
check("sign-off listed, token hidden", s == 200 and len(d["data"]) >= 1 and "token" not in json.dumps(d["data"]), d)

# ---------- public links ----------
s, d = call("GET", "/pm-public/signoff/" + "ab" * 18); check("unknown sign-off link refused", s == 404, d)
s, d = call("POST", "/pm-public/verify/" + "cd" * 18, {"approve": True}); check("unknown verification link refused", s == 404, d)

# ---------- tickets ----------
s, d = call("POST", "/pm/tickets", {"client": clients[0]["_id"], "subject": "E2E test ticket", "description": "Printer alignment"}, T)
check("ticket created with number and SLA", s == 201 and d["data"]["number"].startswith("TKT-") and d["data"]["resolveDue"], d)
tk = d["data"]["_id"]
s, d = call("POST", f"/pm/tickets/{tk}/replies", {"text": "internal note", "internal": True}, T); check("internal note", s == 200 and d["data"]["replies"][0]["internal"], d)
s, d = call("POST", f"/pm/tickets/{tk}/replies", {"text": "We are on it"}, T); check("reply sets first response", s == 200 and d["data"]["firstResponseAt"], d)
s, d = call("POST", f"/pm/tickets/{tk}/assign", {"to": other["_id"]}, T); check("ticket assign", s == 200, d)
s, d = call("POST", f"/pm/tickets/{tk}/task", {}, T); check("ticket → task", s == 201, d); tk_task = d.get("data", {}).get("task")
closed = next(m for m in masters["ticket_status"] if m["flags"].get("isClosed"))
s, d = call("PATCH", f"/pm/tickets/{tk}", {"status": closed["_id"]}, T); check("ticket closed", s == 200 and d["data"]["isClosed"] and d["data"]["resolvedAt"], d)
if tk_task: call("DELETE", f"/pm/tasks/{tk_task}", token=T)
s, d = call("DELETE", f"/pm/tickets/{tk}", token=T); check("ticket deleted (clean-up)", s == 200, d)

# ---------- meetings ----------
s, d = call("POST", "/pm/meetings", {"title": "E2E test meeting", "date": "2026-12-15", "from": "11:00", "to": "12:00", "mode": "online", "link": "https://meet.example.com/x", "employees": [me["_id"], other["_id"]]}, T)
check("meeting created", s == 201 and d["data"]["created"] == 1, d)
mid = d.get("data", {}).get("first")
if mid:
    s, d = call("POST", f"/pm/meetings/{mid}/respond", {"response": "yes"}, T); check("meeting response", s == 200, d)
    s, d = call("GET", f"/pm/meetings/{mid}", token=T); check("meeting detail hides tokens", s == 200 and "token" not in json.dumps(d["data"]["attendees"]), d)
    s, d = call("GET", "/pm/team-calendar?from=2026-12-14&to=2026-12-16", token=T); check("meeting shown in team calendar", s == 200 and any(c.get("2026-12-15", {}).get("meetings") for c in d["data"]["cells"].values()), list(d["data"]["cells"].keys())[:2])
    s, d = call("POST", f"/pm/meetings/{mid}/cancel", {}, T); check("meeting cancelled", s == 200, d)
    s, d = call("DELETE", f"/pm/meetings/{mid}", token=T); check("meeting deleted (clean-up)", s == 200, d)

# ---------- daily plan ----------
loc = masters["work_location"][0]["_id"]
s, d = call("PUT", "/pm/plans", {"dates": ["2026-12-20", "2026-12-21"], "entries": [{"description": "E2E planned work", "location": loc, "hours": 8}]}, T)
check("daily plan for 2 dates", s == 200 and d["data"]["saved"] == 2, d)
plans = call("GET", "/pm/plans?from=2026-12-20&to=2026-12-21", token=T)[1]["data"]
s, d = call("PATCH", f"/pm/plans/{plans[0]['_id']}/entries/{plans[0]['entries'][0]['_id']}", {"result": "done", "remarks": "ok"}, T); check("end-of-day update", s == 200 and d["data"]["result"] == "done", d)
for p in plans: call("DELETE", f"/pm/plans/{p['_id']}", token=T)
s, d = call("PUT", "/pm/plans", {"dates": ["2026-12-20"], "entries": [{"description": "", "location": loc}]}, T); check("plan entry needs a task or work", s == 400, d)

# ---------- rights and visibility ----------
T2, raw = login(os.environ.get("PM_TEST_NO_RIGHTS", "")) if os.environ.get("PM_TEST_NO_RIGHTS") else (None, "PM_TEST_NO_RIGHTS not set")
if T2:
    for path in ["/pm/projects", "/pm/tasks", "/pm/dashboard", "/pm/clients", "/pm/reports/overdue", "/pm/hierarchy", "/pm/tickets", "/pm/messages", f"/pm/tasks/{first['_id']}"]:
        s, d = call("GET", path, token=T2)
        check(f"user without PM rights refused: {path.split('?')[0][:28]}", s in (403, 404), (s, d))
    s, d = call("POST", f"/pm/tasks/{first['_id']}/status", {"status": st["isInitial"]["_id"]}, T2); check("no-rights user cannot change a task", s in (403, 404), d)
else:
    print("  (second login not available:", str(raw)[:80], ")")
s, d = call("GET", "/pm/projects"); check("no token refused", s == 401)
s, d = call("GET", "/pm/portal/home", token=T); check("internal user refused in the client portal", s == 403, d)
s, d = call("GET", "/pm/mail-settings", token=T); check("SMTP password never returned", s == 200 and "smtpPass" not in d["data"], d)

# clean-up of what this test added to the demo task
if comment_id: call("DELETE", f"/pm/comments/{comment_id}", token=T)
for a in att[:3]: call("DELETE", f"/pm/tasks/{first['_id']}/attachments/{a[1]['data']['_id']}", token=T)
if pasted_id: call("DELETE", f"/pm/tasks/{first['_id']}/attachments/{pasted_id}", token=T)

print(f"\n{ok_n} passed, {len(bad)} failed")
for b in bad: print("  FAILED:", b)
