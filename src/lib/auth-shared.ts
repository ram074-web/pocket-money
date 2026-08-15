// Constants shared between the edge middleware and the Node server runtime.
// Kept in its own module because middleware can't import src/lib/auth.ts —
// that pulls in Prisma, which doesn't run on the edge runtime.
export const SESSION_COOKIE = "fo_session";
