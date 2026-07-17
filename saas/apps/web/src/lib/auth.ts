import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabaseServer";

export async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return user;
}

export async function requireOrgIdForUser(userId: string): Promise<string> {
  const supabase = createSupabaseServerClient();
  const { data: membership, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) redirect("/onboarding");
  return membership.org_id as string;
}
