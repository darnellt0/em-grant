import Link from "next/link";
import { requireUser, requireOrgIdForUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("org_profiles")
    .select("org_name")
    .eq("org_id", orgId)
    .maybeSingle();

  const orgName = profile?.org_name ?? "My Organization";

  return (
    <main>
      <header style={{
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 2 }}>
            Grant Discovery
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>{orgName}</div>
        </div>
        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { href: "/dashboard/grants", label: "Grants" },
            { href: "/dashboard/outcomes", label: "Outcomes" },
            { href: "/dashboard/runs", label: "Runs" },
            { href: "/dashboard/settings", label: "Settings" },
            { href: "/dashboard/settings/billing", label: "Billing" },
            { href: "/dashboard/help", label: "Help" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 14, fontWeight: 500,
              color: "#374151", textDecoration: "none", background: "#f3f4f6",
            }}>
              {label}
            </Link>
          ))}
          <span style={{ padding: "6px 14px", fontSize: 13, color: "#9ca3af", alignSelf: "center" }}>
            {user.email}
          </span>
        </nav>
      </header>
      {children}
    </main>
  );
}
