"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type UpgradePlan = "trial" | "pro" | "team";
type CurrentPlan = "free" | "trial" | "pro" | "team";

type BillingActionsProps = {
  orgId: string;
  currentPlan: CurrentPlan;
  hasStripeCustomer: boolean;
};

function getFunctionUrl(functionName: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return `${baseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function BillingActions({ orgId, currentPlan, hasStripeCustomer }: BillingActionsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callFunction(functionName: "stripe_checkout" | "stripe_portal", body: Record<string, unknown>) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      throw new Error("You must be signed in to manage billing.");
    }

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(getFunctionUrl(functionName), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...(anonKey ? { apikey: anonKey } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(await parseError(res));
    }

    const payload = (await res.json()) as { url?: string };
    if (!payload.url) throw new Error("Stripe URL was not returned.");
    window.location.href = payload.url;
  }

  async function startCheckout(plan: UpgradePlan) {
    try {
      setError(null);
      setLoadingAction(`checkout-${plan}`);
      await callFunction("stripe_checkout", { org_id: orgId, plan });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create checkout session");
    } finally {
      setLoadingAction(null);
    }
  }

  async function openPortal() {
    try {
      setError(null);
      setLoadingAction("portal");
      await callFunction("stripe_portal", { org_id: orgId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create billing portal session");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="card">
      <h3>Actions</h3>
      <p>Current plan: {currentPlan}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {currentPlan === "free" ? (
          <>
            <button onClick={() => startCheckout("pro")} disabled={loadingAction !== null}>
              {loadingAction === "checkout-pro" ? "Opening..." : "Upgrade to Pro"}
            </button>
            <button onClick={() => startCheckout("team")} disabled={loadingAction !== null}>
              {loadingAction === "checkout-team" ? "Opening..." : "Upgrade to Team"}
            </button>
            <button onClick={() => startCheckout("trial")} disabled={loadingAction !== null}>
              {loadingAction === "checkout-trial" ? "Opening..." : "Start Trial"}
            </button>
            <button onClick={openPortal} disabled={loadingAction !== null || !hasStripeCustomer}>
              {loadingAction === "portal" ? "Opening..." : "Manage Billing"}
            </button>
          </>
        ) : (
          <>
            {currentPlan !== "team" ? (
              <button onClick={() => startCheckout("team")} disabled={loadingAction !== null}>
                {loadingAction === "checkout-team" ? "Opening..." : "Upgrade Plan"}
              </button>
            ) : null}
            <button onClick={openPortal} disabled={loadingAction !== null || !hasStripeCustomer}>
              {loadingAction === "portal" ? "Opening..." : "Manage Billing"}
            </button>
          </>
        )}
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {!hasStripeCustomer && currentPlan !== "free" ? (
        <p>Manage Billing becomes available after your first successful checkout.</p>
      ) : null}
    </div>
  );
}
