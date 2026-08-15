"use client";

import { recordVendorPaymentAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea } from "@/components/form";

export function VendorPaymentForm({
  vendorInvoiceId,
  vendorId,
  outstanding,
  today,
}: {
  vendorInvoiceId: string;
  vendorId: string;
  outstanding: number;
  today: string;
}) {
  return (
    <RecordForm action={recordVendorPaymentAction} submitLabel="Record payment" cancelHref={`/vendors/${vendorId}`}>
      {(state) => (
        <>
          <input type="hidden" name="vendorInvoiceId" value={vendorInvoiceId} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount paid" name="amount" state={state} required
                   hint={`Still payable: ${outstanding.toLocaleString("en-IN")}`}>
              <TextInput name="amount" state={state} type="number" step="0.01" />
            </Field>
            <Field label="Payment date" name="paymentDate" state={state} required>
              <input
                id="paymentDate"
                name="paymentDate"
                type="date"
                defaultValue={state?.values?.paymentDate ?? today}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
          </div>

          <Field label="Reference" name="reference" state={state} hint="UTR or bank reference to share with the vendor.">
            <TextInput name="reference" state={state} />
          </Field>

          <Field label="Notes" name="notes" state={state}>
            <TextArea name="notes" state={state} rows={2} />
          </Field>
        </>
      )}
    </RecordForm>
  );
}
