import { PageHeader } from "@/components/ui";
import { WhatsAppSimulator } from "./WhatsAppSimulator";

export default function WhatsAppPage() {
  return (
    <div>
      <PageHeader
        title="WhatsApp Simulator"
        subtitle="No live WhatsApp Business API is connected — this simulates the conversational interface described in the spec, running the same command logic that would sit behind a real WhatsApp number."
      />
      <div className="p-6">
        <WhatsAppSimulator />
      </div>
    </div>
  );
}
