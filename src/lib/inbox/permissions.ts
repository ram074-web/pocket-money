import { MessageCategory } from "@prisma/client";

// -----------------------------------------------------------------------
// Section 16: Human approval & financial controls.
// -----------------------------------------------------------------------

export const AUTOMATICALLY_ALLOWED_ACTIONS = [
  "Reading messages",
  "Classifying messages",
  "Extracting PO/invoice/quotation information",
  "Updating internal records",
  "Creating drafts (quotations, invoices, emails, WhatsApp messages)",
  "Preparing reports",
  "Sending internal notifications",
  "Creating follow-up reminders",
] as const;

export const APPROVAL_REQUIRED_ACTIONS = [
  "Issuing an invoice",
  "Sending an external quotation",
  "Changing invoice values",
  "Approving vendor payments",
  "Making financial commitments",
  "Sending sensitive financial information externally",
  "Issuing credit notes",
  "Cancelling invoices",
] as const;

// The externally-facing action each inbound category ultimately leads to,
// and whether that action is auto-allowed or requires human approval. The
// *processing* of every message (classify/extract/match/draft) is always
// auto-allowed — this table is specifically about what happens with the
// resulting draft.
export const CATEGORY_EXTERNAL_ACTION: Record<MessageCategory, { action: string; approvalRequired: boolean }> = {
  CUSTOMER_QUOTATION_REQUEST: { action: "Send quotation to customer", approvalRequired: true },
  CUSTOMER_PO: { action: "Issue invoice to customer", approvalRequired: true },
  PO_AMENDMENT: { action: "Issue revised invoice to customer", approvalRequired: true },
  INVOICE_SUBMISSION_INSTRUCTION: { action: "Resubmit invoice per instructions", approvalRequired: true },
  INVOICE_REJECTION: { action: "Respond to customer on rejection", approvalRequired: true },
  INVOICE_CORRECTION_REQUEST: { action: "Send corrected invoice to customer", approvalRequired: true },
  PAYMENT_CONFIRMATION: { action: "Reconcile payment against invoice", approvalRequired: false },
  PAYMENT_FOLLOWUP: { action: "Acknowledge and log payment commitment", approvalRequired: false },
  VENDOR_QUOTATION: { action: "Approve vendor quotation / issue PO", approvalRequired: true },
  VENDOR_INVOICE: { action: "Approve vendor invoice for payment", approvalRequired: true },
  VENDOR_PAYMENT_REQUEST: { action: "Release vendor payment", approvalRequired: true },
  CUSTOMER_COMPLAINT: { action: "Send response to customer complaint", approvalRequired: true },
  PROJECT_INSTRUCTION: { action: "Update project status internally", approvalRequired: false },
  OTHER: { action: "Manual triage", approvalRequired: true },
};

// -----------------------------------------------------------------------
// Section 17: Security & role-based access.
// -----------------------------------------------------------------------

export type Role = "Owner" | "Finance Manager" | "Sales" | "Operations" | "Accounts Executive";

export const ROLES: Role[] = ["Owner", "Finance Manager", "Sales", "Operations", "Accounts Executive"];

export type DataDomain = "receivables" | "payables" | "invoices" | "payments" | "customers" | "quotations" | "pos" | "projects" | "vendorInvoices" | "dashboard";

const ROLE_PERMISSIONS: Record<Role, DataDomain[] | "ALL"> = {
  Owner: "ALL",
  "Finance Manager": ["receivables", "payables", "invoices", "payments", "dashboard"],
  Sales: ["customers", "quotations", "pos"],
  Operations: ["projects", "pos"],
  "Accounts Executive": ["invoices", "payments", "vendorInvoices", "receivables"],
};

export function canRoleAccess(role: Role, domain: DataDomain): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed === "ALL" || allowed.includes(domain);
}

export function domainsForRole(role: Role): DataDomain[] | "ALL" {
  return ROLE_PERMISSIONS[role];
}
