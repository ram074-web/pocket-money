import Link from "next/link";
import { getDashboardData, fmtINR } from "@/lib/calc";
import { PageHeader, StatCard, Section, SeverityBadge, EmptyState } from "@/components/ui";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAccess("dashboard");

  const d = await getDashboardData();

  return (
    <div>
      <PageHeader
        title="Owner Dashboard"
        subtitle={`Real-time view across Digital Marketing & Offline/Print divisions — as of ${d.ref.toDateString()}`}
      />

      <div className="p-6 space-y-6">
        {/* Top-line KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Receivables Outstanding" value={fmtINR(d.receivables.totalOutstanding)} hint={`${d.receivables.overdueCount} overdue`} />
          <StatCard label="Overdue Receivables" value={fmtINR(d.receivables.overdueAmount)} tone="red" />
          <StatCard label="Payables Outstanding" value={fmtINR(d.payables.totalOutstandingPayable)} hint={`${d.payables.overdueCount} overdue`} />
          <StatCard label="Overdue Payables" value={fmtINR(d.payables.overdueAmount)} tone="red" />
        </div>

        {/* Cash position */}
        <Section title="Expected Net Cash Position — Next 30 Days">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Expected Collections" value={fmtINR(d.cash.expectedCollections30)} tone="green" />
            <StatCard label="Expected Vendor Payments" value={fmtINR(d.cash.expectedPayments30)} tone="amber" />
            <StatCard
              label="Expected Net Cash Position"
              value={fmtINR(d.cash.expectedNetCash30)}
              tone={d.cash.expectedNetCash30 >= 0 ? "green" : "red"}
            />
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receivables */}
          <Section title="Receivables">
            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div>
                <div className="text-[var(--muted)] text-xs">Total Received</div>
                <div className="font-medium">{fmtINR(d.receivables.totalReceived)}</div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs">Due within 7 days</div>
                <div className="font-medium">{fmtINR(d.receivables.dueWithin7Amount)} ({d.receivables.dueWithin7Count})</div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs">Due within 30 days</div>
                <div className="font-medium">{fmtINR(d.receivables.dueWithin30Amount)} ({d.receivables.dueWithin30Count})</div>
              </div>
            </div>

            <div className="text-xs font-medium text-[var(--muted)] uppercase mb-2">Ageing</div>
            <table className="data-table mb-4">
              <thead>
                <tr>
                  <th>0-30</th>
                  <th>31-60</th>
                  <th>61-90</th>
                  <th>90+</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{fmtINR(d.receivables.ageing["0-30"])}</td>
                  <td>{fmtINR(d.receivables.ageing["31-60"])}</td>
                  <td>{fmtINR(d.receivables.ageing["61-90"])}</td>
                  <td className="text-[var(--red)] font-medium">{fmtINR(d.receivables.ageing["90+"])}</td>
                </tr>
              </tbody>
            </table>

            <div className="text-xs font-medium text-[var(--muted)] uppercase mb-2">Customer-wise Outstanding</div>
            {d.receivables.customerOutstanding.length === 0 ? (
              <EmptyState text="No outstanding receivables." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Outstanding</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {d.receivables.customerOutstanding.slice(0, 6).map((c) => (
                    <tr key={c.customer.id}>
                      <td>
                        <Link href={`/customers/${c.customer.id}`} className="text-[var(--brand)] hover:underline">
                          {c.customer.name}
                        </Link>
                        {c.overCreditLimit && <span className="badge badge-red ml-2">Over credit limit</span>}
                      </td>
                      <td>{fmtINR(c.outstanding)}</td>
                      <td className={c.overdue > 0 ? "text-[var(--red)]" : ""}>{fmtINR(c.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Payables */}
          <Section title="Payables">
            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div>
                <div className="text-[var(--muted)] text-xs">Total Paid</div>
                <div className="font-medium">{fmtINR(d.payables.totalPaid)}</div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs">Due within 7 days</div>
                <div className="font-medium">{fmtINR(d.payables.dueWithin7Amount)} ({d.payables.dueWithin7Count})</div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs">Due within 30 days</div>
                <div className="font-medium">{fmtINR(d.payables.dueWithin30Amount)} ({d.payables.dueWithin30Count})</div>
              </div>
            </div>

            <div className="text-xs font-medium text-[var(--muted)] uppercase mb-2">Vendor-wise Payable</div>
            {d.payables.vendorOutstanding.length === 0 ? (
              <EmptyState text="No outstanding payables." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Outstanding</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {d.payables.vendorOutstanding.map((v) => (
                    <tr key={v.vendor.id}>
                      <td>
                        <Link href={`/vendors/${v.vendor.id}`} className="text-[var(--brand)] hover:underline">
                          {v.vendor.name}
                        </Link>
                      </td>
                      <td>{fmtINR(v.outstanding)}</td>
                      <td className={v.overdue > 0 ? "text-[var(--red)]" : ""}>{fmtINR(v.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        {/* Sales & Billing */}
        <Section title="Sales & Billing">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Quotations Raised" value={String(d.sales.quotationsRaised)} hint={`${d.sales.quotationsAccepted} accepted · ${d.sales.quotationsPending} pending`} />
            <StatCard label="POs Received" value={String(d.sales.posReceived)} hint={`${d.sales.posPending} pending`} />
            <StatCard label="Invoices Raised" value={String(d.sales.invoicesRaised)} hint={`${d.sales.invoicesPendingSubmission} pending submission`} />
            <StatCard label="Under Correction" value={String(d.sales.invoicesUnderCorrection)} tone={d.sales.invoicesUnderCorrection > 0 ? "amber" : "default"} hint={`${d.sales.cancelledOrRevised} cancelled/revised`} />
          </div>
          {d.sales.posWithoutInvoice > 0 && (
            <div className="mt-4 text-sm">
              <span className="badge badge-amber">Attention</span>{" "}
              {d.sales.posWithoutInvoice} PO(s) received with no invoice raised yet.{" "}
              <Link href="/invoices" className="text-[var(--brand)] hover:underline">
                Review
              </Link>
            </div>
          )}
        </Section>

        {/* Risks & Exceptions */}
        <Section title="Exceptions & Risk Alerts" action={<span className="text-xs text-[var(--muted)]">{d.risks.length} item(s)</span>}>
          {d.risks.length === 0 ? (
            <EmptyState text="No exceptions detected." />
          ) : (
            <ul className="space-y-2">
              {d.risks.slice(0, 15).map((r, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm border-b border-[var(--border)] last:border-b-0 pb-2 last:pb-0">
                  <SeverityBadge severity={r.severity} />
                  <div className="flex-1">
                    <div className="text-xs text-[var(--muted)] uppercase tracking-wide">{r.category}</div>
                    {r.link ? (
                      <Link href={r.link} className="hover:underline">
                        {r.message}
                      </Link>
                    ) : (
                      <span>{r.message}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
