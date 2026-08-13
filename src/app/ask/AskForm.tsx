"use client";

import { useState } from "react";
import { Section, EmptyState } from "@/components/ui";

type AgentResponse = {
  question: string;
  executiveSummary: string;
  financialImpact: string[];
  pendingItems: string[];
  risks: string[];
  responsiblePerson: string[];
  nextActions: string[];
  dataNotAvailable?: boolean;
};

export function AskForm({ examples }: { examples: string[] }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as AgentResponse;
      setAnswer(data);
    } catch {
      setError("Something went wrong answering that question. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which invoices are overdue?"
          className="flex-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
            className="text-xs badge badge-gray hover:bg-[var(--border)]"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-[var(--red)]">{error}</div>}

      {answer && (
        <Section title={`"${answer.question}"`}>
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-[var(--muted)] uppercase mb-1">Executive Summary</div>
              <div className="font-medium">{answer.executiveSummary}</div>
            </div>

            <AnswerList label="Financial Impact" items={answer.financialImpact} />
            <AnswerList label="Pending Items" items={answer.pendingItems} />
            <AnswerList label="Risks / Exceptions" items={answer.risks} tone="red" />
            <AnswerList label="Responsible Person" items={answer.responsiblePerson} />
            <AnswerList label="Recommended Next Actions" items={answer.nextActions} />
          </div>
        </Section>
      )}

      {!answer && !loading && <EmptyState text="Ask a question above, or pick one of the examples." />}
    </div>
  );
}

function AnswerList({ label, items, tone }: { label: string; items: string[]; tone?: "red" }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--muted)] uppercase mb-1">{label}</div>
      <ul className={`list-disc pl-5 space-y-0.5 ${tone === "red" ? "text-[var(--red)]" : ""}`}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
