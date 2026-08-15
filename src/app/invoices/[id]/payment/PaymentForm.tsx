"use client";

import { recordPaymentAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea, Checkbox } from "@/components/form";

export function PaymentForm({
  invoiceId,
  outstanding,
  today,
}: {
  invoiceId: string;
  outstanding: number;
  today: string;
}) {
  return (
    <RecordForm action={recordPaymentAction} submitLabel="Record payment" cancelHref={`/invoices/${invoiceId}`}>
      {(state) => (
        <>
          <input type="hidden" name="invoiceId" value={invoiceId} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount received" name="amount" state={state} required
                   hint={`Outstanding on this invoice: ${outstanding.toLocaleString("en-IN")}`}>
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

          <Field label="Reference" name="reference" state={state} hint="UTR, cheque number, or bank reference.">
            <TextInput name="reference" state={state} />
          </Field>

          <Checkbox
            name="reconciled"
            state={state}
            label="I have confirmed this against the bank statement"
          />

          <Field label="Notes" name="notes" state={state}>
            <TextArea name="notes" state={state} rows={2} />
          </Field>
        </>
      )}
    </RecordForm>
  );
}
