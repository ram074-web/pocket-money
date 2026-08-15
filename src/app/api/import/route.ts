import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { Division, InvoiceStatus } from "@prisma/client";
import { requireApiUser } from "@/lib/api-auth";

// Imports a customer invoice register from Excel into the single source of
// truth. Expected header row (case-insensitive, order-independent):
//   Customer | Invoice No | Invoice Date | Due Date | Invoice Value
//   | Tax Amount | Amount Received | PO No | Status
//
// Rules (spec section 12): never silently overwrite, always flag duplicates,
// missing fields, inconsistent numbers, mismatched amounts and conflicts for
// manual verification. Only clean, unambiguous new rows are written.

type RowIssue = { row: number; status: string; issues: string[]; data: Record<string, unknown> };

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function excelDateToJs(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Excel serial date (1900 date system)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + value * 86400000);
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    if (!isNaN(n)) return n;
  }
  return null;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  // ExcelJS returns an object for hyperlink/rich-text cells; an email column
  // formatted as a mailto link is the common case here.
  if (typeof value === "object") {
    const v = value as { text?: string; hyperlink?: string; result?: unknown };
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result === "string") return v.result.trim();
    if (typeof v.hyperlink === "string") return v.hyperlink.replace(/^mailto:/i, "").trim();
    return "";
  }
  return String(value).trim();
}

/**
 * Imports the customer master. Existing customers are matched by name and
 * left untouched — this never edits a customer you already have, so
 * re-running a workbook is safe.
 */
