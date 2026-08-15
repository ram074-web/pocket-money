import Link from "next/link";
import { prisma } from "@/lib/db";
import { vendorInvoiceOutstanding, isOverdue, fmtINR } from "@/lib/calc";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  await requireAccess("payables");

  const vendors = await prisma.vendor.findMany({
    include: { vendorInvoices: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Vendors" subtitle="Payables across the vendor requirement-to-payment cycle" />
      <div className="p-6">
        <Section title={`${vendors.length} vendor(s)`}>
          {vendors.length === 0 ? (
            <EmptyState text="No vendors yet." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Contact</th>
                  <th>Payable Outstanding</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const outstanding = v.vendorInvoices.reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
                  const overdue = v.vendorInvoices
                    .filter((vi) => isOverdue(vi.dueDate))
                    .reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
                  return (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/vendors/${v.id}`} className="text-[var(--brand)] hover:underline font-medium">
                          {v.name}
                        </Link>
                      </td>
                      <td>{v.category ?? "—"}</td>
                      <td>{v.contactName ?? "—"}</td>
                      <td>{fmtINR(outstanding)}</td>
                      <td className={overdue > 0 ? "text-[var(--red)]" : ""}>{fmtINR(overdue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}
