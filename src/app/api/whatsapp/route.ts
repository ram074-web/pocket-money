import { NextRequest, NextResponse } from "next/server";
import { handleWhatsAppCommand } from "@/lib/inbox/whatsapp-commands";
import { ROLES, type Role } from "@/lib/inbox/permissions";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const role = body?.role as Role;

  if (!text) return NextResponse.json({ error: "A 'text' string is required." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: `role must be one of: ${ROLES.join(", ")}` }, { status: 400 });

  const reply = await handleWhatsAppCommand(text, role);
  return NextResponse.json(reply);
}
