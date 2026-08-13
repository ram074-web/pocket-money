import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance & Operations Control Center",
  description: "Integrated Sales, Invoicing, Receivables & Payables Management",
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
      </body>
    </html>
  );
}
