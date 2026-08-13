import { prisma } from "@/lib/db";
import { getDashboardData, invoiceOutstanding, vendorInvoiceOutstanding, fmtINR, isOverdue, today } from "@/lib/calc";
import { canRoleAccess, type Role } from "./permissions";
import { answerQuestion } from "@/lib/query-engine";

export type WhatsAppReply = { authorized: boolean; text: string };

const DENIED = (domain: string): WhatsAppReply => ({
  authorized: false,
  text: `Not authorized. Your role does not have access to ${domain} information. Contact the Owner if you need this.`,
});

async function customerShow(nameFragment: string): Promise<string> {
  const customers = await prisma.customer.findMany();
  const customer = customers.find((c) => c.name.toLowerCase().includes(nameFragment.toLowerCase()));
  if (!customer) return `No customer found matching "${nameFragment}". Data not available.`;

  const [quotations, pos, invoices, communications] = await Promise.all([
    prisma.quotation.findMany({ where: { customerId: customer.id } }),
    prisma.purchaseOrder.findMany({ where: { customerId: customer.id } }),
    prisma.invoice.findMany({ where: { customerId: customer.id } }),
    prisma.communication.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 1 }),
  ]);

  const totalBusiness = invoices.reduce((s, i) => s + i.value + i.taxAmount, 0);
  const paid = invoices.reduce((s, i) => s + i.amountReceived, 0);
  const outstanding = invoices.reduce((s, i) => s + invoiceOutstanding(i), 0);
  const overdue = invoices.filter((i) => isOverdue(i.dueDate)).reduce((s, i) => s + invoiceOutstanding(i), 0);
  const lastComm = communications[0];

  return `*${customer.name}*

Total Business: ${fmtINR(totalBusiness)}
Quotations: ${quotations.length}
POs: ${pos.length}
Invoices: ${invoices.length}
Paid: ${fmtINR(paid)}
Outstanding: ${fmtINR(outstanding)}
Overdue: ${fmtINR(overdue)}
Pending Communication: ${lastComm ? `${lastComm.subject} (${lastComm.createdAt.toDateString()})` : "None on record"}
Next Action: ${overdue > 0 ? "Follow up on overdue balance" : "No action required"}`;
}

async function invoiceStatus(invoiceNo: string): Promise<string> {
  const invoice = await prisma.invoice.findUnique({ where: { invoiceNo }, include: { customer: true } });
  if (!invoice) return `Invoice ${invoiceNo} not found. Data not available.`;
  const outstanding = invoiceOutstanding(invoice);
  return `*${invoice.invoiceNo}* — ${invoice.customer.name}

Status: ${invoice.status.replaceAll("_", " ")}
Submitted: ${invoice.submissionDate ? invoice.submissionDate.toDateString() : "Not yet submitted"}
Payment Due: ${invoice.dueDate.toDateString()}
Amount: ${fmtINR(invoice.value + invoice.taxAmount)}
Paid: ${fmtINR(invoice.amountReceived)}
Outstanding: ${fmtINR(outstanding)}
Next Follow-up: ${outstanding > 0 ? "See My Action List for scheduled follow-up" : "None — settled"}`;
}

async function quotationStatus(quotationNo: string): Promise<string> {
  const quotation = await prisma.quotation.findUnique({
    where: { quotationNo },
    include: { customer: true, purchaseOrders: { include: { invoices: true } } },
  });
  if (!quotation) return `Quotation ${quotationNo} not found. Data not available.`;
  const po = quotation.purchaseOrders[0];
  return `*${quotation.quotationNo}* — ${quotation.customer.name}

Created: ${quotation.quotationDate.toDateString()}
Status: ${quotation.status}
Value: ${fmtINR(quotation.value + quotation.taxAmount - quotation.discount)}
PO Status: ${po ? `${po.poNo} received (${fmtINR(po.value)})` : "No PO received yet"}
Invoiced: ${po && po.invoices.length > 0 ? po.invoices.map((i) => i.invoiceNo).join(", ") : "Not yet invoiced"}`;
}

async function poStatus(poNo: string): Promise<string> {
  const po = await prisma.purchaseOrder.findUnique({ where: { poNo }, include: { customer: true, invoices: true, quotation: true } });
  if (!po) return `PO ${poNo} not found. Data not available.`;
  return `*${po.poNo}* — ${po.customer.name}

Date: ${po.poDate.toDateString()}
Value: ${fmtINR(po.value)}
Status: ${po.status.replaceAll("_", " ")}
Related Quotation: ${po.quotation?.quotationNo ?? "None on record"}
Invoices Raised: ${po.invoices.length > 0 ? po.invoices.map((i) => i.invoiceNo).join(", ") : "None yet"}`;
}

