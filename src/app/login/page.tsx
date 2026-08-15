import { redirect } from "next/navigation";
import { getCurrentUser, needsFirstRunSetup } from "@/lib/auth";
import { LoginForm, FirstRunForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  // With no accounts yet, offer to create the first (Owner) account instead
  // of a sign-in form nobody could satisfy.
  const firstRun = await needsFirstRunSetup();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-6 w-full max-w-sm">
        <div className="mb-5">
          <h1 className="font-semibold">Finance &amp; Operations</h1>
          <p className="text-xs text-[var(--muted)]">Control Center</p>
        </div>

        {firstRun ? (
          <>
            <p className="text-sm mb-4">
              No accounts exist yet. Create the owner account to get started — it will have full access.
            </p>
            <FirstRunForm />
          </>
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
}
