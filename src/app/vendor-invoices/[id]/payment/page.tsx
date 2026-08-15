import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { vendorInvoiceOutstanding, vendorInvoiceTotal, fmtINR } from "@/lib/calc";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { todayISO } from "@/lib/next-number";
import { VendorPaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

export default async function RecordVendorPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("payables");
  const { id } = await params;

  const vi = await prisma.vendorInvoice.findUnique({ where: { id }, include: { vendor: true } });
  if (!vi) notFound();

  const outstanding = vendorInvoiceOutstanding(vi);

  return (
    <div>
      <PageHeader
        title={`Pay ${vi.vendorInvoiceNo}`}
        subtitle={`${vi.vendor.name} · ${fmtINR(outstanding)} payable of ${fmtINR(vendorInvoiceTotal(vi))}`}
      />
      <div className="p-6">
        <Section title="Payment details">
          {vi.approvalStatus !== "APPROVED" ? (
            <div className="py-6 text-center space-y-2">
              <EmptyState text="This invoice hasn't been approved yet, so it can't be paid." />
              <Link href={`/vendors/${vi.vendorId}`} className="text-sm text-[var(--brand)] hover:underline">
                Back to {vi.vendor.name}
              </Link>
            </div>
          ) : outstanding <= 0 ? (
            <EmptyState text="This vendor invoice is already fully paid." />
          ) : (
            <VendorPaymentForm
              vendorInvoiceId={vi.id}
              vendorId={vi.vendorId}
              outstanding={outstanding}
              today={todayISO()}
            />
          )}
        </Section>
      </div>
    </div>
  );
}
