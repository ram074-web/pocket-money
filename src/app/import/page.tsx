import { PageHeader, Section } from "@/components/ui";
import { ImportForm } from "./ImportForm";
import { requireAccess } from "@/lib/auth";

export default async function ImportPage() {
  await requireAccess("invoices");

  return (
    <div>
      <PageHeader
        title="Excel Import"
        subtitle="Consolidate existing Excel invoice registers into the single source of truth — without silently overwriting anything."
      />
      <div className="p-6 space-y-6">
        <Section title="How it works">
          <ul className="text-sm list-disc pl-5 space-y-1 text-[var(--muted)]">
            <li>
              The template has two sheets. <strong>Customers</strong> is processed first, so one file can
              populate a brand-new system — invoices on the second sheet then match the customers just created.
            </li>
            <li>Existing customers are matched by name and left unchanged, so re-running a file is safe.</li>
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