async function dashboardReply(): Promise<string> {
  const d = await getDashboardData();
  const topRisks = d.risks.slice(0, 5);
  return `*BUSINESS DASHBOARD*

*Receivables*
Total Outstanding: ${fmtINR(d.receivables.totalOutstanding)}
Overdue: ${fmtINR(d.receivables.overdueAmount)}
Due This Week: ${fmtINR(d.receivables.dueWithin7Amount)}
Due This Month: ${fmtINR(d.receivables.dueWithin30Amount)}

*Payables*
Total Vendor Payable: ${fmtINR(d.payables.totalOutstandingPayable)}
Overdue: ${fmtINR(d.payables.overdueAmount)}
Due This Week: ${fmtINR(d.payables.dueWithin7Amount)}
Due This Month: ${fmtINR(d.payables.dueWithin30Amount)}

*Sales*
Quotations Pending: ${d.sales.quotationsPending}
POs Pending: ${d.sales.posPending}

*Invoicing*
Invoices Pending Submission: ${d.sales.invoicesPendingSubmission}
Invoices Submitted: ${d.sales.invoicesRaised - d.sales.invoicesPendingSubmission}
Under Correction: ${d.sales.invoicesUnderCorrection}
Overdue: ${d.receivables.overdueCount}

*Cash Flow*
Expected Collections (30d): ${fmtINR(d.cash.expectedCollections30)}
Expected Payments (30d): ${fmtINR(d.cash.expectedPayments30)}
Net Expected Movement: ${fmtINR(d.cash.expectedNetCash30)}

*Critical Actions*
${topRisks.length === 0 ? "None" : topRisks.map((r, i) => `${i + 1}. ${r.message}`).join("\n")}`;
}

async function morningReport(): Promise<string> {
  const d = await getDashboardData();
  const topRisks = d.risks.filter((r) => r.severity === "RED").slice(0, 3);
  const topFollowUps = await prisma.followUp.findMany({
    where: { status: "PENDING" },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
    take: 3,
  });
  return `*GOOD MORNING — BUSINESS CONTROL REPORT*

Money to Receive: ${fmtINR(d.receivables.totalOutstanding)}
Money to Pay: ${fmtINR(d.payables.totalOutstandingPayable)}
Overdue Customer Payments: ${d.receivables.overdueCount} invoice(s) / ${fmtINR(d.receivables.overdueAmount)}
Invoices Pending: ${d.sales.invoicesPendingSubmission}
Invoice Corrections: ${d.sales.invoicesUnderCorrection}
Quotations Awaiting Response: ${d.sales.quotationsPending}
POs Awaiting Action: ${d.sales.posPending}
Vendor Payments Pending: ${d.payables.overdueCount}

*Critical Issues*
${topRisks.length === 0 ? "None" : topRisks.map((r, i) => `${i + 1}. ${r.message}`).join("\n")}

*Today's Priorities*
${topFollowUps.length === 0 ? "None" : topFollowUps.map((f, i) => `${i + 1}. ${f.title}`).join("\n")}`;
}

async function eveningReport(): Promise<string> {
  const start = new Date(today());
  start.setHours(0, 0, 0, 0);
  const [quotationsToday, posToday, invoicesToday, paymentsToday, vendorPaymentsToday, pendingFollowUps] = await Promise.all([
    prisma.quotation.count({ where: { createdAt: { gte: start } } }),
    prisma.purchaseOrder.count({ where: { createdAt: { gte: start } } }),
    prisma.invoice.count({ where: { createdAt: { gte: start } } }),
    prisma.payment.findMany({ where: { createdAt: { gte: start } } }),
    prisma.vendorPayment.findMany({ where: { createdAt: { gte: start } } }),
    prisma.followUp.count({ where: { status: "PENDING" } }),
  ]);
  const invoicesSubmittedToday = await prisma.invoice.count({ where: { submissionDate: { gte: start } } });

  return `*END-OF-DAY BUSINESS REPORT*

Quotations Sent Today: ${quotationsToday}
POs Received Today: ${posToday}
Invoices Created Today: ${invoicesToday}
Invoices Submitted Today: ${invoicesSubmittedToday}
Payments Received Today: ${paymentsToday.length} (${fmtINR(paymentsToday.reduce((s, p) => s + p.amount, 0))})
Vendor Payments Made Today: ${vendorPaymentsToday.length} (${fmtINR(vendorPaymentsToday.reduce((s, p) => s + p.amount, 0))})
Pending Tasks: ${pendingFollowUps}

*Tomorrow's Priorities*
Review My Action List for the next due items.`;
}

