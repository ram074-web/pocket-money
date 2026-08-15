import Link from "next/link";

/** Primary "create a record" affordance, used in Section headers. */
export function NewButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs px-3 py-1.5 rounded-md bg-[var(--brand)] text-white whitespace-nowrap hover:opacity-90"
    >
      {label}
    </Link>
  );
}

/** Secondary variant for adding a related record from a detail page. */
export function AddLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs px-3 py-1.5 rounded-md border border-[var(--border)] whitespace-nowrap hover:bg-[var(--background)]"
    >
      {label}
    </Link>
  );
}
