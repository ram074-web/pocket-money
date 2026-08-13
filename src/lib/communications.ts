import type { Invoice, Customer, VendorInvoice, Vendor } from "@prisma/client";
import { invoiceOutstanding, vendorInvoiceOutstanding, fmtINR, daysBetween, today } from "@/lib/calc";

export type DraftEmail = { subject: string; body: string };

export function paymentFollowUpEmail(invoice: Invoice, customer: Customer): DraftEmail {
  const outstanding = invoiceOutstanding(invoice);
  const overdueDays = daysBetween(today(), invoice.dueDate);
  const overdueLine =
    overdueDays > 0
      ? `This invoice is now ${overdueDays} day(s) overdue.`
      : `This invoice is due on ${invoice.dueDate.toDateString()}.`;
  return {
    subject: `Payment Reminder — Invoice ${invoice.invoiceNo}`,
    body: `Dear ${customer.contactName ?? customer.name} team,

This is a reminder regarding Invoice ${invoice.invoiceNo} dated ${invoice.invoiceDate.toDateString()} for ${fmtINR(
      invoice.value + invoice.taxAmount
    )}, with an outstanding balance of ${fmtINR(outstanding)}.

${overdueLine}

Kindly confirm the expected payment date at your earliest convenience, or let us know if any information is required from our side to process this payment.

Thank you,
Accounts Receivable Team`,
  };
}

export function invoiceSubmissionEmail(invoice: Invoice, customer: Customer): DraftEmail {
  return {
    subject: `Invoice Submission — ${invoice.invoiceNo}`,
    body: `Dear ${customer.contactName ?? customer.name} team,

Please find attached Invoice ${invoice.invoiceNo} dated ${invoice.invoiceDate.toDateString()} for ${fmtINR(
      invoice.value + invoice.taxAmount
    )}, due on ${invoice.dueDate.toDateString()}.

Please confirm receipt and share the expected processing timeline.

Thank you,
Accounts Team`,
  };
}

export function poFollowUpEmail(customer: Customer, quotationNo: string): DraftEmail {
  return {
    subject: `Follow-up on Purchase Order — Quotation ${quotationNo}`,
    body: `Dear ${customer.contactName ?? customer.name} team,

We are following up on Quotation ${quotationNo}, which was shared for your review. Could you please confirm the status and share the Purchase Order at your earliest convenience so we can proceed with the work?

Thank you,
Sales Team`,
  };
}

export function invoiceCorrectionResponseEmail(
  invoice: Invoice,
  customer: Customer,
  correctionNeeded: string
): DraftEmail {
  return {
    subject: `RE: Correction on Invoice ${invoice.invoiceNo}`,
    body: `Dear ${customer.contactName ?? customer.name} team,

Thank you for flagging the correction required on Invoice ${invoice.invoiceNo}: "${correctionNeeded}".

We are processing this correction and will resubmit the revised invoice shortly. We appreciate your patience.

Thank you,
Accounts Team`,
  };
}

export function vendorPaymentEmail(vendorInvoice: VendorInvoice, vendor: Vendor): DraftEmail {
  const outstanding = vendorInvoiceOutstanding(vendorInvoice);
  return {
    subject: `Payment Update — Invoice ${vendorInvoice.vendorInvoiceNo}`,
    body: `Dear ${vendor.contactName ?? vendor.name} team,

Regarding your Invoice ${vendorInvoice.vendorInvoiceNo} for ${fmtINR(
      vendorInvoice.amount + vendorInvoice.taxAmount
    )}, the outstanding balance is ${fmtINR(outstanding)}.

We will process this payment by ${vendorInvoice.dueDate.toDateString()}. Please let us know if you have any questions.

Thank you,
Accounts Payable Team`,
  };
}

export function internalEscalationEmail(subject: string, details: string, amount?: number): DraftEmail {
  return {
    subject: `Escalation: ${subject}`,
    body: `Hi team,

Flagging for immediate attention: ${details}${amount ? `\n\nAmount involved: ${fmtINR(amount)}` : ""}

Please advise on next steps.

Thanks,
Finance Operations`,
  };
}
