"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { RecordFormState } from "@/lib/record-actions";

const baseInput =
  "w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)] disabled:opacity-50";

function errorRing(hasError: boolean) {
  return hasError ? `${baseInput} border-[var(--red)]` : baseInput;
}

export function Field({
  label,
  name,
  state,
  children,
  hint,
  required,
}: {
  label: string;
  name: string;
  state: RecordFormState;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  const fieldError = state?.fieldErrors?.[name];
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-[var(--muted)] mb-1">
        {label}
        {required && <span className="text-[var(--red)]"> *</span>}
      </label>
      {children}
      {hint && !fieldError && <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>}
      {fieldError && (
        <p role="alert" className="text-xs text-[var(--red)] mt-1">
          {fieldError}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  name,
  state,
  type = "text",
  placeholder,
  step,
}: {
  name: string;
  state: RecordFormState;
  type?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      id={name}
      name={name}
      type={type}
      step={step}
      placeholder={placeholder}
      defaultValue={state?.values?.[name] ?? ""}
      className={errorRing(Boolean(state?.fieldErrors?.[name]))}
    />
  );
}

export function TextArea({ name, state, rows = 3 }: { name: string; state: RecordFormState; rows?: number }) {
  return (
    <textarea
      id={name}
      name={name}
      rows={rows}
      defaultValue={state?.values?.[name] ?? ""}
      className={errorRing(Boolean(state?.fieldErrors?.[name]))}
    />
  );
}

/**
 * React resets a form's DOM once its action returns. A text input survives
 * that, because React writes what was submitted into `defaultValue` and a
 * reset restores exactly that. A `<select>` has no equivalent: the reset
 * snaps it back to its first option while React still believes the user's
 * choice is selected, so someone who fixes one rejected field is then told
 * the customer is missing — and the dropdown on screen agrees with neither.
 *
 * Re-asserting the value into the DOM after every commit keeps what the user
 * sees and what the form actually submits the same thing.
 */
function useSelectValue(initial: string) {
  const ref = useRef<HTMLSelectElement>(null);
  const [value, setValue] = useState(initial);

  // Deliberately no dependency array: the reset happens without any React
  // state changing, so an effect keyed on `value` would never re-run and the
  // dropdown would stay blank. Re-running setValue is self-limiting — after
  // it the DOM and the state agree, so the next pass does nothing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref.current;
    if (!el || el.value === value) return;
    el.value = value;
    // Still no match means the option itself is gone — a dependent list was
    // rebuilt for a different parent record. Follow the DOM rather than
    // submit an id that is nowhere on screen.
    if (el.value !== value) setValue(el.value);
  });

  return { ref, value, setValue };
}

export function Select({
  name,
  state,
  options,
  placeholder,
  defaultValue,
  disabled,
  onValueChange,
}: {
  name: string;
  state: RecordFormState;
  options: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  /** Notified on every change, for forms that filter a dependent dropdown. */
  onValueChange?: (value: string) => void;
}) {
  // With no placeholder the first option is what the user sees, so that is
  // what the form should submit — an empty value would leave the field
  // silently unset while showing a real choice.
  const fallback = placeholder === undefined ? options[0]?.value ?? "" : "";
  const { ref, value, setValue } = useSelectValue(
    state?.values?.[name] ?? defaultValue ?? fallback,
  );

  return (
    <select
      ref={ref}
      id={name}
      name={name}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        setValue(e.target.value);
        onValueChange?.(e.target.value);
      }}
      className={errorRing(Boolean(state?.fieldErrors?.[name]))}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ name, state, label }: { name: string; state: RecordFormState; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input id={name} name={name} type="checkbox" defaultChecked={state?.values?.[name] === "on"} />
      {label}
    </label>
  );
}

/**
 * Wraps a server action in the standard submit/error/preserve-values loop.
 * `action` is a server action; `children` receives the current state so
 * fields can re-apply what the user typed after a rejected submit.
 */
export function RecordForm({
  action,
  submitLabel,
  cancelHref,
  children,
}: {
  action: (prev: RecordFormState, fd: FormData) => Promise<RecordFormState>;
  submitLabel: string;
  cancelHref: string;
  children: (state: RecordFormState, pending: boolean) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<RecordFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4 max-w-2xl">
      {children(state, pending)}

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--red)]">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <a href={cancelHref} className="text-sm text-[var(--muted)] hover:underline">
          Cancel
        </a>
      </div>
    </form>
  );
}

export { baseInput };
