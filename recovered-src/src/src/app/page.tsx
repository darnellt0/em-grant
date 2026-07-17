import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>EM Grant SaaS</h1>
      <p>Phase 2 dashboard shell for multi-org grant operations.</p>
      <p>
        <Link href="/login">Login</Link> | <Link href="/dashboard/grants">Go to Dashboard</Link>
      </p>
    </main>
  );
}
