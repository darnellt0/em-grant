import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <main>
      <header style={{ marginBottom: 16 }}>
        <h1>Dashboard</h1>
        <p>Signed in as {user.email}</p>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/dashboard/grants">Grants</Link>
          <Link href="/dashboard/runs">Runs</Link>
          <Link href="/dashboard/settings">Settings</Link>
          <Link href="/dashboard/settings/billing">Billing</Link>
          <Link href="/dashboard/settings/usage">Usage</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
