import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtINR } from "@/lib/calc";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { LoadScenariosButton } from "./LoadScenariosButton";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  CUSTOMER_QUOTATION_REQUEST: "Customer Quotation Request",
  CUSTOMER_PO: "Customer PO",
  PO_AMENDMENT: "PO Amendment",
  INVOICE_SUBMISSION_INSTRUCTION: "Invoice Submission Instruction",
  INVOICE_REJECTION: "Invoice Rejection",
  INVOICE_CORRECTION_REQUEST: "Invoice Correction Request",
  PAYMENT_CONFIRMATION: "Payment Confirmation",
  PAYMENT_FOLLOWUP: "Payment Follow-up",
  VENDOR_QUOTATION: "Vendor Quotation",
  VENDOR_INVOICE: "Vendor Invoice",
  VENDOR_PAYMENT_REQUEST: "Vendor Payment Request",
  CUSTOMER_COMPLAINT: "Customer Complaint",
  PROJECT_INSTRUCTION: "Project Instruction",
  OTHER: "Other / Unclassified",
};

const MATCH_TONE: Record<string, string> = {
  VERIFIED: "badge-green",
  REQUIRES_VERIFICATION: "badge-amber",
  NO_MATCH_FOUND: "badge-red",
  NOT_APPLICABLE: "badge-gray",
};

export default async function InboxPage() {
  await requireUser();

  const messages = await prisma.inboundMessage.findMany({
    include: { customer: true, vendor: true },
    orderBy: { receivedAt: "desc" },
  });
  const routingLog = await prisma.routingLogEntry.findMany({
    include: { inboundMessage: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <PageHeader
        title="Email + WhatsApp Inbox (Test Mode)"
        subtitle="Demo/test mode only — no real Gmail or WhatsApp account is connected. Every message below is fixture data."
      />
      <div className="p-6 space-y-6">
        <Section title="Sample scenarios">
          <p className="text-sm text-[var(--muted)] mb-3">
            Nine sample messages covering the full range the spec asks for: customer quotation requests, POs, PO
            amendments, invoice corrections, payment confirmations, customer payment follow-ups, vendor quotations,
            vendor invoices, and vendor payment requests. Loading them runs the same classify → identify → match →
            route → draft pipeline that would run on a real inbox — nothing is sent externally.
          </p>
          <LoadScenariosButton />
        </Section>

        <Section title={`Inbound Messages (${messages.length})`}>
          {messages.length === 0 ? (
            <EmptyState text='No messages processed yet — click "Load Sample Scenarios" above.' />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Party</th>
                  <th>Match</th>
                  <th>Financial Impact</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td>{m.receivedAt.toDateString()}</td>
                    <td>{m.fromName ?? m.fromAddress}</td>
                    <td>
                      <Link href={`/inbox/${m.id}`} className="text-[var(--brand)] hover:underline">
                        {m.subject ?? "(no subject)"}
                      </Link>
                    </td>
                    <td>
                      <span className="badge badge-gray">{CATEGORY_LABEL[m.category ?? "OTHER"] ?? m.category}</span>
                    </td>
                    <td>{m.customer?.name ?? m.vendor?.name ?? "Unidentified"}</td>
                    <td>
                      <span className={`badge ${MATCH_TONE[m.matchResult] ?? "badge-gray"}`}>{m.matchResult.replaceAll("_", " ")}</span>
                    </td>
                    <td>{m.financialImpact != null ? fmtINR(m.financialImpact) : "—"}</td>
                    <td>
                      {m.approvalRequirement === "APPROVAL_REQUIRED" ? (
                        <span className="badge badge-amber">Approval required</span>
                      ) : (
                        <span className="badge badge-green">Auto-allowed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Routing Log">
          {routingLog.length === 0 ? (
            <EmptyState text="No routing activity yet." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Classification</th>
                  <th>Person Responsible</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {routingLog.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/inbox/${r.inboundMessageId}`} className="text-[var(--brand)] hover:underline">
                        {r.inboundMessage.subject ?? "(no subject)"}
                      </Link>
                    </td>
                    <td>{CATEGORY_LABEL[r.classification] ?? r.classification}</td>
                    <td>{r.routedTo}</td>
                    <td>{r.action}</td>
                    <td>
                      <span className="badge badge-gray">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}
