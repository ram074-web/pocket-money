import { prisma } from "@/lib/db";
import { MessageCategory, MatchResult, ProcessingStatus, ApprovalRequirement, InvoiceStatus, VendorInvoiceStatus, ApprovalStatus, RiskSeverity } from "@prisma/client";
import { daysBetween, fmtINR, today } from "@/lib/calc";
import type { IncomingMessage } from "./types";
import { identifyParty } from "./identify";
import { classifyMessage } from "./classify";
import { extractFields } from "./extract";
import { matchPoAgainstQuotation, matchVendorInvoiceAgainstPo } from "./match";
import { routeMessage } from "./route";
import { CATEGORY_EXTERNAL_ACTION } from "./permissions";
import {
  newPoReceivedMessage,
  invoiceCreatedMessage,
  poRequiresVerificationMessage,
  vendorInvoiceFlaggedMessage,
  paymentReminderMessage,
} from "./whatsapp-templates";

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function nextInvoiceNo(): string {
  return `INV-${Date.now().toString().slice(-8)}`;
}

export type ProcessResult = {
  inboundMessageId: string;
  category: MessageCategory;
  confidence: number;
  classificationReasons: string[];
  party: { type: string; id?: string; name?: string; matchedOn?: string };
  matchResult: MatchResult;
  matchReasons: string[];
  extracted: Record<string, unknown>;
  requiredAction: string;
  responsibleRoles: string[];
  financialImpact: number | null;
  approvalRequired: boolean;
  approvalAction: string;
  databaseUpdates: string[];
  whatsappDraft: string | null;
};

