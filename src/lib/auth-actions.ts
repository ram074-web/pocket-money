"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { login, logout, needsFirstRunSetup, landingPathFor } from "@/lib/auth";
import { hashPassword, validatePassword } from "@/lib/password";

// React resets an uncontrolled form after a submit, so anything the user
// typed is echoed back here and re-applied as defaultValue. Passwords are
// deliberately never echoed.
export type FormState =
  | { error?: string; values?: { name?: string; email?: string } }
  | undefined;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", values: { email } };

  const user = await login(email, password);
  // One generic message for every failure mode, so the form can't be used to
  // discover which email addresses exist or which accounts are disabled.
  if (!user) return { error: "Incorrect email or password.", values: { email } };

  redirect(landingPathFor(user.roleLabel));
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}

/**
 * Creates the very first account (an Owner) when the database has no users.
 * Guarded by that check so it can never be used to add an admin later.
 */
export async function firstRunSetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await needsFirstRunSetup())) {
    return { error: "Setup has already been completed." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const values = { name, email };

  if (!name || !email) return { error: "Enter your name and email address.", values };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", values };
  if (password !== confirm) return { error: "The two passwords don't match.", values };

  const passwordProblem = validatePassword(password);
  if (passwordProblem) return { error: passwordProblem, values };

  await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "OWNER" },
  });

  await login(email, password);
  redirect("/");
}
