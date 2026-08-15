import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { invoiceOutstanding, fmtINR } from "@/lib/calc";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { todayISO } from "@/lib/next-number";
import { PaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

export default async function RecordPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("payments");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { customer: true } });
  if (!invoice) notFound();

  const outstanding = invoiceOutstanding(invoice);

  return (
    <div>
      <PageHeader
        title={`Record payment — ${invoice.invoiceNo}`}
        subtitle={`${invoice.customer.name} · ${fmtINR(outstanding)} outstanding of ${fmtINR(invoice.value + invoice.taxAmount)}`}
      />
      <div className="p-6">
        <Section title="Payment details">
          {outstanding <= 0 ? (
            <EmptyState text="This invoice is already fully paid." />
          ) : (
            <PaymentForm invoiceId={invoice.id} outstanding={outstanding} today={todayISO()} />
          )}
        </Section>
      </div>
    </div>
  );
}
