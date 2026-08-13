import { prisma } from "@/lib/db";
import type { Invoice, VendorInvoice } from "@prisma/client";

// All money figures are plain numbers (INR). "Today" for ageing/overdue
// purposes is the real current date unless a fixed reference is supplied
// (tests / demos can pin it for reproducibility).
export function today(): Date {
  return new Date();
}

export function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function invoiceTotal(inv: Pick<Invoice, "value" | "taxAmount">): number {
  return inv.value + inv.taxAmount;
}

export function invoiceOutstanding(
  inv: Pick<Invoice, "value" | "taxAmount" | "amountReceived" | "status">
): number {
  if (inv.status === "CANCELLED" || inv.status === "CREDIT_NOTE") return 0;
  return Math.max(0, invoiceTotal(inv) - inv.amountReceived);
}

export function vendorInvoiceTotal(vi: Pick<VendorInvoice, "amount" | "taxAmount">): number {
  return vi.amount + vi.taxAmount;
}

export function vendorInvoiceOutstanding(
  vi: Pick<VendorInvoice, "amount" | "taxAmount" | "amountPaid" | "status">
): number {
  if (vi.status === "CANCELLED") return 0;
  return Math.max(0, vendorInvoiceTotal(vi) - vi.amountPaid);
}

export type AgeingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

/** Days overdue > 0 means past due date. Negative/zero means not yet due. */
export function ageingBucket(dueDate: Date, ref: Date = today()): AgeingBucket {
  const overdueDays = daysBetween(ref, dueDate);
  if (overdueDays <= 0) return "current";
  if (overdueDays <= 30) return "0-30";
  if (overdueDays <= 60) return "31-60";
  if (overdueDays <= 90) return "61-90";
  return "90+";
}

export function isOverdue(dueDate: Date, ref: Date = today()): boolean {
  return daysBetween(ref, dueDate) > 0;
}

