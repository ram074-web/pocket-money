import { fmtINR } from "@/lib/calc";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-[var(--border)] bg-[var(--surface)]">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "red" | "amber" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-[var(--red)]"
      : tone === "amber"
      ? "text-[var(--amber)]"
      : tone === "green"
      ? "text-[var(--green)]"
      : "text-[var(--foreground)]";
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-[var(--muted)] mt-1">{hint}</div>}
    </div>
  );
}

export function Money({ amount, tone }: { amount: number; tone?: "red" | "amber" | "green" }) {
  const toneClass =
    tone === "red" ? "text-[var(--red)]" : tone === "amber" ? "text-[var(--amber)]" : tone === "green" ? "text-[var(--green)]" : "";
  return <span className={toneClass}>{fmtINR(amount)}</span>;
}

const SEVERITY_CLASS: Record<string, string> = {
  RED: "badge-red",
  AMBER: "badge-amber",
  GREEN: "badge-green",
};

export function SeverityBadge({ severity }: { severity: "RED" | "AMBER" | "GREEN" }) {
  const label = severity === "RED" ? "High" : severity === "AMBER" ? "Medium" : "Low";
  return <span className={`badge ${SEVERITY_CLASS[severity]}`}>{label}</span>;
}

const STATUS_TONE: Record<string, string> = {
  PAID: "badge-green",
  APPROVED: "badge-green",
  DONE: "badge-green",
  CLOSED: "badge-green",
  ACCEPTED: "badge-green",
  OVERDUE: "badge-red",
  CANCELLED: "badge-gray",
  DRAFT: "badge-gray",
  REJECTED: "badge-red",
  DISPUTED: "badge-red",
  CORRECTION_REQUIRED: "badge-amber",
  PARTIALLY_PAID: "badge-amber",
  PARTIALLY_UTILISED: "badge-amber",
  UNDER_VERIFICATION: "badge-amber",
  APPROVAL_PENDING: "badge-amber",
  PENDING: "badge-amber",
  SUBMITTED: "badge-amber",
  RESUBMITTED: "badge-amber",
  READY_FOR_SUBMISSION: "badge-gray",
  RECEIVED: "badge-gray",
  SENT: "badge-gray",
  SENT_: "badge-gray",
  SENT_PENDING: "badge-gray",
  AWAITED: "badge-gray",
  PAYMENT_DUE: "badge-amber",
  CREDIT_NOTE: "badge-gray",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_TONE[status] ?? "badge-gray";
  return <span className={`badge ${cls}`}>{status.replaceAll("_", " ")}</span>;
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="font-semibold text-sm">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="text-sm text-[var(--muted)] py-6 text-center">{text}</div>;
}
