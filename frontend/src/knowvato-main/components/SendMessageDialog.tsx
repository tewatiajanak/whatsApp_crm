import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MessageComposer, { type Channel, type Recipient } from "./MessageComposer";

export type { Recipient };

/** Right-side drawer to message a list of people (e.g. the registrants currently shown). */
export default function SendMessageDialog({ channel, recipients, onClose, onNotify }: { channel: Channel; recipients: Recipient[]; onClose: () => void; onNotify: (msg: string, type?: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b p-4 pr-10">
          <SheetTitle>{channel === "whatsapp" ? "Send WhatsApp message" : "Send email"}</SheetTitle>
        </SheetHeader>
        <MessageComposer channel={channel} recipients={recipients} onNotify={onNotify} onClose={onClose} onBusy={setBusy} />
      </SheetContent>
    </Sheet>
  );
}
