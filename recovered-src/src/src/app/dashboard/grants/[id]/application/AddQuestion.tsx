"use client";

import { useState, useTransition, FormEvent } from "react";
import { addQuestionAction } from "./actions";

export function AddQuestion({ grantId }: { grantId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [words, setWords] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Question text required.");
      return;
    }
    const wordsNum = words.trim() === "" ? null : Math.max(1, Math.min(5000, parseInt(words, 10) || 0));
    startTransition(async () => {
      const res = await addQuestionAction(grantId, trimmed, wordsNum);
      if (res.ok) {
        setText("");
        setWords("");
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "8px 18px", borderRadius: 6, fontSize: 14, fontWeight: 500,
          background: "#fff", color: "#0b57d0", border: "1px dashed #0b57d0",
          cursor: "pointer", marginTop: 4,
        }}
      >
        + Add a question
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 14, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, marginTop: 4 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        New question
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder='e.g. "Describe how this project advances racial equity in your community."'
        style={{ width: "100%", padding: 8, fontSize: 14, fontFamily: "inherit", border: "1px solid #d1d5db", borderRadius: 6 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#374151" }}>Target words (optional):</label>
        <input
          type="number"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          min="1" max="5000"
          placeholder="250"
          style={{ width: 100, padding: "6px 8px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6 }}
        />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => { setOpen(false); setText(""); setWords(""); setError(null); }}
          style={{ padding: "6px 12px", fontSize: 13, background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "6px 14px", fontSize: 13, fontWeight: 500,
            background: pending ? "#9ca3af" : "#0b57d0", color: "#fff",
            border: "none", borderRadius: 6, cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Adding…" : "Add question"}
        </button>
      </div>
      {error && <p style={{ marginTop: 8, marginBottom: 0, color: "#c0392b", fontSize: 13 }}>{error}</p>}
    </form>
  );
}
