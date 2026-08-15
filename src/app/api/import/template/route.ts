import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoices");
  sheet.columns = [
    { header: "Customer", key: "customer", width: 32 },
    { header: "Invoice No", key: "invoiceNo", width: 16 },
    { header: "Invoice Date", key: "invoiceDate", width: 14 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Invoice Value", key: "value", width: 16 },
    { header: "Tax Amount", key: "taxAmount", width: 14 },
    { header: "Amount Received", key: "amountReceived", width: 16 },
    { header: "PO No", key: "poNo", width: 16 },
    { header: "Status", key: "status", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    customer: "Orion Global Foods Pvt Ltd",
    invoiceNo: "INV-2001",
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 86400000),
    value: 500000,
    taxAmount: 90000,
    amountReceived: 0,
    poNo: "PO-ORI-2201",
    status: "Submitted",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="invoice-import-template.xlsx"',
    },
  });
}
