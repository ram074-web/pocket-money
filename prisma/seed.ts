import { PrismaClient, Division, QuotationStatus, POStatus, InvoiceStatus, VendorInvoiceStatus, ApprovalStatus, FollowUpDirection, FollowUpStatus, RiskSeverity, CommunicationDirection } from "@prisma/client";

const prisma = new PrismaClient();

// "Today" is fixed to the environment's current date so seeded overdue /
// due-soon / ageing data stays meaningful for the dashboard.
const TODAY = new Date("2026-08-13T00:00:00Z");

function daysFrom(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main() {
  console.log("Seeding database...");

  await prisma.$transaction([
    prisma.whatsAppDraft.deleteMany(),
    prisma.routingLogEntry.deleteMany(),
    prisma.inboundMessage.deleteMany(),
    prisma.followUp.deleteMany(),
    prisma.communication.deleteMany(),
    prisma.projectOtherCost.deleteMany(),
    prisma.projectVendorCost.deleteMany(),
    prisma.vendorPayment.deleteMany(),
    prisma.vendorInvoice.deleteMany(),
    prisma.vendorPurchaseOrder.deleteMany(),
    prisma.invoiceCorrection.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.quotation.deleteMany(),
    prisma.project.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.importRow.deleteMany(),
    prisma.importBatch.deleteMany(),
  ]);

  const [priya, arjun, kavita, rahul] = await Promise.all([
    prisma.employee.create({ data: { name: "Priya Sharma", email: "priya.sharma@company.com", role: "Digital Account Manager" } }),
    prisma.employee.create({ data: { name: "Arjun Mehta", email: "arjun.mehta@company.com", role: "Print Account Manager" } }),
    prisma.employee.create({ data: { name: "Kavita Rao", email: "kavita.rao@company.com", role: "Accounts & Receivables" } }),
    prisma.employee.create({ data: { name: "Rahul Nair", email: "rahul.nair@company.com", role: "Vendor & Payables" } }),
  ]);

  const orion = await prisma.customer.create({
    data: {
      name: "Orion Global Foods Pvt Ltd",
      contactName: "Neha Kapoor",
      contactEmail: "neha.kapoor@orionglobalfoods.com",
      contactPhone: "+91 98200 11122",
      division: Division.DIGITAL_MARKETING,
      creditLimit: 2500000,
    },
  });

  const sterling = await prisma.customer.create({
    data: {
      name: "Sterling Pharma International",
      contactName: "David Chen",
      contactEmail: "david.chen@sterlingpharma.com",
      contactPhone: "+91 98100 22233",
      division: Division.OFFLINE_PRINT,
      creditLimit: 1500000,
    },
  });

  const bluewave = await prisma.customer.create({
    data: {
      name: "BlueWave Technologies",
      contactName: "Amit Verma",
      contactEmail: "amit.verma@bluewavetech.com",
      contactPhone: "+91 99870 33344",
      division: Division.DIGITAL_MARKETING,
      creditLimit: 1000000,
    },
  });

  const meridian = await prisma.customer.create({
    data: {
      name: "Meridian Retail Group",
      contactName: "Sarah Thomas",
      contactEmail: "sarah.thomas@meridianretail.com",
      contactPhone: "+91 98450 44455",
      division: Division.OFFLINE_PRINT,
      creditLimit: 2000000,
    },
  });

  const nimbus = await prisma.customer.create({
    data: {
      name: "Nimbus Financial Services",
      contactName: "Rohan Desai",
      contactEmail: "rohan.desai@nimbusfin.com",
      contactPhone: "+91 90040 55566",
      division: Division.DIGITAL_MARKETING,
      creditLimit: 3000000,
    },
  });

  const pixelcraft = await prisma.vendor.create({
    data: { name: "PixelCraft Studios", contactName: "Vikram Iyer", contactEmail: "accounts@pixelcraft.in", category: "Creative & Design" },
  });
  const printhouse = await prisma.vendor.create({
    data: { name: "PrintHouse Industries", contactName: "Sunita Menon", contactEmail: "billing@printhouseind.com", category: "Print Production" },
  });
  const adreach = await prisma.vendor.create({
    data: { name: "AdReach Media Buying", contactName: "Karan Malhotra", contactEmail: "finance@adreachmedia.com", category: "Media Buying" },
  });
  const signageworld = await prisma.vendor.create({
    data: { name: "Signage World", contactName: "Divya Pillai", contactEmail: "accounts@signageworld.in", category: "Signage & Banners" },
  });

  // ---------------------------------------------------------------------
  // Project 1: Orion Global Foods — Q3 Digital Campaign (fully paid, closed)
  // ---------------------------------------------------------------------
  const orionProject = await prisma.project.create({
    data: { name: "Q3 Social & SEO Campaign", division: Division.DIGITAL_MARKETING, customerId: orion.id, employeeId: priya.id, status: "Closed" },
  });
  const orionQuote = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0101", quotationDate: daysFrom(TODAY, -70), customerId: orion.id, projectId: orionProject.id,
      division: Division.DIGITAL_MARKETING, requirement: "Q3 social media + SEO campaign", value: 800000, taxAmount: 144000, discount: 0,
      status: QuotationStatus.ACCEPTED, employeeId: priya.id,
    },
  });
  const orionPO = await prisma.purchaseOrder.create({
    data: { poNo: "PO-ORI-2201", poDate: daysFrom(TODAY, -60), customerId: orion.id, quotationId: orionQuote.id, projectId: orionProject.id, value: 944000, status: POStatus.CLOSED },
  });
  const orionInvoice = await prisma.invoice.create({
    data: {
      invoiceNo: "INV-1001", invoiceDate: daysFrom(TODAY, -55), customerId: orion.id, projectId: orionProject.id, purchaseOrderId: orionPO.id,
      division: Division.DIGITAL_MARKETING, value: 800000, taxAmount: 144000, submissionDate: daysFrom(TODAY, -55), dueDate: daysFrom(TODAY, -25),
      status: InvoiceStatus.PAID, amountReceived: 944000, employeeId: priya.id,
    },
  });
  await prisma.payment.create({ data: { invoiceId: orionInvoice.id, amount: 944000, paymentDate: daysFrom(TODAY, -27), reference: "NEFT/ORI/5521", reconciled: true } });
  await prisma.projectVendorCost.create({
    data: { projectId: orionProject.id, vendorId: adreach.id, amount: 220000, description: "Paid media buying for Q3 campaign" },
  });

  // ---------------------------------------------------------------------
  // Project 2: Orion Global Foods — Festive Campaign (overdue, high value)
  // ---------------------------------------------------------------------
  const orionProject2 = await prisma.project.create({
    data: { name: "Festive Season Digital Push", division: Division.DIGITAL_MARKETING, customerId: orion.id, employeeId: priya.id, status: "Active" },
  });
  const orionQuote2 = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0142", quotationDate: daysFrom(TODAY, -50), customerId: orion.id, projectId: orionProject2.id,
      division: Division.DIGITAL_MARKETING, requirement: "Festive season paid campaign + creatives", value: 1200000, taxAmount: 216000, discount: 20000,
      status: QuotationStatus.ACCEPTED, employeeId: priya.id,
    },
  });
  const orionPO2 = await prisma.purchaseOrder.create({
    data: { poNo: "PO-ORI-2245", poDate: daysFrom(TODAY, -45), customerId: orion.id, quotationId: orionQuote2.id, projectId: orionProject2.id, value: 1396000, status: POStatus.RECEIVED },
  });
  const orionInvoice2 = await prisma.invoice.create({
    data: {
      invoiceNo: "INV-1025", invoiceDate: daysFrom(TODAY, -42), customerId: orion.id, projectId: orionProject2.id, purchaseOrderId: orionPO2.id,
      division: Division.DIGITAL_MARKETING, value: 1180000, taxAmount: 212400, submissionDate: daysFrom(TODAY, -42), dueDate: daysFrom(TODAY, -12),
      status: InvoiceStatus.OVERDUE, amountReceived: 0, employeeId: priya.id, notes: "High-value overdue — escalate",
    },
  });
  await prisma.communication.create({
    data: {
      direction: CommunicationDirection.OUTBOUND, channel: "email", subject: "Payment reminder — INV-1025",
      body: "Dear Neha, this is a reminder that INV-1025 dated for Rs 13,92,400 was due on 12 Aug 2026 and remains unpaid. Please confirm expected payment date.",
      customerId: orion.id, invoiceId: orionInvoice2.id, sentBy: "Kavita Rao", approved: true, createdAt: daysFrom(TODAY, -5),
    },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.CUSTOMER, title: "Follow up on overdue INV-1025", details: "Call Neha Kapoor for payment confirmation date.",
      customerId: orion.id, invoiceId: orionInvoice2.id, amount: 1392400, employeeId: kavita.id, dueDate: daysFrom(TODAY, 0),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.RED, nextAction: "Call customer and escalate to finance head if no response",
    },
  });
  await prisma.projectVendorCost.create({
    data: { projectId: orionProject2.id, vendorId: adreach.id, amount: 340000, description: "Media buying — festive campaign" },
  });
  await prisma.projectVendorCost.create({
    data: { projectId: orionProject2.id, vendorId: pixelcraft.id, amount: 95000, description: "Festive campaign creatives" },
  });

  // ---------------------------------------------------------------------
  // Project 3: Sterling Pharma — Brochure & Packaging (invoice correction)
  // ---------------------------------------------------------------------
  const sterlingProject = await prisma.project.create({
    data: { name: "Product Launch Brochures & Packaging", division: Division.OFFLINE_PRINT, customerId: sterling.id, employeeId: arjun.id, status: "Active" },
  });
  const sterlingQuote = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0158", quotationDate: daysFrom(TODAY, -38), customerId: sterling.id, projectId: sterlingProject.id,
      division: Division.OFFLINE_PRINT, requirement: "Brochures, cartons and packaging inserts for product launch", value: 650000, taxAmount: 117000, discount: 0,
      status: QuotationStatus.ACCEPTED, employeeId: arjun.id,
    },
  });
  const sterlingPO = await prisma.purchaseOrder.create({
    data: { poNo: "PO-STP-3390", poDate: daysFrom(TODAY, -33), customerId: sterling.id, quotationId: sterlingQuote.id, projectId: sterlingProject.id, value: 767000, status: POStatus.RECEIVED },
  });
  const sterlingInvoice = await prisma.invoice.create({
    data: {
      invoiceNo: "INV-1041", invoiceDate: daysFrom(TODAY, -20), customerId: sterling.id, projectId: sterlingProject.id, purchaseOrderId: sterlingPO.id,
      division: Division.OFFLINE_PRINT, value: 650000, taxAmount: 117000, submissionDate: daysFrom(TODAY, -20), dueDate: daysFrom(TODAY, 10),
      status: InvoiceStatus.CORRECTION_REQUIRED, amountReceived: 0, employeeId: arjun.id,
    },
  });
  await prisma.invoiceCorrection.create({
    data: {
      invoiceId: sterlingInvoice.id, correctionNeeded: "GSTIN on invoice does not match Sterling's registered GSTIN; PO number missing from invoice header.",
      requestedBy: "David Chen (Sterling Pharma)", requestedDate: daysFrom(TODAY, -6), responsiblePerson: "Arjun Mehta",
      status: "Open", reasonForDelay: "Awaiting updated GSTIN confirmation from customer's finance team",
    },
  });
  await prisma.communication.create({
    data: {
      direction: CommunicationDirection.INBOUND, channel: "email", subject: "RE: INV-1041 — correction required",
      body: "Hi Arjun, please correct the GSTIN on INV-1041 and resend for processing. Also add our PO number PO-STP-3390 to the header.",
      customerId: sterling.id, invoiceId: sterlingInvoice.id, sentBy: "David Chen", approved: true, createdAt: daysFrom(TODAY, -6),
    },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.INTERNAL, title: "Correct GSTIN & resubmit INV-1041", details: "Update GSTIN and PO number, then resend to Sterling.",
      customerId: sterling.id, invoiceId: sterlingInvoice.id, amount: 767000, employeeId: arjun.id, dueDate: daysFrom(TODAY, 1),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.AMBER, nextAction: "Reissue corrected invoice and resubmit to customer",
    },
  });
  await prisma.projectVendorCost.create({
    data: { projectId: sterlingProject.id, vendorId: printhouse.id, amount: 280000, description: "Brochure & carton print run" },
  });

  // ---------------------------------------------------------------------
  // Project 4: BlueWave Technologies — Website Revamp (partially paid)
  // ---------------------------------------------------------------------
  const bluewaveProject = await prisma.project.create({
    data: { name: "Corporate Website Revamp", division: Division.DIGITAL_MARKETING, customerId: bluewave.id, employeeId: priya.id, status: "Active" },
  });
  const bluewaveQuote = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0170", quotationDate: daysFrom(TODAY, -90), customerId: bluewave.id, projectId: bluewaveProject.id,
      division: Division.DIGITAL_MARKETING, requirement: "Website redesign, UX and SEO migration", value: 900000, taxAmount: 162000, discount: 0,
      status: QuotationStatus.ACCEPTED, employeeId: priya.id,
    },
  });
  const bluewavePO = await prisma.purchaseOrder.create({
    data: { poNo: "PO-BWT-4410", poDate: daysFrom(TODAY, -85), customerId: bluewave.id, quotationId: bluewaveQuote.id, projectId: bluewaveProject.id, value: 1062000, status: POStatus.PARTIALLY_UTILISED },
  });
  const bluewaveInvoice = await prisma.invoice.create({
    data: {
      invoiceNo: "INV-0987", invoiceDate: daysFrom(TODAY, -45), customerId: bluewave.id, projectId: bluewaveProject.id, purchaseOrderId: bluewavePO.id,
      division: Division.DIGITAL_MARKETING, value: 900000, taxAmount: 162000, submissionDate: daysFrom(TODAY, -45), dueDate: daysFrom(TODAY, -15),
      status: InvoiceStatus.PARTIALLY_PAID, amountReceived: 600000, employeeId: priya.id,
    },
  });
  await prisma.payment.create({ data: { invoiceId: bluewaveInvoice.id, amount: 600000, paymentDate: daysFrom(TODAY, -10), reference: "RTGS/BWT/8871", reconciled: true } });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.CUSTOMER, title: "Collect balance on INV-0987", details: "Balance of Rs 4,62,000 overdue since 29 Jul 2026.",
      customerId: bluewave.id, invoiceId: bluewaveInvoice.id, amount: 462000, employeeId: kavita.id, dueDate: daysFrom(TODAY, -1),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.RED, nextAction: "Send balance payment reminder and confirm date",
    },
  });

  // Work completed, PO received, but invoice not yet raised (exception case)
  const bluewaveProject2 = await prisma.project.create({
    data: { name: "Performance Marketing Retainer — Aug", division: Division.DIGITAL_MARKETING, customerId: bluewave.id, employeeId: priya.id, status: "Active" },
  });
  const bluewaveQuote2 = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0201", quotationDate: daysFrom(TODAY, -20), customerId: bluewave.id, projectId: bluewaveProject2.id,
      division: Division.DIGITAL_MARKETING, requirement: "August performance marketing retainer", value: 250000, taxAmount: 45000, discount: 0,
      status: QuotationStatus.ACCEPTED, employeeId: priya.id,
    },
  });
  await prisma.purchaseOrder.create({
    data: { poNo: "PO-BWT-4455", poDate: daysFrom(TODAY, -15), customerId: bluewave.id, quotationId: bluewaveQuote2.id, projectId: bluewaveProject2.id, value: 295000, status: POStatus.RECEIVED },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.INTERNAL, title: "Raise invoice for PO-BWT-4455", details: "Work delivered for August retainer; invoice not yet raised against received PO.",
      customerId: bluewave.id, amount: 295000, employeeId: priya.id, dueDate: daysFrom(TODAY, 2),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.AMBER, nextAction: "Raise and submit invoice against PO-BWT-4455",
    },
  });

  // ---------------------------------------------------------------------
  // Project 5: Meridian Retail — Store Branding Rollout (due soon)
  // ---------------------------------------------------------------------
  const meridianProject = await prisma.project.create({
    data: { name: "Pan-India Store Branding Rollout", division: Division.OFFLINE_PRINT, customerId: meridian.id, employeeId: arjun.id, status: "Active" },
  });
  const meridianQuote = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0188", quotationDate: daysFrom(TODAY, -35), customerId: meridian.id, projectId: meridianProject.id,
      division: Division.OFFLINE_PRINT, requirement: "In-store branding, banners and signage for 40 outlets", value: 1800000, taxAmount: 324000, discount: 50000,
      status: QuotationStatus.ACCEPTED, employeeId: arjun.id,
    },
  });
  const meridianPO = await prisma.purchaseOrder.create({
    data: { poNo: "PO-MER-5510", poDate: daysFrom(TODAY, -30), customerId: meridian.id, quotationId: meridianQuote.id, projectId: meridianProject.id, value: 2074000, status: POStatus.RECEIVED },
  });
  const meridianInvoice = await prisma.invoice.create({
    data: {
      invoiceNo: "INV-1060", invoiceDate: daysFrom(TODAY, -18), customerId: meridian.id, projectId: meridianProject.id, purchaseOrderId: meridianPO.id,
      division: Division.OFFLINE_PRINT, value: 1800000, taxAmount: 324000, submissionDate: daysFrom(TODAY, -18), dueDate: daysFrom(TODAY, 3),
      status: InvoiceStatus.SUBMITTED, amountReceived: 0, employeeId: arjun.id,
    },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.CUSTOMER, title: "Confirm payment schedule for INV-1060", details: "High-value invoice due in 3 days; confirm processing status with accounts team.",
      customerId: meridian.id, invoiceId: meridianInvoice.id, amount: 2124000, employeeId: kavita.id, dueDate: daysFrom(TODAY, 1),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.AMBER, nextAction: "Email accounts team to confirm payment is scheduled",
    },
  });
  await prisma.projectVendorCost.create({
    data: { projectId: meridianProject.id, vendorId: signageworld.id, amount: 610000, description: "Banners and signage production — 40 outlets" },
  });
  await prisma.projectVendorCost.create({
    data: { projectId: meridianProject.id, vendorId: printhouse.id, amount: 180000, description: "In-store POS print material" },
  });
  await prisma.projectOtherCost.create({ data: { projectId: meridianProject.id, description: "Site installation & logistics", amount: 90000 } });

  // Meridian — a second invoice, due within 30 days, quotation-only pipeline item
  const meridianQuote2 = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0210", quotationDate: daysFrom(TODAY, -5), customerId: meridian.id, projectId: meridianProject.id,
      division: Division.OFFLINE_PRINT, requirement: "Additional signage for 10 new outlets", value: 420000, taxAmount: 75600, discount: 0,
      status: QuotationStatus.SENT, employeeId: arjun.id,
    },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.CUSTOMER, title: "Follow up on quotation QT-2026-0210", details: "Awaiting customer approval on additional signage quotation.",
      customerId: meridian.id, amount: 495600, employeeId: arjun.id, dueDate: daysFrom(TODAY, 4),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.GREEN, nextAction: "Call customer for approval status",
    },
  });
  void meridianQuote2;

  // ---------------------------------------------------------------------
  // Project 6: Nimbus Financial — Brand Campaign (credit limit exceeded, ageing 90+)
  // ---------------------------------------------------------------------
  const nimbusProject = await prisma.project.create({
    data: { name: "Annual Brand Awareness Campaign", division: Division.DIGITAL_MARKETING, customerId: nimbus.id, employeeId: priya.id, status: "Active" },
  });
  const nimbusQuote = await prisma.quotation.create({
    data: {
      quotationNo: "QT-2025-0980", quotationDate: daysFrom(TODAY, -140), customerId: nimbus.id, projectId: nimbusProject.id,
      division: Division.DIGITAL_MARKETING, requirement: "Annual brand awareness — paid + organic", value: 2600000, taxAmount: 468000, discount: 0,
      status: QuotationStatus.ACCEPTED, employeeId: priya.id,
    },
  });
  const nimbusPO = await prisma.purchaseOrder.create({
    data: { poNo: "PO-NIM-1180", poDate: daysFrom(TODAY, -135), customerId: nimbus.id, quotationId: nimbusQuote.id, projectId: nimbusProject.id, value: 3068000, status: POStatus.CLOSED },
  });
  const nimbusInvoice = await prisma.invoice.create({
    data: {
      invoiceNo: "INV-0890", invoiceDate: daysFrom(TODAY, -125), customerId: nimbus.id, projectId: nimbusProject.id, purchaseOrderId: nimbusPO.id,
      division: Division.DIGITAL_MARKETING, value: 2600000, taxAmount: 468000, submissionDate: daysFrom(TODAY, -125), dueDate: daysFrom(TODAY, -95),
      status: InvoiceStatus.OVERDUE, amountReceived: 0, employeeId: priya.id, notes: "Severely overdue (90+ days) — repeated delay pattern",
    },
  });
  await prisma.communication.create({
    data: {
      direction: CommunicationDirection.OUTBOUND, channel: "email", subject: "URGENT: Escalation — INV-0890 overdue 90+ days",
      body: "Dear Rohan, INV-0890 for Rs 30,68,000 has been outstanding for over 90 days despite multiple reminders. Please arrange immediate payment or provide a written payment plan.",
      customerId: nimbus.id, invoiceId: nimbusInvoice.id, sentBy: "Kavita Rao", approved: true, createdAt: daysFrom(TODAY, -14),
    },
  });
  await prisma.communication.create({
    data: {
      direction: CommunicationDirection.OUTBOUND, channel: "phone", subject: "Follow-up call log — INV-0890",
      body: "Spoke with accounts team; they cited internal approval delays. Promised payment by end of month — no confirmation received yet.",
      customerId: nimbus.id, invoiceId: nimbusInvoice.id, sentBy: "Kavita Rao", approved: true, createdAt: daysFrom(TODAY, -40),
    },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.CUSTOMER, title: "Escalate INV-0890 to management", details: "90+ days overdue, high value, repeated broken promises. Escalate to owner.",
      customerId: nimbus.id, invoiceId: nimbusInvoice.id, amount: 3068000, employeeId: kavita.id, dueDate: daysFrom(TODAY, 0),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.RED, nextAction: "Owner to call customer CFO directly; consider legal notice if unresolved by month end",
    },
  });
  await prisma.projectVendorCost.create({
    data: { projectId: nimbusProject.id, vendorId: adreach.id, amount: 780000, description: "Paid media — annual campaign" },
  });
  await prisma.projectVendorCost.create({
    data: { projectId: nimbusProject.id, vendorId: pixelcraft.id, amount: 210000, description: "Brand creative assets" },
  });

  // Nimbus — new quotation pending approval (customer over credit limit -> risk alert)
  await prisma.quotation.create({
    data: {
      quotationNo: "QT-2026-0215", quotationDate: daysFrom(TODAY, -2), customerId: nimbus.id, projectId: nimbusProject.id,
      division: Division.DIGITAL_MARKETING, requirement: "Q4 campaign extension", value: 500000, taxAmount: 90000, discount: 0,
      status: QuotationStatus.SENT, employeeId: priya.id,
    },
  });

  // =======================================================================
  // Vendor Payables
  // =======================================================================
  const pixelcraftPO = await prisma.vendorPurchaseOrder.create({
    data: { poNo: "VPO-PXC-2001", poDate: daysFrom(TODAY, -50), vendorId: pixelcraft.id, value: 305000 },
  });
  const pixelcraftInvoice = await prisma.vendorInvoice.create({
    data: {
      vendorInvoiceNo: "PXC-INV-771", invoiceDate: daysFrom(TODAY, -30), vendorId: pixelcraft.id, vendorPoId: pixelcraftPO.id,
      amount: 305000, taxAmount: 54900, dueDate: daysFrom(TODAY, -5), amountPaid: 0,
      status: VendorInvoiceStatus.OVERDUE, approvalStatus: ApprovalStatus.APPROVED, employeeId: rahul.id,
    },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.VENDOR, title: "Pay overdue PixelCraft invoice PXC-INV-771", details: "Approved, overdue by 5 days.",
      vendorId: pixelcraft.id, vendorInvoiceId: pixelcraftInvoice.id, amount: 359900, employeeId: rahul.id, dueDate: daysFrom(TODAY, 0),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.RED, nextAction: "Release payment via NEFT and share UTR with vendor",
    },
  });

  const printhousePO = await prisma.vendorPurchaseOrder.create({
    data: { poNo: "VPO-PHI-3105", poDate: daysFrom(TODAY, -32), vendorId: printhouse.id, value: 460000 },
  });
  const printhouseInvoice = await prisma.vendorInvoice.create({
    data: {
      vendorInvoiceNo: "PHI-INV-4402", invoiceDate: daysFrom(TODAY, -18), vendorId: printhouse.id, vendorPoId: printhousePO.id,
      amount: 460000, taxAmount: 82800, dueDate: daysFrom(TODAY, 5), amountPaid: 0,
      status: VendorInvoiceStatus.APPROVAL_PENDING, approvalStatus: ApprovalStatus.PENDING, employeeId: rahul.id,
    },
  });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.INTERNAL, title: "Approve PrintHouse invoice PHI-INV-4402", details: "Awaiting internal approval before payment can be scheduled.",
      vendorId: printhouse.id, vendorInvoiceId: printhouseInvoice.id, amount: 542800, employeeId: rahul.id, dueDate: daysFrom(TODAY, 2),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.AMBER, nextAction: "Get approval from Arjun Mehta and schedule payment",
    },
  });

  const adreachPO = await prisma.vendorPurchaseOrder.create({
    data: { poNo: "VPO-ADR-1900", poDate: daysFrom(TODAY, -60), vendorId: adreach.id, value: 1340000 },
  });
  const adreachInvoice = await prisma.vendorInvoice.create({
    data: {
      vendorInvoiceNo: "ADR-INV-9012", invoiceDate: daysFrom(TODAY, -40), vendorId: adreach.id, vendorPoId: adreachPO.id,
      amount: 1120000, taxAmount: 201600, dueDate: daysFrom(TODAY, -10), amountPaid: 700000,
      status: VendorInvoiceStatus.PARTIALLY_PAID, approvalStatus: ApprovalStatus.APPROVED, employeeId: rahul.id,
    },
  });
  await prisma.vendorPayment.create({ data: { vendorInvoiceId: adreachInvoice.id, amount: 700000, paymentDate: daysFrom(TODAY, -12), reference: "NEFT/ADR/2201" } });
  await prisma.followUp.create({
    data: {
      direction: FollowUpDirection.VENDOR, title: "Pay balance to AdReach Media", details: "Balance of Rs 6,21,600 overdue by 10 days.",
      vendorId: adreach.id, vendorInvoiceId: adreachInvoice.id, amount: 621600, employeeId: rahul.id, dueDate: daysFrom(TODAY, -3),
      status: FollowUpStatus.PENDING, priority: RiskSeverity.RED, nextAction: "Clear balance payment this week to avoid credit hold on media accounts",
    },
  });

  const signagePO = await prisma.vendorPurchaseOrder.create({
    data: { poNo: "VPO-SGW-770", poDate: daysFrom(TODAY, -25), vendorId: signageworld.id, value: 610000 },
  });
  const signageInvoice = await prisma.vendorInvoice.create({
    data: {
      vendorInvoiceNo: "SGW-INV-330", invoiceDate: daysFrom(TODAY, -10), vendorId: signageworld.id, vendorPoId: signagePO.id,
      amount: 610000, taxAmount: 109800, dueDate: daysFrom(TODAY, 12), amountPaid: 0,
      status: VendorInvoiceStatus.APPROVED, approvalStatus: ApprovalStatus.APPROVED, employeeId: rahul.id,
    },
  });
  void signageInvoice;

  const printhouseInvoice2 = await prisma.vendorInvoice.create({
    data: {
      vendorInvoiceNo: "PHI-INV-4350", invoiceDate: daysFrom(TODAY, -60), vendorId: printhouse.id,
      amount: 180000, taxAmount: 32400, dueDate: daysFrom(TODAY, -30), amountPaid: 212400,
      status: VendorInvoiceStatus.PAID, approvalStatus: ApprovalStatus.APPROVED, employeeId: rahul.id,
    },
  });
  await prisma.vendorPayment.create({ data: { vendorInvoiceId: printhouseInvoice2.id, amount: 212400, paymentDate: daysFrom(TODAY, -28), reference: "NEFT/PHI/1187" } });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
