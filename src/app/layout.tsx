import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { UserBar } from "@/components/UserBar";
import { getCurrentUser } from "@/lib/auth";
import { canRoleAccess, type DataDomain } from "@/lib/inbox/permissions";

export const metadata: Metadata = {
  title: "Finance & Operations Control Center",
  description: "Integrated Sales, Invoicing, Receivables & Payables Management",
  // Lets iOS open the home-screen shortcut fullscreen; Android reads this
  // from manifest.ts instead.
  appleWebApp: {
    capable: true,
    title: "Finance Ops",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
  // The layout is designed to fit a phone screen; allowing zoom keeps the
  // dense financial tables accessible.
  maximumScale: 5,
};

// `domain` gates the link by role. Hiding a link is only a convenience —
// each page independently enforces access server-side.
const NAV: { href: string; label: string; domain?: DataDomain }[] = [
  { href: "/", label: "Dashboard", domain: "dashboard" },
  { href: "/customers", label: "Customers", domain: "customers" },
  { href: "/vendors", label: "Vendors", domain: "payables" },
  { href: "/invoices", label: "Invoices", domain: "invoices" },
  { href: "/actions", label: "My Action List" },
  { href: "/projects", label: "Project Profitability", domain: "projects" },
  { href: "/ask", label: "Ask", domain: "dashboard" },
  { href: "/import", label: "Excel Import", domain: "invoices" },
  { href: "/inbox", label: "Email + WhatsApp Inbox" },
  { href: "/whatsapp", label: "WhatsApp Simulator" },
  { href: "/permissions", label: "Controls & Permissions" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  // Signed-out visitors only ever see the login screen, which renders itself
  // without the app shell.
  if (!user) {
    return (
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full">
          {children}
          <ServiceWorkerRegistrar />
        </body>
      </html>
    );
  }

  const visibleNav = NAV.filter((item) => !item.domain || canRoleAccess(user.roleLabel, item.domain));

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col md:flex-row">
        <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--surface)] md:flex md:flex-col">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="font-semibold text-sm leading-tight">Finance &amp; Operations</div>
            <div className="text-xs text-[var(--muted)]">Control Center</div>
          </div>
          <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1 text-sm md:flex-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-md hover:bg-[var(--background)] whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <UserBar user={user} />
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
