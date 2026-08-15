import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import type { UserRole } from "@prisma/client";
import { canRoleAccess, type DataDomain, type Role } from "@/lib/inbox/permissions";
import { SESSION_COOKIE } from "@/lib/auth-shared";

export { SESSION_COOKIE };
const SESSION_DAYS = 7;

// The database stores the enum form; the permission matrix (spec section 17)
// is keyed by the human-readable form. One mapping, in one place.
const ROLE_LABEL: Record<UserRole, Role> = {
  OWNER: "Owner",
  FINANCE_MANAGER: "Finance Manager",
  SALES: "Sales",
  OPERATIONS: "Operations",
  ACCOUNTS_EXECUTIVE: "Accounts Executive",
};

export function roleLabel(role: UserRole): Role {
  return ROLE_LABEL[role];
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleLabel: Role;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies credentials and issues a session. Returns null for bad
 * credentials or a deactivated account — deliberately without saying which,
 * so the response can't be used to enumerate valid email addresses.
 */
export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  if (!user || !user.active) {
    // Still spend the hashing time so a missing user isn't detectable by how
    // fast the request fails.
    await verifyPassword(password, "scrypt:00:00");
    return null;
  }

  if (!(await verifyPassword(password, user.passwordHash))) return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production; omitted in dev so http://localhost still works.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { id: user.id, email: user.email, name: user.name, role: user.role, roleLabel: roleLabel(user.role) };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user, or null. Expired sessions are deleted on
 * sight, and a deactivated user's session stops working immediately.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.active) return null;

  const { user } = session;
  return { id: user.id, email: user.email, name: user.name, role: user.role, roleLabel: roleLabel(user.role) };
}

/** For pages: returns the user or redirects to the login screen. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For pages: requires the user's role to cover a data domain (spec section
 * 17). This is the server-side enforcement — the UI hiding a nav link is a
 * convenience, not a control.
 */
export async function requireAccess(domain: DataDomain): Promise<SessionUser> {
  const user = await requireUser();
  if (!canRoleAccess(user.roleLabel, domain)) redirect("/no-access");
  return user;
}

/**
 * Where to send a user after signing in. Roles without dashboard access
 * would otherwise land on "Not authorized" immediately, so they go to the
 * first area their role actually covers.
 */
export function landingPathFor(role: Role): string {
  if (canRoleAccess(role, "dashboard")) return "/";
  if (canRoleAccess(role, "customers")) return "/customers";
  if (canRoleAccess(role, "invoices")) return "/invoices";
  if (canRoleAccess(role, "projects")) return "/projects";
  // Every signed-in user can see their own action list.
  return "/actions";
}

/** True when no account exists yet, so first-run setup can be offered. */
export async function needsFirstRunSetup(): Promise<boolean> {
  return (await prisma.user.count()) === 0;
}

/** Housekeeping: drop expired sessions. Safe to call opportunistically. */
export async function purgeExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
