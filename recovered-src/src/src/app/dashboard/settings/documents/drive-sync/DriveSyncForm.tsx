"use client";

import { useState, useTransition, FormEvent } from "react";
import {
  upsertDriveSyncConfigAction,
  deleteDriveSyncConfigAction,
  requestSyncNowAction,
} from "./actions";

interface Props {
  initial: {
    drive_folder_id: string | null;
    drive_folder_label: string | null;
    enabled: boolean;
    drive_account: string;
    sync_requested_at: string | null;
    last_synced_at: string | null;
    last_sync_status: string | null;
    last_sync_message: string | null;
    files_synced_total: number;
  } | null;
}

const STATUS_COLOR: Record<string, string> = {
  success: "#1a7f4e",
  failed: "#c0392b",
  partial: "#b45309",
};

function relativeAge(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function DriveSyncForm({ initial }: Props) {
  const [folderInput, setFolderInput] = useState(initial?.drive_folder_id ?? "");
  const [label, setLabel] = useState(initial?.drive_folder_label ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [driveAccount, setDriveAccount] = useState(initial?.drive_account ?? "main@elevatedmovements.com");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = !!initial?.drive_folder_id;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await upsertDriveSyncConfigAction(folderInput, label, enabled, driveAccount);
      if (res.ok) {
        setMessage(isConfigured ? "Updated. Sync runs nightly at ~3 AM PT or when you click Sync now." : "Saved. First sync will run nightly at ~3 AM PT — or click Sync now to queue immediately.");
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete() {
    if (!confirm("Stop syncing this Drive folder? Files already mirrored stay in your Documents — only future syncs stop.")) return;
    setMessage(null); setError(null);
    startTransition(async () => {
      const res = await deleteDriveSyncConfigAction();
      if (res.ok) {
        setFolderInput(""); setLabel(""); setEnabled(true);
        setMessage("Sync disabled.");
      } else {
        setError(res.error);
      }
    });
  }

  function handleSyncNow() {
    setMessage(null); setError(null);
    startTransition(async () => {
      const res = await requestSyncNowAction();
      if (res.ok) {
        setMessage("Sync queued. The script polls every ~10 min and will run shortly.");
      } else {
        setError(res.error);
      }
    });
  }

  const lastStatus = initial?.last_sync_status;
  const lastColor = lastStatus ? STATUS_COLOR[lastStatus] ?? "#6b7280" : null;
  const syncPending = initial?.sync_requested_at &&
    (!initial?.last_synced_at || new Date(initial.sync_requested_at) > new Date(initial.last_synced_at));

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Google Drive sync</h3>
      <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Mirror a Google Drive folder into this org&apos;s Documents nightly. Useful if your org keeps grant docs (IRS letter, audit, 990, board roster, bios) in Drive — paste the folder URL or ID and the sync script picks new and modified files automatically.
      </p>

      {/* Status panel (shown when configured) */}
      {isConfigured && (
        <div style={{
          padding: 12, marginBottom: 16,
          background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6,
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ fontSize: 13, color: "#374151" }}>
            <div>
              <strong>Last sync:</strong> {relativeAge(initial?.last_synced_at ?? null)}{" "}
              {lastStatus && lastColor && (
                <span style={{
                  marginLeft: 6, padding: "1px 8px", borderRadius: 999,
                  background: lastColor + "18", color: lastColor, border: `1px solid ${lastColor}44`,
                  fontSize: 11, fontWeight: 600,
                }}>
                  {lastStatus}
                </span>
              )}
            </div>
            <div style={{ marginTop: 2 }}>
              <strong>Files mirrored to date:</strong> {initial?.files_synced_total ?? 0}
            </div>
            {initial?.last_sync_message && (
              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>{initial.last_sync_message}</div>
            )}
            {syncPending && (
              <div style={{ marginTop: 4, color: "#b45309", fontSize: 12 }}>
                ⏳ Sync requested at {relativeAge(initial?.sync_requested_at ?? null)} — script polls every ~10 min.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={pending}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
              background: "#fff", color: "#0b57d0", border: "1px solid #0b57d0",
              cursor: pending ? "default" : "pointer",
            }}
          >
            Sync now
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
            Drive folder URL or ID
          </label>
          <input
            type="text"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/1abc... — or just the ID"
            style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "monospace" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
            Label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 'EM Grant Docs'"
            style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
            Drive account
          </label>
          <input
            type="email"
            value={driveAccount}
            onChange={(e) => setDriveAccount(e.target.value)}
            placeholder="main@elevatedmovements.com"
            style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            The Google account on main-pc with access. (For Dorothy: main@elevatedmovements.com)
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="drive-sync-enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <label htmlFor="drive-sync-enabled" style={{ fontSize: 13, color: "#374151" }}>
            Sync enabled (uncheck to pause without losing config)
          </label>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 18px", borderRadius: 6, fontSize: 14, fontWeight: 500,
            background: pending ? "#9ca3af" : "#0b57d0", color: "#fff",
            border: "none", cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Saving…" : isConfigured ? "Update config" : "Enable sync"}
        </button>
        {isConfigured && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            style={{
              padding: "8px 14px", borderRadius: 6, fontSize: 13,
              background: "#fff", color: "#c0392b", border: "1px solid #c0392b",
              cursor: pending ? "default" : "pointer",
            }}
          >
            Stop syncing
          </button>
        )}
        {message && <span style={{ color: "#1a7f4e", fontSize: 13 }}>{message}</span>}
        {error && <span style={{ color: "#c0392b", fontSize: 13 }}>{error}</span>}
      </div>

      <details style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>
        <summary style={{ cursor: "pointer", color: "#374151" }}>How does this work?</summary>
        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: "3px solid #e5e7eb" }}>
          A script on main-pc (where Dorothy lives) runs nightly at ~3 AM PT. It reads this config, enumerates files in the Drive folder using the configured account&apos;s OAuth, downloads any new or modified files, and uploads them to your org&apos;s Supabase Storage bucket. Each synced file appears in Documents with a &quot;From Drive&quot; badge and a stable link back to the Drive file. Deletes in Drive don&apos;t propagate (safe default) — remove from Documents manually if you want them gone.
        </div>
      </details>
    </form>
  );
}
