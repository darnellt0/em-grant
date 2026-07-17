"use server";

import { revalidatePath } from "next/cache";
import { requireOrgIdForUser, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const ALLOWED_QUESTION_STATUS = new Set(["draft", "reviewed", "final", "skipped"]);

export async function saveAnswerAction(
  questionId: string,
  answer: string,
  status?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const update: Record<string, unknown> = {
    draft_answer: answer,
    updated_at: new Date().toISOString(),
  };
  if (status && ALLOWED_QUESTION_STATUS.has(status)) {
    update.status = status;
  }

  const { error, data } = await supabase
    .from("application_questions")
    .update(update)
    .eq("id", questionId)
    .eq("org_id", orgId)
    .select("grant_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.grant_id) revalidatePath(`/dashboard/grants/${data.grant_id}/application`);
  return { ok: true };
}

export async function updateQuestionTextAction(
  questionId: string,
  question: string,
  wordTarget: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("application_questions")
    .update({ question, word_target: wordTarget, updated_at: new Date().toISOString() })
    .eq("id", questionId)
    .eq("org_id", orgId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteQuestionAction(
  questionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  const supabase = createSupabaseServerClient();

  const { data: row } = await supabase
    .from("application_questions")
    .select("grant_id")
    .eq("id", questionId)
    .eq("org_id", orgId)
    .maybeSingle();

  const { error } = await supabase
    .from("application_questions")
    .delete()
    .eq("id", questionId)
    .eq("org_id", orgId);
  if (error) return { ok: false, error: error.message };
  if (row?.grant_id) revalidatePath(`/dashboard/grants/${row.grant_id}/application`);
  return { ok: true };
}

export async function addQuestionAction(
  grantId: string,
  question: string,
  wordTarget: number | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const orgId = await requireOrgIdForUser(user.id);
  if (!question.trim()) return { ok: false, error: "Question text required." };

  const supabase = createSupabaseServerClient();

  // Pick next ordering value for this grant
  const { data: existing } = await supabase
    .from("application_questions")
    .select("ordering")
    .eq("grant_id", grantId)
    .eq("org_id", orgId)
    .order("ordering", { ascending: false })
    .limit(1);
  const nextOrdering = ((existing?.[0]?.ordering as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("application_questions")
    .insert({
      grant_id: grantId,
      org_id: orgId,
      ordering: nextOrdering,
      question: question.trim(),
      word_target: wordTarget,
      draft_answer: null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  revalidatePath(`/dashboard/grants/${grantId}/application`);
  return { ok: true, id: data.id as string };
}
