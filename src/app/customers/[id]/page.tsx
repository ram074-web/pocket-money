import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { invoiceOutstanding, isOverdue, fmtINR } from "@/lib/calc";
import { PageHeader, Section, StatCard, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      quotations: { orderBy: { quotationDate: "desc" } },
      purchaseOrders: { orderBy: { poDate: "desc" } },
      invoices: {
        include: { payments: true, corrections: true },
        orderBy: { invoiceDate: "desc" },
      },
      communications: { orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { dueDate: "asc" }, include: { invoice: true } },
      projects: true,
    },
  });

  if (!customer) notFound();

  const outstanding = customer.invoices.reduce((s, i) => s + invoiceOutstanding(i), 0);
  const overdue = customer.invoices.filter((i) => isOverdue(i.dueDate)).reduce((s, i) => s + invoiceOutstanding(i), 0);
  const totalReceived = customer.invoices.reduce((s, i) => s + i.amountReceived, 0);
  const lastPayment = customer.invoices
    .flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNo: i.invoiceNo })))
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0];
  const overLimit = customer.creditLimit != null && outstanding > customer.creditLimit;

  return (
    <div>
      <PageHeader title={customer.name} subtitle={`${customer.contactName ?? "No contact on file"} · ${customer.contactEmail ?? ""}`} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Outstanding" value={fmtINR(outstanding)} tone={overLimit ? "red" : "default"} hint={overLimit ? "Exceeds credit limit" : undefined} />
          <StatCard label="Overdue" value={fmtINR(overdue)} tone={overdue > 0 ? "red" : "green"} />
          <StatCard label="Total Received" value={fmtINR(totalReceived)} tone="green" />
          <StatCard
            label="Last Payment"
            value={lastPayment ? fmtINR(lastPayment.amount) : "—"}
            hint={lastPayment ? `${lastPayment.invoiceNo} · ${lastPayment.paymentDate.toDateString()}` : "No payments on record"}
          />
        </div>

        <Section title="Projects">
          {customer.projects.length === 0 ? (
            <EmptyState text="No projects." />
          ) : (
            <ul className="text-sm space-y-1">
              {customer.projects.map((p) => (
                <li key={p.id} className="flex justify-between border-b border-[var(--border)] last:border-b-0 py-1.5">
                  <span>{p.name}</span>
                  <span className="text-[var(--muted)]">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Quotations">
          {customer.quotations.length === 0 ? (
            <EmptyState text="No quotations." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Date</th>
                  <th>Requirement</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.quotations.map((q) => (
                  <tr key={q.id}>
                    <td>{q.quotationNo}</td>
                    <td>{q.quotationDate.toDateString()}</td>
                    <td>{q.requirement}</td>
                    <td>{fmtINR(q.value + q.taxAmount - q.discount)}</td>
                    <td>
                      <StatusBadge status={q.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Purchase Orders">
          {customer.purchaseOrders.length === 0 ? (
            <EmptyState text="No purchase orders." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO No.</th>
                  <th>Date</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td>{po.poNo}</td>
                    <td>{po.poDate.toDateString()}</td>
                    <td>{fmtINR(po.value)}</td>
                    <td>
                      <StatusBadge status={po.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Invoices">
          {customer.invoices.length === 0 ? (
            <EmptyState text="No invoices." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Value</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Corrections</th>
                </tr>
              </thead>
              <tbody>
                {customer.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="text-[var(--brand)] hover:underline">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td>{inv.invoiceDate.toDateString()}</td>
                    <td className={isOverdue(inv.dueDate) ? "text-[var(--red)]" : ""}>{inv.dueDate.toDateString()}</td>
                    <td>{fmtINR(inv.value + inv.taxAmount)}</td>
                    <td>{fmtINR(inv.amountReceived)}</td>
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

        <Section title="Follow-up History">
          {customer.followUps.length === 0 ? (
            <EmptyState text="No follow-ups on record." />
          ) : (
            <ul className="text-sm space-y-2">
              {customer.followUps.map((f) => (
                <li key={f.id} className="border-b border-[var(--border)] last:border-b-0 pb-2 last:pb-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{f.title}</span>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    Due {f.dueDate.toDateString()} {f.invoice ? `· ${f.invoice.invoiceNo}` : ""} {f.amount ? `· ${fmtINR(f.amount)}` : ""}
                  </div>
                  {f.nextAction && <div className="text-xs mt-1">Next: {f.nextAction}</div>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Communication History">
          {customer.communications.length === 0 ? (
            <EmptyState text="No communication on record." />
          ) : (
            <ul className="text-sm space-y-2">
              {customer.communications.map((c) => (
                <li key={c.id} className="border-b border-[var(--border)] last:border-b-0 pb-2 last:pb-0">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.subject}</span>
                    <span className="text-xs text-[var(--muted)]">{c.createdAt.toDateString()}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mb-1">
                    {c.direction} · {c.channel} {c.sentBy ? `· ${c.sentBy}` : ""}
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
