import { requireAccess } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { VendorForm } from "./VendorForm";

export const dynamic = "force-dynamic";

export default async function NewVendorPage() {
  await requireAccess("payables");

  return (
    <div>
      <PageHeader title="New vendor" subtitle="Suppliers, printers, freelancers — anyone you receive invoices from." />
      <div className="p-6">
        <Section title="Vendor details">
          <VendorForm />
        </Section>
      </div>
    </div>
  );
}
