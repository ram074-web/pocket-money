import { prisma } from "@/lib/db";
import { MatchResult } from "@prisma/client";
import type { ExtractedFields } from "./types";

export type PoMatchOutcome = {
  result: MatchResult;
  quotationId?: string;
  reasons: string[];
};

const VALUE_TOLERANCE = 0.02; // 2% — allows minor rounding differences

/**
 * Matches an incoming customer PO against an existing quotation: same
 * customer, and PO value within tolerance of the quotation's value after
 * tax and discount. Never assumes a match when the quotation can't be
 * found — that's REQUIRES_VERIFICATION, not a guess.
 */
export async function matchPoAgainstQuotation(
  customerId: string,
  extracted: ExtractedFields
): Promise<PoMatchOutcome> {
  const reasons: string[] = [];
  const quotationNo = extracted.quotationNo as string | undefined;
  const poValue = extracted.poValue as number | undefined;

  let quotation = null;
  if (quotationNo) {
    quotation = await prisma.quotation.findUnique({ where: { quotationNo } });
    if (!quotation) reasons.push(`Quotation ${quotationNo} referenced but not found in the system.`);
  } else {
    reasons.push("PO did not reference a quotation number.");
  }

  if (!quotation) {
    // Fall back to the customer's most recent accepted quotation, if any —
    // still flagged, never silently assumed correct.
    quotation = await prisma.quotation.findFirst({
      where: { customerId, status: "ACCEPTED" },
      orderBy: { quotationDate: "desc" },
    });
    if (quotation) reasons.push(`No quotation number matched — falling back to most recent accepted quotation ${quotation.quotationNo} for verification.`);
  }

  if (!quotation) {
    return { result: MatchResult.NO_MATCH_FOUND, reasons: [...reasons, "No quotation could be matched at all."] };
  }

  if (quotation.customerId !== customerId) {
    return {
      result: MatchResult.REQUIRES_VERIFICATION,
      quotationId: quotation.id,
      reasons: [...reasons, "Quotation belongs to a different customer."],
    };
  }

  const quotationTotal = quotation.value + quotation.taxAmount - quotation.discount;
  if (poValue == null) {
    return {
      result: MatchResult.REQUIRES_VERIFICATION,
      quotationId: quotation.id,
      reasons: [...reasons, "PO value could not be extracted from the message."],
    };
  }

  const diff = Math.abs(poValue - quotationTotal);
  const diffPct = quotationTotal > 0 ? diff / quotationTotal : 1;
  if (diffPct > VALUE_TOLERANCE) {
    return {
      result: MatchResult.REQUIRES_VERIFICATION,
      quotationId: quotation.id,
      reasons: [
        ...reasons,
        `PO value ${poValue} differs from quotation total ${quotationTotal} by ${(diffPct * 100).toFixed(1)}% (tolerance ${VALUE_TOLERANCE * 100}%).`,
      ],
    };
  }

  return {
    result: MatchResult.VERIFIED,
    quotationId: quotation.id,
    reasons: [...reasons, `PO value ${poValue} matches quotation ${quotation.quotationNo} total ${quotationTotal} within tolerance.`],
  };
}

export type VendorPoMatchOutcome = {
  result: MatchResult;
  vendorPoId?: string;
  reasons: string[];
};

/** Matches an incoming vendor invoice against a vendor PO, if referenced. */
export async function matchVendorInvoiceAgainstPo(
  vendorId: string,
  extracted: ExtractedFields
): Promise<VendorPoMatchOutcome> {
  const poNo = extracted.poNo as string | undefined;
  if (!poNo) {
    return { result: MatchResult.REQUIRES_VERIFICATION, reasons: ["Vendor invoice did not reference a PO/work order number."] };
  }

  const vendorPo = await prisma.vendorPurchaseOrder.findUnique({ where: { poNo } });
  if (!vendorPo) {
    return { result: MatchResult.NO_MATCH_FOUND, reasons: [`PO ${poNo} referenced but not found in the system.`] };
  }
  if (vendorPo.vendorId !== vendorId) {
    return { result: MatchResult.REQUIRES_VERIFICATION, vendorPoId: vendorPo.id, reasons: ["PO belongs to a different vendor."] };
  }

  const amount = extracted.amount as number | undefined;
  if (amount != null) {
    const diffPct = vendorPo.value > 0 ? Math.abs(amount - vendorPo.value) / vendorPo.value : 1;
    if (diffPct > VALUE_TOLERANCE) {
      return {
        result: MatchResult.REQUIRES_VERIFICATION,
        vendorPoId: vendorPo.id,
        reasons: [`Invoice amount ${amount} differs from PO value ${vendorPo.value} by ${(diffPct * 100).toFixed(1)}%.`],
      };
    }
  }

  return { result: MatchResult.VERIFIED, vendorPoId: vendorPo.id, reasons: [`Matched PO ${vendorPo.poNo}.`] };
}
