import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { suggestInvoiceNo, todayISO } from "@/lib/next-number";
import { InvoiceForm } from "./InvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; po?: string }>;
}) {
  await requireAccess("invoices");
  const { customer, po } = await searchParams;

  const [customers, poRows, suggestedNo] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchaseOrder.findMany({ include: { invoices: true }, orderBy: { poDate: "desc" } }),
    suggestInvoiceNo(),
  ]);

  const pos = poRows.map((p) => ({
    id: p.id,
    poNo: p.poNo,
    customerId: p.customerId,
    value: p.value,
    invoiced: p.invoices.reduce((s, i) => s + i.value + i.taxAmount, 0),
  }));

  return (
    <div>
      <PageHeader title="New invoice" subtitle="What you're billing, and when it falls due." />
      <div className="p-6">
        <Section title="Invoice details">
          {customers.length === 0 ? (
            <div className="py-6 text-center">
              <EmptyState text="An invoice has to belong to a customer, and there aren't any yet." />
              <Link href="/customers/new" className="text-sm text-[var(--brand)] hover:underline">
                Create the first customer
              </Link>
            </div>
          ) : (
            <InvoiceForm
              customers={customers}
              pos={pos}
              suggestedNo={suggestedNo}
              today={todayISO()}
              presetCustomerId={customer}
              presetPoId={po}
            />
          )}
        </Section>
      </div>
    </div>
  );
}
