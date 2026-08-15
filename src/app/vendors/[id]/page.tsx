import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { vendorInvoiceOutstanding, vendorInvoiceTotal, isOverdue, fmtINR } from "@/lib/calc";
import { PageHeader, Section, StatCard, StatusBadge, EmptyState } from "@/components/ui";
import { requireAccess } from "@/lib/auth";
import { AddLink } from "@/components/NewButton";
import { VendorInvoiceActions } from "@/components/VendorInvoiceActions";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("payables");
  const canApprove = user.roleLabel === "Owner" || user.roleLabel === "Finance Manager";

  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      purchaseOrders: { orderBy: { poDate: "desc" } },
      vendorInvoices: { include: { payments: true }, orderBy: { invoiceDate: "desc" } },
      communications: { orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { dueDate: "asc" } },
      projectCosts: { include: { project: { include: { customer: true } } } },
    },
  });

  if (!vendor) notFound();

  const outstanding = vendor.vendorInvoices.reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
  const overdue = vendor.vendorInvoices.filter((vi) => isOverdue(vi.dueDate)).reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
  const totalPaid = vendor.vendorInvoices.reduce((s, vi) => s + vi.amountPaid, 0);

  return (
    <div>
      <PageHeader title={vendor.name} subtitle={`${vendor.category ?? ""} · ${vendor.contactName ?? "No contact on file"}`} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Payable Outstanding" value={fmtINR(outstanding)} />
          <StatCard label="Overdue" value={fmtINR(overdue)} tone={overdue > 0 ? "red" : "green"} />
          <StatCard label="Total Paid" value={fmtINR(totalPaid)} tone="green" />
          <StatCard label="Open Invoices" value={String(vendor.vendorInvoices.filter((vi) => vendorInvoiceOutstanding(vi) > 0).length)} />
        </div>

        <Section title="Linked Customer Projects">
          {vendor.projectCosts.length === 0 ? (
            <EmptyState text="No project cost links." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Customer</th>
                  <th>Cost</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {vendor.projectCosts.map((pc) => (
                  <tr key={pc.id}>
                    <td>{pc.project.name}</td>
                    <td>{pc.project.customer.name}</td>
                    <td>{fmtINR(pc.amount)}</td>
                    <td>{pc.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Purchase Orders">
          {vendor.purchaseOrders.length === 0 ? (
            <EmptyState text="No purchase orders." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO No.</th>
                  <th>Date</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {vendor.purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td>{po.poNo}</td>
                    <td>{po.poDate.toDateString()}</td>
                    <td>{fmtINR(po.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Vendor Invoices" action={<AddLink href={`/vendor-invoices/new?vendor=${vendor.id}`} label="Record invoice" />}>
          {vendor.vendorInvoices.length === 0 ? (
            <EmptyState text="No invoices." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendor.vendorInvoices.map((vi) => (
                  <tr key={vi.id}>
                    <td>{vi.vendorInvoiceNo}</td>
                    <td>{vi.invoiceDate.toDateString()}</td>
                    <td className={isOverdue(vi.dueDate) ? "text-[var(--red)]" : ""}>{vi.dueDate.toDateString()}</td>
                    <td>{fmtINR(vendorInvoiceTotal(vi))}</td>
                    <td>{fmtINR(vi.amountPaid)}</td>
                    <td>{fmtINR(vendorInvoiceOutstanding(vi))}</td>
                    <td>
                      <StatusBadge status={vi.status} />
                    </td>
                    <td>
                      <StatusBadge status={vi.approvalStatus} />
                    </td>
                    <td>
                      <VendorInvoiceActions
                        id={vi.id}
                        approved={vi.approvalStatus === "APPROVED"}
                        outstanding={vendorInvoiceOutstanding(vi)}
                        canApprove={canApprove}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Follow-up History">
          {vendor.followUps.length === 0 ? (
            <EmptyState text="No follow-ups on record." />
          ) : (
            <ul className="text-sm space-y-2">
              {vendor.followUps.map((f) => (
                <li key={f.id} className="border-b border-[var(--border)] last:border-b-0 pb-2 last:pb-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{f.title}</span>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    Due {f.dueDate.toDateString()} {f.amount ? `· ${fmtINR(f.amount)}` : ""}
                  </div>
                  {f.nextAction && <div className="text-xs mt-1">Next: {f.nextAction}</div>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Communication History">
          {vendor.communications.length === 0 ? (
            <EmptyState text="No communication on record." />
          ) : (
            <ul className="text-sm space-y-2">
              {vendor.communications.map((c) => (
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
      </div>
    </div>
  );
}
