"use client";

import { useState, useTransition, FormEvent } from "react";
import { markOutcomeAction } from "./actions";

type OutcomeStatus = "applied" | "in_review" | "won" | "declined" | "skipped";

const STATUS_OPTIONS: { value: OutcomeStatus; label: string; color: string; tone: string }[] = [
  { value: "applied",   label: "Applied",     color: "#0b57d0", tone: "blue"   },
  { value: "in_review", label: "In Review",   color: "#b45309", tone: "amber"  },
  { value: "won",       label: "Won",         color: "#1a7f4e", tone: "green"  },
  { value: "declined",  label: "Declined",    color: "#c0392b", tone: "red"    },
  { value: "skipped",   label: "Skipped",     color: "#6b7280", tone: "gray"   },
];

interface OutcomeFormProps {
  grantId: string;
  currentStatus: string | null;
  currentApplicationDate: string | null;
  currentOutcomeDate: string | null;
  currentOutcomeAmount: number | null;
  currentOutcomeNote: string | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OutcomeForm({
  grantId,
  currentStatus,
  currentApplicationDate,
  currentOutcomeDate,
  currentOutcomeAmount,
  currentOutcomeNote,
}: OutcomeFormProps) {
  const [status, setStatus] = useState<OutcomeStatus | "">(
    (currentStatus as OutcomeStatus) || ""
  );
  const [applicationDate, setApplicationDate] = useState(currentApplicationDate ?? "");
  const [outcomeDate, setOutcomeDate] = useState(currentOutcomeDate ?? "");
  const [outcomeAmount, setOutcomeAmount] = useState(
    currentOutcomeAmount != null ? String(currentOutcomeAmount) : ""
  );
  const [outcomeNote, setOutcomeNote] = useState(currentOutcomeNote ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const fd = new FormData();
    fd.set("grantId", grantId);
    fd.set("status", status);
    fd.set("applicationDate", applicationDate);
    fd.set("outcomeDate", outcomeDate);
    fd.set("outcomeAmount", outcomeAmount);
    fd.set("outcomeNote", outcomeNote);

    startTransition(async () => {
      const res = await markOutcomeAction(fd);
      if (res.ok) {
        setMessage("Saved.");
      } else {
        setError(res.error ?? "Failed to save.");
      }
    });
  }

  function quickPick(s: OutcomeStatus) {
    setStatus(s);
    if (s === "applied" && !applicationDate) setApplicationDate(todayISO());
    if ((s === "won" || s === "declined") && !outcomeDate) setOutcomeDate(todayISO());
  }

  // Field visibility heuristic
  const showApplicationDate = status && status !== "skipped";
  const showOutcomeDate = status === "won" || status === "declined";
  const showAmount = status === "won";

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Quick-pick buttons */}
      <div>
        <label style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 6, fontWeight: 500 }}>
          Outcome status
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STATUS_OPTIONS.map((opt) => {
            const active = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => quickPick(opt.value)}
                style={{
                  padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 500,
                  cursor: "pointer",
                  background: active ? opt.color : "#fff",
                  color: active ? "#fff" : opt.color,
                  border: `1.5px solid ${opt.color}`,
                  transition: "all 0.15s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
          {status && (
            <button
              type="button"
              onClick={() => setStatus("")}
              style={{
                padding: "8px 12px", borderRadius: 6, fontSize: 13,
                background: "transparent", color: "#6b7280", border: "1px dashed #d1d5db",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Conditional fields */}
      {showApplicationDate && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Application date</label>
          <input
            type="date"
            value={applicationDate}
            onChange={(e) => setApplicationDate(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: 200 }}
          />
        </div>
      )}

      {showOutcomeDate && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
            {status === "won" ? "Award date" : "Decision date"}
          </label>
          <input
            type="date"
            value={outcomeDate}
            onChange={(e) => setOutcomeDate(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: 200 }}
          />
        </div>
      )}

      {showAmount && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Amount won ($)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={outcomeAmount}
            onChange={(e) => setOutcomeAmount(e.target.value)}
            placeholder="50000"
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: 200 }}
          />
        </div>
      )}

      {status && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Note (optional)</label>
          <textarea
            value={outcomeNote}
            onChange={(e) => setOutcomeNote(e.target.value)}
            rows={2}
            placeholder="Context — funder feedback, application strategy, etc."
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 18px", borderRadius: 6, fontSize: 14, fontWeight: 500,
            background: pending ? "#9ca3af" : "#0b57d0", color: "#fff",
            border: "none", cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Saving…" : "Save outcome"}
        </button>
        {message && <span style={{ color: "#1a7f4e", fontSize: 13 }}>{message}</span>}
        {error && <span style={{ color: "#c0392b", fontSize: 13 }}>{error}</span>}
      </div>
    </form>
  );
}
