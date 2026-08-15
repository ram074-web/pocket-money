import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { todayISO } from "@/lib/next-number";
import { VendorInvoiceForm } from "./VendorInvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewVendorInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string }>;
}) {
  await requireAccess("vendorInvoices");
  const { vendor } = await searchParams;

  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader title="Record a vendor invoice" subtitle="A bill you've received and will need to pay." />
      <div className="p-6">
        <Section title="Vendor invoice details">
          {vendors.length === 0 ? (
            <div className="py-6 text-center">
              <EmptyState text="A vendor invoice has to belong to a vendor, and there aren't any yet." />
              <Link href="/vendors/new" className="text-sm text-[var(--brand)] hover:underline">
                Create the first vendor
              </Link>
            </div>
          ) : (
            <VendorInvoiceForm vendors={vendors} today={todayISO()} presetVendorId={vendor} />
          )}
        </Section>
      </div>
    </div>
  );
}
