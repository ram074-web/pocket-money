import { fmtINR } from "@/lib/calc";

// WhatsApp message bodies, formatted with WhatsApp's own markdown
// (*bold*, not Markdown **bold**). These are always drafts — see
// permissions.ts: nothing here is ever transmitted automatically.

export function newPoReceivedMessage(args: {
  customerName: string;
  poNo: string;
  value: number;
  quotationNo?: string;
  status: string;
  nextAction: string;
}): string {
  return `*New PO Received*

Customer: ${args.customerName}
PO: ${args.poNo}
Value: ${fmtINR(args.value)}${args.quotationNo ? `\nRelated Quotation: ${args.quotationNo}` : ""}
Status: ${args.status}
Next Action: ${args.nextAction}`;
}

export function invoiceCreatedMessage(args: {
  customerName: string;
  invoiceNo: string;
  poNo?: string;
  amount: number;
  status: string;
}): string {
  return `*Invoice Created*

Customer: ${args.customerName}
Invoice: ${args.invoiceNo}${args.poNo ? `\nPO: ${args.poNo}` : ""}
Amount: ${fmtINR(args.amount)}
Status: ${args.status}`;
}

export function paymentOverdueMessage(args: {
  customerName: string;
  invoiceNo: string;
  outstanding: number;
  dueDate: string;
  daysOverdue: number;
}): string {
  return `*Payment Overdue*

Customer: ${args.customerName}
Invoice: ${args.invoiceNo}
Outstanding: ${fmtINR(args.outstanding)}
Due Date: ${args.dueDate}
Days Overdue: ${args.daysOverdue}
Action Required: Payment Follow-up`;
}

export function vendorPaymentPendingMessage(args: {
  vendorName: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
  status: string;
}): string {
  return `*Vendor Payment Pending*

Vendor: ${args.vendorName}
Invoice: ${args.invoiceNo}
Amount: ${fmtINR(args.amount)}
Due Date: ${args.dueDate}
Status: ${args.status}`;
}

export function paymentReminderMessage(args: { customerName: string; invoiceNo: string; outstanding: number; dueDate: string; daysOverdue: number }): string {
  const overdueLine =
    args.daysOverdue > 0
      ? `The invoice is now ${args.daysOverdue} day(s) overdue.`
      : `Payment was due on ${args.dueDate}.`;
  return `${args.customerName} has ${fmtINR(args.outstanding)} outstanding against ${args.invoiceNo}. ${overdueLine} No payment confirmation has been recorded.`;
}

export function poRequiresVerificationMessage(args: { customerName: string; poNo: string; reasons: string[] }): string {
  return `*PO Requires Verification*

Customer: ${args.customerName}
PO: ${args.poNo}
Reason(s): ${args.reasons.join("; ")}
Action Required: Manual verification before invoicing`;
}

export function vendorInvoiceFlaggedMessage(args: { vendorName: string; invoiceNo: string; reasons: string[] }): string {
  return `*Vendor Invoice Requires Review*

Vendor: ${args.vendorName}
Invoice: ${args.invoiceNo}
Reason(s): ${args.reasons.join("; ")}
Action Required: Verify before approval`;
}
