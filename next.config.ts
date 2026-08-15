import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" emits .next/standalone with a self-contained server.js and
  // only the traced subset of node_modules. The Electron desktop build ships
  // that folder rather than the whole dependency tree — it's what makes the
  // packaged app both correct (module resolution matches what was traced)
  // and a fraction of the size.
  output: "standalone",
  // Prisma's query engine is a native .node binary resolved at runtime, so it
  // must stay a real external require rather than being bundled.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
