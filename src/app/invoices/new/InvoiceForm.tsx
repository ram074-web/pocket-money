"use client";

import { useState } from "react";
import { createInvoiceAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea, Select } from "@/components/form";

type PO = { id: string; poNo: string; customerId: string; value: number; invoiced: number };

export function InvoiceForm({
  customers,
  pos,
  suggestedNo,
  today,
  presetCustomerId,
  presetPoId,
}: {
  customers: { id: string; name: string }[];
  pos: PO[];
  suggestedNo: string;
  today: string;
  presetCustomerId?: string;
  presetPoId?: string;
}) {
  const [customerId, setCustomerId] = useState(presetCustomerId ?? "");
  const available = pos.filter((p) => p.customerId === customerId);

  return (
    <RecordForm action={createInvoiceAction} submitLabel="Create invoice" cancelHref="/invoices">
      {(state) => (
        <>
          <Field label="Customer" name="customerId" state={state} required>
            <Select
              name="customerId"
              state={state}
              placeholder="Choose a customer…"
              defaultValue={presetCustomerId}
              onValueChange={setCustomerId}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>

          <Field
            label="Against PO"
            name="purchaseOrderId"
            state={state}
            hint={
              customerId
                ? available.length
                  ? "Linking the PO lets the system stop you invoicing more than the PO is worth."
                  : "This customer has no POs on file yet."
                : "Choose a customer first."
            }
          >
            <Select
              name="purchaseOrderId"
              state={state}
              placeholder="No linked PO"
              defaultValue={presetPoId}
              disabled={!customerId || available.length === 0}
              options={available.map((p) => ({
                value: p.id,
                label:
                  `${p.poNo} — ${p.value.toLocaleString("en-IN")}` +
                  (p.invoiced > 0 ? ` (${p.invoiced.toLocaleString("en-IN")} already invoiced)` : ""),
              }))}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Invoice number" name="invoiceNo" state={state} required>
              <input
                id="invoiceNo"
                name="invoiceNo"
                defaultValue={state?.values?.invoiceNo ?? suggestedNo}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
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
            <Field label="Payment due date" name="dueDate" state={state} required
                   hint="Drives ageing and overdue alerts.">
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={state?.values?.dueDate ?? ""}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Invoice value" name="value" state={state} required hint="Before tax.">
              <TextInput name="value" state={state} type="number" step="0.01" />
            </Field>
            <Field label="Tax amount" name="taxAmount" state={state}>
              <TextInput name="taxAmount" state={state} type="number" step="0.01" />
            </Field>
            <Field label="Submitted on" name="submissionDate" state={state} hint="Leave blank if not yet sent.">
              <input
                id="submissionDate"
                name="submissionDate"
                type="date"
                defaultValue={state?.values?.submissionDate ?? ""}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
          </div>

          <Field label="Status" name="status" state={state}>
            <Select
              name="status"
              state={state}
              options={[
                { value: "DRAFT", label: "Draft" },
                { value: "READY_FOR_SUBMISSION", label: "Ready for submission" },
                { value: "SUBMITTED", label: "Submitted to customer" },
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
