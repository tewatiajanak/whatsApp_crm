import { useEffect, useState } from "react";
import { Save, Settings2 } from "lucide-react";
import { pmApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { UIButton } from "../../components/UIKit";
import { LABEL, Toggle } from "../../user-management/shared";
import { PageTitle } from "../shared";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type S = {
  workingDays: number[]; workStart: string; workEnd: string; maxAttachments: number; maxFileSizeMb: number;
  allowedFileTypes: string[]; aheadThreshold: number; delayedThreshold: number; pastedImagesCount: boolean;
  ticketReopenDays: number; workloadThreshold: number; timeLogging: boolean; meetingEmail: boolean;
};

/** Working days and hours, attachment limits, schedule thresholds. */
export default function Settings() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const canSave = hasRight("setup", "configure");
  const [s, setS] = useState<S | null>(null);
  const [types, setTypes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await pmApi.settings();
        setS(res.data);
        setTypes((res.data.allowedFileTypes || []).join(", "));
      } catch (e: any) {
        toast(e?.message || "Could not load", "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s) return <PageTitle icon={<Settings2 className="h-4 w-4" />} title="Settings" />;
  const set = (patch: Partial<S>) => setS({ ...s, ...patch });
  const num = (key: keyof S) => (e: any) => set({ [key]: Number(e.target.value) } as any);

  const save = async () => {
    setSaving(true);
    try {
      const { ...body } = s;
      const res: any = await pmApi.saveSettings({ ...body, allowedFileTypes: types.split(","), taskStatusFlow: undefined });
      setS(res.data);
      setTypes((res.data.allowedFileTypes || []).join(", "));
      toast("Saved");
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const card = "rounded-xl border bg-card p-4 space-y-3";
  const heading = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div>
      <PageTitle
        icon={<Settings2 className="h-4 w-4" />}
        title="Settings"
        actions={canSave && <UIButton onClick={save} loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>Save</UIButton>}
      />
      <fieldset disabled={!canSave} className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ border: 0, padding: 0, margin: "12px 0 0", minWidth: 0 }}>
        <div className={card}>
          <div className={heading}>Working time</div>
          <div className="pm-days">
            {DAYS.map((d, i) => {
              const on = s.workingDays.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ workingDays: on ? s.workingDays.filter((x) => x !== i) : [...s.workingDays, i].sort() })}
                  aria-pressed={on}
                  className={on ? "is-on" : ""}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Start</label>
              <input type="time" className="ui-input w-full" value={s.workStart} onChange={(e) => set({ workStart: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>End</label>
              <input type="time" className="ui-input w-full" value={s.workEnd} onChange={(e) => set({ workEnd: e.target.value })} />
            </div>
          </div>
        </div>

        <div className={card}>
          <div className={heading}>Schedule status</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Ahead above %</label>
              <input type="number" min={0} max={50} className="ui-input w-full" value={s.aheadThreshold} onChange={num("aheadThreshold")} />
            </div>
            <div>
              <label className={LABEL}>Delayed below %</label>
              <input type="number" min={0} max={50} className="ui-input w-full" value={s.delayedThreshold} onChange={num("delayedThreshold")} />
            </div>
          </div>
        </div>

        <div className={`${card} lg:col-span-2`}>
          <div className={heading}>Work</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Overloaded above (open tasks)</label>
              <input type="number" min={1} max={200} className="ui-input w-full" value={s.workloadThreshold} onChange={num("workloadThreshold")} />
            </div>
            <div>
              <label className={LABEL}>Ticket reopen days</label>
              <input type="number" min={0} max={90} className="ui-input w-full" value={s.ticketReopenDays} onChange={num("ticketReopenDays")} />
            </div>
            <div className="flex items-end justify-between gap-3 text-sm pb-1.5">
              <span>Time logging</span>
              <Toggle on={s.timeLogging} onChange={() => set({ timeLogging: !s.timeLogging })} labels={["On", "Off"]} />
            </div>
            <div className="flex items-end justify-between gap-3 text-sm pb-1.5">
              <span>Meeting email invite</span>
              <Toggle on={s.meetingEmail} onChange={() => set({ meetingEmail: !s.meetingEmail })} labels={["On", "Off"]} />
            </div>
          </div>
        </div>

        <div className={`${card} lg:col-span-2`}>
          <div className={heading}>Attachments</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Per task</label>
              <input type="number" min={0} max={20} className="ui-input w-full" value={s.maxAttachments} onChange={num("maxAttachments")} />
            </div>
            <div>
              <label className={LABEL}>Max size MB</label>
              <input type="number" min={1} max={50} className="ui-input w-full" value={s.maxFileSizeMb} onChange={num("maxFileSizeMb")} />
            </div>
            <div className="flex items-end justify-between gap-3 text-sm pb-1.5">
              <span>Pasted images count</span>
              <Toggle on={s.pastedImagesCount} onChange={() => set({ pastedImagesCount: !s.pastedImagesCount })} labels={["Yes", "No"]} />
            </div>
          </div>
          <div>
            <label className={LABEL}>File types</label>
            <input className="ui-input w-full" value={types} onChange={(e) => setTypes(e.target.value)} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
