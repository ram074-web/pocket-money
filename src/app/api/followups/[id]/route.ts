import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== "DONE" && status !== "CANCELLED" && status !== "PENDING") {
    return NextResponse.json({ error: "status must be DONE, CANCELLED, or PENDING" }, { status: 400 });
  }

  const existing = await prisma.followUp.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
  }

  const updated = await prisma.followUp.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({
    data: {
      entityType: "FollowUp",
      entityId: id,
      action: "status_change",
      field: "status",
      oldValue: existing.status,
      newValue: status,
      // Real attribution now that requests are authenticated — the audit
      // trail records who actually made the change.
      actor: `${user.name} <${user.email}>`,
    },
  });

  return NextResponse.json(updated);
}
