import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { domainsForRole } from "@/lib/inbox/permissions";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const user = await requireUser();
  const domains = domainsForRole(user.roleLabel);

  return (
    <div className="p-6">
      <div className="card p-6 max-w-lg">
        <h1 className="font-semibold mb-2">Not authorized</h1>
        <p className="text-sm mb-4">
          Your role (<strong>{user.roleLabel}</strong>) doesn&apos;t have access to that area. Contact the
          owner if you need it.
        </p>
        <p className="text-sm text-[var(--muted)] mb-4">
          You can access:{" "}
          {domains === "ALL" ? "everything" : domains.join(", ")}
        </p>
        <Link href="/" className="text-sm text-[var(--brand)] hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
