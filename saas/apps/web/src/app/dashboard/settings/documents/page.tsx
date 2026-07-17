import Link from "next/link";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { DocumentUploader } from "./DocumentUploader";
import { DocumentRow } from "./DocumentRow";
import { DriveSyncForm } from "./drive-sync/DriveSyncForm";

type Doc = {
  id: string;
  name: string;
  kind: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  created_at: string;
  source: string;
  drive_file_id: string | null;
};

// Recommended documents every org should upload (used for the checklist UI).
const RECOMMENDED: Array<{ kind: string; label: string; whoNeedsIt: string }> = [
  { kind: "irs_letter",   label: "501(c)(3) Determination Letter", whoNeedsIt: "Most federal/foundation grants for nonprofits" },
  { kind: "form_990",     label: "IRS Form 990 (most recent)",     whoNeedsIt: "Most foundation grants" },
  { kind: "audit",        label: "Audited Financials",              whoNeedsIt: "Grants over $50K typically require this" },
  { kind: "board_roster", label: "Board of Directors Roster",       whoNeedsIt: "Foundation + corporate grants" },
  { kind: "budget",       label: "Project Budget Template",         whoNeedsIt: "Almost every application" },
  { kind: "founder_bio",  label: "Founder / Leadership Bios",       whoNeedsIt: "Almost every application" },
];

export default async function DocumentsPage() {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const [{ data: docs, error }, { data: driveCfg }] = await Promise.all([
    supabase
      .from("org_documents")
      .select("id, name, kind, storage_path, mime_type, size_bytes, description, created_at, source, drive_file_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("org_drive_sync_config")
      .select("drive_folder_id, drive_folder_label, enabled, drive_account, sync_requested_at, last_synced_at, last_sync_status, last_sync_message, files_synced_total")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (error) return <p>Failed to load documents: {error.message}</p>;

  const documents = (docs ?? []) as Doc[];
  const haveKinds = new Set(documents.map((d) => d.kind));

  return (
    <section>
      <div style={{ marginBottom: 8 }}>
        <Link href="/dashboard/settings" style={{ fontSize: 13, color: "#666" }}>← Back to settings</Link>
      </div>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Documents</h2>
      <p style={{ color: "#6b7280", marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Store the org documents grant funders typically require — IRS letter, 990, audit, board roster, budget templates, founder bios.
        Upload once, reference everywhere. Each grant&apos;s application checklist will know which of these you have.
      </p>

      {/* Recommended checklist */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Recommended uploads</h3>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          The 80% of documents funders ask for. Green = you have one, gray = missing.
        </p>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {RECOMMENDED.map((r) => {
            const have = haveKinds.has(r.kind);
            return (
              <li key={r.kind} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "8px 12px",
                background: have ? "#f0fdf4" : "#f9fafb",
                border: `1px solid ${have ? "#bbf7d0" : "#e5e7eb"}`,
                borderRadius: 6, fontSize: 13,
              }}>
                <span style={{
                  flexShrink: 0, color: have ? "#1a7f4e" : "#9ca3af",
                  fontWeight: 700, width: 16, textAlign: "center",
                }}>
                  {have ? "✓" : "○"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: have ? "#1a7f4e" : "#374151", fontWeight: 500 }}>{r.label}</div>
                  <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>{r.whoNeedsIt}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <DriveSyncForm initial={driveCfg as Parameters<typeof DriveSyncForm>[0]["initial"]} />

      <DocumentUploader />

      {documents.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "32px 16px" }}>
          <p style={{ color: "#6b7280", margin: 0 }}>
            No documents yet. Upload one above.
          </p>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your documents ({documents.length})</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "8px 12px 8px 0", fontWeight: 600 }}>Name</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Type</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Size</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Uploaded</th>
                  <th style={{ padding: "8px 0 8px 12px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => <DocumentRow key={d.id} doc={d} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
