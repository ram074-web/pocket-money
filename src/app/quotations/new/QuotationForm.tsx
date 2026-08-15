"use client";

import { createQuotationAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea, Select } from "@/components/form";

export function QuotationForm({
  customers,
  suggestedNo,
  today,
  presetCustomerId,
}: {
  customers: { id: string; name: string }[];
  suggestedNo: string;
  today: string;
  presetCustomerId?: string;
}) {
  return (
    <RecordForm action={createQuotationAction} submitLabel="Create quotation" cancelHref="/customers">
      {(state) => (
        <>
          <Field label="Customer" name="customerId" state={state} required>
            <Select
              name="customerId"
              state={state}
              placeholder="Choose a customer…"
              defaultValue={presetCustomerId}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Quotation number" name="quotationNo" state={state} required
                   hint="Suggested from your last one — change it to match your own numbering.">
              <input
                id="quotationNo"
                name="quotationNo"
                defaultValue={state?.values?.quotationNo ?? suggestedNo}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
            <Field label="Quotation date" name="quotationDate" state={state} required>
              <input
                id="quotationDate"
                name="quotationDate"
                type="date"
                defaultValue={state?.values?.quotationDate ?? today}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
          </div>

          <Field label="Requirement" name="requirement" state={state} required
                 hint="What the customer asked for.">
            <TextArea name="requirement" state={state} rows={2} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Value" name="value" state={state} required hint="Before tax.">
              <TextInput name="value" state={state} type="number" step="0.01" />
            </Field>
            <Field label="Tax amount" name="taxAmount" state={state}>
              <TextInput name="taxAmount" state={state} type="number" step="0.01" />
            </Field>
            <Field label="Discount" name="discount" state={state}>
              <TextInput name="discount" state={state} type="number" step="0.01" />
            </Field>
          </div>

          <Field label="Status" name="status" state={state}>
            <Select
              name="status"
              state={state}
              options={[
                { value: "DRAFT", label: "Draft" },
                { value: "SENT", label: "Sent to customer" },
                { value: "ACCEPTED", label: "Accepted" },
              ]}
            />
          </Field>

          <Field label="Notes" name="notes" state={state}>
            <TextArea name="notes" state={state} />
          </Field>
        </>
      )}
    </RecordForm>
  );
}
