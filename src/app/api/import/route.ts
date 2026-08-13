import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { Division, InvoiceStatus } from "@prisma/client";

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

export async function POST(req: NextRequest) {
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

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "Workbook has no sheets." }, { status: 400 });
  }

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
      summary: JSON.stringify(summary),
      rows: {
        create: results.map((r) => ({
          rowNumber: r.row,
          rawData: JSON.stringify(r.data),
          entityType: "Invoice",
          status: r.status,
          issues: r.issues.join(" "),
        })),
      },
    },
  });

  return NextResponse.json({ batchId: batch.id, summary, rows: results });
}
