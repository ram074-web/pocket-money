"use client";

import { createVendorAction } from "@/lib/record-actions";
import { RecordForm, Field, TextInput, TextArea } from "@/components/form";

export function VendorForm() {
  return (
    <RecordForm action={createVendorAction} submitLabel="Create vendor" cancelHref="/vendors">
      {(state) => (
        <>
          <Field label="Vendor name" name="name" state={state} required>
            <TextInput name="name" state={state} placeholder="e.g. PrintHouse Industries" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact person" name="contactName" state={state}>
              <TextInput name="contactName" state={state} />
            </Field>
            <Field label="Contact email" name="contactEmail" state={state}
                   hint="Used to match incoming email to this vendor.">
              <TextInput name="contactEmail" state={state} type="email" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact phone" name="contactPhone" state={state}>
              <TextInput name="contactPhone" state={state} />
            </Field>
            <Field label="Category" name="category" state={state} hint="e.g. Print Production, Media Buying.">
              <TextInput name="category" state={state} />
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