async function importCustomers(sheet: ExcelJS.Worksheet): Promise<{ results: RowIssue[]; created: number }> {
  const headerRow = sheet.getRow(1);
  const col: Record<string, number> = {};
  headerRow.eachCell((cell, n) => {
    col[normalizeHeader(String(cell.value ?? ""))] = n;
  });

  const at = (row: ExcelJS.Row, key: string) => (col[key] ? row.getCell(col[key]).value : undefined);

  if (!("name" in col) && !("customer" in col)) {
    return {
      results: [
        {
          row: 1,
          status: "missing_fields",
          issues: ['The Customers sheet needs a "Name" column (optionally Division, Contact Person, Contact Email, Contact Phone, Credit Limit).'],
          data: {},
        },
      ],
      created: 0,
    };
  }

  const existing = await prisma.customer.findMany();
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));
  const seen = new Set<string>();
  const results: RowIssue[] = [];
  const toCreate: {
    name: string;
    division: Division;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    creditLimit?: number;
  }[] = [];

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0) continue;

    const name = cellText(at(row, "name") ?? at(row, "customer"));
    if (!name) continue; // blank row

    const divisionRaw = cellText(at(row, "division")).toLowerCase();
    const contactName = cellText(at(row, "contact person") || at(row, "contact name"));
    const contactEmail = cellText(at(row, "contact email") || at(row, "email")).toLowerCase();
    const contactPhone = cellText(at(row, "contact phone") || at(row, "phone"));
    const creditLimit = num(at(row, "credit limit"));

    const data = { name, division: divisionRaw, contactName, contactEmail, contactPhone, creditLimit };
    const key = name.toLowerCase();

    if (seen.has(key)) {
      results.push({ row: r, status: "duplicate_in_file", issues: [`"${name}" appears more than once in this sheet.`], data });
      continue;
    }
    seen.add(key);

    if (byName.has(key)) {
      results.push({ row: r, status: "duplicate", issues: [`"${name}" already exists. Left unchanged.`], data });
      continue;
    }

    // Division drives which side of the business a customer belongs to, so an
    // unreadable value is flagged rather than defaulted to one of them.
    let division: Division | null = null;
    if (/digital/.test(divisionRaw)) division = Division.DIGITAL_MARKETING;
    else if (/offline|print/.test(divisionRaw)) division = Division.OFFLINE_PRINT;

    if (!division) {
      results.push({
        row: r,
        status: "missing_fields",
        issues: [
          divisionRaw
            ? `Division "${divisionRaw}" not recognised — use "Digital Marketing" or "Offline/Print".`
            : 'Division is required — use "Digital Marketing" or "Offline/Print".',
        ],
        data,
      });
      continue;
    }

    toCreate.push({
      name,
      division,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      creditLimit: creditLimit ?? undefined,
    });
    results.push({ row: r, status: "ok", issues: [], data });
  }

  if (toCreate.length) {
    await prisma.$transaction(toCreate.map((c) => prisma.customer.create({ data: c })));
  }

  return { results, created: toCreate.length };
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser("invoices");
  if (response) return response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Upload a file under the 'file' field." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return NextResponse.json({ error: "Could not parse file. Upload a valid .xlsx file." }, { status: 400 });
  }

  if (workbook.worksheets.length === 0) {
    return NextResponse.json({ error: "Workbook has no sheets." }, { status: 400 });
  }

  // A workbook may carry a "Customers" sheet, an invoice sheet, or both.
  // Customers are processed first so a single file can populate a brand-new
  // database: invoices on the second sheet then match the customers created
  // moments earlier, instead of every row failing as "unknown customer".
  const byName = (want: string) =>
    workbook.worksheets.find((ws) => normalizeHeader(ws.name) === want);

  const customersSheet = byName("customers");
  const invoiceSheet =
    byName("invoices") ?? workbook.worksheets.find((ws) => ws !== customersSheet) ?? null;

  const customerResults: RowIssue[] = [];
  let customersCreated = 0;

  if (customersSheet) {
    const outcome = await importCustomers(customersSheet);
    customerResults.push(...outcome.results);
    customersCreated = outcome.created;
  }

  if (!invoiceSheet) {
    // Customers-only workbook: a legitimate first step on a fresh install.
    const summary = {
      customersCreated,
      customerRows: customerResults.length,
      customerDuplicates: customerResults.filter((r) => r.status === "duplicate").length,
      customerMissingFields: customerResults.filter((r) => r.status === "missing_fields").length,
    };
    const batch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        importedBy: `${user.name} <${user.email}>`,
        summary: JSON.stringify(summary),
        rows: {
          create: customerResults.map((r) => ({
            rowNumber: r.row,
            rawData: JSON.stringify(r.data),
            entityType: "Customer",
            status: r.status,
            issues: r.issues.join(" "),
          })),
        },
      },
    });
    return NextResponse.json({ batchId: batch.id, summary, rows: customerResults });
  }

  const sheet = invoiceSheet;
  const headerRow = sheet.getRow(1);
  const columnIndex: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    columnIndex[normalizeHeader(String(cell.value ?? ""))] = colNumber;
  });

  const required = ["customer", "invoice no", "invoice date", "due date", "invoice value"];
  const missingHeaders = required.filter((r) => !(r in columnIndex));
  if (missingHeaders.length) {
    return NextResponse.json(
      {
        error: `Missing required column(s): ${missingHeaders.join(", ")}. Expected headers: Customer, Invoice No, Invoice Date, Due Date, Invoice Value, Tax Amount, Amount Received, PO No, Status.`,
      },
      { status: 400 }
    );
  }

  const get = (row: ExcelJS.Row, key: string) => (columnIndex[key] ? row.getCell(columnIndex[key]).value : undefined);

  const customers = await prisma.customer.findMany();
  const customerByName = new Map(customers.map((c) => [c.name.trim().toLowerCase(), c]));
  const existingInvoices = await prisma.invoice.findMany();
  const invoiceByNo = new Map(existingInvoices.map((i) => [i.invoiceNo.trim().toLowerCase(), i]));

  const seenInFile = new Set<string>();
  const results: RowIssue[] = [];
  const toCreate: {
    invoiceNo: string;
    invoiceDate: Date;
    dueDate: Date;
    value: number;
    taxAmount: number;
    amountReceived: number;
    customerId: string;
    division: Division;
  }[] = [];

  const lastRow = sheet.actualRowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0) continue;

    const rawCustomer = String(get(row, "customer") ?? "").trim();
    const rawInvoiceNo = String(get(row, "invoice no") ?? "").trim();
    const invoiceDate = excelDateToJs(get(row, "invoice date"));
    const dueDate = excelDateToJs(get(row, "due date"));
    const value = num(get(row, "invoice value"));
    const taxAmount = num(get(row, "tax amount")) ?? 0;
    const amountReceived = num(get(row, "amount received")) ?? 0;
    const status = String(get(row, "status") ?? "").trim();

    if (!rawCustomer && !rawInvoiceNo && value == null) continue; // blank row

    const issues: string[] = [];
    const data = { customer: rawCustomer, invoiceNo: rawInvoiceNo, invoiceDate: get(row, "invoice date"), dueDate: get(row, "due date"), value, taxAmount, amountReceived, status };

    if (!rawCustomer) issues.push("Missing customer name.");
    if (!rawInvoiceNo) issues.push("Missing invoice number.");
    if (!invoiceDate) issues.push("Missing or unparseable invoice date.");
    if (!dueDate) issues.push("Missing or unparseable due date.");
    if (value == null) issues.push("Missing or invalid invoice value.");

    if (issues.length) {
      results.push({ row: r, status: "missing_fields", issues, data });
      continue;
    }

    const invoiceKey = rawInvoiceNo.toLowerCase();
    if (seenInFile.has(invoiceKey)) {
      results.push({ row: r, status: "duplicate_in_file", issues: [`Invoice number "${rawInvoiceNo}" appears more than once in this file.`], data });
      continue;
    }
    seenInFile.add(invoiceKey);

    const existing = invoiceByNo.get(invoiceKey);
    if (existing) {
      const existingTotal = existing.value + existing.taxAmount;
      const importedTotal = (value ?? 0) + taxAmount;
      if (Math.abs(existingTotal - importedTotal) > 1) {
        results.push({
          row: r,
          status: "conflict",
          issues: [
            `Invoice "${rawInvoiceNo}" already exists with total ${existingTotal}, but import has ${importedTotal}. Requires verification — not overwritten.`,
          ],
          data,
        });
      } else {
        results.push({ row: r, status: "duplicate", issues: [`Invoice "${rawInvoiceNo}" already exists in the system. Skipped.`], data });
      }
      continue;
    }

    const customer = customerByName.get(rawCustomer.toLowerCase());
    if (!customer) {
      results.push({
        row: r,
        status: "unknown_customer",
        issues: [`Customer "${rawCustomer}" not found in the system. Requires verification before import.`],
        data,
      });
      continue;
    }

    if (dueDate! < invoiceDate!) {
      results.push({ row: r, status: "invalid_dates", issues: ["Due date is earlier than invoice date."], data });
      continue;
    }

    toCreate.push({
      invoiceNo: rawInvoiceNo,
      invoiceDate: invoiceDate!,
      dueDate: dueDate!,
      value: value!,
      taxAmount,
      amountReceived,
      customerId: customer.id,
      division: customer.division,
    });
    results.push({ row: r, status: "ok", issues: [], data });
  }

  const created = await prisma.$transaction(
    toCreate.map((inv) =>
      prisma.invoice.create({
        data: {
          invoiceNo: inv.invoiceNo,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          value: inv.value,
          taxAmount: inv.taxAmount,
          amountReceived: inv.amountReceived,
          customerId: inv.customerId,
          division: inv.division,
          status: inv.amountReceived >= inv.value + inv.taxAmount ? InvoiceStatus.PAID : InvoiceStatus.SUBMITTED,
        },
      })
    )
  );

  const summary = {
    ...(customersSheet ? { customersCreated } : {}),
    totalRows: results.length,
    created: created.length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    duplicatesInFile: results.filter((r) => r.status === "duplicate_in_file").length,
    conflicts: results.filter((r) => r.status === "conflict").length,
    missingFields: results.filter((r) => r.status === "missing_fields").length,
    unknownCustomers: results.filter((r) => r.status === "unknown_customer").length,
    invalidDates: results.filter((r) => r.status === "invalid_dates").length,
  };

  const batch = await prisma.importBatch.create({
    data: {
      fileName: file.name,
      importedBy: `${user.name} <${user.email}>`,
      summary: JSON.stringify(summary),
      rows: {
        create: [
          ...customerResults.map((r) => ({
            rowNumber: r.row,
            rawData: JSON.stringify(r.data),
            entityType: "Customer",
            status: r.status,
            issues: r.issues.join(" "),
          })),
          ...results.map((r) => ({
            rowNumber: r.row,
            rawData: JSON.stringify(r.data),
            entityType: "Invoice",
            status: r.status,
            issues: r.issues.join(" "),
          })),
        ],
      },
    },
  });

  return NextResponse.json({
    batchId: batch.id,
    summary,
    rows: results,
    customerRows: customerResults,
  });
}
