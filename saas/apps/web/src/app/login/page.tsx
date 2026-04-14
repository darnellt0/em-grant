"use client";

import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard/grants`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }
    setMessage("Magic link sent. Check your inbox.");
  }

  async function handleGoogle() {
    setMessage(null);
    setError(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard/grants`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <main>
      <h1>Login</h1>
      <div className="card">
        <form onSubmit={handleMagicLink}>
          <label htmlFor="email">Email (Magic Link)</label>
          <br />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "320px", padding: "8px", marginTop: "6px", marginBottom: "12px" }}
          />
          <br />
          <button type="submit">Send Magic Link</button>
        </form>
      </div>

      <div className="card">
        <button onClick={handleGoogle}>Continue with Google</button>
      </div>

      {message ? <p>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </main>
  );
}
