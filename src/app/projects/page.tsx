import Link from "next/link";
import { getDashboardData, fmtINR } from "@/lib/calc";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MARGIN_THRESHOLD = 0.15;

export default async function ProjectsPage() {
  await requireAccess("projects");

  const d = await getDashboardData();
  const rows = [...d.projectProfitability].sort((a, b) => (a.margin ?? 1) - (b.margin ?? 1));

  return (
    <div>
      <PageHeader
        title="Project Profitability"
        subtitle={`Revenue − Vendor Cost − Other Direct Costs = Gross Profit. Alert threshold: ${(MARGIN_THRESHOLD * 100).toFixed(0)}% margin.`}
      />
      <div className="p-6">
        <Section title={`${rows.length} project(s)`}>
          {rows.length === 0 ? (
            <EmptyState text="No projects yet." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Customer</th>
                  <th>Division</th>
                  <th>Revenue</th>
                  <th>Vendor Cost</th>
                  <th>Other Cost</th>
                  <th>Gross Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const belowThreshold = r.margin != null && r.margin < MARGIN_THRESHOLD;
                  return (
                    <tr key={r.project.id}>
                      <td>{r.project.name}</td>
                      <td>
                        <Link href={`/customers/${r.project.customerId}`} className="text-[var(--brand)] hover:underline">
                          {r.project.customer.name}
                        </Link>
                      </td>
                      <td>{r.project.division === "DIGITAL_MARKETING" ? "Digital" : "Print"}</td>
                      <td>{fmtINR(r.revenue)}</td>
                      <td>{fmtINR(r.vendorCost)}</td>
                      <td>{fmtINR(r.otherCost)}</td>
                      <td className={r.grossProfit < 0 ? "text-[var(--red)]" : ""}>{fmtINR(r.grossProfit)}</td>
                      <td>
                        {r.margin != null ? (
                          <span className={belowThreshold ? "badge badge-red" : "badge badge-green"}>
                            {(r.margin * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="badge badge-gray">No revenue yet</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}
