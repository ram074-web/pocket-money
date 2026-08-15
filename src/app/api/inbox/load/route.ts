import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { demoMessages } from "@/lib/inbox/fixtures";
import { processInboundMessage } from "@/lib/inbox/process";
import { today } from "@/lib/calc";
import { requireApiUser } from "@/lib/api-auth";

// Idempotent: re-running this only processes fixtures that haven't been
// processed yet (matched by sender + subject + receivedAt), so clicking
// "Load Sample Scenarios" repeatedly never creates duplicate records. To
// fully reset the demo, run `npm run db:seed`.
export async function POST() {
  const { response } = await requireApiUser();
  if (response) return response;

  // Floor to the start of the day so repeated calls within the same day
  // produce byte-identical receivedAt timestamps for each fixture — that's
  // what makes the existing-message lookup below actually find a match.
  const anchor = today();
  anchor.setHours(0, 0, 0, 0);
  const messages = demoMessages(anchor);
  let processed = 0;
  let skipped = 0;

  for (const msg of messages) {
    const existing = await prisma.inboundMessage.findFirst({
      where: { fromAddress: msg.fromAddress, subject: msg.subject, receivedAt: msg.receivedAt },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await processInboundMessage(msg);
    processed++;
  }

  return NextResponse.json({ processed, skipped, total: messages.length });
}
