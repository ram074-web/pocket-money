import { MessageCategory } from "@prisma/client";
import type { ClassificationResult, PartyMatch } from "./types";

type Rule = {
  category: MessageCategory;
  /** All patterns must match (AND). */
  requireAll?: RegExp[];
  /** At least one pattern must match (OR). */
  requireAny?: RegExp[];
  /** Any pattern here disqualifies this rule. */
  excludeAny?: RegExp[];
  /** Restrict to a sender type, if known. */
  partyType?: "customer" | "vendor";
  weight: number;
};

// Ordered most-specific first and scored by weight. This is a deliberately
// simple, auditable rule-based classifier (keyword/pattern matching over
// subject+body) rather than an opaque model — every classification can be
// explained by which rule fired, which matters for a financial system per
// the "never invent, always show your work" data-accuracy requirement.
const RULES: Rule[] = [
  {
    category: MessageCategory.PO_AMENDMENT,
    partyType: "customer",
    requireAny: [/\bamend(ed|ment)?\b/i, /\brevised po\b/i, /\bupdated po\b/i, /\bpo revision\b/i, /\bchange in po\b/i],
    requireAll: [/\bpo\b|purchase order/i],
    weight: 4,
  },
  {
    category: MessageCategory.CUSTOMER_PO,
    partyType: "customer",
    requireAny: [/purchase order/i, /\bpo\s*(no\.?|number)?\s*[:#-]/i, /\bpo[-\s]?\d/i],
    weight: 3,
  },
  {
    category: MessageCategory.INVOICE_CORRECTION_REQUEST,
    partyType: "customer",
    requireAny: [
      /\bcorrect(ion)?\b/i,
      /\bgstin\b.*(wrong|incorrect|mismatch)/i,
      /\bplease (re-?issue|resend|correct)\b/i,
      /\bincorrect (amount|invoice|gstin|address)\b/i,
    ],
    requireAll: [/invoice/i],
    weight: 4,
  },
  {
    category: MessageCategory.INVOICE_REJECTION,
    partyType: "customer",
    requireAny: [/\breject(ed|ing)?\b.*invoice/i, /invoice.*\breject/i, /\bcannot process this invoice\b/i],
    weight: 4,
  },
  {
    category: MessageCategory.PAYMENT_CONFIRMATION,
    partyType: "customer",
    requireAny: [
      /\bpayment (has been|is) made\b/i,
      /\bwe have (paid|remitted|transferred)\b/i,
      /\butr\b/i,
      /\btransaction (reference|id)\b/i,
      /\bpayment (done|completed|processed)\b/i,
    ],
    weight: 4,
  },
  {
    category: MessageCategory.PAYMENT_FOLLOWUP,
    partyType: "customer",
    requireAny: [
      /\bwill (be able to )?pay by\b/i,
      /\bwill\b.*\b(process|make)\b.*\bpayment\b.*\bby\b/i,
      /\bapologies for the delay\b/i,
      /\brequest.*(extension|more time)\b/i,
      /\bdelay(ed)?\b.*\bpayment\b/i,
      /\bpayment.*(next week|by month end|shortly)\b/i,
      /\bfollowing up on (the )?(payment|invoice)\b/i,
    ],
    weight: 3,
  },
  {
    // Deliberately specific to "asking for a quote" phrasing so a bare
    // mention of the word "quotation" (which a vendor could just as easily
    // use) doesn't collide with VENDOR_QUOTATION below.
    category: MessageCategory.CUSTOMER_QUOTATION_REQUEST,
    partyType: "customer",
    requireAny: [
      /request for (a )?quote/i,
      /\bwould like a quotation\b/i,
      /\bplease share your (quotation|pricing|proposal|quote)\b/i,
      /\bkindly (send|share) (us )?(a |your )?quote\b/i,
      /\bshare (your )?(pricing|proposal)\b/i,
      /\brfq\b/i,
    ],
    excludeAny: [/purchase order/i, /\bpo\s*(no\.?|number)\b/i],
    weight: 3,
  },
  {
    category: MessageCategory.CUSTOMER_COMPLAINT,
    partyType: "customer",
    requireAny: [/\bcomplaint\b/i, /\bnot satisfied\b/i, /\bpoor quality\b/i, /\bunacceptable\b/i, /\bdisappointed\b/i],
    weight: 4,
  },
  {
    category: MessageCategory.VENDOR_PAYMENT_REQUEST,
    partyType: "vendor",
    requireAny: [
      /\bkindly (release|process|arrange) (the )?payment\b/i,
      /\bpayment (status|update)\b/i,
      /\bour invoice.*(pending|due|overdue)\b/i,
      /\brequest.*payment\b/i,
    ],
    weight: 3,
  },
  {
    category: MessageCategory.VENDOR_INVOICE,
    partyType: "vendor",
    requireAny: [/\binvoice\b/i, /\bbill\b/i],
    requireAll: [/\bamount\b|₹|\brs\.?\s?\d|\binr\b/i],
    weight: 2,
  },
  {
    // Specific to "here is our pricing" phrasing — the offering side of a
    // quotation exchange, as opposed to CUSTOMER_QUOTATION_REQUEST above.
    category: MessageCategory.VENDOR_QUOTATION,
    partyType: "vendor",
    requireAny: [
      /\bplease find our\b.{0,25}(quotation|pricing|rates|proposal)/i,
      /\bour (rates|quotation|pricing)\s*[:.]?/i,
      /\bindicative quotation\b/i,
      /\bbulk discount/i,
    ],
    weight: 3,
  },
  {
    category: MessageCategory.PROJECT_INSTRUCTION,
    requireAny: [/\bplease proceed\b/i, /\bgo ahead\b/i, /\bstart (the )?work\b/i, /\bproject instruction\b/i],
    weight: 1,
  },
];

export function classifyMessage(text: { subject?: string; body: string }, party: PartyMatch): ClassificationResult {
  const haystack = `${text.subject ?? ""}\n${text.body}`;
  const partyType = party.type === "none" ? undefined : party.type;

  let best: { rule: Rule; reasons: string[] } | null = null;

  for (const rule of RULES) {
    if (rule.partyType && partyType && rule.partyType !== partyType) continue;
    if (rule.excludeAny?.some((re) => re.test(haystack))) continue;

    const reasons: string[] = [];
    if (rule.requireAll) {
      if (!rule.requireAll.every((re) => re.test(haystack))) continue;
      reasons.push(...rule.requireAll.map((re) => `matched ${re}`));
    }
    if (rule.requireAny) {
      const matched = rule.requireAny.filter((re) => re.test(haystack));
      if (matched.length === 0) continue;
      reasons.push(...matched.map((re) => `matched ${re}`));
    }

    if (!best || rule.weight > best.rule.weight) {
      best = { rule, reasons };
    }
  }

  if (!best) {
    return {
      category: MessageCategory.OTHER,
      confidence: 0.2,
      reasons: ["No classification rule matched — flagged as OTHER for manual review."],
    };
  }

  return {
    category: best.rule.category,
    confidence: Math.min(0.95, 0.5 + best.rule.weight * 0.1),
    reasons: best.reasons,
  };
}
