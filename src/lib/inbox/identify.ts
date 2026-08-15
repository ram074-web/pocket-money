import { prisma } from "@/lib/db";
import type { PartyMatch } from "./types";

function domainOf(email: string): string | null {
  const at = email.indexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

/**
 * Identify which customer or vendor a message came from. Tries, in order:
 * exact contact-email match, email-domain match, then a name mention in the
 * message body (e.g. a signature block). Never guesses beyond that — if
 * nothing matches, callers must treat the sender as unidentified and route
 * for manual verification rather than assuming a party.
 */
export async function identifyParty(fromAddress: string, body: string): Promise<PartyMatch> {
  const email = fromAddress.trim().toLowerCase();
  const domain = domainOf(email);

  const [customers, vendors] = await Promise.all([prisma.customer.findMany(), prisma.vendor.findMany()]);

  for (const c of customers) {
    if (c.contactEmail && c.contactEmail.toLowerCase() === email) {
      return { type: "customer", id: c.id, name: c.name, matchedOn: "email" };
    }
  }
  for (const v of vendors) {
    if (v.contactEmail && v.contactEmail.toLowerCase() === email) {
      return { type: "vendor", id: v.id, name: v.name, matchedOn: "email" };
    }
  }

  if (domain) {
    for (const c of customers) {
      if (c.contactEmail && domainOf(c.contactEmail) === domain) {
        return { type: "customer", id: c.id, name: c.name, matchedOn: "domain" };
      }
    }
    for (const v of vendors) {
      if (v.contactEmail && domainOf(v.contactEmail) === domain) {
        return { type: "vendor", id: v.id, name: v.name, matchedOn: "domain" };
      }
    }
  }

  const lowerBody = body.toLowerCase();
  for (const c of customers) {
    if (lowerBody.includes(c.name.toLowerCase())) {
      return { type: "customer", id: c.id, name: c.name, matchedOn: "name" };
    }
  }
  for (const v of vendors) {
    if (lowerBody.includes(v.name.toLowerCase())) {
      return { type: "vendor", id: v.id, name: v.name, matchedOn: "name" };
    }
  }

  return { type: "none", matchedOn: "none" };
}
