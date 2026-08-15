import Link from "next/link";
import { prisma } from "@/lib/db";
import { invoiceOutstanding, isOverdue, fmtINR } from "@/lib/calc";
import { PageHeader, Section, StatusBadge, EmptyState } from "@/components/ui";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAccess("invoices");

  const { status } = await searchParams;
  const invoices = await prisma.invoice.findMany({
    where: status ? { status: status as never } : undefined,
    include: { customer: true, corrections: true },
    orderBy: { invoiceDate: "desc" },
  });

  const statuses = [
    "DRAFT",
    "READY_FOR_SUBMISSION",
    "SUBMITTED",
    "UNDER_VERIFICATION",
    "CORRECTION_REQUIRED",
    "RESUBMITTED",
    "APPROVED",
    "PAYMENT_DUE",
    "PARTIALLY_PAID",
    "PAID",
    "OVERDUE",
    "CANCELLED",
    "CREDIT_NOTE",
  ];

  return (
    <div>
      <PageHeader title="Invoice Register" subtitle="Central register — every invoice keeps its full status history" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/invoices" className={`badge ${!status ? "badge-gray" : "badge-gray"}`}>
            All
          </Link>
          {statuses.map((s) => (
            <Link key={s} href={`/invoices?status=${s}`} className="badge badge-gray">
              {s.replaceAll("_", " ")}
            </Link>
          ))}
        </div>

        <Section title={`${invoices.length} invoice(s)${status ? ` — ${status.replaceAll("_", " ")}` : ""}`}>
          {invoices.length === 0 ? (
            <EmptyState text="No invoices match this filter." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Value</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Corrections</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="text-[var(--brand)] hover:underline">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/customers/${inv.customerId}`} className="hover:underline">
                        {inv.customer.name}
                      </Link>
                    </td>
                    <td>{inv.invoiceDate.toDateString()}</td>
                    <td className={isOverdue(inv.dueDate) && invoiceOutstanding(inv) > 0 ? "text-[var(--red)]" : ""}>
                      {inv.dueDate.toDateString()}
                    </td>
                    <td>{fmtINR(inv.value + inv.taxAmount)}</td>
                    <td>{fmtINR(invoiceOutstanding(inv))}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td>{inv.corrections.length > 0 ? <span className="badge badge-amber">{inv.corrections.length}</span> : "—"}</td>
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
