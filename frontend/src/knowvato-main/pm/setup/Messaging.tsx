import { useEffect, useState } from "react";
import { Save, Send, Share2 } from "lucide-react";
import { pmApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { UIButton } from "../../components/UIKit";
import { LABEL, Pill, Toggle } from "../../user-management/shared";
import { PageTitle } from "../shared";

const HOURS = [-1, ...Array.from({ length: 24 }, (_, i) => i)];
const hourLabel = (h: number) => (h < 0 ? "Off" : `${String(h).padStart(2, "0")}:00`);

/** Setup › Sending Settings: how Project Management sends messages. */
export default function Messaging() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const canSave = hasRight("setup", "configure");
  const [s, setS] = useState<any>(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState("");
  const [to, setTo] = useState({ email: "", number: "" });

  useEffect(() => {
    pmApi.mailSettings().then((r: any) => setS(r.data)).catch((e: any) => toast(e?.message || "Could not load", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!s) return <PageTitle icon={<Share2 className="h-4 w-4" />} title="Sending Settings" />;
  const set = (patch: any) => setS({ ...s, ...patch });

  const save = async () => {
    setBusy("save");
    try {
      const res: any = await pmApi.saveMailSettings({ ...s, smtpPass: pass || undefined });
      setS(res.data);
      setPass("");
      toast("Saved");
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setBusy("");
    }
  };
  const test = async (kind: "email" | "whatsapp") => {
    setBusy(kind);
    try {
      const res: any = kind === "email" ? await pmApi.testEmail(to.email) : await pmApi.testWhatsapp(to.number);
      toast(res.data.simulated ? "WhatsApp is in simulation; nothing was delivered" : "Test sent", res.data.simulated ? "error" : "success");
    } catch (e: any) {
      toast(e?.message || "Could not send", "error");
    } finally {
      setBusy("");
    }
  };

  const card = "rounded-xl border bg-card p-4 space-y-3";
  const heading = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  const row = "flex items-center justify-between gap-3 text-sm";

  return (
    <div>
      <PageTitle icon={<Share2 className="h-4 w-4" />} title="Sending Settings" actions={canSave && <UIButton onClick={save} loading={busy === "save"} leftIcon={<Save className="h-3.5 w-3.5" />}>Save</UIButton>} />
      <fieldset disabled={!canSave} className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ border: 0, padding: 0, margin: "12px 0 0", minWidth: 0 }}>
        <div className={`${card} lg:col-span-2`} style={s.testMode ? { borderColor: "var(--warning)" } : undefined}>
          <div className="flex items-center justify-between gap-3">
            <div className={heading}>Test mode</div>
            <Toggle on={s.testMode} onChange={() => set({ testMode: !s.testMode })} labels={["On", "Off"]} />
          </div>
          <p className="text-xs text-muted-foreground" style={{ margin: 0 }}>On: every message goes to the test recipients below, never to clients or the team.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Test email</label>
              <input type="email" className="ui-input w-full" value={s.testEmail} onChange={(e) => set({ testEmail: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Test WhatsApp number</label>
              <input type="tel" className="ui-input w-full" value={s.testNumber} onChange={(e) => set({ testNumber: e.target.value.replace(/[^\d+]/g, "") })} placeholder="919876543210" />
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <div className={heading}>Email (SMTP)</div>
            <Toggle on={s.emailEnabled} onChange={() => set({ emailEnabled: !s.emailEnabled })} labels={["On", "Off"]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={LABEL}>Host</label>
              <input className="ui-input w-full" value={s.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Port</label>
              <input type="number" className="ui-input w-full" value={s.smtpPort} onChange={(e) => set({ smtpPort: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>User</label>
              <input className="ui-input w-full" value={s.smtpUser} autoComplete="off" onChange={(e) => set({ smtpUser: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Password</label>
              <input type="password" className="ui-input w-full" value={pass} autoComplete="new-password" onChange={(e) => setPass(e.target.value)} placeholder={s.smtpPassSet ? "••••••••" : ""} />
            </div>
            <div>
              <label className={LABEL}>From name</label>
              <input className="ui-input w-full" value={s.fromName} onChange={(e) => set({ fromName: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>From email</label>
              <input type="email" className="ui-input w-full" value={s.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} />
            </div>
          </div>
          <div className={row}>
            <span>SSL (port 465)</span>
            <Toggle on={s.smtpSecure} onChange={() => set({ smtpSecure: !s.smtpSecure })} labels={["Yes", "No"]} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="email" className="ui-input flex-1 min-w-0" value={to.email} aria-label="Send test email to" onChange={(e) => setTo({ ...to, email: e.target.value })} placeholder="name@example.com" />
            <UIButton variant="outline" onClick={() => test("email")} loading={busy === "email"} disabled={!to.email.trim()} leftIcon={<Send className="h-3.5 w-3.5" />}>Send test</UIButton>
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <div className={heading}>WhatsApp</div>
            <Toggle on={s.whatsappEnabled} onChange={() => set({ whatsappEnabled: !s.whatsappEnabled })} labels={["On", "Off"]} />
          </div>
          <div className={row}>
            <span>Provider</span>
            <Pill tone={s.whatsappVendor === "simulation" ? "warning" : "success"}>{String(s.whatsappVendor || "simulation").toUpperCase()}</Pill>
          </div>
          <p className="text-xs text-muted-foreground" style={{ margin: 0 }}>The account is the one set in Configuration → WhatsApp Integration.</p>
          <div className="flex items-center gap-2 pt-1">
            <input type="tel" className="ui-input flex-1 min-w-0" value={to.number} aria-label="Send test message to" onChange={(e) => setTo({ ...to, number: e.target.value.replace(/[^\d+]/g, "") })} placeholder="919876543210" />
            <UIButton variant="outline" onClick={() => test("whatsapp")} loading={busy === "whatsapp"} disabled={!to.number.trim()} leftIcon={<Send className="h-3.5 w-3.5" />}>Send test</UIButton>
          </div>
        </div>

        <div className={`${card} lg:col-span-2`}>
          <div className={heading}>Links and reminders</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className={LABEL}>App address</label>
              <input className="ui-input w-full" value={s.appUrl} onChange={(e) => set({ appUrl: e.target.value })} placeholder="https://app.yourcompany.com" />
            </div>
            <div>
              <label className={LABEL}>Daily digest</label>
              <select className="ui-input w-full" value={s.digestHour} onChange={(e) => set({ digestHour: Number(e.target.value) })}>
                {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Plan reminder</label>
              <select className="ui-input w-full" value={s.planReminderHour} onChange={(e) => set({ planReminderHour: Number(e.target.value) })}>
                {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Verification reminder (days)</label>
              <input type="number" min={0} max={30} className="ui-input w-full" value={s.verificationReminderDays} onChange={(e) => set({ verificationReminderDays: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
