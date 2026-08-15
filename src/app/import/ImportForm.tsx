"use client";

import { useRef, useState } from "react";
import { Section, EmptyState } from "@/components/ui";

type RowResult = { row: number; status: string; issues: string[] };
type ImportResult = {
  batchId: string;
  summary: Record<string, number>;
  rows: RowResult[];
  customerRows?: RowResult[];
};

const STATUS_LABEL: Record<string, string> = {
  ok: "Imported",
  duplicate: "Duplicate (skipped)",
  duplicate_in_file: "Duplicate in file",
  conflict: "Conflict — requires verification",
  missing_fields: "Missing fields",
  unknown_customer: "Unknown customer",
  invalid_dates: "Invalid dates",
};

const STATUS_TONE: Record<string, string> = {
  ok: "badge-green",
  duplicate: "badge-gray",
  duplicate_in_file: "badge-gray",
  conflict: "badge-red",
  missing_fields: "badge-amber",
  unknown_customer: "badge-amber",
  invalid_dates: "badge-amber",
};

export function ImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .xlsx file to import.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Upload">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--surface)] file:text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm disabled:opacity-50"
          >
            {loading ? "Importing…" : "Import"}
          </button>
        </form>
        {error && <div className="text-sm text-[var(--red)] mt-3">{error}</div>}
      </Section>

      {result && (
        <>
          <Section title="Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {Object.entries(result.summary).map(([key, value]) => (
                <div key={key}>
                  <div className="text-xs text-[var(--muted)] uppercase">{key.replace(/([A-Z])/g, " $1")}</div>
                  <div className="font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </Section>

          {result.customerRows && result.customerRows.length > 0 && (
            <Section title="Customers">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Result</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.customerRows.map((r) => (
                    <tr key={`c-${r.row}`}>
                      <td>{r.row}</td>
                      <td>
                        <span className={`badge ${STATUS_TONE[r.status] ?? "badge-gray"}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="text-xs">{r.issues.join(" ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          <Section title="Invoices">
            {result.rows.length === 0 ? (
              <EmptyState text="No data rows found." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Result</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>
                        <span className={`badge ${STATUS_TONE[r.status] ?? "badge-gray"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                      </td>
                      <td className="text-xs">{r.issues.join(" ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