export async function processInboundMessage(msg: IncomingMessage): Promise<ProcessResult> {
  const party = await identifyParty(msg.fromAddress, msg.body);
  const classification = classifyMessage({ subject: msg.subject, body: msg.body }, party);
  const extracted = extractFields(msg.body);

  let matchResult: MatchResult = MatchResult.NOT_APPLICABLE;
  let matchReasons: string[] = [];
  let quotationId: string | undefined;
  let purchaseOrderId: string | undefined;
  let invoiceId: string | undefined;
  let vendorInvoiceId: string | undefined;
  let financialImpact: number | null = null;
  const databaseUpdates: string[] = [];
  let requiredAction = CATEGORY_EXTERNAL_ACTION[classification.category].action;
  let whatsappDraft: string | null = null;

  const customerId = party.type === "customer" ? party.id : undefined;
  const vendorId = party.type === "vendor" ? party.id : undefined;

  switch (classification.category) {
    case MessageCategory.CUSTOMER_PO:
    case MessageCategory.PO_AMENDMENT: {
      financialImpact = (extracted.poValue as number) ?? null;
      if (!customerId) {
        matchResult = MatchResult.NO_MATCH_FOUND;
        matchReasons = ["Sender could not be identified as a known customer — cannot verify PO."];
        requiredAction = "Identify sender and manually verify PO";
        break;
      }
      const outcome = await matchPoAgainstQuotation(customerId, extracted);
      matchResult = outcome.result;
      matchReasons = outcome.reasons;
      quotationId = outcome.quotationId;

      const poNo = (extracted.poNo as string) ?? `PO-UNKNOWN-${Date.now().toString().slice(-6)}`;
      const poDate = parseDate(extracted.poDate) ?? msg.receivedAt;
      let po = await prisma.purchaseOrder.findUnique({ where: { poNo } });
      if (!po) {
        po = await prisma.purchaseOrder.create({
          data: {
            poNo,
            poDate,
            customerId,
            quotationId,
            value: (extracted.poValue as number) ?? 0,
            status: "RECEIVED",
          },
        });
        databaseUpdates.push(`Created PurchaseOrder ${po.poNo} for customer.`);
      } else {
        databaseUpdates.push(`Matched existing PurchaseOrder ${po.poNo}.`);
      }
      purchaseOrderId = po.id;

      if (matchResult === MatchResult.VERIFIED && quotationId) {
        const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
        if (quotation) {
          const invoiceNo = nextInvoiceNo();
          const dueDate = parseDate(extracted.dueDate) ?? new Date(poDate.getTime() + 30 * 86400000);
          const invoice = await prisma.invoice.create({
            data: {
              invoiceNo,
              invoiceDate: today(),
              customerId,
              projectId: quotation.projectId,
              purchaseOrderId: po.id,
              division: quotation.division,
              value: quotation.value - quotation.discount,
              taxAmount: quotation.taxAmount,
              dueDate,
              status: InvoiceStatus.DRAFT,
              employeeId: quotation.employeeId,
            },
          });
          invoiceId = invoice.id;
          databaseUpdates.push(`Created draft Invoice ${invoice.invoiceNo} (status DRAFT — awaiting approval to issue).`);
          requiredAction = "Review and approve draft invoice for issuance";
          whatsappDraft = invoiceCreatedMessage({
            customerName: party.name ?? "Customer",
            invoiceNo: invoice.invoiceNo,
            poNo: po.poNo,
            amount: invoice.value + invoice.taxAmount,
            status: "Draft — ready for review",
          });
        }
      } else {
        whatsappDraft = poRequiresVerificationMessage({
          customerName: party.name ?? "Unknown sender",
          poNo: po.poNo,
          reasons: matchReasons,
        });
      }

      if (!whatsappDraft) {
        whatsappDraft = newPoReceivedMessage({
          customerName: party.name ?? "Unknown sender",
          poNo: po.poNo,
          value: po.value,
          quotationNo: (extracted.quotationNo as string) ?? undefined,
          status: matchResult,
          nextAction: requiredAction,
        });
      }
      break;
    }

    case MessageCategory.INVOICE_CORRECTION_REQUEST:
    case MessageCategory.INVOICE_REJECTION: {
      const invoiceNo = extracted.invoiceNo as string | undefined;
      const invoice = invoiceNo ? await prisma.invoice.findUnique({ where: { invoiceNo }, include: { customer: true } }) : null;
      if (!invoice) {
        matchResult = MatchResult.NO_MATCH_FOUND;
        matchReasons = [invoiceNo ? `Invoice ${invoiceNo} not found.` : "No invoice number found in message."];
        requiredAction = "Manually locate the invoice referenced";
        break;
      }
      matchResult = MatchResult.VERIFIED;
      matchReasons = [`Matched invoice ${invoice.invoiceNo}.`];
      invoiceId = invoice.id;
      financialImpact = invoice.value + invoice.taxAmount;

      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: InvoiceStatus.CORRECTION_REQUIRED } });
      const correction = await prisma.invoiceCorrection.create({
        data: {
          invoiceId: invoice.id,
          correctionNeeded: (extracted.correctionNeeded as string) ?? msg.body.slice(0, 300),
          requestedBy: party.name ?? msg.fromName ?? msg.fromAddress,
          requestedDate: msg.receivedAt,
          status: "Open",
        },
      });
      databaseUpdates.push(`Invoice ${invoice.invoiceNo} status set to CORRECTION_REQUIRED; correction record ${correction.id} logged.`);
      requiredAction = "Correct and resubmit the invoice";
      whatsappDraft = `*Invoice Correction Requested*\n\nCustomer: ${invoice.customer.name}\nInvoice: ${invoice.invoiceNo}\nIssue: ${correction.correctionNeeded}\nAction Required: Correct and resubmit`;
      break;
    }

    case MessageCategory.PAYMENT_CONFIRMATION: {
      const invoiceNo = extracted.invoiceNo as string | undefined;
      const invoice = invoiceNo ? await prisma.invoice.findUnique({ where: { invoiceNo }, include: { customer: true } }) : null;
      if (!invoice) {
        matchResult = MatchResult.NO_MATCH_FOUND;
        matchReasons = [invoiceNo ? `Invoice ${invoiceNo} not found.` : "No invoice number found in message — cannot reconcile."];
        requiredAction = "Manually identify which invoice this payment applies to";
        break;
      }
      matchResult = MatchResult.VERIFIED;
      invoiceId = invoice.id;
      const amount = (extracted.paidAmount as number) ?? (extracted.amount as number) ?? null;
      financialImpact = amount;
      if (amount == null) {
        matchReasons = ["Invoice matched, but no payment amount could be extracted — cannot record payment automatically."];
        requiredAction = "Manually verify amount and record payment";
        break;
      }
      matchReasons = [`Matched invoice ${invoice.invoiceNo}.`];
      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          paymentDate: parseDate(extracted.paymentDate) ?? msg.receivedAt,
          reference: (extracted.utr as string) ?? undefined,
          reconciled: false,
        },
      });
      const newReceived = invoice.amountReceived + amount;
      const total = invoice.value + invoice.taxAmount;
      const newStatus = newReceived >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      await prisma.invoice.update({ where: { id: invoice.id }, data: { amountReceived: newReceived, status: newStatus } });
      databaseUpdates.push(
        `Recorded unreconciled Payment ${payment.id} of ${fmtINR(amount)} against ${invoice.invoiceNo}; invoice status set to ${newStatus}. Marked "pending reconciliation" — a human must confirm against the bank statement.`
      );
      requiredAction = "Reconcile reported payment against bank statement";
      whatsappDraft = `*Payment Reported*\n\nCustomer: ${invoice.customer.name}\nInvoice: ${invoice.invoiceNo}\nAmount: ${fmtINR(amount)}${extracted.utr ? `\nReference: ${extracted.utr}` : ""}\nStatus: Pending reconciliation\nAction Required: Confirm against bank statement`;
      break;
    }

    case MessageCategory.PAYMENT_FOLLOWUP: {
      const invoiceNo = extracted.invoiceNo as string | undefined;
      const invoice = invoiceNo
        ? await prisma.invoice.findUnique({ where: { invoiceNo }, include: { customer: true } })
        : customerId
          ? await prisma.invoice.findFirst({ where: { customerId, status: { in: ["OVERDUE", "SUBMITTED", "PARTIALLY_PAID"] } }, orderBy: { dueDate: "asc" }, include: { customer: true } })
          : null;
      if (!invoice) {
        matchResult = MatchResult.NO_MATCH_FOUND;
        matchReasons = ["Could not identify which invoice this follow-up relates to."];
        break;
      }
      matchResult = MatchResult.VERIFIED;
      invoiceId = invoice.id;
      financialImpact = invoice.value + invoice.taxAmount - invoice.amountReceived;
      matchReasons = [`Matched invoice ${invoice.invoiceNo}.`];
      const followUp = await prisma.followUp.create({
        data: {
          direction: "CUSTOMER",
          title: `Customer commitment on ${invoice.invoiceNo}`,
          details: (extracted.promisedDate as string)
            ? `Customer indicated payment by ${extracted.promisedDate}.`
            : "Customer followed up regarding payment timing.",
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          amount: financialImpact,
          dueDate: parseDate(extracted.promisedDate) ?? new Date(today().getTime() + 3 * 86400000),
          priority: RiskSeverity.AMBER,
          nextAction: "Confirm commitment date and follow up if missed",
        },
      });
      databaseUpdates.push(`Logged FollowUp ${followUp.id} recording the customer's payment commitment.`);
      requiredAction = "Acknowledge commitment; follow up if the promised date passes";
      whatsappDraft = paymentReminderMessage({
        customerName: invoice.customer.name,
        invoiceNo: invoice.invoiceNo,
        outstanding: financialImpact,
        dueDate: invoice.dueDate.toDateString(),
        daysOverdue: Math.max(0, daysBetween(today(), invoice.dueDate)),
      });
      break;
    }

    case MessageCategory.VENDOR_INVOICE: {
      financialImpact = (extracted.amount as number) ?? null;
      if (!vendorId) {
        matchResult = MatchResult.NO_MATCH_FOUND;
        matchReasons = ["Sender could not be identified as a known vendor."];
        break;
      }
      const outcome = await matchVendorInvoiceAgainstPo(vendorId, extracted);
      matchResult = outcome.result;
      matchReasons = outcome.reasons;

      const vendorInvoiceNo = (extracted.vendorInvoiceNo as string) ?? (extracted.invoiceNo as string) ?? `VIN-UNKNOWN-${Date.now().toString().slice(-6)}`;
      const existing = await prisma.vendorInvoice.findUnique({ where: { vendorId_vendorInvoiceNo: { vendorId, vendorInvoiceNo } } });
      if (existing) {
        matchReasons.push("Duplicate: this vendor invoice number already exists in the system.");
        vendorInvoiceId = existing.id;
        requiredAction = "Possible duplicate — verify before processing";
        break;
      }

      const vi = await prisma.vendorInvoice.create({
        data: {
          vendorInvoiceNo,
          invoiceDate: parseDate(extracted.invoiceDate) ?? msg.receivedAt,
          vendorId,
          vendorPoId: outcome.vendorPoId,
          amount: (extracted.amount as number) ?? 0,
          taxAmount: (extracted.taxAmount as number) ?? 0,
          dueDate: parseDate(extracted.dueDate) ?? new Date(msg.receivedAt.getTime() + 30 * 86400000),
          status: outcome.vendorPoId ? VendorInvoiceStatus.UNDER_VERIFICATION : VendorInvoiceStatus.RECEIVED,
          approvalStatus: ApprovalStatus.PENDING,
          notes: outcome.vendorPoId ? undefined : `Flagged: ${matchReasons.join(" ")}`,
        },
      });
      vendorInvoiceId = vi.id;
      databaseUpdates.push(`Created VendorInvoice ${vi.vendorInvoiceNo} (approval pending)${outcome.vendorPoId ? ` linked to PO.` : `, flagged — no PO matched.`}`);
      requiredAction = "Verify and approve vendor invoice for payment";
      whatsappDraft =
        matchResult === MatchResult.VERIFIED
          ? vendorInvoiceFlaggedMessage({ vendorName: party.name ?? "Vendor", invoiceNo: vi.vendorInvoiceNo, reasons: ["Matched to PO — pending approval."] })
          : vendorInvoiceFlaggedMessage({ vendorName: party.name ?? "Vendor", invoiceNo: vi.vendorInvoiceNo, reasons: matchReasons });
      break;
    }

    case MessageCategory.VENDOR_PAYMENT_REQUEST: {
      const vendorInvoiceNo = extracted.vendorInvoiceNo as string | undefined;
      const vi = vendorId && vendorInvoiceNo
        ? await prisma.vendorInvoice.findUnique({ where: { vendorId_vendorInvoiceNo: { vendorId, vendorInvoiceNo } }, include: { vendor: true } })
        : vendorId
          ? await prisma.vendorInvoice.findFirst({ where: { vendorId }, orderBy: { dueDate: "asc" }, include: { vendor: true } })
          : null;
      if (!vi) {
        matchResult = MatchResult.NO_MATCH_FOUND;
        matchReasons = ["Could not identify which vendor invoice this request relates to."];
        break;
      }
      matchResult = MatchResult.VERIFIED;
      vendorInvoiceId = vi.id;
      financialImpact = vi.amount + vi.taxAmount - vi.amountPaid;
      matchReasons = [`Matched vendor invoice ${vi.vendorInvoiceNo}.`];
      requiredAction = "Confirm payment schedule to vendor";
      whatsappDraft = `*Vendor Payment Status*\n\nVendor: ${vi.vendor.name}\nInvoice: ${vi.vendorInvoiceNo}\nOutstanding: ${fmtINR(financialImpact)}\nApproval: ${vi.approvalStatus}\nStatus: ${vi.status}`;
      break;
    }

    case MessageCategory.CUSTOMER_QUOTATION_REQUEST: {
      financialImpact = null;
      matchResult = MatchResult.NOT_APPLICABLE;
      matchReasons = customerId ? [`Identified customer ${party.name}.`] : ["Sender not matched to an existing customer — treat as a new lead."];
      databaseUpdates.push("No quotation record created automatically — drafting is allowed, but commercial terms need review before a quotation number is issued.");
      requiredAction = "Prepare quotation draft for review";
      whatsappDraft = `*New Quotation Request*\n\nFrom: ${party.name ?? msg.fromAddress}\nRequirement: ${(extracted.requirement as string) ?? "See email for details"}\nAction Required: Prepare and review quotation draft`;
      break;
    }

    case MessageCategory.VENDOR_QUOTATION: {
      matchResult = MatchResult.NOT_APPLICABLE;
      matchReasons = vendorId ? [`Identified vendor ${party.name}.`] : ["Sender not matched to an existing vendor."];
      requiredAction = "Review vendor pricing";
      whatsappDraft = `*Vendor Quotation Received*\n\nFrom: ${party.name ?? msg.fromAddress}\nAction Required: Review pricing and terms`;
      break;
    }

    case MessageCategory.CUSTOMER_COMPLAINT: {
      matchResult = MatchResult.NOT_APPLICABLE;
      matchReasons = [];
      if (customerId) {
        const followUp = await prisma.followUp.create({
          data: {
            direction: "CUSTOMER",
            title: "Customer complaint requires response",
            details: msg.body.slice(0, 300),
            customerId,
            dueDate: today(),
            priority: RiskSeverity.RED,
            nextAction: "Owner/account manager to respond directly",
          },
        });
        databaseUpdates.push(`Logged FollowUp ${followUp.id} (RED priority) for complaint response.`);
      }
      requiredAction = "Respond to customer directly";
      whatsappDraft = `*Customer Complaint*\n\nFrom: ${party.name ?? msg.fromAddress}\nAction Required: Immediate response needed`;
      break;
    }

    default: {
      matchResult = MatchResult.NOT_APPLICABLE;
      matchReasons = [];
      requiredAction = CATEGORY_EXTERNAL_ACTION[classification.category].action;
    }
  }

  const routing = routeMessage(classification.category, financialImpact);
  const approval = CATEGORY_EXTERNAL_ACTION[classification.category];

  // Always log the raw message against whichever party/records were found —
  // this is what makes it show up in the existing Customer/Vendor 360 views.
  const communication = await prisma.communication.create({
    data: {
      direction: "INBOUND",
      channel: msg.channel === "EMAIL" ? "email" : "whatsapp",
      subject: msg.subject ?? "(no subject)",
      body: msg.body,
      customerId,
      vendorId,
      invoiceId,
      vendorInvoiceId,
      sentBy: msg.fromName ?? msg.fromAddress,
      approved: true,
    },
  });
  databaseUpdates.push(`Logged inbound Communication ${communication.id}.`);

  const inbound = await prisma.inboundMessage.create({
    data: {
      channel: msg.channel,
      source: msg.source,
      fromAddress: msg.fromAddress,
      fromName: msg.fromName,
      toAddress: msg.toAddress,
      subject: msg.subject,
      body: msg.body,
      receivedAt: msg.receivedAt,
      category: classification.category,
      classificationReasons: JSON.stringify(classification.reasons),
      matchResult,
      matchReasons: JSON.stringify(matchReasons),
      status: ProcessingStatus.ACTION_DRAFTED,
      approvalRequirement: approval.approvalRequired ? ApprovalRequirement.APPROVAL_REQUIRED : ApprovalRequirement.AUTO_ALLOWED,
      customerId,
      vendorId,
      quotationId,
      purchaseOrderId,
      invoiceId,
      vendorInvoiceId,
      extractedData: JSON.stringify(extracted),
      requiredAction,
      responsibleRole: routing.roles.join(", "),
      financialImpact,
      databaseUpdateSummary: databaseUpdates.join(" "),
    },
  });

  await prisma.routingLogEntry.create({
    data: {
      inboundMessageId: inbound.id,
      classification: classification.category,
      routedTo: routing.roles.join(", "),
      action: requiredAction,
      status: "Routed",
    },
  });

  if (whatsappDraft) {
    await prisma.whatsAppDraft.create({
      data: {
        inboundMessageId: inbound.id,
        toRole: routing.roles.join(", "),
        template: classification.category,
        messageText: whatsappDraft,
        relatedCustomerId: customerId,
        relatedVendorId: vendorId,
        status: "Draft",
      },
    });
  }

  return {
    inboundMessageId: inbound.id,
    category: classification.category,
    confidence: classification.confidence,
    classificationReasons: classification.reasons,
    party,
    matchResult,
    matchReasons,
    extracted,
    requiredAction,
    responsibleRoles: routing.roles,
    financialImpact,
    approvalRequired: approval.approvalRequired,
    approvalAction: approval.action,
    databaseUpdates,
    whatsappDraft,
  };
}
