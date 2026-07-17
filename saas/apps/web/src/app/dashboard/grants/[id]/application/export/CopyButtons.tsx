"use client";

import { useState } from "react";

interface Question {
  id: string;
  ordering: number;
  question: string;
  draft_answer: string | null;
  word_target: number | null;
}

interface Props {
  grantName: string;
  questions: Question[];
}

function formatAllMarkdown(grantName: string, questions: Question[]): string {
  const lines: string[] = [];
  lines.push(`# ${grantName} — Application Draft`);
  lines.push("");
  for (const q of questions) {
    const header = `## ${q.ordering + 1}. ${q.question}` + (q.word_target ? ` *(${q.word_target} words)*` : "");
    lines.push(header);
    lines.push("");
    lines.push(q.draft_answer ?? "_[no answer]_");
    lines.push("");
  }
  return lines.join("\n");
}

export function CopyOne({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback for older browsers: create a hidden textarea, select, execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  return (
    <button
      type="button"
      onClick={doCopy}
      style={{
        padding: "4px 10px", fontSize: 12, fontWeight: 500,
        background: copied ? "#1a7f4e" : "#fff",
        color: copied ? "#fff" : "#0b57d0",
        border: `1px solid ${copied ? "#1a7f4e" : "#0b57d0"}`,
        borderRadius: 6, cursor: "pointer",
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

export function CopyAllToolbar({ grantName, questions }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function downloadMarkdown() {
    setDownloading(true);
    try {
      const md = formatAllMarkdown(grantName, questions);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${grantName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-application.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const allText = formatAllMarkdown(grantName, questions);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <CopyOne text={allText} label="Copy all (markdown)" />
      <button
        type="button"
        onClick={downloadMarkdown}
        disabled={downloading}
        style={{
          padding: "4px 10px", fontSize: 12, fontWeight: 500,
          background: "#fff", color: "#0b57d0",
          border: "1px solid #0b57d0", borderRadius: 6, cursor: "pointer",
        }}
      >
        {downloading ? "…" : "Download .md"}
      </button>
    </div>
  );
}
