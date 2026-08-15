import Link from "next/link";
import { approveVendorInvoiceAction } from "@/lib/record-actions";

/**
 * The two controls that move a vendor invoice forward: approve it, then pay
 * it. Approval is deliberately the gate — the payment form refuses an
 * unapproved invoice regardless of what the UI offers.
 */
export function VendorInvoiceActions({
  id,
  approved,
  outstanding,
  canApprove,
}: {
  id: string;
  approved: boolean;
  outstanding: number;
  canApprove: boolean;
}) {
  if (!approved) {
    if (!canApprove) {
      return <span className="text-xs text-[var(--muted)]">Awaiting approval</span>;
    }
    return (
      <form action={approveVendorInvoiceAction}>
        <input type="hidden" name="vendorInvoiceId" value={id} />
        <button
          type="submit"
          className="text-xs px-2.5 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--background)] whitespace-nowrap"
        >
          Approve
        </button>
      </form>
    );
  }

  if (outstanding <= 0) return <span className="text-xs text-[var(--muted)]">Settled</span>;

  return (
    <Link
      href={`/vendor-invoices/${id}/payment`}
      className="text-xs px-2.5 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--background)] whitespace-nowrap"
    >
      Pay
    </Link>
  );
}
