// Prepares .next/standalone to be shipped inside the Electron app.
//
// `next build` with output:"standalone" emits a self-contained server plus a
// traced subset of node_modules, but deliberately leaves out `public/` and
// `.next/static` (on a normal deployment a CDN serves those). The desktop app
// has no CDN, so they get copied in here.
import { cp, rm, mkdir, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.error('Missing .next/standalone — run "next build" with output:"standalone" first.');
  process.exit(1);
}

await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

// The build copies the project's .env into the standalone output. In the
// desktop app the database lives in the user's app-data directory and the
// path is set by the Electron main process at runtime, so a stale
// DATABASE_URL pointing at a dev file must not ship.
await rm(path.join(standalone, ".env"), { force: true });

// Blank, fully-migrated database that gets copied into the user's app-data
// folder on first launch. Built here in Node rather than a shell one-liner so
// the same command works on the Windows CI runner as on macOS/Linux.
const resourcesDir = path.join(root, "resources");
await mkdir(resourcesDir, { recursive: true });
const templateDb = path.join(resourcesDir, "db-template.db");
await rm(templateDb, { force: true });

execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    // Prisma accepts forward slashes on every platform; backslashes in a
    // file: URL would be read as escapes.
    DATABASE_URL: `file:${templateDb.split(path.sep).join("/")}`,
  },
});

if (!(await exists(templateDb))) {
  console.error(`Failed to create the database template at ${templateDb}`);
  process.exit(1);
}

// Note for future maintainers: electron-builder skips dot-directories when
// copying extraResources, but Prisma's generated client lives in
// node_modules/.prisma. package.json's build.extraResources therefore lists
// it explicitly — without that entry the packaged app dies at startup with
// "Cannot find module '.prisma/client/default'".

console.log("Desktop bundle prepared at .next/standalone");
