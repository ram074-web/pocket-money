"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { canRoleAccess, type DataDomain } from "@/lib/inbox/permissions";
import { Prisma } from "@prisma/client";

// Every form posts back through one shape: an error message plus the values
// the user typed, so a rejected submit never wipes the form. See
// src/components/form.tsx for the matching client side.
export type RecordFormState =
  | { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | undefined;

function valuesOf(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function requireDomain(domain: DataDomain): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canRoleAccess(user.roleLabel, domain)) redirect("/no-access");
  return user;
}

async function audit(entityType: string, entityId: string, actor: SessionUser, summary: string) {
  await prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action: "create",
      newValue: summary,
      actor: `${actor.name} <${actor.email}>`,
    },
  });
}

// ---------------------------------------------------------------------------
// Parsing helpers. These reject rather than guess: a blank or unparseable
// value becomes an error the user has to resolve, never a silent zero or
// today's date. Financial records must not contain values nobody typed.
// ---------------------------------------------------------------------------

function reqText(fd: FormData, key: string, label: string, errors: Record<string, string>): string {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) errors[key] = `${label} is required.`;
  return v;
}

function optText(fd: FormData, key: string): string | undefined {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? undefined : v;
}

function reqAmount(fd: FormData, key: string, label: string, errors: Record<string, string>): number {
  const raw = String(fd.get(key) ?? "").trim().replace(/,/g, "");
  if (raw === "") {
    errors[key] = `${label} is required.`;
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    errors[key] = `${label} must be a number.`;
    return 0;
  }
  if (n < 0) {
    errors[key] = `${label} cannot be negative.`;
    return 0;
  }
  return n;
}

function optAmount(fd: FormData, key: string, label: string, errors: Record<string, string>): number {
  const raw = String(fd.get(key) ?? "").trim().replace(/,/g, "");
  if (raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    errors[key] = `${label} must be a number.`;
    return 0;
  }
  if (n < 0) {
    errors[key] = `${label} cannot be negative.`;
    return 0;
  }
  return n;
}

function reqDate(fd: FormData, key: string, label: string, errors: Record<string, string>): Date {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw) {
    errors[key] = `${label} is required.`;
    return new Date(0);
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    errors[key] = `${label} is not a valid date.`;
    return new Date(0);
  }
  return d;
}

function optDate(fd: FormData, key: string, label: string, errors: Record<string, string>): Date | undefined {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw) return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    errors[key] = `${label} is not a valid date.`;
    return undefined;
  }
  return d;
}

function fail(errors: Record<string, string>, fd: FormData, message?: string): RecordFormState {
  return {
    error: message ?? "Please correct the highlighted fields.",
    fieldErrors: errors,
    values: valuesOf(fd),
  };
}

