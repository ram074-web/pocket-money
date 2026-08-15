"use client";

import { createCustomerAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea, Select } from "@/components/form";

export function CustomerForm() {
  return (
    <RecordForm action={createCustomerAction} submitLabel="Create customer" cancelHref="/customers">
      {(state) => (
        <>
          <Field label="Customer name" name="name" state={state} required>
            <TextInput name="name" state={state} placeholder="e.g. Orion Global Foods Pvt Ltd" />
          </Field>

          <Field label="Division" name="division" state={state} required
                 hint="Which side of the business this customer buys from.">
            <Select
              name="division"
              state={state}
              placeholder="Choose a division…"
              options={[
                { value: "DIGITAL_MARKETING", label: "Digital Marketing" },
                { value: "OFFLINE_PRINT", label: "Offline / Print" },
              ]}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact person" name="contactName" state={state}>
              <TextInput name="contactName" state={state} />
            </Field>
            <Field label="Contact email" name="contactEmail" state={state}
                   hint="Used to match incoming email to this customer.">
              <TextInput name="contactEmail" state={state} type="email" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact phone" name="contactPhone" state={state}>
              <TextInput name="contactPhone" state={state} />
            </Field>
            <Field label="Credit limit" name="creditLimit" state={state}
                   hint="Leave blank if none. The dashboard flags customers who exceed it.">
              <TextInput name="creditLimit" state={state} type="number" step="0.01" placeholder="e.g. 2500000" />
            </Field>
          </div>

          <Field label="Notes" name="notes" state={state}>
            <TextArea name="notes" state={state} />
          </Field>
        </>
      )}
    </RecordForm>
  );
}
