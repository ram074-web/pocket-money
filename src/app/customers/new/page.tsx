import { requireAccess } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { CustomerForm } from "./CustomerForm";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireAccess("customers");

  return (
    <div>
      <PageHeader
        title="New customer"
        subtitle="Everything else — quotations, POs, invoices — hangs off a customer, so this is the first record to create."
      />
      <div className="p-6">
        <Section title="Customer details">
          <CustomerForm />
        </Section>
      </div>
    </div>
  );
}
