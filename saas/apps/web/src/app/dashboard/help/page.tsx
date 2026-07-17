import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

// Static, server-rendered help page. Walks a new user through the full
// identify → apply → win loop with a concrete walkthrough at the top.
// Worth keeping low-tech (no client state) so it loads fast and prints cleanly.

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "20px 24px",
  marginBottom: 16,
};

const STEP_NUM: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 999,
  background: "#0b57d0",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  marginRight: 12,
  flexShrink: 0,
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 18 }}>
      <span style={STEP_NUM}>{n}</span>
      <div style={{ flex: 1, paddingTop: 2 }}>
        <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "#111" }}>{title}</h4>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "#374151" }}>{children}</div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      padding: "1px 6px", borderRadius: 4, background: "#f3f4f6",
      border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "ui-monospace, monospace",
      color: "#111",
    }}>{children}</code>
  );
}

export default async function HelpPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("org_profiles").select("org_name, entity_type").eq("org_id", orgId).maybeSingle();
  const orgName = profile?.org_name ?? "your organization";

  return (
    <section style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 6px" }}>How to use this</h2>
        <p style={{ color: "#6b7280", margin: 0, fontSize: 15 }}>
          The full identify → apply → win loop for {orgName}.
        </p>
      </div>

      {/* TLDR */}
      <div style={{ ...CARD, background: "#f0f7ff", border: "1px solid #c7dcfd" }}>
        <h3 style={{ marginTop: 0, color: "#0b57d0" }}>TL;DR</h3>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8, color: "#1f2937" }}>
          <li>Click a grant from <Link href="/dashboard/grants">Grants</Link></li>
          <li>Click <strong>Start application draft</strong> → wait 30-60 seconds → review the 11 drafted answers</li>
          <li>Edit / regenerate any answer that needs work, mark them <strong>Final</strong> as you go</li>
          <li>Hit <strong>Export view</strong> → copy each answer into the funder&apos;s actual application form</li>
          <li>After submitting, mark the grant <strong>Applied</strong> in the Outcome card</li>
          <li>When the funder decides, mark <strong>Won</strong> (with $ amount) or <strong>Declined</strong></li>
        </ol>
      </div>

      {/* Cartier walkthrough */}
      <div style={CARD}>
        <h3 style={{ marginTop: 0 }}>Walkthrough: Cartier Women&apos;s Initiative</h3>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 0 }}>
          A concrete example using the real grant in your dashboard. Deadline 2026-06-16.
        </p>

        <Step n={1} title="Open the grant">
          <Link href="/dashboard/grants">Grants</Link> → click <strong>Cartier Women&apos;s Initiative Awards</strong>.
          You&apos;ll see the grant detail page with metadata, scores, the Application Draft CTA, and the Outcome card.
        </Step>

        <Step n={2} title="Generate the first draft">
          In the blue <strong>Application Draft</strong> card click <strong>Start application draft</strong>.
          The system spends ~30-60 seconds calling Claude Sonnet to draft answers to 11 standard grant
          questions using <Link href="/dashboard/settings">your org profile</Link> + the existing pitch as context.
        </Step>

        <Step n={3} title="Review + edit each answer">
          When the page loads you&apos;ll see 11 cards. For each one:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>Read the draft answer</li>
            <li>Edit inline if it needs polish</li>
            <li>If wholly off — hit <strong>Regenerate&hellip;</strong> with feedback like &ldquo;lead with founder story&rdquo; or &ldquo;more specific about coaching methodology&rdquo;</li>
            <li>Watch the word count vs target (green = on target)</li>
            <li>Change the status pill: <Kbd>Draft</Kbd> → <Kbd>Reviewed</Kbd> → <Kbd>Final</Kbd></li>
            <li>Click <strong>Save</strong> when done with that question</li>
          </ul>
        </Step>

        <Step n={4} title="Add Cartier-specific questions">
          Cartier&apos;s real form has questions the 11-question template doesn&apos;t cover (impact metrics,
          1-minute video script, etc). Click <strong>+ Add a question</strong> at the bottom, paste the
          funder&apos;s exact wording + target word count. Then regenerate to get a draft answer for it.
        </Step>

        <Step n={5} title="Export and submit">
          Click <strong>Export view →</strong> at the top of the application page.
          Copy each answer (per-question button) and paste into Cartier&apos;s form at <em>cartierwomensinitiative.com</em>.
        </Step>

        <Step n={6} title="Track the outcome">
          Back on the grant detail page, find the <strong>Outcome</strong> card. Click <strong>Applied</strong>,
          set today&apos;s date. Later, when Cartier decides, come back and mark it <strong>Won</strong>
          (with the $ amount) or <strong>Declined</strong>. The <Link href="/dashboard/outcomes">Outcomes</Link> dashboard
          rolls these up into win-rate %, in-flight count, and lifetime $ won.
        </Step>
      </div>

      {/* Tips by surface */}
      <div style={CARD}>
        <h3 style={{ marginTop: 0 }}>Tips by surface</h3>

        <h4 style={{ marginTop: 16, marginBottom: 6 }}>Pitch card</h4>
        <ul style={{ marginTop: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
          <li>Expand <Kbd>▸ Tailoring options</Kbd> before generating to pick Length / Tone / Format. Cartier expects long-form narrative; Hello Alice prefers short LOI; Google for Startups wants data-driven.</li>
          <li>The <strong>Emphasis</strong> free-text field is the most powerful knob — &ldquo;lead with founder story&rdquo;, &ldquo;tie to economic mobility&rdquo;, &ldquo;emphasize measurable outcomes&rdquo;.</li>
          <li>👍/👎 rate the pitch after it&apos;s generated. Ratings store on the grant and will eventually feed back as few-shot examples.</li>
          <li>Regenerate REPLACES the prior pitch — it doesn&apos;t stack. Reset the rating on regenerate.</li>
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 6 }}>Application draft</h4>
        <ul style={{ marginTop: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
          <li>The 11-question template covers ~80% of what funders ask. Add custom questions for the other 20%.</li>
          <li>Each answer uses your org profile + the current pitch as context, so update your profile in Settings before drafting if the org has changed.</li>
          <li>Edit the question text (✎ pencil) if a funder asks a similar-but-different question. Word target updates too.</li>
          <li>Status: <Kbd>Draft</Kbd> = LLM output. <Kbd>Reviewed</Kbd> = you&apos;ve read it. <Kbd>Final</Kbd> = ready to copy into the form. <Kbd>Skipped</Kbd> = not applicable to this funder.</li>
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 6 }}>Outcomes</h4>
        <ul style={{ marginTop: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
          <li>Mark Applied <em>as soon as</em> you submit — that&apos;s what shifts the grant from &ldquo;in flight&rdquo; vs &ldquo;pipeline&rdquo;.</li>
          <li>Won outcomes need the $ amount to count toward lifetime totals.</li>
          <li>Skipped grants don&apos;t hurt your win rate. Decline-after-applying does.</li>
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 6 }}>Dorothy&apos;s analyses (EM only)</h4>
        <ul style={{ marginTop: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
          <li>If a grant has an amber 🎯 <strong>Dorothy&apos;s strategic analysis</strong> card, that&apos;s richer EM-specific
            verdict + alignment score + narrative from the Dorothy analyst pipeline.</li>
          <li>When Dorothy has analyzed a grant, the SaaS 6-dimension scores collapse into a <Kbd>▸ details</Kbd> toggle below — they&apos;re not gone, just demoted.</li>
          <li>If Dorothy says EXCLUDE, take it seriously — she&apos;s hardcoded to reject nonprofit-only grants for EM (which is an LLC).</li>
        </ul>
      </div>

      {/* FAQ */}
      <div style={CARD}>
        <h3 style={{ marginTop: 0 }}>FAQ</h3>

        <details style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            How are grants discovered?
          </summary>
          <p style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
            New grants flow into a shared <code>grants_raw</code> firehose from scrapers (Apps Script,
            SAM.gov adapter, curated corporate D&amp;I list). Click <strong>Run Discovery</strong> on the
            Grants page to surface candidates matching your org&apos;s entity type (nonprofit / hybrid / LLC).
            Claude Haiku then ranks them and picks the top 10 per run.
          </p>
        </details>

        <details style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Why does Cartier appear but not other big foundation grants?
          </summary>
          <p style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
            We curated 20 Tier-1 corporate D&amp;I and women-of-color founder programs (Hello Alice,
            Goldman 1M Black Women, Pharrell Black Ambition, Cartier, Tory Burch, Eileen Fisher, FedEx,
            Microsoft, Google, AWS, etc) plus federal Grants.gov + SAM.gov. Other foundation universes
            (Candid&apos;s Foundation Directory, Instrumentl) aren&apos;t integrated yet.
          </p>
        </details>

        <details style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Why does the application drafter cost money?
          </summary>
          <p style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
            Each question is a Claude Sonnet call (~$0.01-$0.03 each, so $0.10-$0.30 for the 11-question seed).
            Regenerations are similar. The Outcomes / Pitch / Discover surfaces also use Anthropic credits.
            Monthly cap lives at <a href="https://console.anthropic.com/settings/limits" target="_blank" rel="noopener noreferrer">console.anthropic.com/settings/limits</a>.
          </p>
        </details>

        <details style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            What happens to my data?
          </summary>
          <p style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
            Everything lives in Supabase Postgres, partitioned per-org by Row-Level Security. No tenant
            can see another tenant&apos;s grants, pitches, answers, or outcomes. Documents you upload to the
            Documents vault are in Supabase Storage with the same RLS scope.
          </p>
        </details>

        <details style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            What&apos;s the difference between &ldquo;Dorothy&rdquo; and the dashboard?
          </summary>
          <p style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
            Dorothy is a single-tenant analyst agent running on Darnell&apos;s local machine, specifically
            for Elevated Movements. She does deep strategic analysis (PURSUE/REVIEW/EXCLUDE verdicts,
            application strategy narratives). Her output writes into Supabase and surfaces in EM&apos;s
            dashboard. Other tenants (SFSC etc) don&apos;t have a Dorothy yet — they rely on the SaaS&apos;s
            built-in Claude Haiku curator.
          </p>
        </details>

        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Where do I report a bug or request a feature?
          </summary>
          <p style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
            Email darnell.tomlinson@gmail.com or file an issue in the em-grant repo.
          </p>
        </details>
      </div>

      {/* Glossary */}
      <div style={CARD}>
        <h3 style={{ marginTop: 0 }}>Glossary</h3>
        <dl style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          <dt style={{ fontWeight: 600, color: "#111" }}>Discovery</dt>
          <dd style={{ margin: "0 0 10px 0", color: "#374151" }}>
            The process of finding new grant opportunities matching your org&apos;s profile.
            Runs against the grants_raw firehose.
          </dd>
          <dt style={{ fontWeight: 600, color: "#111" }}>Engagement</dt>
          <dd style={{ margin: "0 0 10px 0", color: "#374151" }}>
            A per-org record that &ldquo;you&apos;ve looked at this grant&rdquo;. Stores Dorothy/SaaS verdict, alignment score, assessment text.
          </dd>
          <dt style={{ fontWeight: 600, color: "#111" }}>Pitch</dt>
          <dd style={{ margin: "0 0 10px 0", color: "#374151" }}>
            A 1-page strategic narrative. The thing you&apos;d use as a cover letter or executive summary.
            Generated with Claude Sonnet, tailored via Length/Tone/Format/Emphasis options.
          </dd>
          <dt style={{ fontWeight: 600, color: "#111" }}>Application draft</dt>
          <dd style={{ margin: "0 0 10px 0", color: "#374151" }}>
            The 8-15 long-form question answers a funder actually asks on their form. Defaults to a
            curated 11-question template; you add custom questions per funder.
          </dd>
          <dt style={{ fontWeight: 600, color: "#111" }}>Outcome</dt>
          <dd style={{ margin: "0 0 10px 0", color: "#374151" }}>
            What happened: Applied / In Review / Won / Declined / Skipped. Drives the win-rate metrics.
          </dd>
        </dl>
      </div>
    </section>
  );
}
