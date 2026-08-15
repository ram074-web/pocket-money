"use client";

import { useEffect, useRef, useState } from "react";

const ROLES = ["Owner", "Finance Manager", "Sales", "Operations", "Accounts Executive"] as const;
type Role = (typeof ROLES)[number];

const EXAMPLES = [
  "Dashboard",
  "How much do customers owe us today?",
  "Show all overdue invoices.",
  "What payments are expected this week?",
  "How much do we owe suppliers?",
  "What is the status of INV-1025?",
  "What is the status of quotation QT-2026-0210?",
  "What is the status of PO PO-MER-5510?",
  "Show Orion Global Foods Pvt Ltd",
  "Which invoices need correction?",
  "Good morning report",
  "End of day report",
];

type Msg = { from: "user" | "bot"; text: string; authorized?: boolean };

export function WhatsAppSimulator() {
  const [role, setRole] = useState<Role>("Owner");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, role }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { from: "bot", text: data.text ?? "Error processing command.", authorized: data.authorized }]);
    } catch {
      setMessages((m) => [...m, { from: "bot", text: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[var(--muted)]">Logged in as:</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="border border-[var(--border)] rounded-md px-2 py-1 bg-[var(--surface)]"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--muted)]">
          Access is permission-gated per role (Section 17) — try switching roles and asking about payables.
        </span>
      </div>

      <div className="card">
        <div ref={scrollRef} className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto space-y-3 bg-[var(--background)]">
          {messages.length === 0 && (
            <div className="text-sm text-[var(--muted)] text-center py-8">
              Send a message below, or tap an example to get started.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.from === "user"
                    ? "bg-[var(--brand)] text-white"
                    : m.authorized === false
                      ? "bg-[var(--red-bg)] text-[var(--red)] border border-[var(--border)]"
                      : "bg-[var(--surface)] border border-[var(--border)]"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-[var(--muted)]">Typing…</div>}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 p-3 border-t border-[var(--border)]"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--surface)]"
          />
          <button type="submit" className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm">
            Send
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => send(ex)} className="text-xs badge badge-gray hover:bg-[var(--border)]">
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
