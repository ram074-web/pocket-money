import { PageHeader } from "@/components/ui";
import { AskForm } from "./AskForm";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "How much money do customers owe us today?",
  "What is overdue?",
  "Which customer has the highest outstanding amount?",
  "Which invoices need correction?",
  "What is our expected cash position for the next 30 days?",
  "Which vendor payments are overdue?",
  "Show me everything pending today.",
  "Which projects have low margins?",
  "How much do we owe PrintHouse Industries?",
  "How much does Orion Global Foods Pvt Ltd owe us?",
];

export default function AskPage() {
  return (
    <div>
      <PageHeader
        title="Ask"
        subtitle="Ask a business question in plain language. Every figure is computed from stored records — nothing is invented."
      />
      <div className="p-6">
        <AskForm examples={EXAMPLES} />
      </div>
    </div>
  );
}
