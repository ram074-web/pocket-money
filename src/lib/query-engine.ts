import { prisma } from "@/lib/db";
import {
  getDashboardData,
  invoiceOutstanding,
  vendorInvoiceOutstanding,
  fmtINR,
  isOverdue,
  daysBetween,
  today,
} from "@/lib/calc";

// A response follows the standard AI Agent Response Format from the spec:
// Executive Summary, Financial Impact, Pending Items, Risks/Exceptions,
// Responsible Person, Recommended Next Actions.
export type AgentResponse = {
  question: string;
  executiveSummary: string;
  financialImpact: string[];
  pendingItems: string[];
  risks: string[];
  responsiblePerson: string[];
  nextActions: string[];
  dataNotAvailable?: boolean;
};

function empty(question: string, note = "Data not available."): AgentResponse {
  return {
    question,
    executiveSummary: note,
    financialImpact: [],
    pendingItems: [],
    risks: [],
    responsiblePerson: [],
    nextActions: [],
    dataNotAvailable: true,
  };
}

/**
 * Rule-based resolver for the canonical owner questions in spec section 13.
 * Every figure returned is computed directly from stored records — nothing
 * is fabricated. Free-text that doesn't match a known question pattern
 * falls back to a generic guided answer instead of guessing.
 */
export async function answerQuestion(rawQuestion: string): Promise<AgentResponse> {
  const q = rawQuestion.trim().toLowerCase();
  const d = await getDashboardData();

  const matchCustomer = async (text: string) => {
    const customers = await prisma.customer.findMany();
    return customers.find((c) => text.includes(c.name.toLowerCase()));
  };
  const matchVendor = async (text: string) => {
    const vendors = await prisma.vendor.findMany();
    return vendors.find((v) => text.includes(v.name.toLowerCase()));
  };

  // "How much do we owe <vendor>?" / vendor payable question
  if (/(owe|payable).*(vendor|printers|studio|media|world)|how much.*we (owe|pay)/.test(q) || /owe/.test(q) && (await matchVendor(q))) {
    const vendor = await matchVendor(q);
    if (vendor) {
      const vi = await prisma.vendorInvoice.findMany({ where: { vendorId: vendor.id } });
      const outstanding = vi.reduce((s, v) => s + vendorInvoiceOutstanding(v), 0);
      const overdue = vi.filter((v) => isOverdue(v.dueDate)).reduce((s, v) => s + vendorInvoiceOutstanding(v), 0);
      return {
        question: rawQuestion,
        executiveSummary: `${vendor.name}: outstanding payable is ${fmtINR(outstanding)}.`,
        financialImpact: [
          `Total payable outstanding: ${fmtINR(outstanding)}`,
          `Of which overdue: ${fmtINR(overdue)}`,
        ],
        pendingItems: vi
          .filter((v) => vendorInvoiceOutstanding(v) > 0)
          .map((v) => `${v.vendorInvoiceNo} — ${fmtINR(vendorInvoiceOutstanding(v))} due ${v.dueDate.toDateString()} (${v.status})`),
        risks: overdue > 0 ? [`${fmtINR(overdue)} overdue to ${vendor.name}`] : [],
        responsiblePerson: ["Accounts Payable (Rahul Nair)"],
        nextActions: overdue > 0 ? ["Schedule payment for overdue vendor invoices this week"] : ["No immediate action required"],
      };
    }
  }

  // Customer outstanding: "how much does X owe us"
  if (/owe us|outstanding|receivable/.test(q)) {
    const customer = await matchCustomer(q);
    if (customer) {
      const inv = await prisma.invoice.findMany({ where: { customerId: customer.id } });
      const outstanding = inv.reduce((s, i) => s + invoiceOutstanding(i), 0);
      const overdue = inv.filter((i) => isOverdue(i.dueDate)).reduce((s, i) => s + invoiceOutstanding(i), 0);
      const lastPayment = await prisma.payment.findFirst({
        where: { invoice: { customerId: customer.id } },
        orderBy: { paymentDate: "desc" },
      });
      return {
        question: rawQuestion,
        executiveSummary: `${customer.name} owes ${fmtINR(outstanding)} in total outstanding receivables.`,
        financialImpact: [
          `Total outstanding: ${fmtINR(outstanding)}`,
          `Of which overdue: ${fmtINR(overdue)}`,
          lastPayment
            ? `Last payment received: ${fmtINR(lastPayment.amount)} on ${lastPayment.paymentDate.toDateString()}`
            : `Last payment received: none on record`,
        ],
        pendingItems: inv
          .filter((i) => invoiceOutstanding(i) > 0)
          .map((i) => `${i.invoiceNo} — ${fmtINR(invoiceOutstanding(i))} due ${i.dueDate.toDateString()} (${i.status})`),
        risks: overdue > 0 ? [`${fmtINR(overdue)} overdue from ${customer.name}`] : [],
        responsiblePerson: ["Accounts Receivable (Kavita Rao)"],
        nextActions: overdue > 0 ? ["Send payment follow-up for overdue invoices"] : ["Monitor — no overdue amount currently"],
      };
    }
  }

  // "How much money do customers owe us today?"
  if (/how much.*customers?.*owe|money.*customers.*owe|total.*receivable/.test(q)) {
    return {
      question: rawQuestion,
      executiveSummary: `Customers currently owe ${fmtINR(d.receivables.totalOutstanding)} in total outstanding receivables.`,
      financialImpact: [
        `Total invoiced: ${fmtINR(d.receivables.totalReceivables)}`,
        `Total received: ${fmtINR(d.receivables.totalReceived)}`,
        `Total outstanding: ${fmtINR(d.receivables.totalOutstanding)}`,
        `Overdue: ${fmtINR(d.receivables.overdueAmount)} across ${d.receivables.overdueCount} invoice(s)`,
      ],
      pendingItems: d.receivables.customerOutstanding
        .slice(0, 5)
        .map((c) => `${c.customer.name}: ${fmtINR(c.outstanding)}`),
      risks: d.risks.filter((r) => r.severity === "RED").slice(0, 5).map((r) => r.message),
      responsiblePerson: ["Accounts Receivable (Kavita Rao)"],
      nextActions: ["Prioritise follow-up on RED-flagged overdue invoices"],
    };
  }

  // "How much have we collected this month?"
  if (/collected this month|collections this month/.test(q)) {
    const now = today();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const payments = await prisma.payment.findMany({ where: { paymentDate: { gte: start } } });
    const total = payments.reduce((s, p) => s + p.amount, 0);
    return {
      question: rawQuestion,
      executiveSummary: `Collected ${fmtINR(total)} so far this month across ${payments.length} payment(s).`,
      financialImpact: [`Total collected (month to date): ${fmtINR(total)}`],
      pendingItems: [],
      risks: [],
      responsiblePerson: ["Accounts Receivable (Kavita Rao)"],
      nextActions: [],
    };
  }

  // "What is overdue?"
  if (/^what is overdue|overdue invoices|which invoices are overdue/.test(q)) {
    return {
      question: rawQuestion,
      executiveSummary: `${d.receivables.overdueCount} invoice(s) overdue totalling ${fmtINR(d.receivables.overdueAmount)}.`,
      financialImpact: [`Overdue receivables: ${fmtINR(d.receivables.overdueAmount)}`],
      pendingItems: d.receivables.overdueInvoices.map(
        (i) => `${i.invoiceNo} (${i.customer.name}) — ${fmtINR(invoiceOutstanding(i))}, due ${i.dueDate.toDateString()}`
      ),
      risks: d.receivables.overdueInvoices
        .filter((i) => invoiceOutstanding(i) > 500000)
        .map((i) => `High-value overdue: ${i.invoiceNo} (${fmtINR(invoiceOutstanding(i))})`),
      responsiblePerson: ["Accounts Receivable (Kavita Rao)"],
      nextActions: ["Send follow-up communication for each overdue invoice, escalate 90+ day items"],
    };
  }

  // Highest outstanding customer
  if (/highest outstanding|delayed payments repeatedly|repeatedly/.test(q)) {
    const top = d.receivables.customerOutstanding[0];
    return {
      question: rawQuestion,
      executiveSummary: top
        ? `${top.customer.name} has the highest outstanding amount: ${fmtINR(top.outstanding)}.`
        : "No outstanding receivables currently.",
      financialImpact: d.receivables.customerOutstanding.slice(0, 5).map((c) => `${c.customer.name}: ${fmtINR(c.outstanding)}`),
      pendingItems: [],
      risks: [],
      responsiblePerson: ["Accounts Receivable (Kavita Rao)"],
      nextActions: top ? [`Prioritise follow-up with ${top.customer.name}`] : [],
    };
  }

  // Invoices needing correction
  if (/correction/.test(q)) {
    const corrections = await prisma.invoiceCorrection.findMany({
      where: { status: { not: "Resolved" } },
      include: { invoice: { include: { customer: true } } },
    });
    return {
      question: rawQuestion,
      executiveSummary: `${corrections.length} invoice(s) currently under correction.`,
      financialImpact: corrections.map(
        (c) => `${c.invoice.invoiceNo} (${c.invoice.customer.name}): ${fmtINR(invoiceOutstanding(c.invoice))}`
      ),
      pendingItems: corrections.map((c) => `${c.invoice.invoiceNo}: ${c.correctionNeeded}`),
      risks: [],
      responsiblePerson: corrections.map((c) => c.responsiblePerson ?? "Unassigned"),
      nextActions: corrections.map((c) => `Resolve correction on ${c.invoice.invoiceNo} and resubmit`),
    };
  }

  // Payments expected this week
  if (/payments? expected this week|expected.*collections?.*week/.test(q)) {
    return {
      question: rawQuestion,
      executiveSummary: `${fmtINR(d.receivables.dueWithin7Amount)} expected from customers within 7 days (${d.receivables.dueWithin7Count} invoice(s)).`,
      financialImpact: [`Due within 7 days: ${fmtINR(d.receivables.dueWithin7Amount)}`],
      pendingItems: [],
      risks: [],
      responsiblePerson: ["Accounts Receivable (Kavita Rao)"],
      nextActions: [],
    };
  }

  // Vendor payments due this week / overdue
  if (/pay vendors this week|vendor payments.*week/.test(q)) {
    return {
      question: rawQuestion,
      executiveSummary: `${fmtINR(d.payables.dueWithin7Amount)} due to vendors within 7 days (${d.payables.dueWithin7Count} invoice(s)).`,
      financialImpact: [`Due within 7 days: ${fmtINR(d.payables.dueWithin7Amount)}`],
      pendingItems: [],
      risks: [],
      responsiblePerson: ["Accounts Payable (Rahul Nair)"],
      nextActions: [],
    };
  }

  if (/vendor payments.*overdue|overdue.*vendor/.test(q)) {
    return {
      question: rawQuestion,
      executiveSummary: `${d.payables.overdueCount} vendor invoice(s) overdue totalling ${fmtINR(d.payables.overdueAmount)}.`,
      financialImpact: [`Overdue payables: ${fmtINR(d.payables.overdueAmount)}`],
      pendingItems: d.payables.overdueVendorInvoices.map(
        (v) => `${v.vendorInvoiceNo} (${v.vendor.name}) — ${fmtINR(vendorInvoiceOutstanding(v))}, due ${v.dueDate.toDateString()}`
      ),
      risks: [],
      responsiblePerson: ["Accounts Payable (Rahul Nair)"],
      nextActions: ["Clear overdue vendor payments to avoid credit holds"],
    };
  }

  // Cash position for next 30 days
  if (/cash position|next 30 days/.test(q)) {
    return {
      question: rawQuestion,
      executiveSummary: `Expected net cash position over next 30 days: ${fmtINR(d.cash.expectedNetCash30)}.`,
      financialImpact: [
        `Expected collections (30 days): ${fmtINR(d.cash.expectedCollections30)}`,
        `Expected vendor payments (30 days): ${fmtINR(d.cash.expectedPayments30)}`,
        `Expected net cash position: ${fmtINR(d.cash.expectedNetCash30)}`,
      ],
      pendingItems: [],
      risks: d.cash.expectedNetCash30 < 0 ? ["Expected net cash position is negative for the next 30 days"] : [],
      responsiblePerson: ["Finance"],
      nextActions: d.cash.expectedNetCash30 < 0 ? ["Accelerate collections or negotiate vendor payment timing"] : [],
    };
  }

  // Employee with most pending follow-ups
  if (/employee.*pending follow|highest number of pending/.test(q)) {
    const followUps = await prisma.followUp.findMany({
      where: { status: "PENDING" },
      include: { employee: true },
    });
    const counts = new Map<string, number>();
    for (const f of followUps) {
      const name = f.employee?.name ?? "Unassigned";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      question: rawQuestion,
      executiveSummary: sorted.length
        ? `${sorted[0][0]} has the highest number of pending follow-ups: ${sorted[0][1]}.`
        : "No pending follow-ups.",
      financialImpact: [],
      pendingItems: sorted.map(([name, count]) => `${name}: ${count} pending`),
      risks: [],
      responsiblePerson: sorted.map(([name]) => name),
      nextActions: [],
    };
  }

  // Everything pending today
  if (/pending today|show me everything pending/.test(q)) {
    const followUps = await prisma.followUp.findMany({
      where: { status: "PENDING" },
      include: { employee: true, customer: true, vendor: true },
      orderBy: { dueDate: "asc" },
    });
    const dueTodayOrOverdue = followUps.filter((f) => daysBetween(today(), f.dueDate) >= 0);
    return {
      question: rawQuestion,
      executiveSummary: `${dueTodayOrOverdue.length} action(s) due today or overdue.`,
      financialImpact: dueTodayOrOverdue
        .filter((f) => f.amount)
        .map((f) => `${f.title}: ${fmtINR(f.amount ?? 0)}`),
      pendingItems: dueTodayOrOverdue.map(
        (f) => `[${f.priority}] ${f.title} — ${f.customer?.name ?? f.vendor?.name ?? "Internal"} (${f.employee?.name ?? "Unassigned"})`
      ),
      risks: dueTodayOrOverdue.filter((f) => f.priority === "RED").map((f) => f.title),
      responsiblePerson: [...new Set(dueTodayOrOverdue.map((f) => f.employee?.name ?? "Unassigned"))],
      nextActions: dueTodayOrOverdue.map((f) => f.nextAction ?? f.title),
    };
  }

  // Invoices above a threshold that are overdue: "invoices above X lakh that are overdue"
  const lakhMatch = q.match(/above\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*lakh/);
  if (lakhMatch && /overdue/.test(q)) {
    const threshold = parseFloat(lakhMatch[1]) * 100000;
    const matches = d.receivables.overdueInvoices.filter((i) => invoiceOutstanding(i) > threshold);
    return {
      question: rawQuestion,
      executiveSummary: `${matches.length} overdue invoice(s) above ${fmtINR(threshold)}.`,
      financialImpact: matches.map((i) => `${i.invoiceNo} (${i.customer.name}): ${fmtINR(invoiceOutstanding(i))}`),
      pendingItems: matches.map((i) => `${i.invoiceNo} due ${i.dueDate.toDateString()}`),
      risks: matches.map((i) => `High-value overdue: ${i.invoiceNo}`),
      responsiblePerson: ["Accounts Receivable (Kavita Rao)"],
      nextActions: ["Escalate high-value overdue invoices immediately"],
    };
  }

  // Profitable / low-margin projects
  if (/profitable projects|low margin|low-margin/.test(q)) {
    const sorted = [...d.projectProfitability].sort((a, b) => (b.margin ?? -1) - (a.margin ?? -1));
    const low = sorted.filter((p) => p.margin != null && p.margin < 0.15);
    return {
      question: rawQuestion,
      executiveSummary: /low/.test(q)
        ? `${low.length} project(s) below the 15% margin threshold.`
        : `Top project by margin: ${sorted[0]?.project.name ?? "N/A"}.`,
      financialImpact: sorted
        .slice(0, 5)
        .map((p) => `${p.project.name}: revenue ${fmtINR(p.revenue)}, margin ${p.margin != null ? (p.margin * 100).toFixed(1) + "%" : "N/A"}`),
      pendingItems: [],
      risks: low.map((p) => `${p.project.name} margin ${(p.margin! * 100).toFixed(1)}% — below threshold`),
      responsiblePerson: [...new Set(sorted.map((p) => p.project.name))],
      nextActions: low.length ? ["Review pricing / vendor cost on low-margin projects"] : [],
    };
  }

  // Invoices raised against a particular PO
  const poMatch = rawQuestion.match(/PO[-\s]?[A-Z0-9-]+/i);
  if (poMatch && /invoices.*against|against.*po/.test(q)) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { poNo: { equals: poMatch[0].toUpperCase().replace(/\s/g, "-") } },
      include: { invoices: true, customer: true },
    });
    if (po) {
      return {
        question: rawQuestion,
        executiveSummary: `${po.invoices.length} invoice(s) raised against ${po.poNo} (${po.customer.name}).`,
        financialImpact: po.invoices.map((i) => `${i.invoiceNo}: ${fmtINR(i.value + i.taxAmount)} (${i.status})`),
        pendingItems: [],
        risks: [],
        responsiblePerson: [],
        nextActions: [],
      };
    }
    return empty(rawQuestion, `No PO found matching "${poMatch[0]}". Data not available.`);
  }

  // POs without invoices
  if (/pos where invoices have not|pos without invoice/.test(q)) {
    const pos = await prisma.purchaseOrder.findMany({ include: { invoices: true, customer: true } });
    const without = pos.filter((p) => p.invoices.length === 0);
    return {
      question: rawQuestion,
      executiveSummary: `${without.length} PO(s) have no invoice raised against them yet.`,
      financialImpact: without.map((p) => `${p.poNo} (${p.customer.name}): ${fmtINR(p.value)}`),
      pendingItems: without.map((p) => `${p.poNo} — raise invoice`),
      risks: without.length ? ["Revenue at risk of delay — work may be billable now"] : [],
      responsiblePerson: [],
      nextActions: without.length ? ["Raise invoices against these POs"] : [],
    };
  }

  return empty(
    rawQuestion,
    "This question doesn't match a known pattern yet. Try asking about a specific customer/vendor outstanding, overdue invoices, cash position, or pending follow-ups. Data not available for a direct match."
  );
}
