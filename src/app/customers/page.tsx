import Link from "next/link";
import { prisma } from "@/lib/db";
import { invoiceOutstanding, isOverdue, fmtINR } from "@/lib/calc";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireAccess("customers");

  const customers = await prisma.customer.findMany({
    include: { invoices: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Customers" subtitle="360° view across quotations, POs, invoices and payments" />
      <div className="p-6">
        <Section title={`${customers.length} customer(s)`}>
          {customers.length === 0 ? (
            <EmptyState text="No customers yet." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Division</th>
                  <th>Contact</th>
                  <th>Outstanding</th>
                  <th>Overdue</th>
                  <th>Credit Limit</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const outstanding = c.invoices.reduce((s, i) => s + invoiceOutstanding(i), 0);
                  const overdue = c.invoices
                    .filter((i) => isOverdue(i.dueDate))
                    .reduce((s, i) => s + invoiceOutstanding(i), 0);
                  const overLimit = c.creditLimit != null && outstanding > c.creditLimit;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/customers/${c.id}`} className="text-[var(--brand)] hover:underline font-medium">
                          {c.name}
                        </Link>
                        {overLimit && <span className="badge badge-red ml-2">Over credit limit</span>}
                      </td>
                      <td>{c.division === "DIGITAL_MARKETING" ? "Digital Marketing" : "Offline/Print"}</td>
                      <td>{c.contactName ?? "—"}</td>
                      <td>{fmtINR(outstanding)}</td>
                      <td className={overdue > 0 ? "text-[var(--red)]" : ""}>{fmtINR(overdue)}</td>
                      <td>{c.creditLimit != null ? fmtINR(c.creditLimit) : "—"}</td>
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
