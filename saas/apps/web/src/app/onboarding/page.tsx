import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { OnboardingActions } from "./OnboardingActions";
import type { PendingInvite } from "./OnboardingActions";

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership?.org_id) redirect("/dashboard/grants");

  const { data: invites } = await supabase.rpc("get_my_pending_invites");

  return (
    <main>
      <h1>Welcome</h1>
      <p>
        Signed in as <strong>{user.email}</strong>. You are not part of an
        organization yet — accept an invite below, or create a new organization.
      </p>
      <OnboardingActions invites={(invites ?? []) as PendingInvite[]} />
    </main>
  );
}
