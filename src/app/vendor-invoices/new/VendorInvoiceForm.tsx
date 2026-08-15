"use client";

import { createVendorInvoiceAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea, Select } from "@/components/form";

export function VendorInvoiceForm({
  vendors,
  today,
  presetVendorId,
}: {
  vendors: { id: string; name: string }[];
  today: string;
  presetVendorId?: string;
}) {
  return (
    <RecordForm action={createVendorInvoiceAction} submitLabel="Record vendor invoice" cancelHref="/vendors">
      {(state) => (
        <>
          <Field label="Vendor" name="vendorId" state={state} required>
            <Select
              name="vendorId"
              state={state}
              placeholder="Choose a vendor…"
              defaultValue={presetVendorId}
              options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Their invoice number" name="vendorInvoiceNo" state={state} required>
              <TextInput name="vendorInvoiceNo" state={state} />
            </Field>
            <Field label="Invoice date" name="invoiceDate" state={state} required>
              <input
                id="invoiceDate"
                name="invoiceDate"
                type="date"
                defaultValue={state?.values?.invoiceDate ?? today}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
            <Field label="Payment due date" name="dueDate" state={state} required>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={state?.values?.dueDate ?? ""}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount" name="amount" state={state} required hint="Before tax.">
              <TextInput name="amount" state={state} type="number" step="0.01" />
            </Field>
            <Field label="Tax amount" name="taxAmount" state={state}>
              <TextInput name="taxAmount" state={state} type="number" step="0.01" />
            </Field>
          </div>

          <Field label="Notes" name="notes" state={state}>
            <TextArea name="notes" state={state} rows={2} />
          </Field>

          <p className="text-xs text-[var(--muted)]">
            It will be recorded as <strong>pending approval</strong>. Payment can&apos;t be entered against it until
            an Owner or Finance Manager approves it.
          </p>
        </>
      )}
    </RecordForm>
  );
}
