import { PageHeader, Section } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Excel Import"
        subtitle="Consolidate existing Excel invoice registers into the single source of truth — without silently overwriting anything."
      />
      <div className="p-6 space-y-6">
        <Section title="How it works">
          <ul className="text-sm list-disc pl-5 space-y-1 text-[var(--muted)]">
            <li>Upload an invoice register in the expected column format (download the template below).</li>
            <li>Rows with a customer name and invoice number that don&apos;t already exist are imported automatically.</li>
            <li>Duplicate invoice numbers (already in the system, or repeated within the file) are skipped, not overwritten.</li>
            <li>Rows where the same invoice number exists with different amounts are flagged as a conflict for manual verification.</li>
            <li>Rows with missing required fields, unknown customers, or invalid dates are flagged and not imported.</li>
            <li>Every import is logged with a full row-by-row audit trail.</li>
          </ul>
          <a
            href="/api/import/template"
            className="inline-block mt-3 text-xs px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--background)]"
          >
            Download template (.xlsx)
          </a>
        </Section>

        <ImportForm />
      </div>
    </div>
  );
}
