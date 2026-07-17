"use client";

import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  saveAnswerAction,
  updateQuestionTextAction,
  deleteQuestionAction,
} from "./actions";

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "#0b57d0" },
  reviewed: { label: "Reviewed", color: "#b45309" },
  final:    { label: "Final",    color: "#1a7f4e" },
  skipped:  { label: "Skipped",  color: "#6b7280" },
};

interface QuestionCardProps {
  question: {
    id: string;
    grant_id: string;
    ordering: number;
    question: string;
    word_target: number | null;
    draft_answer: string | null;
    status: string;
    last_regen_at: string | null;
    regen_feedback: string | null;
  };
  orgId: string;
  index: number;
  // Voice profile names available for this org (e.g. ["Joy"]).
  // Empty/omitted → no polish button rendered.
  voiceProfiles?: string[];
}

function getFunctionUrl(name: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/functions/v1/${name}`;
}

function wordCount(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function QuestionCard({ question, orgId, index, voiceProfiles = [] }: QuestionCardProps) {
  const supabase = createSupabaseBrowserClient();

  // Editable question text + word target
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [qText, setQText] = useState(question.question);
  const [qWords, setQWords] = useState(question.word_target?.toString() ?? "");

  // Editable answer
  const [answer, setAnswer] = useState(question.draft_answer ?? "");
  const [savedAnswer, setSavedAnswer] = useState(question.draft_answer ?? "");

  // Status
  const [status, setStatus] = useState(question.status);

  // Regenerate feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  // UI state
  const [savePending, startSaveTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();
  const [regenLoading, setRegenLoading] = useState(false);
  const [polishLoading, setPolishLoading] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isDirty = answer !== savedAnswer;
  const wc = wordCount(answer);
  const targetMet = question.word_target
    ? wc >= question.word_target * 0.8 && wc <= question.word_target * 1.2
    : true;

  function flashSaved(text = "Saved") {
    setSavedMessage(text);
    setTimeout(() => setSavedMessage(null), 1800);
  }

  function saveAnswer(newStatus?: string) {
    startSaveTransition(async () => {
      setError(null);
      const res = await saveAnswerAction(question.id, answer, newStatus);
      if (res.ok) {
        setSavedAnswer(answer);
        if (newStatus) setStatus(newStatus);
        flashSaved();
      } else {
        setError(res.error);
      }
    });
  }

  function updateStatus(newStatus: string) {
    setStatus(newStatus);
    startStatusTransition(async () => {
      setError(null);
      const res = await saveAnswerAction(question.id, savedAnswer, newStatus);
      if (!res.ok) setError(res.error);
    });
  }

  function saveQuestionText() {
    const trimmed = qText.trim();
    if (!trimmed) {
      setError("Question text required.");
      return;
    }
    const wordsNum = qWords.trim() === "" ? null : Math.max(1, Math.min(5000, parseInt(qWords, 10) || 0));
    startSaveTransition(async () => {
      setError(null);
      const res = await updateQuestionTextAction(question.id, trimmed, wordsNum);
      if (res.ok) {
        setEditingQuestion(false);
        flashSaved("Question updated");
      } else {
        setError(res.error);
      }
    });
  }

  async function regenerate() {
    setRegenLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(getFunctionUrl("draft_application"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey ? { apikey: anonKey } : {}),
        },
        body: JSON.stringify({
          org_id: orgId,
          mode: "regenerate",
          question_id: question.id,
          feedback: feedback.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(body.message ?? body.error ?? `Regenerate failed (${res.status})`);
      }
      const data = await res.json() as { answer?: string };
      if (data.answer) {
        setAnswer(data.answer);
        setSavedAnswer(data.answer);
        setStatus("draft");
        setShowFeedback(false);
        setFeedback("");
        flashSaved("Regenerated");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenLoading(false);
    }
  }

  // Gap 2: rewrite the current answer in the org's signature voice (e.g. Joy).
  // Substance is preserved server-side; only register/rhythm changes.
  async function polishWithVoice(voiceName: string) {
    setPolishLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(getFunctionUrl("polish_with_voice"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          ...(anonKey ? { apikey: anonKey } : {}),
        },
        body: JSON.stringify({
          org_id: orgId,
          question_id: question.id,
          voice_name: voiceName,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(body.message ?? body.error ?? `Polish failed (${res.status})`);
      }
      const data = await res.json() as { answer?: string };
      if (data.answer) {
        setAnswer(data.answer);
        setSavedAnswer(data.answer);
        setStatus("draft");
        flashSaved(`Polished with ${voiceName}'s voice`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Polish failed");
    } finally {
      setPolishLoading(false);
    }
  }

  function deleteQuestion() {
    if (!confirm(`Delete question "${question.question.slice(0, 60)}..."? This is permanent.`)) return;
    startDeleteTransition(async () => {
      setError(null);
      const res = await deleteQuestionAction(question.id);
      if (!res.ok) setError(res.error);
      // Page revalidates → row disappears
    });
  }

  const meta = STATUS_META[status] ?? STATUS_META.draft;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          {editingQuestion ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: 8, fontSize: 15, fontFamily: "inherit", border: "1px solid #d1d5db", borderRadius: 6 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 13, color: "#374151" }}>Target words:</label>
                <input
                  type="number"
                  value={qWords}
                  onChange={(e) => setQWords(e.target.value)}
                  placeholder="(optional)"
                  min="1"
                  max="5000"
                  style={{ width: 100, padding: "4px 8px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6 }}
                />
                <button onClick={saveQuestionText} disabled={savePending} style={{ padding: "6px 14px", fontSize: 13, background: "#0b57d0", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                  Save question
                </button>
                <button onClick={() => { setEditingQuestion(false); setQText(question.question); setQWords(question.word_target?.toString() ?? ""); }} style={{ padding: "6px 12px", fontSize: 13, background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                Question {index + 1}{question.word_target ? ` — ${question.word_target} words` : ""}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#111", lineHeight: 1.4 }}>
                {question.question}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <select
            value={status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={statusPending}
            style={{
              padding: "4px 10px", borderRadius: 999, border: `1px solid ${meta.color}66`,
              background: meta.color + "18", color: meta.color, fontWeight: 600, fontSize: 12,
              cursor: "pointer",
            }}
          >
            {Object.entries(STATUS_META).map(([key, m]) => (
              <option key={key} value={key}>{m.label}</option>
            ))}
          </select>
          {!editingQuestion && (
            <button
              type="button"
              onClick={() => setEditingQuestion(true)}
              title="Edit question text"
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, padding: 4 }}
            >
              ✎
            </button>
          )}
          <button
            type="button"
            onClick={deleteQuestion}
            disabled={deletePending}
            title="Delete question"
            style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 13, padding: 4 }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Answer textarea */}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={Math.min(20, Math.max(8, Math.ceil((answer?.length ?? 0) / 70)))}
        placeholder={question.draft_answer == null ? "No draft yet. Click Regenerate to generate, or write your own." : ""}
        style={{
          width: "100%", padding: 12, fontSize: 14, fontFamily: "inherit",
          border: "1px solid #d1d5db", borderRadius: 6, lineHeight: 1.6, resize: "vertical",
          background: "#fff",
        }}
      />

      {/* Word count + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 12, color: targetMet ? "#1a7f4e" : "#b45309" }}>
          {wc} word{wc === 1 ? "" : "s"}
          {question.word_target ? ` (target ${question.word_target})` : ""}
          {isDirty ? <span style={{ color: "#b45309", marginLeft: 8 }}>● unsaved</span> : null}
          {savedMessage && <span style={{ color: "#1a7f4e", marginLeft: 8 }}>✓ {savedMessage}</span>}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {voiceProfiles.map((voiceName) => (
            <button
              key={voiceName}
              type="button"
              onClick={() => polishWithVoice(voiceName)}
              disabled={polishLoading || !savedAnswer.trim()}
              title={`Rewrite this answer in ${voiceName}'s voice (substance unchanged)`}
              style={{
                padding: "6px 12px", fontSize: 13,
                background: polishLoading ? "#f3f4f6" : "#fdf6e3",
                color: "#854d0e", border: "1px solid #facc15", borderRadius: 6,
                cursor: polishLoading || !savedAnswer.trim() ? "default" : "pointer",
              }}
            >
              {polishLoading ? "Polishing…" : `✨ Polish with ${voiceName}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowFeedback((v) => !v)}
            style={{ padding: "6px 12px", fontSize: 13, background: "#fff", color: "#0b57d0", border: "1px solid #0b57d0", borderRadius: 6, cursor: "pointer" }}
          >
            {showFeedback ? "Cancel feedback" : "Regenerate…"}
          </button>
          <button
            type="button"
            onClick={() => saveAnswer()}
            disabled={savePending || !isDirty}
            style={{
              padding: "6px 14px", fontSize: 13, fontWeight: 500,
              background: !isDirty || savePending ? "#9ca3af" : "#0b57d0",
              color: "#fff", border: "none", borderRadius: 6,
              cursor: !isDirty || savePending ? "default" : "pointer",
            }}
          >
            {savePending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Regenerate feedback panel */}
      {showFeedback && (
        <div style={{ marginTop: 12, padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 500, display: "block", marginBottom: 6 }}>
            Optional feedback for the regeneration (skip for a clean re-draft):
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder='e.g. "shorter intro", "lead with the founder story", "more data on outcomes"'
            style={{ width: "100%", padding: 8, fontSize: 13, fontFamily: "inherit", border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical" }}
          />
          <button
            type="button"
            onClick={regenerate}
            disabled={regenLoading}
            style={{
              marginTop: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500,
              background: regenLoading ? "#9ca3af" : "#0b57d0", color: "#fff",
              border: "none", borderRadius: 6, cursor: regenLoading ? "default" : "pointer",
            }}
          >
            {regenLoading ? "Generating…" : feedback.trim() ? "Regenerate with feedback" : "Regenerate clean"}
          </button>
        </div>
      )}

      {error && (
        <p style={{ marginTop: 10, marginBottom: 0, color: "#c0392b", fontSize: 13 }}>{error}</p>
      )}

      {question.last_regen_at && (
        <p style={{ marginTop: 8, marginBottom: 0, color: "#9ca3af", fontSize: 11 }}>
          Last regenerated: {new Date(question.last_regen_at).toLocaleString()}
          {question.regen_feedback ? ` — feedback: "${question.regen_feedback}"` : ""}
        </p>
      )}
    </div>
  );
}
