"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LoadScenariosButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ processed: number; skipped: number; total: number } | null>(null);

  function load() {
    startTransition(async () => {
      const res = await fetch("/api/inbox/load", { method: "POST" });
      if (res.ok) {
        setResult(await res.json());
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={load}
        disabled={pending}
        className="px-3 py-1.5 rounded-md bg-[var(--brand)] text-white text-xs disabled:opacity-50"
      >
        {pending ? "Processing…" : "Load Sample Scenarios"}
      </button>
      {result && (
        <span className="text-xs text-[var(--muted)]">
          {result.processed} processed, {result.skipped} already loaded.
        </span>
      )}
    </div>
  );
}
