import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

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

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/vendors", label: "Vendors" },
  { href: "/invoices", label: "Invoices" },
  { href: "/actions", label: "My Action List" },
  { href: "/projects", label: "Project Profitability" },
  { href: "/ask", label: "Ask" },
  { href: "/import", label: "Excel Import" },
  { href: "/inbox", label: "Email + WhatsApp Inbox" },
  { href: "/whatsapp", label: "WhatsApp Simulator" },
  { href: "/permissions", label: "Controls & Permissions" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col md:flex-row">
        <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--surface)]">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="font-semibold text-sm leading-tight">Finance &amp; Operations</div>
            <div className="text-xs text-[var(--muted)]">Control Center</div>
          </div>
          <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-md hover:bg-[var(--background)] whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
