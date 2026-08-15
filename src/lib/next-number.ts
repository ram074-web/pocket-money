import "server-only";

import { prisma } from "@/lib/db";

/**
 * Suggests the next number in whatever sequence the business already uses, by
 * incrementing the trailing digits of the most recently created record
 * (e.g. QT-2026-0210 -> QT-2026-0211).
 *
 * This is a *suggestion shown in an editable field*, never a value written
 * without a human seeing it: the numbering scheme belongs to the business, and
 * the spec is explicit that document numbers must not be invented. When no
 * prior record exists, the field is left blank for the user to establish
 * their own format.
 */
function increment(previous: string): string {
  const m = previous.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return "";
  const [, head, digits, tail] = m;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${head}${next}${tail}`;
}

export async function suggestQuotationNo(): Promise<string> {
  const last = await prisma.quotation.findFirst({ orderBy: { createdAt: "desc" } });
  return last ? increment(last.quotationNo) : "";
}

export async function suggestPoNo(): Promise<string> {
  const last = await prisma.purchaseOrder.findFirst({ orderBy: { createdAt: "desc" } });
  return last ? increment(last.poNo) : "";
}

export async function suggestInvoiceNo(): Promise<string> {
  const last = await prisma.invoice.findFirst({ orderBy: { createdAt: "desc" } });
  return last ? increment(last.invoiceNo) : "";
}

/** Today as yyyy-mm-dd in local time, for date input defaults. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
