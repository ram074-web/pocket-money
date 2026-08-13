import { PageHeader, Section } from "@/components/ui";
import { AUTOMATICALLY_ALLOWED_ACTIONS, APPROVAL_REQUIRED_ACTIONS, ROLES, domainsForRole } from "@/lib/inbox/permissions";

export default function PermissionsPage() {
  return (
    <div>
      <PageHeader
        title="Controls & Permissions"
        subtitle="What this system is and isn't allowed to do automatically, and exactly what would be required to connect it to a real inbox or WhatsApp number."
      />
      <div className="p-6 space-y-6">
        <Section title="Current mode">
          <p className="text-sm">
            <span className="badge badge-green">Test Mode</span> — this app is not connected to any real email
            account or WhatsApp number. The <code>/inbox</code> page runs the classification/routing engine only
            against fixture messages defined in <code>src/lib/inbox/fixtures.ts</code>. No message has ever been
            read from or sent to a real inbox, and no WhatsApp message has ever been sent — there is no WhatsApp
            provider connected at all.
          </p>
        </Section>

        <Section title="Automatically allowed actions (Section 16)">
          <ul className="text-sm list-disc pl-5 space-y-1">
            {AUTOMATICALLY_ALLOWED_ACTIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>

        <Section title="Actions that always require human approval (Section 16)">
          <ul className="text-sm list-disc pl-5 space-y-1">
            {APPROVAL_REQUIRED_ACTIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)] mt-3">
            In this build every one of these is drafted only — see the WhatsApp/email drafts on each inbound
            message&apos;s detail page. Nothing is ever transmitted automatically, regardless of category.
          </p>
        </Section>

        <Section title="Role-based access (Section 17)">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Can access</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => {
                const domains = domainsForRole(role);
                return (
                  <tr key={role}>
                    <td className="font-medium">{role}</td>
                    <td>{domains === "ALL" ? "Full access to all data" : domains.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-[var(--muted)] mt-3">
            Try this in the <a href="/whatsapp" className="text-[var(--brand)] hover:underline">WhatsApp Simulator</a> —
            switch roles and ask about payables/receivables to see access denied for out-of-scope roles.
          </p>
        </Section>

        <Section title="Before enabling real Gmail access">
          <p className="text-sm mb-3">
            This is what would actually be requested — nothing beyond this list, and nothing is enabled until you
            explicitly say so.
          </p>
          <table className="data-table mb-4">
            <thead>
              <tr>
                <th>Gmail OAuth scope</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>gmail.readonly</code></td>
                <td>Read incoming mail to classify and extract PO/invoice/payment information. Required minimum.</td>
              </tr>
              <tr>
                <td><code>gmail.labels</code> (optional)</td>
                <td>Tag processed emails (e.g. &quot;Processed&quot;, &quot;Needs Verification&quot;) so nothing is read twice — cosmetic, not required.</td>
              </tr>
              <tr>
                <td><code>gmail.send</code> or <code>gmail.compose</code></td>
                <td>
                  Only needed if/when you authorize the system to actually send drafted emails. Until then, drafts
                  stay inside this app for your review — this scope would not be requested at all in the current
                  draft-only mode.
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm font-medium mb-1">What the system would be allowed to do with that access:</p>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Read new emails and classify them (this never modifies your mailbox).</li>
            <li>Extract structured data and match it against quotations/POs/invoices already in this system.</li>
            <li>Create draft invoices, follow-ups, and internal records — exactly as it does now with fixtures.</li>
            <li>Prepare draft reply emails, held for your approval — never sent without the <code>gmail.send</code> scope and your explicit sign-off per message.</li>
          </ul>
          <p className="text-sm font-medium mt-4 mb-1">What it would never do, even with full access:</p>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Delete or move emails.</li>
            <li>Send anything externally without a human clicking approve on that specific draft.</li>
            <li>Issue invoices, change invoice values, approve vendor payments, or cancel/credit-note invoices automatically (Section 16).</li>
          </ul>
        </Section>

        <Section title="Before enabling live WhatsApp">
          <p className="text-sm">
            No WhatsApp connector is available in this environment today. Going live would require a WhatsApp
            Business API provider (e.g. Meta Cloud API, Twilio, or 360dialog) with its own credentials and phone
            number, plus a webhook endpoint for inbound messages. The command logic in{" "}
            <code>src/lib/inbox/whatsapp-commands.ts</code> and the notification templates in{" "}
            <code>src/lib/inbox/whatsapp-templates.ts</code> are written to be channel-agnostic already — going live
            is a matter of writing a new adapter that turns provider webhooks into the same{" "}
            <code>IncomingMessage</code> shape the demo fixtures use, and turning outbound{" "}
            <code>WhatsAppDraft</code> rows into actual API calls once a human approves them. No core business logic
            changes.
          </p>
        </Section>
      </div>
    </div>
  );
}
