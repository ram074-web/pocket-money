import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { canRoleAccess, type DataDomain } from "@/lib/inbox/permissions";

/**
 * Guard for API route handlers. Returns either the signed-in user or a
 * response to return immediately.
 *
 * The middleware only checks that a session cookie is present — it runs on
 * the edge runtime and can't reach the database. This is where the session
 * is actually validated, so revoked sessions and deactivated users are
 * rejected here.
 */
export async function requireApiUser(
  domain?: DataDomain
): Promise<{ user: SessionUser; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getCurrentUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  if (domain && !canRoleAccess(user.roleLabel, domain)) {
    return {
      response: NextResponse.json(
        { error: `Your role (${user.roleLabel}) does not have access to ${domain}.` },
        { status: 403 }
      ),
    };
  }

  return { user };
}
