import { NextRequest, NextResponse } from "next/server";
import { handleWhatsAppCommand } from "@/lib/inbox/whatsapp-commands";
import { ROLES, type Role } from "@/lib/inbox/permissions";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const requestedRole = body?.role as Role | undefined;

  if (!text) return NextResponse.json({ error: "A 'text' string is required." }, { status: 400 });

  // The role is taken from the session, never from the request body —
  // otherwise any signed-in user could ask as "Owner" and read everything.
  //
  // Owners may still simulate a *different* role, because that is the point
  // of the demo page and an Owner already has full access, so nothing is
  // escalated. Everyone else is pinned to their own role.
  let effectiveRole: Role = user.roleLabel;
  if (user.roleLabel === "Owner" && requestedRole) {
    if (!ROLES.includes(requestedRole)) {
      return NextResponse.json({ error: `role must be one of: ${ROLES.join(", ")}` }, { status: 400 });
    }
    effectiveRole = requestedRole;
  }

  const reply = await handleWhatsAppCommand(text, effectiveRole);
  return NextResponse.json({ ...reply, role: effectiveRole, simulated: effectiveRole !== user.roleLabel });
}
