import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

export function UserBar({ user }: { user: SessionUser }) {
  return (
    <div className="p-3 border-t border-[var(--border)] text-xs">
      <div className="font-medium truncate">{user.name}</div>
      <div className="text-[var(--muted)] truncate">{user.roleLabel}</div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="mt-2 w-full px-2 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--background)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
