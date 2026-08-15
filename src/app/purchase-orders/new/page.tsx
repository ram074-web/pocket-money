import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { suggestPoNo, todayISO } from "@/lib/next-number";
import { PurchaseOrderForm } from "./PurchaseOrderForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  await requireAccess("pos");
  const { customer } = await searchParams;

  const [customers, quotationRows, suggestedNo] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.quotation.findMany({
      where: { status: { in: ["SENT", "ACCEPTED", "DRAFT"] } },
      orderBy: { quotationDate: "desc" },
    }),
    suggestPoNo(),
  ]);

  const quotations = quotationRows.map((q) => ({
    id: q.id,
    quotationNo: q.quotationNo,
    customerId: q.customerId,
    requirement: q.requirement,
    total: q.value + q.taxAmount - q.discount,
  }));

  return (
    <div>
      <PageHeader
        title="Record a purchase order"
        subtitle="The customer's commitment to buy — what you invoice against."
      />
      <div className="p-6">
        <Section title="PO details">
          {customers.length === 0 ? (
            <div className="py-6 text-center">
              <EmptyState text="A PO has to belong to a customer, and there aren't any yet." />
              <Link href="/customers/new" className="text-sm text-[var(--brand)] hover:underline">
                Create the first customer
              </Link>
            </div>
          ) : (
            <PurchaseOrderForm
              customers={customers}
              quotations={quotations}
              suggestedNo={suggestedNo}
              today={todayISO()}
              presetCustomerId={customer}
            />
          )}
        </Section>
      </div>
    </div>
  );
}
