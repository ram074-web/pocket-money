import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { suggestQuotationNo, todayISO } from "@/lib/next-number";
import { QuotationForm } from "./QuotationForm";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  await requireAccess("quotations");
  const { customer } = await searchParams;

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const suggestedNo = await suggestQuotationNo();

  return (
    <div>
      <PageHeader title="New quotation" subtitle="The start of the cycle — what you quoted, to whom, for how much." />
      <div className="p-6">
        <Section title="Quotation details">
          {customers.length === 0 ? (
            <div className="py-6 text-center">
              <EmptyState text="A quotation has to belong to a customer, and there aren't any yet." />
              <Link href="/customers/new" className="text-sm text-[var(--brand)] hover:underline">
                Create the first customer
              </Link>
            </div>
          ) : (
            <QuotationForm
              customers={customers}
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
