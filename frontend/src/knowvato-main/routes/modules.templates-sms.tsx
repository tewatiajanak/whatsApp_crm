import TemplateManager from "@/components/TemplateManager";
import type { SetupModule } from "@/lib/template-store";

export default function Page({ module = "events" }: { module?: SetupModule }) {
  return <TemplateManager channel="sms" module={module} />;
}
