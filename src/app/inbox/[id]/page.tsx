import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtINR } from "@/lib/calc";
import { PageHeader, Section, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function safeParseObject(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return {};
  }
}

export default async function InboundMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const message = await prisma.inboundMessage.findUnique({
    where: { id },
    include: {
      customer: true,
      vendor: true,
      quotation: true,
      purchaseOrder: true,
      invoice: true,
      vendorInvoice: true,
      routingLog: true,
      whatsappDrafts: true,
    },
  });

  if (!message) notFound();

  const classificationReasons = safeParseArray(message.classificationReasons);
  const matchReasons = safeParseArray(message.matchReasons);
  const extracted = safeParseObject(message.extractedData);

  return (
    <div>
      <PageHeader
        title={message.subject ?? "(no subject)"}
        subtitle={
          <>
            From {message.fromName ?? message.fromAddress} ({message.fromAddress}) · {message.channel} · {message.source.replaceAll("_", " ")} ·{" "}
            {message.receivedAt.toDateString()}
          </>
        }
      />
      <div className="p-6 space-y-6">
        <Section title="Original Message">
          <pre className="text-xs whitespace-pre-wrap bg-[var(--background)] rounded-md p-3">{message.body}</pre>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="1. Email Classification">
            <div className="text-sm space-y-1">
              <div>
                Category: <span className="badge badge-gray">{message.category?.replaceAll("_", " ")}</span>
              </div>
              {classificationReasons.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-[var(--muted)] mt-2">
                  {classificationReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="2. Customer / Vendor Identification">
            {message.customer ? (
              <div className="text-sm">
                Identified as customer{" "}
                <Link href={`/customers/${message.customer.id}`} className="text-[var(--brand)] hover:underline">
                  {message.customer.name}
                </Link>
              </div>
            ) : message.vendor ? (
              <div className="text-sm">
                Identified as vendor{" "}
                <Link href={`/vendors/${message.vendor.id}`} className="text-[var(--brand)] hover:underline">
                  {message.vendor.name}
                </Link>
              </div>
            ) : (
              <EmptyState text="Sender could not be matched to any existing customer or vendor." />
            )}
          </Section>

          <Section title="3. Quotation / PO / Invoice Matching">
            <div className="text-sm space-y-1">
              <div>
                Result:{" "}
                <span
                  className={`badge ${
                    message.matchResult === "VERIFIED"
                      ? "badge-green"
                      : message.matchResult === "REQUIRES_VERIFICATION"
                        ? "badge-amber"
                        : message.matchResult === "NO_MATCH_FOUND"
                          ? "badge-red"
                          : "badge-gray"
                  }`}
                >
                  {message.matchResult.replaceAll("_", " ")}
                </span>
              </div>
              {message.quotation && (
                <div>
                  Quotation:{" "}
                  <Link href={`/customers/${message.customerId}`} className="text-[var(--brand)] hover:underline">
                    {message.quotation.quotationNo}
                  </Link>
                </div>
              )}
              {message.purchaseOrder && <div>PO: {message.purchaseOrder.poNo}</div>}
              {message.invoice && (
                <div>
                  Invoice:{" "}
                  <Link href={`/invoices/${message.invoice.id}`} className="text-[var(--brand)] hover:underline">
                    {message.invoice.invoiceNo}
                  </Link>
                </div>
              )}
              {message.vendorInvoice && <div>Vendor Invoice: {message.vendorInvoice.vendorInvoiceNo}</div>}
              {matchReasons.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-[var(--muted)] mt-2">
                  {matchReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="4. Data Extraction">
            {Object.keys(extracted).length === 0 ? (
              <EmptyState text="No structured fields extracted." />
            ) : (
              <table className="data-table">
                <tbody>
                  {Object.entries(extracted).map(([k, v]) => (
                    <tr key={k}>
                      <td className="font-medium">{k}</td>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="5. Required Action">
            <p className="text-sm">{message.requiredAction}</p>
          </Section>

          <Section title="6. Responsible">
            <p className="text-sm">{message.responsibleRole}</p>
          </Section>

          <Section title="7. Financial Impact">
            <p className="text-sm font-semibold">{message.financialImpact != null ? fmtINR(message.financialImpact) : "None"}</p>
          </Section>

          <Section title="8. Approval Requirement">
            {message.approvalRequirement === "APPROVAL_REQUIRED" ? (
              <span className="badge badge-amber">Approval required before this goes external</span>
            ) : (
              <span className="badge badge-green">Auto-allowed (internal processing only)</span>
            )}
          </Section>
        </div>

        <Section title="9. Database Update">
          <p className="text-sm">{message.databaseUpdateSummary || "No changes made."}</p>
        </Section>

        <Section title="10. WhatsApp Notification (Draft)">
          {message.whatsappDrafts.length === 0 ? (
            <EmptyState text="No WhatsApp notification generated for this message." />
          ) : (
            <div className="space-y-3">
              {message.whatsappDrafts.map((d) => (
                <div key={d.id}>
                  <div className="text-xs text-[var(--muted)] mb-1">
                    To: {d.toRole} · <StatusBadge status={d.status} />
                  </div>
                  <pre className="text-xs whitespace-pre-wrap bg-[var(--background)] rounded-md p-3">{d.messageText}</pre>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