export function fmtINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const OPEN_INVOICE_STATUSES = [
  "READY_FOR_SUBMISSION",
  "SUBMITTED",
  "UNDER_VERIFICATION",
  "CORRECTION_REQUIRED",
  "RESUBMITTED",
  "APPROVED",
  "PAYMENT_DUE",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const;

const OPEN_VENDOR_INVOICE_STATUSES = [
  "RECEIVED",
  "UNDER_VERIFICATION",
  "APPROVAL_PENDING",
  "APPROVED",
  "PAYMENT_DUE",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const;

export type RiskItem = {
  severity: "RED" | "AMBER" | "GREEN";
  category: string;
  message: string;
  amount?: number;
  entityType: "customer" | "vendor" | "invoice" | "vendorInvoice" | "po" | "project";
  entityId: string;
  link?: string;
};

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData(ref: Date = today()) {
  const [customers, vendors, invoices, vendorInvoices, quotations, pos, projects] =
    await Promise.all([
      prisma.customer.findMany(),
      prisma.vendor.findMany(),
      prisma.invoice.findMany({ include: { customer: true, corrections: true, purchaseOrder: true } }),
      prisma.vendorInvoice.findMany({ include: { vendor: true } }),
      prisma.quotation.findMany(),
      prisma.purchaseOrder.findMany({ include: { invoices: true } }),
      prisma.project.findMany({
        include: {
          invoices: true,
          vendorCosts: true,
          otherCosts: true,
          customer: true,
          purchaseOrders: true,
        },
      }),
    ]);

  // ---------------- Receivables ----------------
  const openInvoices = invoices.filter((i) =>
    (OPEN_INVOICE_STATUSES as readonly string[]).includes(i.status)
  );
  const totalReceivables = invoices.reduce((s, i) => s + invoiceTotal(i), 0);
  const totalReceived = invoices.reduce((s, i) => s + i.amountReceived, 0);
  const totalOutstanding = openInvoices.reduce((s, i) => s + invoiceOutstanding(i), 0);

  const overdueInvoices = openInvoices.filter((i) => isOverdue(i.dueDate, ref));
  const dueWithin7 = openInvoices.filter(
    (i) => !isOverdue(i.dueDate, ref) && daysBetween(i.dueDate, ref) <= 7
  );
  const dueWithin30 = openInvoices.filter(
    (i) => !isOverdue(i.dueDate, ref) && daysBetween(i.dueDate, ref) <= 30
  );

  const ageing: Record<AgeingBucket, number> = {
    current: 0,
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  for (const inv of openInvoices) {
    ageing[ageingBucket(inv.dueDate, ref)] += invoiceOutstanding(inv);
  }

  const customerOutstanding = customers
    .map((c) => {
      const custInvoices = openInvoices.filter((i) => i.customerId === c.id);
      const outstanding = custInvoices.reduce((s, i) => s + invoiceOutstanding(i), 0);
      const overdue = custInvoices
        .filter((i) => isOverdue(i.dueDate, ref))
        .reduce((s, i) => s + invoiceOutstanding(i), 0);
      return {
        customer: c,
        outstanding,
        overdue,
        overCreditLimit: c.creditLimit != null && outstanding > c.creditLimit,
        invoiceCount: custInvoices.length,
      };
    })
    .filter((c) => c.invoiceCount > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  // ---------------- Payables ----------------
  const openVendorInvoices = vendorInvoices.filter((v) =>
    (OPEN_VENDOR_INVOICE_STATUSES as readonly string[]).includes(v.status)
  );
  const totalPayable = vendorInvoices.reduce((s, v) => s + vendorInvoiceTotal(v), 0);
  const totalPaid = vendorInvoices.reduce((s, v) => s + v.amountPaid, 0);
  const totalOutstandingPayable = openVendorInvoices.reduce(
    (s, v) => s + vendorInvoiceOutstanding(v),
    0
  );
  const overdueVendorInvoices = openVendorInvoices.filter((v) => isOverdue(v.dueDate, ref));
  const payableDueWithin7 = openVendorInvoices.filter(
    (v) => !isOverdue(v.dueDate, ref) && daysBetween(v.dueDate, ref) <= 7
  );
  const payableDueWithin30 = openVendorInvoices.filter(
    (v) => !isOverdue(v.dueDate, ref) && daysBetween(v.dueDate, ref) <= 30
  );

  const vendorOutstanding = vendors
    .map((v) => {
      const vInvoices = openVendorInvoices.filter((vi) => vi.vendorId === v.id);
      const outstanding = vInvoices.reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
      const overdue = vInvoices
        .filter((vi) => isOverdue(vi.dueDate, ref))
        .reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
      return { vendor: v, outstanding, overdue, invoiceCount: vInvoices.length };
    })
    .filter((v) => v.invoiceCount > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  // ---------------- Sales & Billing ----------------
  const quotationsRaised = quotations.length;
  const quotationsAccepted = quotations.filter((q) => q.status === "ACCEPTED").length;
  const quotationsPending = quotations.filter((q) => q.status === "SENT" || q.status === "DRAFT").length;
  const posReceived = pos.filter((p) => p.status !== "AWAITED").length;
  const posPending = pos.filter((p) => p.status === "AWAITED").length;
  const invoicesRaised = invoices.length;
  const invoicesPendingSubmission = invoices.filter(
    (i) => i.status === "DRAFT" || i.status === "READY_FOR_SUBMISSION"
  ).length;
  const invoicesUnderCorrection = invoices.filter((i) => i.status === "CORRECTION_REQUIRED").length;
  const cancelledOrRevised = invoices.filter(
    (i) => i.status === "CANCELLED" || i.status === "CREDIT_NOTE"
  ).length;

  // POs with no invoice raised against them at all = work likely completed but not invoiced
  const posWithoutInvoice = pos.filter((p) => p.invoices.length === 0);

  // ---------------- Cash Position ----------------
  const expectedCollections30 = openInvoices
    .filter((i) => daysBetween(i.dueDate, ref) <= 30)
    .reduce((s, i) => s + invoiceOutstanding(i), 0);
  const expectedPayments30 = openVendorInvoices
    .filter((v) => daysBetween(v.dueDate, ref) <= 30)
    .reduce((s, v) => s + vendorInvoiceOutstanding(v), 0);
  const expectedNetCash30 = expectedCollections30 - expectedPayments30;

  // ---------------- Exceptions / Risk Alerts ----------------
  const risks: RiskItem[] = [];

  for (const inv of overdueInvoices) {
    const overdueDays = daysBetween(ref, inv.dueDate);
    const amt = invoiceOutstanding(inv);
    risks.push({
      severity: amt > 500000 || overdueDays > 60 ? "RED" : "AMBER",
      category: "Customer payment overdue",
      message: `${inv.invoiceNo} (${inv.customer.name}) overdue by ${overdueDays} day(s), ${fmtINR(amt)} outstanding`,
      amount: amt,
      entityType: "invoice",
      entityId: inv.id,
      link: `/invoices/${inv.id}`,
    });
  }

  for (const inv of invoices.filter((i) => i.status === "CORRECTION_REQUIRED")) {
    risks.push({
      severity: "AMBER",
      category: "Invoice correction pending",
      message: `${inv.invoiceNo} (${inv.customer.name}) requires correction before resubmission`,
      amount: invoiceOutstanding(inv),
      entityType: "invoice",
      entityId: inv.id,
      link: `/invoices/${inv.id}`,
    });
  }

  for (const p of posWithoutInvoice) {
    risks.push({
      severity: "AMBER",
      category: "PO received but invoice not raised",
      message: `${p.poNo} received, no invoice raised yet (PO value ${fmtINR(p.value)})`,
      amount: p.value,
      entityType: "po",
      entityId: p.id,
    });
  }

  for (const c of customerOutstanding.filter((c) => c.overCreditLimit)) {
    risks.push({
      severity: "RED",
      category: "Customer outstanding exceeds credit limit",
      message: `${c.customer.name} outstanding ${fmtINR(c.outstanding)} exceeds credit limit ${fmtINR(
        c.customer.creditLimit ?? 0
      )}`,
      amount: c.outstanding,
      entityType: "customer",
      entityId: c.customer.id,
      link: `/customers/${c.customer.id}`,
    });
  }

  for (const vi of overdueVendorInvoices) {
    const overdueDays = daysBetween(ref, vi.dueDate);
    const amt = vendorInvoiceOutstanding(vi);
    risks.push({
      severity: amt > 300000 || overdueDays > 30 ? "RED" : "AMBER",
      category: "Vendor payment overdue",
      message: `${vi.vendorInvoiceNo} (${vi.vendor.name}) overdue by ${overdueDays} day(s), ${fmtINR(amt)} payable`,
      amount: amt,
      entityType: "vendorInvoice",
      entityId: vi.id,
      link: `/vendors/${vi.vendorId}`,
    });
  }

  for (const vi of vendorInvoices.filter(
    (v) => v.approvalStatus === "PENDING" && v.status !== "CANCELLED"
  )) {
    risks.push({
      severity: "AMBER",
      category: "Vendor invoice pending approval",
      message: `${vi.vendorInvoiceNo} (${vi.vendor.name}) awaiting internal approval, ${fmtINR(
        vendorInvoiceTotal(vi)
      )}`,
      amount: vendorInvoiceTotal(vi),
      entityType: "vendorInvoice",
      entityId: vi.id,
      link: `/vendors/${vi.vendorId}`,
    });
  }

  // PO amount vs invoice amount mismatch (invoiced total exceeds PO value)
  for (const p of pos) {
    const invoiced = p.invoices.reduce((s, i) => s + i.value + i.taxAmount, 0);
    if (invoiced > p.value * 1.02) {
      risks.push({
        severity: "AMBER",
        category: "PO amount and invoice amount mismatch",
        message: `${p.poNo} value ${fmtINR(p.value)} but invoiced total ${fmtINR(invoiced)}`,
        amount: invoiced - p.value,
        entityType: "po",
        entityId: p.id,
      });
    }
  }

  risks.sort((a, b) => {
    const order = { RED: 0, AMBER: 1, GREEN: 2 };
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  // ---------------- Project profitability ----------------
  const projectProfitability = projects.map((p) => {
    const revenue = p.invoices.reduce((s, i) => s + i.value + i.taxAmount, 0);
    const vendorCost = p.vendorCosts.reduce((s, c) => s + c.amount, 0);
    const otherCost = p.otherCosts.reduce((s, c) => s + c.amount, 0);
    const grossProfit = revenue - vendorCost - otherCost;
    const margin = revenue > 0 ? grossProfit / revenue : null;
    return {
      project: p,
      revenue,
      vendorCost,
      otherCost,
      grossProfit,
      margin,
    };
  });

  return {
    ref,
    receivables: {
      totalReceivables,
      totalReceived,
      totalOutstanding,
      overdueCount: overdueInvoices.length,
      overdueAmount: overdueInvoices.reduce((s, i) => s + invoiceOutstanding(i), 0),
      dueWithin7Count: dueWithin7.length,
      dueWithin7Amount: dueWithin7.reduce((s, i) => s + invoiceOutstanding(i), 0),
      dueWithin30Count: dueWithin30.length,
      dueWithin30Amount: dueWithin30.reduce((s, i) => s + invoiceOutstanding(i), 0),
      ageing,
      customerOutstanding,
      overdueInvoices,
    },
    payables: {
      totalPayable,
      totalPaid,
      totalOutstandingPayable,
      overdueCount: overdueVendorInvoices.length,
      overdueAmount: overdueVendorInvoices.reduce((s, v) => s + vendorInvoiceOutstanding(v), 0),
      dueWithin7Count: payableDueWithin7.length,
      dueWithin7Amount: payableDueWithin7.reduce((s, v) => s + vendorInvoiceOutstanding(v), 0),
      dueWithin30Count: payableDueWithin30.length,
      dueWithin30Amount: payableDueWithin30.reduce((s, v) => s + vendorInvoiceOutstanding(v), 0),
      vendorOutstanding,
      overdueVendorInvoices,
    },
    sales: {
      quotationsRaised,
      quotationsAccepted,
      quotationsPending,
      posReceived,
      posPending,
      posWithoutInvoice: posWithoutInvoice.length,
      invoicesRaised,
      invoicesPendingSubmission,
      invoicesUnderCorrection,
      cancelledOrRevised,
    },
    cash: {
      expectedCollections30,
      expectedPayments30,
      expectedNetCash30,
    },
    risks,
    projectProfitability,
  };
}
