import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { invoiceOutstanding, isOverdue, fmtINR } from "@/lib/calc";
import { paymentFollowUpEmail, invoiceCorrectionResponseEmail } from "@/lib/communications";
import { PageHeader, Section, StatCard, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      project: true,
      purchaseOrder: true,
      employee: true,
      payments: { orderBy: { paymentDate: "desc" } },
      corrections: { orderBy: { requestedDate: "desc" } },
      communications: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  const outstanding = invoiceOutstanding(invoice);
  const overdue = isOverdue(invoice.dueDate) && outstanding > 0;
  const followUpDraft = paymentFollowUpEmail(invoice, invoice.customer);
  const openCorrection = invoice.corrections.find((c) => c.status !== "Resolved");
  const correctionDraft = openCorrection
    ? invoiceCorrectionResponseEmail(invoice, invoice.customer, openCorrection.correctionNeeded)
    : null;

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoiceNo}`}
        subtitle={
          <>
            <Link href={`/customers/${invoice.customerId}`} className="hover:underline">
              {invoice.customer.name}
            </Link>
            {invoice.project ? ` · ${invoice.project.name}` : ""}
            {invoice.purchaseOrder ? ` · PO ${invoice.purchaseOrder.poNo}` : ""}
          </>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Invoice Value" value={fmtINR(invoice.value + invoice.taxAmount)} hint={`Tax: ${fmtINR(invoice.taxAmount)}`} />
          <StatCard label="Received" value={fmtINR(invoice.amountReceived)} tone="green" />
          <StatCard label="Outstanding" value={fmtINR(outstanding)} tone={overdue ? "red" : "default"} />
          <StatCard label="Status" value={invoice.status.replaceAll("_", " ")} tone={overdue ? "red" : "default"} />
        </div>

        <Section title="Details">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-[var(--muted)] text-xs">Invoice Date</dt>
              <dd>{invoice.invoiceDate.toDateString()}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)] text-xs">Submission Date</dt>
              <dd>{invoice.submissionDate ? invoice.submissionDate.toDateString() : "Data not available"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)] text-xs">Due Date</dt>
              <dd className={overdue ? "text-[var(--red)]" : ""}>{invoice.dueDate.toDateString()}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)] text-xs">Responsible Employee</dt>
              <dd>{invoice.employee?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)] text-xs">Division</dt>
              <dd>{invoice.division === "DIGITAL_MARKETING" ? "Digital Marketing" : "Offline/Print"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)] text-xs">Notes</dt>
              <dd>{invoice.notes ?? "—"}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Payments">
          {invoice.payments.length === 0 ? (
            <EmptyState text="No payments received yet." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Reconciled</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paymentDate.toDateString()}</td>
                    <td>{fmtINR(p.amount)}</td>
                    <td>{p.reference ?? "—"}</td>
                    <td>{p.reconciled ? <span className="badge badge-green">Yes</span> : <span className="badge badge-amber">Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Correction History">
          {invoice.corrections.length === 0 ? (
            <EmptyState text="No corrections recorded." />
          ) : (
            <ul className="text-sm space-y-3">
              {invoice.corrections.map((c) => (
                <li key={c.id} className="border-b border-[var(--border)] last:border-b-0 pb-3 last:pb-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.correctionNeeded}</span>
                    <span className="badge badge-amber">{c.status}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Requested by {c.requestedBy} on {c.requestedDate.toDateString()}
                    {c.responsiblePerson ? ` · Owner: ${c.responsiblePerson}` : ""}
                  </div>
                  {c.reasonForDelay && <div className="text-xs mt-1">Reason for delay: {c.reasonForDelay}</div>}
                  <div className="text-xs mt-1">
                    Corrected: {c.correctedDate ? c.correctedDate.toDateString() : "Pending"} · Resubmitted:{" "}
                    {c.resubmittedDate ? c.resubmittedDate.toDateString() : "Pending"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Communication History">
          {invoice.communications.length === 0 ? (
            <EmptyState text="No communication on record." />
          ) : (
            <ul className="text-sm space-y-2">
              {invoice.communications.map((c) => (
                <li key={c.id} className="border-b border-[var(--border)] last:border-b-0 pb-2 last:pb-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.subject}</span>
                    <span className="text-xs text-[var(--muted)]">{c.createdAt.toDateString()}</span>
                  </div>
                  <div className="text-xs whitespace-pre-wrap">{c.body}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {outstanding > 0 && (
          <Section title="Draft: Payment Follow-up Email">
            <p className="text-xs text-[var(--muted)] mb-2">
              Drafted for review — requires explicit approval before sending to the customer.
            </p>
            <div className="text-sm font-medium mb-1">{followUpDraft.subject}</div>
            <pre className="text-xs whitespace-pre-wrap bg-[var(--background)] rounded-md p-3">{followUpDraft.body}</pre>
          </Section>
        )}

        {correctionDraft && (
          <Section title="Draft: Correction Response Email">
            <p className="text-xs text-[var(--muted)] mb-2">
              Drafted for review — requires explicit approval before sending to the customer.
            </p>
            <div className="text-sm font-medium mb-1">{correctionDraft.subject}</div>
            <pre className="text-xs whitespace-pre-wrap bg-[var(--background)] rounded-md p-3">{correctionDraft.body}</pre>
          </Section>
        )}
      </div>
    </div>
  );
}
