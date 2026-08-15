"use client";

import { useState } from "react";
import { createPurchaseOrderAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea, Select } from "@/components/form";

type Quotation = { id: string; quotationNo: string; customerId: string; total: number; requirement: string };

export function PurchaseOrderForm({
  customers,
  quotations,
  suggestedNo,
  today,
  presetCustomerId,
}: {
  customers: { id: string; name: string }[];
  quotations: Quotation[];
  suggestedNo: string;
  today: string;
  presetCustomerId?: string;
}) {
  const [customerId, setCustomerId] = useState(presetCustomerId ?? "");

  // Only offer quotations belonging to the chosen customer — linking a PO to
  // another customer's quotation is rejected server-side anyway.
  const available = quotations.filter((q) => q.customerId === customerId);

  return (
    <RecordForm action={createPurchaseOrderAction} submitLabel="Record PO" cancelHref="/customers">
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
            label="Against quotation"
            name="quotationId"
            state={state}
            hint={
              customerId
                ? available.length
                  ? "Optional, but linking it lets the system check the PO value against what you quoted."
                  : "This customer has no quotations on file yet."
                : "Choose a customer first."
            }
          >
            <Select
              name="quotationId"
              state={state}
              placeholder="No linked quotation"
              disabled={!customerId || available.length === 0}
              options={available.map((q) => ({
                value: q.id,
                label: `${q.quotationNo} — ${q.requirement.slice(0, 40)} (${q.total.toLocaleString("en-IN")})`,
              }))}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="PO number" name="poNo" state={state} required hint="As printed on the customer's PO.">
              <input
                id="poNo"
                name="poNo"
                defaultValue={state?.values?.poNo ?? suggestedNo}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
            <Field label="PO date" name="poDate" state={state} required>
              <input
                id="poDate"
                name="poDate"
                type="date"
                defaultValue={state?.values?.poDate ?? today}
                className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
              />
            </Field>
            <Field label="PO value" name="value" state={state} required hint="Total including tax.">
              <TextInput name="value" state={state} type="number" step="0.01" />
            </Field>
          </div>

          <Field label="Status" name="status" state={state}>
            <Select
              name="status"
              state={state}
              options={[
                { value: "RECEIVED", label: "Received" },
                { value: "AWAITED", label: "Awaited" },
                { value: "PARTIALLY_UTILISED", label: "Partially utilised" },
                { value: "CLOSED", label: "Closed" },
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
