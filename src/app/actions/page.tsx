import { prisma } from "@/lib/db";
import { daysBetween, today } from "@/lib/calc";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { FollowUpRow } from "./FollowUpRow";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const followUps = await prisma.followUp.findMany({
    where: { status: "PENDING" },
    include: { customer: true, vendor: true, employee: true, invoice: true, vendorInvoice: true },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
  });

  const ref = today();
  const overdue = followUps.filter((f) => daysBetween(ref, f.dueDate) > 0);
  const dueTodayOrSoon = followUps.filter((f) => daysBetween(ref, f.dueDate) <= 0 && daysBetween(ref, f.dueDate) > -3);

  return (
    <div>
      <PageHeader title="My Action List" subtitle="What needs attention today, sorted by priority and due date" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Section title="Overdue">
            <div className="text-2xl font-semibold text-[var(--red)]">{overdue.length}</div>
          </Section>
          <Section title="Due Today / Very Soon">
            <div className="text-2xl font-semibold text-[var(--amber)]">{dueTodayOrSoon.length}</div>
          </Section>
          <Section title="Total Pending">
            <div className="text-2xl font-semibold">{followUps.length}</div>
          </Section>
        </div>

        <Section title="Action Queue">
          {followUps.length === 0 ? (
            <EmptyState text="Nothing pending — all caught up." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Customer / Vendor</th>
                  <th>Task</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Responsible</th>
                  <th>Next Action</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {followUps.map((f) => (
                  <FollowUpRow
                    key={f.id}
                    id={f.id}
                    priority={f.priority}
                    who={f.customer?.name ?? f.vendor?.name ?? "Internal"}
                    title={f.title}
                    amount={f.amount}
                    dueDate={f.dueDate.toDateString()}
                    overdueDays={daysBetween(ref, f.dueDate)}
                    responsible={f.employee?.name ?? "Unassigned"}
                    nextAction={f.nextAction}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}