/** Turns a unique-constraint violation into a message naming the field. */
function duplicateMessage(e: unknown, label: string): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return `${label} already exists. Use a different one, or open the existing record.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export async function createCustomerAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("customers");
  const errors: Record<string, string> = {};

  const name = reqText(fd, "name", "Customer name", errors);
  const division = String(fd.get("division") ?? "");
  if (division !== "DIGITAL_MARKETING" && division !== "OFFLINE_PRINT") {
    errors.division = "Choose a division.";
  }
  const creditLimitRaw = String(fd.get("creditLimit") ?? "").trim();
  const creditLimit = creditLimitRaw === "" ? null : optAmount(fd, "creditLimit", "Credit limit", errors);

  if (Object.keys(errors).length) return fail(errors, fd);

  const existing = await prisma.customer.findFirst({ where: { name } });
  if (existing) {
    return fail({ name: "A customer with this name already exists." }, fd);
  }

  const customer = await prisma.customer.create({
    data: {
      name,
      contactName: optText(fd, "contactName"),
      contactEmail: optText(fd, "contactEmail")?.toLowerCase(),
      contactPhone: optText(fd, "contactPhone"),
      division: division as "DIGITAL_MARKETING" | "OFFLINE_PRINT",
      creditLimit,
      notes: optText(fd, "notes"),
    },
  });

  await audit("Customer", customer.id, user, `Created customer ${customer.name}`);
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

// ---------------------------------------------------------------------------
// Vendor
// ---------------------------------------------------------------------------

export async function createVendorAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("payables");
  const errors: Record<string, string> = {};

  const name = reqText(fd, "name", "Vendor name", errors);
  if (Object.keys(errors).length) return fail(errors, fd);

  const existing = await prisma.vendor.findFirst({ where: { name } });
  if (existing) return fail({ name: "A vendor with this name already exists." }, fd);

  const vendor = await prisma.vendor.create({
    data: {
      name,
      contactName: optText(fd, "contactName"),
      contactEmail: optText(fd, "contactEmail")?.toLowerCase(),
      contactPhone: optText(fd, "contactPhone"),
      category: optText(fd, "category"),
      notes: optText(fd, "notes"),
    },
  });

  await audit("Vendor", vendor.id, user, `Created vendor ${vendor.name}`);
  revalidatePath("/vendors");
  redirect(`/vendors/${vendor.id}`);
}

// ---------------------------------------------------------------------------
// Quotation
// ---------------------------------------------------------------------------

export async function createQuotationAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("quotations");
  const errors: Record<string, string> = {};

  const quotationNo = reqText(fd, "quotationNo", "Quotation number", errors);
  const customerId = reqText(fd, "customerId", "Customer", errors);
  const requirement = reqText(fd, "requirement", "Requirement", errors);
  const quotationDate = reqDate(fd, "quotationDate", "Quotation date", errors);
  const value = reqAmount(fd, "value", "Quotation value", errors);
  const taxAmount = optAmount(fd, "taxAmount", "Tax amount", errors);
  const discount = optAmount(fd, "discount", "Discount", errors);

  if (Object.keys(errors).length) return fail(errors, fd);

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return fail({ customerId: "That customer no longer exists." }, fd);

  if (discount > value) {
    return fail({ discount: "Discount cannot be more than the quotation value." }, fd);
  }

  try {
    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        quotationDate,
        customerId,
        division: customer.division,
        requirement,
        value,
        taxAmount,
        discount,
        status: (String(fd.get("status") ?? "DRAFT") as "DRAFT" | "SENT" | "ACCEPTED"),
        notes: optText(fd, "notes"),
      },
    });
    await audit("Quotation", quotation.id, user, `Created quotation ${quotation.quotationNo} for ${customer.name}`);
    revalidatePath("/customers");
    redirect(`/customers/${customerId}`);
  } catch (e) {
    const dup = duplicateMessage(e, "That quotation number");
    if (dup) return fail({ quotationNo: dup }, fd);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Purchase order (customer PO)
// ---------------------------------------------------------------------------

export async function createPurchaseOrderAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("pos");
  const errors: Record<string, string> = {};

  const poNo = reqText(fd, "poNo", "PO number", errors);
  const customerId = reqText(fd, "customerId", "Customer", errors);
  const poDate = reqDate(fd, "poDate", "PO date", errors);
  const value = reqAmount(fd, "value", "PO value", errors);

  if (Object.keys(errors).length) return fail(errors, fd);

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return fail({ customerId: "That customer no longer exists." }, fd);

  const quotationId = optText(fd, "quotationId");
  if (quotationId) {
    const q = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!q) return fail({ quotationId: "That quotation no longer exists." }, fd);
    if (q.customerId !== customerId) {
      return fail({ quotationId: "That quotation belongs to a different customer." }, fd);
    }
  }

  try {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNo,
        poDate,
        customerId,
        quotationId,
        value,
        status: (String(fd.get("status") ?? "RECEIVED") as "AWAITED" | "RECEIVED" | "PARTIALLY_UTILISED" | "CLOSED"),
        notes: optText(fd, "notes"),
      },
    });
    await audit("PurchaseOrder", po.id, user, `Created PO ${po.poNo} for ${customer.name}`);
    revalidatePath("/customers");
    redirect(`/customers/${customerId}`);
  } catch (e) {
    const dup = duplicateMessage(e, "That PO number");
    if (dup) return fail({ poNo: dup }, fd);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export async function createInvoiceAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("invoices");
  const errors: Record<string, string> = {};

  const invoiceNo = reqText(fd, "invoiceNo", "Invoice number", errors);
  const customerId = reqText(fd, "customerId", "Customer", errors);
  const invoiceDate = reqDate(fd, "invoiceDate", "Invoice date", errors);
  const dueDate = reqDate(fd, "dueDate", "Due date", errors);
  const value = reqAmount(fd, "value", "Invoice value", errors);
  const taxAmount = optAmount(fd, "taxAmount", "Tax amount", errors);
  const submissionDate = optDate(fd, "submissionDate", "Submission date", errors);

  if (Object.keys(errors).length) return fail(errors, fd);

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return fail({ customerId: "That customer no longer exists." }, fd);

  if (dueDate < invoiceDate) {
    return fail({ dueDate: "Due date cannot be before the invoice date." }, fd);
  }

  const purchaseOrderId = optText(fd, "purchaseOrderId");
  if (purchaseOrderId) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { invoices: true },
    });
    if (!po) return fail({ purchaseOrderId: "That PO no longer exists." }, fd);
    if (po.customerId !== customerId) {
      return fail({ purchaseOrderId: "That PO belongs to a different customer." }, fd);
    }
    // Warn-by-refusing on over-invoicing: the dashboard flags this as an
    // exception after the fact, but it is better caught at entry.
    const already = po.invoices.reduce((s, i) => s + i.value + i.taxAmount, 0);
    if (already + value + taxAmount > po.value * 1.02) {
      return fail(
        { value: `This would invoice more than PO ${po.poNo} is worth (PO ${po.value}, already invoiced ${already}).` },
        fd
      );
    }
  }

  try {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        invoiceDate,
        dueDate,
        submissionDate,
        customerId,
        purchaseOrderId,
        division: customer.division,
        value,
        taxAmount,
        status: (String(fd.get("status") ?? "DRAFT") as "DRAFT" | "READY_FOR_SUBMISSION" | "SUBMITTED"),
        notes: optText(fd, "notes"),
      },
    });
    await audit("Invoice", invoice.id, user, `Created invoice ${invoice.invoiceNo} for ${customer.name}`);
    revalidatePath("/invoices");
    redirect(`/invoices/${invoice.id}`);
  } catch (e) {
    const dup = duplicateMessage(e, "That invoice number");
    if (dup) return fail({ invoiceNo: dup }, fd);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Customer payment
// ---------------------------------------------------------------------------

export async function recordPaymentAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("payments");
  const errors: Record<string, string> = {};

  const invoiceId = reqText(fd, "invoiceId", "Invoice", errors);
  const amount = reqAmount(fd, "amount", "Amount", errors);
  const paymentDate = reqDate(fd, "paymentDate", "Payment date", errors);

  if (Object.keys(errors).length) return fail(errors, fd);
  if (amount === 0) return fail({ amount: "Amount must be more than zero." }, fd);

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return fail({ invoiceId: "That invoice no longer exists." }, fd);

  const total = invoice.value + invoice.taxAmount;
  const outstanding = total - invoice.amountReceived;
  if (amount > outstanding + 1) {
    return fail(
      { amount: `That is more than the ${outstanding.toFixed(2)} still outstanding on this invoice.` },
      fd
    );
  }

  const received = invoice.amountReceived + amount;
  const reconciled = String(fd.get("reconciled") ?? "") === "on";

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        amount,
        paymentDate,
        reference: optText(fd, "reference"),
        reconciled,
        notes: optText(fd, "notes"),
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountReceived: received,
        status: received >= total - 0.01 ? "PAID" : "PARTIALLY_PAID",
      },
    }),
  ]);

  await audit("Payment", invoiceId, user, `Recorded ${amount} against invoice ${invoice.invoiceNo}`);
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

// ---------------------------------------------------------------------------
// Vendor invoice
// ---------------------------------------------------------------------------

export async function createVendorInvoiceAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("vendorInvoices");
  const errors: Record<string, string> = {};

  const vendorInvoiceNo = reqText(fd, "vendorInvoiceNo", "Vendor invoice number", errors);
  const vendorId = reqText(fd, "vendorId", "Vendor", errors);
  const invoiceDate = reqDate(fd, "invoiceDate", "Invoice date", errors);
  const dueDate = reqDate(fd, "dueDate", "Due date", errors);
  const amount = reqAmount(fd, "amount", "Amount", errors);
  const taxAmount = optAmount(fd, "taxAmount", "Tax amount", errors);

  if (Object.keys(errors).length) return fail(errors, fd);

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return fail({ vendorId: "That vendor no longer exists." }, fd);
  if (dueDate < invoiceDate) return fail({ dueDate: "Due date cannot be before the invoice date." }, fd);

  try {
    const vi = await prisma.vendorInvoice.create({
      data: {
        vendorInvoiceNo,
        vendorId,
        invoiceDate,
        dueDate,
        amount,
        taxAmount,
        status: "RECEIVED",
        approvalStatus: "PENDING",
        notes: optText(fd, "notes"),
      },
    });
    await audit("VendorInvoice", vi.id, user, `Recorded vendor invoice ${vi.vendorInvoiceNo} from ${vendor.name}`);
    revalidatePath("/vendors");
    redirect(`/vendors/${vendorId}`);
  } catch (e) {
    const dup = duplicateMessage(e, "That invoice number for this vendor");
    if (dup) return fail({ vendorInvoiceNo: dup }, fd);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Vendor payment + approval
// ---------------------------------------------------------------------------

export async function recordVendorPaymentAction(_prev: RecordFormState, fd: FormData): Promise<RecordFormState> {
  const user = await requireDomain("payables");
  const errors: Record<string, string> = {};

  const vendorInvoiceId = reqText(fd, "vendorInvoiceId", "Vendor invoice", errors);
  const amount = reqAmount(fd, "amount", "Amount", errors);
  const paymentDate = reqDate(fd, "paymentDate", "Payment date", errors);

  if (Object.keys(errors).length) return fail(errors, fd);
  if (amount === 0) return fail({ amount: "Amount must be more than zero." }, fd);

  const vi = await prisma.vendorInvoice.findUnique({ where: { id: vendorInvoiceId } });
  if (!vi) return fail({ vendorInvoiceId: "That vendor invoice no longer exists." }, fd);

  // Paying an unapproved invoice is exactly the control the spec asks for.
  if (vi.approvalStatus !== "APPROVED") {
    return fail(
      { amount: "This vendor invoice has not been approved yet. Approve it before recording a payment." },
      fd
    );
  }

  const total = vi.amount + vi.taxAmount;
  const outstanding = total - vi.amountPaid;
  if (amount > outstanding + 1) {
    return fail({ amount: `That is more than the ${outstanding.toFixed(2)} still payable.` }, fd);
  }

  const paid = vi.amountPaid + amount;
  await prisma.$transaction([
    prisma.vendorPayment.create({
      data: {
        vendorInvoiceId,
        amount,
        paymentDate,
        reference: optText(fd, "reference"),
        notes: optText(fd, "notes"),
      },
    }),
    prisma.vendorInvoice.update({
      where: { id: vendorInvoiceId },
      data: { amountPaid: paid, status: paid >= total - 0.01 ? "PAID" : "PARTIALLY_PAID" },
    }),
  ]);

  await audit("VendorPayment", vendorInvoiceId, user, `Paid ${amount} against ${vi.vendorInvoiceNo}`);
  revalidatePath(`/vendors/${vi.vendorId}`);
  redirect(`/vendors/${vi.vendorId}`);
}

/** Approval is Owner/Finance only — it is what unlocks paying the invoice. */
export async function approveVendorInvoiceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.roleLabel !== "Owner" && user.roleLabel !== "Finance Manager") redirect("/no-access");

  const id = String(formData.get("vendorInvoiceId") ?? "");
  const vi = await prisma.vendorInvoice.findUnique({ where: { id } });
  if (!vi) redirect("/vendors");

  await prisma.vendorInvoice.update({
    where: { id },
    data: { approvalStatus: "APPROVED", status: vi.status === "RECEIVED" ? "APPROVED" : vi.status },
  });
  await prisma.auditLog.create({
    data: {
      entityType: "VendorInvoice",
      entityId: id,
      action: "approve",
      field: "approvalStatus",
      oldValue: vi.approvalStatus,
      newValue: "APPROVED",
      actor: `${user.name} <${user.email}>`,
    },
  });

  revalidatePath(`/vendors/${vi.vendorId}`);
  redirect(`/vendors/${vi.vendorId}`);
}
