import { Channel, MessageSource } from "@prisma/client";
import type { IncomingMessage } from "./types";

// Nine demo messages covering every category the spec asks to demonstrate.
// These stand in for a real Gmail/WhatsApp adapter in test mode — every
// sender/amount either matches or deliberately diverges from the seeded
// customers/vendors/quotations so the matching engine has real cases to
// verify, flag, or fail to find, rather than everything trivially passing.
export function demoMessages(now: Date): IncomingMessage[] {
  return [
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "priyanka.rao@skylinebeverages.com",
      fromName: "Priyanka Rao",
      toAddress: "sales@company.com",
      subject: "Request for Quotation — Digital Launch Campaign",
      body: `Hi team,

We are launching a new product line and would like a quotation for a digital marketing campaign.

Requirement: Social media, influencer outreach and paid ads for a new beverage product launch across 4 metro cities.
Timeline: Campaign to start within 6 weeks.
Quantity/Scope: 3-month retainer.

Please share your proposal and pricing at the earliest.

Regards,
Priyanka Rao
Marketing Manager, Skyline Beverages Ltd`,
      receivedAt: new Date(now.getTime() - 6 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "sarah.thomas@meridianretail.com",
      fromName: "Sarah Thomas",
      toAddress: "accounts@company.com",
      subject: "Purchase Order — Additional Signage (10 Outlets)",
      body: `Hello,

Please find our Purchase Order details below for the additional signage work.

PO No: PO-MER-5522
PO Date: 18 Aug 2026
Quotation No: QT-2026-0210
PO Value: ₹4,95,600
Project: Additional signage for 10 new outlets
Payment Terms: 30 days from invoice submission

Please proceed with production and invoice us against this PO.

Regards,
Sarah Thomas
Meridian Retail Group`,
      receivedAt: new Date(now.getTime() - 5 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "rohan.desai@nimbusfin.com",
      fromName: "Rohan Desai",
      toAddress: "accounts@company.com",
      subject: "Revised PO — Q4 Campaign Extension",
      body: `Hi,

Following our discussion, please treat this as a revised PO for the Q4 campaign extension — we negotiated a reduced scope.

PO No: PO-NIM-1250
PO Date: 20 Aug 2026
Quotation No: QT-2026-0215
PO Value: ₹5,60,000

This is a PO amendment on the earlier quotation. Kindly confirm and proceed.

Regards,
Rohan Desai
Nimbus Financial Services`,
      receivedAt: new Date(now.getTime() - 4 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "david.chen@sterlingpharma.com",
      fromName: "David Chen",
      toAddress: "accounts@company.com",
      subject: "RE: INV-1041 — Additional Correction Required",
      body: `Hi Arjun,

In addition to the GSTIN issue already flagged, please also correct the billing address on the invoice before resending.

Invoice No: INV-1041
Correction Needed: Update billing address to our new registered office (see letterhead) in addition to the GSTIN fix already requested.

Thanks,
David Chen
Sterling Pharma International`,
      receivedAt: new Date(now.getTime() - 3 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "amit.verma@bluewavetech.com",
      fromName: "Amit Verma",
      toAddress: "accounts@company.com",
      subject: "Payment Confirmation — INV-0987 Balance",
      body: `Hi team,

We have transferred the balance amount for the website revamp invoice. Details below:

Invoice No: INV-0987
Amount Paid: ₹4,62,000
Payment Date: 12 Aug 2026
UTR: HDFCN52209871234

Please confirm receipt.

Regards,
Amit Verma
BlueWave Technologies`,
      receivedAt: new Date(now.getTime() - 2 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "neha.kapoor@orionglobalfoods.com",
      fromName: "Neha Kapoor",
      toAddress: "accounts@company.com",
      subject: "RE: Payment Reminder — INV-1025",
      body: `Hi Kavita,

Apologies for the delay on this. Our finance team has approved the invoice and we will process payment by 25 Aug 2026.

Invoice No: INV-1025

Thanks for your patience.

Neha Kapoor
Orion Global Foods Pvt Ltd`,
      receivedAt: new Date(now.getTime() - 2 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "contact@brightboxstudio.in",
      fromName: "Rakesh Kumar",
      toAddress: "procurement@company.com",
      subject: "Quotation for Reel & Video Production Services",
      body: `Hello,

Thank you for reaching out. Please find our indicative quotation/pricing for reel and short-video production services below.

Our rates: ₹15,000 per finished reel (up to 60 seconds), bulk discounts available above 10 reels/month.

Happy to discuss further and share a formal quote once scope is confirmed.

Best,
Rakesh Kumar
BrightBox Digital Studio`,
      receivedAt: new Date(now.getTime() - 1 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "accounts@signageworld.in",
      fromName: "Divya Pillai",
      toAddress: "accountspayable@company.com",
      subject: "New Invoice — SGW-INV-341",
      body: `Hi,

Please find our invoice details for the recent order below.

Invoice No: SGW-INV-341
Invoice Date: 20 Aug 2026
PO No: VPO-SGW-812
Amount: ₹1,85,000
Tax Amount: ₹33,300
Due Date: 15 Sep 2026

Kindly process for payment.

Regards,
Divya Pillai
Signage World`,
      receivedAt: new Date(now.getTime() - 1 * 86400000),
    },
    {
      channel: Channel.EMAIL,
      source: MessageSource.DEMO_GMAIL,
      fromAddress: "billing@printhouseind.com",
      fromName: "Sunita Menon",
      toAddress: "accountspayable@company.com",
      subject: "Payment Status Request — PHI-INV-4402",
      body: `Hello,

Kindly release payment for our invoice, it has been pending for a while and we would appreciate an update.

Invoice No: PHI-INV-4402

Regards,
Sunita Menon
PrintHouse Industries`,
      receivedAt: now,
    },
  ];
}