export async function handleWhatsAppCommand(rawText: string, role: Role): Promise<WhatsAppReply> {
  const text = rawText.trim();
  const q = text.toLowerCase();

  if (/^dashboard$/i.test(q)) {
    if (!canRoleAccess(role, "dashboard")) return DENIED("dashboard");
    return { authorized: true, text: await dashboardReply() };
  }

  if (/morning report|good morning/i.test(q)) {
    if (!canRoleAccess(role, "dashboard")) return DENIED("dashboard");
    return { authorized: true, text: await morningReport() };
  }

  if (/evening report|end.of.day/i.test(q)) {
    if (!canRoleAccess(role, "dashboard")) return DENIED("dashboard");
    return { authorized: true, text: await eveningReport() };
  }

  const invoiceMatch = text.match(/INV-[A-Z0-9-]+/i);
  if (invoiceMatch && /status|paid|outstanding|invoice/.test(q)) {
    if (!canRoleAccess(role, "invoices")) return DENIED("invoices");
    return { authorized: true, text: await invoiceStatus(invoiceMatch[0].toUpperCase()) };
  }

  const quotationMatch = text.match(/QT-[A-Z0-9-]+|Q-\d+/i);
  if (quotationMatch && /quotation|status/.test(q)) {
    if (!canRoleAccess(role, "quotations")) return DENIED("quotations");
    const no = quotationMatch[0].toUpperCase();
    const resolved = no.startsWith("QT-") ? no : (await prisma.quotation.findFirst({ where: { quotationNo: { contains: no } } }))?.quotationNo ?? no;
    return { authorized: true, text: await quotationStatus(resolved) };
  }

  const poMatch = text.match(/PO-[A-Z0-9-]+/i);
  if (poMatch && /po |status|purchase order/.test(q)) {
    if (!canRoleAccess(role, "pos")) return DENIED("pos");
    return { authorized: true, text: await poStatus(poMatch[0].toUpperCase()) };
  }

  const showMatch = text.match(/^show\s+(.+?)\.?$/i);
  if (showMatch) {
    if (!canRoleAccess(role, "customers")) return DENIED("customers");
    return { authorized: true, text: await customerShow(showMatch[1]) };
  }

  if (/owe suppliers|owe vendors|pay suppliers|vendor payments? (pending|overdue)|how much do we owe/.test(q)) {
    if (!canRoleAccess(role, "payables")) return DENIED("payables");
  } else if (/owe us|outstanding|overdue invoices|customers.*owe/.test(q)) {
    if (!canRoleAccess(role, "receivables")) return DENIED("receivables");
  }

  const generic = await answerQuestion(text);
  const lines = [
    `*${generic.executiveSummary}*`,
    ...(generic.financialImpact.length ? ["", "Financial Impact:", ...generic.financialImpact.map((l) => `- ${l}`)] : []),
    ...(generic.pendingItems.length ? ["", "Pending:", ...generic.pendingItems.slice(0, 8).map((l) => `- ${l}`)] : []),
    ...(generic.risks.length ? ["", "Risks:", ...generic.risks.slice(0, 5).map((l) => `- ${l}`)] : []),
    ...(generic.nextActions.length ? ["", "Next Actions:", ...generic.nextActions.map((l) => `- ${l}`)] : []),
  ];
  return { authorized: true, text: lines.join("\n") };
}

export async function vendorOutstandingText(vendorNameFragment: string): Promise<string> {
  const vendors = await prisma.vendor.findMany({ include: { vendorInvoices: true } });
  const vendor = vendors.find((v) => v.name.toLowerCase().includes(vendorNameFragment.toLowerCase()));
  if (!vendor) return `No vendor found matching "${vendorNameFragment}". Data not available.`;
  const outstanding = vendor.vendorInvoices.reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
  const overdue = vendor.vendorInvoices.filter((vi) => isOverdue(vi.dueDate)).reduce((s, vi) => s + vendorInvoiceOutstanding(vi), 0);
  const nextDue = vendor.vendorInvoices
    .filter((vi) => vendorInvoiceOutstanding(vi) > 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
  return `*${vendor.name}*

Total Vendor Invoices: ${vendor.vendorInvoices.length}
Paid: ${fmtINR(vendor.vendorInvoices.reduce((s, vi) => s + vi.amountPaid, 0))}
Pending: ${fmtINR(outstanding)}
Overdue: ${fmtINR(overdue)}
Next Payment Due: ${nextDue ? `${nextDue.vendorInvoiceNo} on ${nextDue.dueDate.toDateString()}` : "None pending"}`;
}
