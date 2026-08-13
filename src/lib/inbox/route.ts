import { MessageCategory } from "@prisma/client";

export type RoutingRule = {
  roles: string[];
  action: string;
};

// Predefined routing table (spec section 5). The engine never improvises a
// recipient list — every category maps to a fixed set of roles, plus Owner +
// Finance get added automatically for anything above the high-value
// threshold (see addHighValueEscalation below).
export const ROUTING_RULES: Record<MessageCategory, RoutingRule> = {
  CUSTOMER_QUOTATION_REQUEST: { roles: ["Sales/Business Development", "Responsible Employee"], action: "Prepare quotation draft" },
  CUSTOMER_PO: { roles: ["Accounts", "Operations", "Responsible Manager"], action: "Verify PO against quotation, prepare invoice" },
  PO_AMENDMENT: { roles: ["Accounts", "Operations", "Responsible Manager"], action: "Re-verify PO against quotation" },
  INVOICE_SUBMISSION_INSTRUCTION: { roles: ["Accounts"], action: "Follow submission instructions" },
  INVOICE_REJECTION: { roles: ["Accounts", "Responsible Employee", "Project Manager"], action: "Investigate rejection reason and respond" },
  INVOICE_CORRECTION_REQUEST: { roles: ["Accounts", "Responsible Employee", "Project Manager"], action: "Correct and resubmit invoice" },
  PAYMENT_CONFIRMATION: { roles: ["Accounts", "Owner"], action: "Verify and reconcile payment" },
  PAYMENT_FOLLOWUP: { roles: ["Accounts"], action: "Log commitment and schedule next follow-up" },
  VENDOR_QUOTATION: { roles: ["Procurement", "Responsible Employee"], action: "Review vendor quotation" },
  VENDOR_INVOICE: { roles: ["Accounts Payable", "Responsible Employee"], action: "Verify vendor invoice against PO and approve" },
  VENDOR_PAYMENT_REQUEST: { roles: ["Accounts Payable"], action: "Check payable status and respond" },
  CUSTOMER_COMPLAINT: { roles: ["Owner", "Responsible Employee", "Project Manager"], action: "Investigate and respond to customer" },
  PROJECT_INSTRUCTION: { roles: ["Operations", "Responsible Employee"], action: "Update project/work status" },
  OTHER: { roles: ["Responsible Employee"], action: "Manual review — could not classify automatically" },
};

export const HIGH_VALUE_THRESHOLD = 500000;

export function routeMessage(category: MessageCategory, financialImpact: number | null): RoutingRule {
  const base = ROUTING_RULES[category];
  if (financialImpact != null && financialImpact >= HIGH_VALUE_THRESHOLD) {
    return { roles: [...new Set([...base.roles, "Owner", "Finance"])], action: base.action };
  }
  return base;
}
