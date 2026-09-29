import { useEffect, useMemo, useState } from "react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Lock,
  Loader2,
} from "lucide-react";
import { UIButton, SearchInput } from "../components/UIKit";

type EventType = {
  _id: string;
  tenant: string;
  name: string;
  key: string;
  icon: string;
  color: string;
  description?: string;
  defaultFeatures: Record<string, boolean>;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  key: string;
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  key: "",
  icon: "bi-calendar-event",
  color: "#2249b7",
  description: "",
  isActive: true,
};

const COMMON_ICONS = [
  "bi-calendar-event",
  "bi-mic",
  "bi-easel",
  "bi-tools",
  "bi-camera-video",
  "bi-mortarboard",
  "bi-stars",
  "bi-building",
  "bi-shop-window",
  "bi-briefcase",
  "bi-trophy",
  "bi-music-note-beamed",
  "bi-award",
  "bi-balloon",
  "bi-rocket-takeoff",
  "bi-people",
  "bi-clipboard-check",
  "bi-flag",
  "bi-code-slash",
  "bi-person-badge",
  "bi-bank",
  "bi-shield-lock",
  "bi-heart",
  "bi-hand-thumbs-up",
  "bi-film",
  "bi-music-player",
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

export default function EventTypesPage() {
  const toast = useToast();
  const [items, setItems] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EventType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [keyEdited, setKeyEdited] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventType | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await http.get("/event-types?perPage=200&sort=sortOrder");
      const list: EventType[] = res?.data ?? res?.items ?? (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (e: any) {
      toast?.error?.(e?.message || "Failed to load event types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.key.toLowerCase().includes(q) ||
        (it.description ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setKeyEdited(false);
    setDrawerOpen(true);
  };

  const openEdit = (it: EventType) => {
    setEditing(it);
    setForm({
      name: it.name,
      key: it.key,
      icon: it.icon,
      color: it.color,
      description: it.description ?? "",
      isActive: it.isActive,
    });
    setKeyEdited(true);
    setDrawerOpen(true);
  };

  const onNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      key: keyEdited ? f.key : slugify(name),
    }));
  };

  const onKeyChange = (key: string) => {
    setKeyEdited(true);
    setForm((f) => ({ ...f, key: slugify(key) }));
  };

  const canSave = form.name.trim().length > 1 && form.key.trim().length > 1;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        key: form.key.trim(),
        icon: form.icon,
        color: form.color,
        description: form.description.trim(),
        isActive: form.isActive,
      };
      if (editing) {
        await http.patch(`/event-types/${editing._id}`, payload);
        toast?.success?.("Event type updated");
      } else {
        await http.post("/event-types", payload);
        toast?.success?.("Event type created");
      }
      setDrawerOpen(false);
      await load();
    } catch (e: any) {
      toast?.error?.(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await http.del(`/event-types/${deleteTarget._id}`);
      toast?.success?.(`Removed "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast?.error?.(e?.message || "Delete failed");
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm("Restore the seeded system event types? Custom items you added will be kept.")) return;
    try {
      await http.post("/event-types/reset-defaults", {});
      toast?.success?.("Defaults restored");
      await load();
    } catch (e: any) {
      toast?.error?.(e?.message || "Reset failed");
    }
  };

  const toggleActive = async (it: EventType) => {
    try {
      await http.patch(`/event-types/${it._id}`, { isActive: !it.isActive });
      setItems((prev) => prev.map((x) => (x._id === it._id ? { ...x, isActive: !x.isActive } : x)));
    } catch (e: any) {
      toast?.error?.(e?.message || "Update failed");
    }
  };

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Event Types</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Templates for creating events. Each type carries defaults (icon, color, feature toggles)
            that pre-fill new events of that kind.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UIButton variant="outline" onClick={resetDefaults} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
            Restore defaults
          </UIButton>
          <UIButton onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Add event type
          </UIButton>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, key, or description…"
          containerClassName="flex-1 min-w-[240px] max-w-md"
        />
        <div className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} of ${items.length}`}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[11px] uppercase tracking-wider text-muted-foreground"
                style={{ background: "var(--muted-background)" }}
              >
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Key</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Active</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    Loading event types…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No event types match your search.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((it) => (
                  <tr key={it._id} className="border-t hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                          style={{
                            background: `color-mix(in srgb, ${it.color} 15%, transparent)`,
                            color: it.color,
                          }}
                        >
                          <i className={`${it.icon} text-[15px]`} />
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            {it.name}
                            {it.isSystem && (
                              <span
                                title="System type — restore-safe"
                                className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{
                                  background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                                  color: "var(--primary)",
                                }}
                              >
                                <Lock className="h-2.5 w-2.5" />
                                System
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {it.key}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-[13px] max-w-md truncate">
                      {it.description || <span className="italic opacity-60">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Switch checked={it.isActive} onCheckedChange={() => toggleActive(it)} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(it)} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </UIButton>
                        <UIButton size="icon-sm" variant="danger" onClick={() => setDeleteTarget(it)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </UIButton>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit event type" : "Add event type"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Rename, re-brand, or toggle this event type."
                : "New event types appear in the Create Event wizard immediately."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="et-name">Name *</Label>
              <Input
                id="et-name"
                value={form.name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. Blood Donation Camp"
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="et-key">Key *</Label>
              <Input
                id="et-key"
                value={form.key}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder="auto-generated from name"
                className="font-mono"
                maxLength={40}
                disabled={!!editing?.isSystem}
              />
              <p className="text-[11px] text-muted-foreground">
                Machine name used in code and URLs. Cannot be changed on system types.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="et-color">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="et-color"
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-9 w-14 rounded-md border cursor-pointer bg-background"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <div
                  className="h-9 rounded-md border flex items-center justify-center gap-2 text-sm font-medium"
                  style={{
                    background: `color-mix(in srgb, ${form.color} 12%, transparent)`,
                    color: form.color,
                  }}
                >
                  <i className={`${form.icon} text-base`} />
                  <span>{form.name || "Preview"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {COMMON_ICONS.map((ic) => {
                  const active = form.icon === ic;
                  return (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                      className={
                        "h-9 rounded-md border flex items-center justify-center transition-colors " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent")
                      }
                      title={ic}
                    >
                      <i className={`${ic} text-[15px]`} />
                    </button>
                  );
                })}
              </div>
              <Input
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                className="font-mono text-xs mt-2"
                placeholder="bi-… (bootstrap-icons class)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="et-desc">Description</Label>
              <Textarea
                id="et-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="One-line description shown in the Create Event picker."
                rows={2}
                maxLength={220}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-[11px] text-muted-foreground">
                  Inactive types are hidden from the Create Event picker.
                </div>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked: boolean) => setForm((f) => ({ ...f, isActive: checked }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-6 gap-2">
            <UIButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </UIButton>
            <UIButton onClick={save} disabled={!canSave} loading={saving}>
              {editing ? "Save changes" : "Create event type"}
            </UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the event type. Events already created with it will keep the reference but
              new events won't be able to select it.
              {deleteTarget?.isSystem && (
                <span className="block mt-2 text-amber-600 font-medium">
                  This is a system type. You can restore it with "Restore defaults" later.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
