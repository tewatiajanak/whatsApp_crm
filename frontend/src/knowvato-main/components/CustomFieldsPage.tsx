import { Database } from "lucide-react";
import MiniCrudPage from "./MiniCrudPage";
import type { SetupModule } from "@/lib/template-store";
import { useEventChoices, scopeLabel } from "../event-form/eventScope";

// Stored in MongoDB per module, so fields created in one module's Setup are
// never listed in another.
export default function CustomFieldsPage({ module = "events" }: { module?: SetupModule }) {
  // Event Manager fields can be limited to particular events.
  const forEvents = module === "events";
  const eventChoices = useEventChoices(forEvents);
  return (
    <MiniCrudPage
      title="Field Library"
      icon={Database}
      storageKey={`custom_fields_${module}`}
      endpoint="/custom-fields"
      params={{ module }}
      createLabel="Add field"
      fields={[
        { key: "label", label: "Name", required: true, placeholder: "Meal Preference" },
        { key: "key", label: "Key", required: true, placeholder: "meal_preference" },
        { key: "type", label: "Field type", type: "select", options: ["text", "number", "email", "phone", "dropdown", "multiselect", "rating", "date", "file", "signature", "address", "consent"] },
        ...(forEvents
          ? [{ key: "events", label: "Applies to events", type: "multiselect" as const, choices: eventChoices, emptyLabel: "All events" }]
          : []),
        { key: "isActive", label: "Status", type: "toggle" },
      ]}
      columns={[
        { key: "label", label: "Name" },
        { key: "key", label: "Key", render: (r) => <code className="text-xs font-mono text-muted-foreground">{r.key}</code> },
        { key: "type", label: "Field type" },
        ...(forEvents ? [{ key: "events", label: "Events", render: (r: any) => scopeLabel(r.events, eventChoices) }] : []),
        { key: "isActive", label: "Status", render: (r) => (r.isActive !== false ? "Active" : "Inactive") },
      ]}
    />
  );
}
