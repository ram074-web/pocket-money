"use client";

import { useActionState } from "react";
import { loginAction, firstRunSetupAction, type FormState } from "@/lib/auth-actions";

const inputClass =
  "w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-[var(--muted)] mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.values?.email ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-medium text-[var(--muted)] mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--red)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function FirstRunForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(firstRunSetupAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="name" className="block text-xs font-medium text-[var(--muted)] mb-1">
          Your name
        </label>
        <input id="name" name="name" required defaultValue={state?.values?.name ?? ""} className={inputClass} />
      </div>
      <div>
        <label htmlFor="setup-email" className="block text-xs font-medium text-[var(--muted)] mb-1">
          Email
        </label>
        <input
          id="setup-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.values?.email ?? ""}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="setup-password" className="block text-xs font-medium text-[var(--muted)] mb-1">
          Password
        </label>
        <input
          id="setup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
        <p className="text-xs text-[var(--muted)] mt-1">
          At least 12 characters, including letters and numbers.
        </p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-xs font-medium text-[var(--muted)] mb-1">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--red)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create owner account"}
      </button>
    </form>
  );
}
