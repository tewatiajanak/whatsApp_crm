import { useEffect, useMemo, useState } from "react";
import { http } from "../../api";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ListChecks,
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
  const navigate = useNavigate();
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
      toast?.(e?.message || "Failed to load event categories", "error");
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
        toast?.("Event category updated");
      } else {
        await http.post("/event-types", payload);
        toast?.("Event category created");
      }
      setDrawerOpen(false);
      await load();
    } catch (e: any) {
      toast?.(e?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await http.del(`/event-types/${deleteTarget._id}`);
      toast?.(`Removed "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast?.(e?.message || "Delete failed", "error");
    }
  };

  const toggleActive = async (it: EventType) => {
    try {
      await http.patch(`/event-types/${it._id}`, { isActive: !it.isActive });
      setItems((prev) => prev.map((x) => (x._id === it._id ? { ...x, isActive: !x.isActive } : x)));
    } catch (e: any) {
      toast?.(e?.message || "Update failed", "error");
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground leading-tight">Event Categories</h2>
        </div>
        <div className="flex items-center gap-2">
          <UIButton onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Add event category
          </UIButton>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
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
      <div className="mt-3 rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[11px] uppercase tracking-wider text-muted-foreground"
                style={{ background: "var(--muted-background)" }}
              >
                <th className="px-4 py-2.5 text-left font-medium">Category</th>
                <th className="px-4 py-2.5 text-center font-medium w-32" style={{ textAlign: "center" }}>Status</th>
                <th className="px-4 py-2.5 text-right font-medium w-24" style={{ textAlign: "right", width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    Loading event categories…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No event categories match your search.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((it) => (
                  <tr key={it._id} className="border-t hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{it.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(it)}
                        className="inline-flex items-center gap-2 group"
                        title={it.isActive ? "Click to deactivate" : "Click to activate"}
                      >
                        <span
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            it.isActive ? "" : "bg-muted"
                          }`}
                          style={it.isActive ? { background: "var(--primary)" } : undefined}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              it.isActive ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </span>
                        <span
                          className={`text-[11px] font-medium ${
                            it.isActive ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {it.isActive ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <UIButton size="icon-sm" variant="ghost" onClick={() => navigate(`/modules/events/setup/task-checklist?category=${it._id}`)} title="Tasks and checklist of this category">
                          <ListChecks className="h-3.5 w-3.5" />
                        </UIButton>
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
        <SheetContent className="crm-theme w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit event category" : "Add event category"}</SheetTitle>
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
                  Inactive categories are hidden from the Create Event picker.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                className="inline-flex items-center shrink-0"
              >
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.isActive ? "" : "bg-muted"
                  }`}
                  style={form.isActive ? { background: "var(--primary)" } : undefined}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      form.isActive ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          <SheetFooter className="mt-6 gap-2">
            <UIButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </UIButton>
            <UIButton onClick={save} disabled={!canSave} loading={saving}>
              {editing ? "Save changes" : "Create event category"}
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
              This removes the event category. Events already created with it will keep the reference but
              new events won't be able to select it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              style={{ background: "var(--destructive)", color: "#fff", boxShadow: "none" }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
