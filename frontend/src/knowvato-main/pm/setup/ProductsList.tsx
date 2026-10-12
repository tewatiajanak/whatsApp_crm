import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { pmApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../../components/UIKit";
import { LABEL, Pill, Toggle } from "../../user-management/shared";
import { PageTitle } from "../shared";

type Product = { _id: string; name: string; code: string; description: string; active: boolean; modules: number; tasks: number };
type Form = { name: string; code: string; description: string; active: boolean };

/** Setup › Products: the product templates. Opening one goes to the builder. */
export default function ProductsList() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const nav = useNavigate();
  const { hasRight } = useAuth() as any;
  const canAdd = hasRight("setup", "create");
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [copyOf, setCopyOf] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await pmApi.products();
      setRows(res?.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => { setEditing(null); setCopyOf(null); setForm({ name: "", code: "", description: "", active: true }); };
  const save = async () => {
    if (!form?.name.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      if (copyOf) {
        const res: any = await pmApi.copyProduct(copyOf._id, { name: form.name, code: form.code });
        toast("Product copied");
        setForm(null);
        return nav(`/modules/projects/products/${res.data.product._id}`);
      }
      if (editing) await pmApi.updateProduct(editing._id, form);
      else {
        const res: any = await pmApi.createProduct(form);
        toast("Saved");
        setForm(null);
        return nav(`/modules/projects/products/${res.data._id}`);
      }
      toast("Saved");
      setForm(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}" with its ${p.modules} modules and ${p.tasks} tasks?`)) return;
    try {
      await pmApi.removeProduct(p._id);
      toast("Deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };

  return (
    <div>
      <PageTitle icon={<Boxes className="h-4 w-4" />} title="Products" actions={canAdd && <UIButton onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add product</UIButton>} />

      {!loading && rows.length === 0 && (
        <div className="mt-3 rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No products
          {canAdd && <div className="mt-3"><UIButton size="sm" onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add product</UIButton></div>}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map((p) => (
          <div key={p._id} className="rounded-xl border bg-card p-4 cursor-pointer hover:border-primary transition-colors" onClick={() => nav(`/modules/projects/products/${p._id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{p.code}</div>
              </div>
              <Pill tone={p.active ? "success" : "muted"}>{p.active ? "Active" : "Inactive"}</Pill>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="flex gap-5">
                <div><div className="text-xl font-semibold leading-none text-foreground">{p.modules}</div><div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">Modules</div></div>
                <div><div className="text-xl font-semibold leading-none text-foreground">{p.tasks}</div><div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">Tasks</div></div>
              </div>
              <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {canAdd && <UIButton size="icon-sm" variant="ghost" title="Copy product" onClick={() => { setEditing(null); setCopyOf(p); setForm({ name: `${p.name} (copy)`, code: "", description: p.description, active: true }); }}><Copy className="h-3.5 w-3.5" /></UIButton>}
                {hasRight("setup", "edit") && <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => { setCopyOf(null); setEditing(p); setForm({ name: p.name, code: p.code, description: p.description, active: p.active }); }}><Pencil className="h-3.5 w-3.5" /></UIButton>}
                {hasRight("setup", "del") && <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5" /></UIButton>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{copyOf ? `Copy ${copyOf.name}` : editing ? "Edit product" : "Add product"}</SheetTitle></SheetHeader>
          {form && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className={LABEL}>Name *</label>
                <input autoFocus className="ui-input w-full" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Code *</label>
                <input className="ui-input w-full" value={form.code} maxLength={20} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              {!copyOf && (
                <>
                  <div>
                    <label className={LABEL}>Description</label>
                    <textarea className="ui-input w-full" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ height: "auto" }} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>Active</span>
                    <Toggle on={form.active} onChange={() => setForm({ ...form, active: !form.active })} labels={["Yes", "No"]} />
                  </div>
                </>
              )}
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!form?.name.trim() || !form?.code.trim()} className="flex-1">{copyOf ? "Copy" : "Save"}</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
