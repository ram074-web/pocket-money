"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtINR } from "@/lib/calc";
import { SeverityBadge } from "@/components/ui";

export function FollowUpRow({
  id,
  priority,
  who,
  title,
  amount,
  dueDate,
  overdueDays,
  responsible,
  nextAction,
}: {
  id: string;
  priority: "RED" | "AMBER" | "GREEN";
  who: string;
  title: string;
  amount: number | null;
  dueDate: string;
  overdueDays: number;
  responsible: string;
  nextAction: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function markDone() {
    startTransition(async () => {
      const res = await fetch(`/api/followups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    });
  }

  if (done) return null;

  return (
    <tr>
      <td>
        <SeverityBadge severity={priority} />
      </td>
      <td>{who}</td>
      <td>{title}</td>
      <td>{amount != null ? fmtINR(amount) : "—"}</td>
      <td className={overdueDays > 0 ? "text-[var(--red)]" : ""}>
        {dueDate}
        {overdueDays > 0 ? ` (${overdueDays}d overdue)` : ""}
      </td>
      <td>{responsible}</td>
      <td className="max-w-xs">{nextAction ?? "—"}</td>
      <td>
        <button
          onClick={markDone}
          disabled={pending}
          className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--background)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Mark done"}
        </button>
      </td>
    </tr>
  );
}
