import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { usersApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import { UIButton } from "../components/UIKit";
import { LABEL } from "../user-management/shared";

type Kind = "internal" | "client";
type Policy = { kind: Kind; mode: "parts" | "fixed"; parts: string[]; fixedSet: boolean; fixedMasked: string; forceChange: boolean };

const PART_LABELS: Record<string, string> = { mobile: "Mobile number", email: "Email ID", dob: "Date of birth (DDMMYYYY)" };
// every order of one, two or all three details
const permutations = (items: string[]): string[][] => {
  const out: string[][] = [];
  const walk = (picked: string[], rest: string[]) => {
    if (picked.length) out.push(picked);
    rest.forEach((x, i) => walk([...picked, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  walk([], items);
  return out.sort((a, b) => a.length - b.length);
};
const OPTIONS = permutations(["mobile", "email", "dob"]);
const FIXED = "__fixed__";
const TITLES: Record<Kind, string> = { internal: "Own team users", client: "Client users" };

/** Configuration → User Management → Password Policy: the first password of a new user. */
export default function PasswordPolicyPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");

  useEffect(() => {
    usersApi
      .passwordPolicy()
      .then((res: any) => setPolicies(res?.data ?? []))
      .catch((e: any) => toast(e?.message || "Could not load the password policy", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (kind: Kind, p: Partial<Policy>) => setPolicies((prev) => prev.map((x) => (x.kind === kind ? { ...x, ...p } : x)));

  const save = async (p: Policy) => {
    setSaving(p.kind);
    try {
      const res: any = await usersApi.savePasswordPolicy(p.kind, { mode: p.mode, parts: p.parts, fixed: fixed[p.kind] || "", forceChange: p.forceChange });
      patch(p.kind, res.data);
      setFixed((f) => ({ ...f, [p.kind]: "" }));
      toast(`Password policy saved for ${TITLES[p.kind].toLowerCase()}`);
    } catch (e: any) {
      toast(e?.message || "Could not save the policy", "error");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 pb-3 border-b">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
          <LockKeyhole className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold text-foreground leading-tight">Password Policy</h2>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {policies.map((p) => {
          const value = p.mode === "fixed" ? FIXED : p.parts.join("+");
          return (
            <div key={p.kind} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">{TITLES[p.kind]}</div>
              <div>
                <label className={LABEL}>Default password</label>
                <select
                  className="ui-input w-full"
                  value={value}
                  onChange={(e) => (e.target.value === FIXED ? patch(p.kind, { mode: "fixed" }) : patch(p.kind, { mode: "parts", parts: e.target.value.split("+") }))}
                >
                  {OPTIONS.map((o) => (
                    <option key={o.join("+")} value={o.join("+")}>{o.map((x) => PART_LABELS[x]).join(" + ")}</option>
                  ))}
                  <option value={FIXED}>Same password for everyone</option>
                </select>
              </div>
              {p.mode === "fixed" && (
                <div>
                  <label className={LABEL}>Password for everyone {p.fixedSet ? "" : "*"}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="ui-input w-full"
                    value={fixed[p.kind] || ""}
                    onChange={(e) => setFixed({ ...fixed, [p.kind]: e.target.value })}
                    placeholder={p.fixedSet ? `${p.fixedMasked}  — leave blank to keep` : ""}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">At least 6 characters.</p>
                </div>
              )}
              <label className="text-sm text-foreground" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <input type="checkbox" checked={p.forceChange} onChange={(e) => patch(p.kind, { forceChange: e.target.checked })} />
                <span>Must set a new password at first sign-in</span>
              </label>
              <div className="flex justify-end pt-1 border-t">
                <UIButton className="mt-3" onClick={() => save(p)} loading={saving === p.kind} disabled={p.mode === "fixed" && !p.fixedSet && (fixed[p.kind] || "").length < 6}>
                  Save
                </UIButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
