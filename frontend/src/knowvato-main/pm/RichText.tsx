import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Bold, Image as ImageIcon, Italic, Link2, List, ListOrdered, Underline } from "lucide-react";

export type RichTextHandle = { insert: (text: string) => void };

const MAX_IMAGE = 300 * 1024;

/** Small rich-text editor for email bodies: bold, italic, underline, lists, link, image. */
const RichText = forwardRef<RichTextHandle, { value: string; onChange: (html: string) => void; onError?: (msg: string) => void; minHeight?: number }>(
  ({ value, onChange, onError, minHeight = 220 }, ref) => {
    const box = useRef<HTMLDivElement>(null);
    const file = useRef<HTMLInputElement>(null);

    // keep the DOM in step with the value only when it changed from outside
    useEffect(() => {
      if (box.current && box.current.innerHTML !== value) box.current.innerHTML = value || "";
    }, [value]);

    const emit = () => onChange(box.current?.innerHTML || "");
    const run = (cmd: string, arg?: string) => {
      box.current?.focus();
      document.execCommand(cmd, false, arg);
      emit();
    };
    useImperativeHandle(ref, () => ({ insert: (text: string) => run("insertText", text) }));

    const addImage = (f?: File | null) => {
      if (!f) return;
      if (f.size > MAX_IMAGE) return onError?.("The image must be smaller than 300 KB");
      const reader = new FileReader();
      reader.onload = () => run("insertHTML", `<img src="${reader.result}" style="max-width:100%" alt="">`);
      reader.readAsDataURL(f);
    };

    const tools: [string, React.ReactNode, () => void][] = [
      ["Bold", <Bold className="h-3.5 w-3.5" />, () => run("bold")],
      ["Italic", <Italic className="h-3.5 w-3.5" />, () => run("italic")],
      ["Underline", <Underline className="h-3.5 w-3.5" />, () => run("underline")],
      ["Bullets", <List className="h-3.5 w-3.5" />, () => run("insertUnorderedList")],
      ["Numbers", <ListOrdered className="h-3.5 w-3.5" />, () => run("insertOrderedList")],
      ["Link", <Link2 className="h-3.5 w-3.5" />, () => { const url = window.prompt("Link address"); if (url) run("createLink", url); }],
      ["Image", <ImageIcon className="h-3.5 w-3.5" />, () => file.current?.click()],
    ];

    return (
      <div className="rounded-lg border overflow-hidden bg-card">
        <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1" style={{ background: "var(--muted-background)" }}>
          {tools.map(([title, icon, fn]) => (
            <button key={title} type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={fn} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/50" style={{ background: "transparent", border: 0, color: "var(--foreground)" }}>
              {icon}
            </button>
          ))}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div ref={box} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit} className="px-3 py-2.5 text-sm outline-none overflow-y-auto" style={{ minHeight, maxHeight: 420 }} />
      </div>
    );
  }
);
RichText.displayName = "RichText";
export default RichText;
