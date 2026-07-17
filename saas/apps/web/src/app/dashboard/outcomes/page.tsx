import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type Grant = {
  id: string;
  grant_name: string;
  sponsor_org: string | null;
  amount_text: string | null;
  outcome_status: string | null;
  application_date: string | null;
  outcome_date: string | null;
  outcome_amount: number | null;
  outcome_note: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; order: number }> = {
  won:       { label: "Won",        color: "#1a7f4e", order: 1 },
  in_review: { label: "In Review",  color: "#b45309", order: 2 },
  applied:   { label: "Applied",    color: "#0b57d0", order: 3 },
  declined:  { label: "Declined",   color: "#c0392b", order: 4 },
  skipped:   { label: "Skipped",    color: "#6b7280", order: 5 },
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, sublabel, color = "#111" }: { label: string; value: string; sublabel?: string; color?: string }) {
  return (
    <div style={{
      padding: "16px 18px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", flex: 1, minWidth: 180,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sublabel && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{sublabel}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const meta = status ? STATUS_META[status] : null;
  if (!meta) return <span style={{ color: "#9ca3af", fontSize: 13 }}>—</span>;
  return (
    <span style={{
      fontSize: 12, fontWeight: 600,
      padding: "3px 10px", borderRadius: 999,
      background: meta.color + "18", color: meta.color,
      border: `1px solid ${meta.color}44`,
    }}>
      {meta.label}
    </span>
  );
}

export default async function OutcomesPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  // Pull ALL grants with an outcome_status set (any of applied/in_review/won/declined/skipped).
  const { data: rawGrants, error } = await supabase
    .from("grants")
    .select("id, grant_name, sponsor_org, amount_text, outcome_status, application_date, outcome_date, outcome_amount, outcome_note")
    .eq("org_id", orgId)
    .not("outcome_status", "is", null)
    .order("outcome_date", { ascending: false, nullsFirst: false });

  if (error) {
    return <p>Failed to load outcomes: {error.message}</p>;
  }

  const grants = (rawGrants ?? []) as Grant[];

  // Aggregate totals
  const totals = {
    applied: 0,
    in_review: 0,
    won: 0,
    declined: 0,
    skipped: 0,
    won_amount: 0,
  };
  for (const g of grants) {
    const s = g.outcome_status;
    if (s && s in totals) (totals as Record<string, number>)[s] += 1;
    if (s === "won" && g.outcome_amount != null) {
      totals.won_amount += Number(g.outcome_amount);
    }
  }

  // Win-rate funnel
  const inFlightCount = totals.applied + totals.in_review;
  const decidedCount = totals.won + totals.declined;
  const winRate = decidedCount > 0 ? Math.round((totals.won / decidedCount) * 100) : null;
  const conversionApplied = (decidedCount + inFlightCount) > 0 ? Math.round((decidedCount / (decidedCount + inFlightCount)) * 100) : null;

  // Group by status (sorted)
  const grouped: Record<string, Grant[]> = {};
  for (const g of grants) {
    const s = g.outcome_status ?? "unknown";
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(g);
  }
  const groupOrder = Object.keys(grouped).sort((a, b) => (STATUS_META[a]?.order ?? 99) - (STATUS_META[b]?.order ?? 99));

  return (
    <section>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Outcomes</h2>
      <p style={{ color: "#6b7280", marginTop: 0, marginBottom: 24 }}>
        Application pipeline and funder conversion metrics. Updates here come from the &ldquo;Outcome&rdquo; card on each grant detail page.
      </p>

      {/* Top stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <StatCard
          label="Won (lifetime)"
          value={fmtMoney(totals.won_amount)}
          sublabel={`${totals.won} grant${totals.won === 1 ? "" : "s"}`}
          color="#1a7f4e"
        />
        <StatCard
          label="In flight"
          value={String(inFlightCount)}
          sublabel={`${totals.applied} applied + ${totals.in_review} in review`}
          color="#0b57d0"
        />
        <StatCard
          label="Win rate"
          value={winRate != null ? `${winRate}%` : "—"}
          sublabel={decidedCount > 0 ? `${totals.won} of ${decidedCount} decided` : "no decisions yet"}
          color={winRate != null && winRate >= 50 ? "#1a7f4e" : "#b45309"}
        />
        <StatCard
          label="Application rate"
          value={conversionApplied != null ? `${conversionApplied}%` : "—"}
          sublabel={`${decidedCount} resolved of ${decidedCount + inFlightCount} applied total`}
        />
      </div>

      {/* Funnel breakdown */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Pipeline funnel</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14 }}>
          {(["applied", "in_review", "won", "declined", "skipped"] as const).map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge status={s} />
              <span style={{ color: "#374151", fontWeight: 600 }}>{totals[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {grants.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "32px 16px" }}>
          <p style={{ color: "#6b7280", marginBottom: 12 }}>
            No outcomes tracked yet. Open a grant from <Link href="/dashboard/grants">Grants</Link> and use the &ldquo;Outcome&rdquo; card to mark it as Applied, Won, Declined, or Skipped.
          </p>
        </div>
      ) : (
        groupOrder.map((status) => {
          const meta = STATUS_META[status];
          const rows = grouped[status];
          return (
            <div className="card" key={status} style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <span>{meta?.label ?? status}</span>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>({rows.length})</span>
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <th style={{ padding: "8px 12px 8px 0", fontWeight: 600 }}>Grant</th>
                      <th style={{ padding: "8px 12px", fontWeight: 600 }}>Funder</th>
                      <th style={{ padding: "8px 12px", fontWeight: 600 }}>Applied</th>
                      <th style={{ padding: "8px 12px", fontWeight: 600 }}>Decided</th>
                      <th style={{ padding: "8px 0 8px 12px", fontWeight: 600, textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr key={g.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px 10px 0" }}>
                          <Link href={`/dashboard/grants/${g.id}`} style={{ color: "#0b57d0", textDecoration: "none", fontWeight: 500 }}>
                            {g.grant_name}
                          </Link>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{g.sponsor_org ?? "—"}</td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{g.application_date ?? "—"}</td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{g.outcome_date ?? "—"}</td>
                        <td style={{ padding: "10px 0 10px 12px", textAlign: "right", color: status === "won" ? "#1a7f4e" : "#374151", fontWeight: status === "won" ? 600 : 400 }}>
                          {status === "won" ? fmtMoney(g.outcome_amount) : (g.amount_text ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
