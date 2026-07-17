"use client";

import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Mode = "password" | "magic";

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMessage(null);
    setError(null);
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      // Full page navigation so the server reads fresh auth cookies
      window.location.href = "/dashboard/grants";
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard/grants` },
      });
      if (signInError) { setError(signInError.message); return; }
      setMessage("Magic link sent — check your inbox.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    reset();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard/grants` },
    });
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>
          Grant Discovery
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#111" }}>Sign in</h1>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
        {(["password", "magic"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); reset(); }}
            style={{
              flex: 1, border: "none", padding: "10px", fontSize: 14, cursor: "pointer",
              fontWeight: mode === m ? 700 : 400,
              background: mode === m ? "#0b57d0" : "#f9fafb",
              color: mode === m ? "#fff" : "#374151",
              borderRadius: 0,
            }}
          >
            {m === "password" ? "Email & Password" : "Magic Link"}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label htmlFor="email-pw">Email</label>
            <input
              id="email-pw"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label htmlFor="email-magic">Email</label>
            <input
              id="email-magic"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Sending…" : "Send Magic Link"}
          </button>
        </form>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        <span style={{ fontSize: 12, color: "#9ca3af" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
      </div>

      <button
        onClick={handleGoogle}
        style={{ width: "100%", background: "#fff", color: "#374151", border: "1px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>

      {message && <p style={{ marginTop: 16, color: "#1a7f4e", fontWeight: 500 }}>{message}</p>}
      {error && <p style={{ marginTop: 16, color: "crimson" }}>{error}</p>}
    </main>
  );
}
