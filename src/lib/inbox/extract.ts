import type { ExtractedFields } from "./types";

// Pulls "Label: value" style fields out of a message body. Real emails in
// this domain (POs, invoices, vendor bills) are overwhelmingly written with
// a labeled details block — the same assumption the Excel importer makes
// about spreadsheet columns. If a field's label isn't found, it is simply
// absent from the result — nothing is guessed or filled in.
const FIELD_PATTERNS: Record<string, RegExp> = {
  quotationNo: /quotation\s*(?:no\.?|number)?\s*[:#]\s*([A-Z0-9-]+)/i,
  poNo: /\bpo\s*(?:no\.?|number)?\s*[:#]\s*([A-Z0-9-]+)/i,
  invoiceNo: /invoice\s*(?:no\.?|number)?\s*[:#]\s*([A-Z0-9-]+)/i,
  vendorInvoiceNo: /(?:our\s+)?invoice\s*(?:no\.?|number)?\s*[:#]\s*([A-Z0-9-]+)/i,
  poValue: /\bpo\s*value\s*[:#]\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
  invoiceValue: /invoice\s*value\s*[:#]\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
  amount: /\bamount\s*[:#]\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
  taxAmount: /\btax(?:\s*amount)?\s*[:#]\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
  dueDate: /due\s*date\s*[:#]\s*([\d]{1,2}[\s/-][A-Za-z0-9]+[\s/-][\d]{2,4})/i,
  invoiceDate: /invoice\s*date\s*[:#]\s*([\d]{1,2}[\s/-][A-Za-z0-9]+[\s/-][\d]{2,4})/i,
  poDate: /\bpo\s*date\s*[:#]\s*([\d]{1,2}[\s/-][A-Za-z0-9]+[\s/-][\d]{2,4})/i,
  paymentDate: /payment\s*date\s*[:#]\s*([\d]{1,2}[\s/-][A-Za-z0-9]+[\s/-][\d]{2,4})/i,
  utr: /\b(?:utr|transaction\s*(?:id|reference))\s*[:#]\s*([A-Za-z0-9]+)/i,
  paidAmount: /\bamount\s*paid\s*[:#]\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
  projectRef: /project\s*[:#]\s*(.+)/i,
  requirement: /requirement\s*[:#]\s*(.+)/i,
  promisedDate: /(?:pay|payment)\s*by\s*[:#]?\s*([\d]{1,2}[\s/-][A-Za-z0-9]+[\s/-][\d]{2,4})/i,
  correctionNeeded: /correction (?:needed|required)\s*[:#]\s*(.+)/i,
};

function parseNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

export function extractFields(body: string): ExtractedFields {
  const result: ExtractedFields = {};
  for (const [key, pattern] of Object.entries(FIELD_PATTERNS)) {
    const match = body.match(pattern);
    if (!match) continue;
    const raw = match[1].trim();
    if (/^[\d,]+(\.\d+)?$/.test(raw)) {
      result[key] = parseNumber(raw);
    } else {
      result[key] = raw;
    }
  }
  return result;
}
