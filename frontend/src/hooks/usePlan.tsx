import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────
export type Plan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanFeatures {
  max_accounts:          number;
  ai_journal:            boolean;
  telegram_alerts:       boolean;
  sms_alerts:            boolean;
  prop_firm_profiles:    boolean;
  performance_analytics: boolean;
  trade_history_days:    number;
  priority_support:      boolean;
  white_label:           boolean;
  api_access:            boolean;
  team_management:       boolean;
  custom_risk_rules:     boolean;
  dedicated_manager:     boolean;
  sla_guarantee:         boolean;
  custom_integrations:   boolean;
}

interface PlanState {
  plan:         Plan;
  features:     PlanFeatures;
  loading:      boolean;
  expiresAt:    string | null;
  refetch:      () => void;
  refreshPlan:  () => void;
}

const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    max_accounts: 1, ai_journal: false, telegram_alerts: false,
    sms_alerts: false, prop_firm_profiles: false, performance_analytics: false,
    trade_history_days: 7, priority_support: false, white_label: false,
    api_access: false, team_management: false, custom_risk_rules: false,
    dedicated_manager: false, sla_guarantee: false, custom_integrations: false,
  },
  starter: {
    max_accounts: 1, ai_journal: false, telegram_alerts: false,
    sms_alerts: false, prop_firm_profiles: false, performance_analytics: false,
    trade_history_days: 30, priority_support: false, white_label: false,
    api_access: false, team_management: false, custom_risk_rules: true,
    dedicated_manager: false, sla_guarantee: false, custom_integrations: false,
  },
  pro: {
    max_accounts: 3, ai_journal: true, telegram_alerts: true,
    sms_alerts: true, prop_firm_profiles: true, performance_analytics: true,
    trade_history_days: 90, priority_support: true, white_label: false,
    api_access: false, team_management: false, custom_risk_rules: true,
    dedicated_manager: false, sla_guarantee: false, custom_integrations: false,
  },
  enterprise: {
    max_accounts: 999, ai_journal: true, telegram_alerts: true,
    sms_alerts: true, prop_firm_profiles: true, performance_analytics: true,
    trade_history_days: 365, priority_support: true, white_label: true,
    api_access: true, team_management: true, custom_risk_rules: true,
    dedicated_manager: true, sla_guarantee: true, custom_integrations: true,
  },
};

function getLocalPlan(): Plan {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.plan && user.plan !== 'free') return user.plan as Plan;
  } catch {}
  const selected = localStorage.getItem('selected_plan');
  if (selected && selected !== 'free') return selected as Plan;
  return 'free';
}

export const PlanContext = createContext<PlanState>({
  plan:        'free',
  features:    PLAN_FEATURES.free,
  loading:     true,
  expiresAt:   null,
  refetch:     () => {},
  refreshPlan: () => {},
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan,      setPlan]      = useState<Plan>(getLocalPlan());
  const [features,  setFeatures]  = useState<PlanFeatures>(PLAN_FEATURES[getLocalPlan() as Plan] || PLAN_FEATURES.free);
  const [loading,   setLoading]   = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const fetchPlan = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await axios.get(`${API}/api/v1/billing/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const backendPlan = (data.plan || 'free') as Plan;
      setPlan(backendPlan);
      setFeatures(PLAN_FEATURES[backendPlan] || PLAN_FEATURES.free);
      setExpiresAt(data.expires_at ?? null);
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.plan = backendPlan;
        user.subscription_status = data.subscription_status || 'active';
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('selected_plan', backendPlan);
      } catch {}
    } catch {
      const localPlan = getLocalPlan();
      setPlan(localPlan);
      setFeatures(PLAN_FEATURES[localPlan]);
    } finally {
      setLoading(false);
    }
  };

  const refreshPlan = () => {
    const localPlan = getLocalPlan();
    setPlan(localPlan);
    setFeatures(PLAN_FEATURES[localPlan]);
    fetchPlan();
  };

  useEffect(() => { fetchPlan(); }, []);

  return (
    <PlanContext.Provider value={{ plan, features, loading, expiresAt, refetch: fetchPlan, refreshPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

// ✅ startCheckout now accepts optional setLoading callback
// so each button can show its own spinner
export async function startCheckout(
  planName: Plan,
  setLoading?: (v: boolean) => void
): Promise<{ success: boolean; error?: string }> {
  const token = localStorage.getItem('access_token');
  if (!token) {
    window.location.href = '/#/login';
    return { success: false, error: 'Not logged in' };
  }

  try {
    setLoading?.(true);

    const { data } = await axios.post(
      `${API}/api/v1/billing/create-checkout-session`,
      { plan: planName },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!data.checkout_url) {
      setLoading?.(false);
      alert('Could not start checkout. Please try again.');
      return { success: false, error: 'No checkout URL' };
    }

    // Loading stays true — page will navigate away to Stripe
    window.top!.location.href = data.checkout_url;
    return { success: true };

  } catch (err: any) {
    setLoading?.(false);
    const msg = err?.response?.data?.detail || err?.message || 'Unknown error';
    alert(`Checkout failed: ${msg}`);
    return { success: false, error: msg };
  }
}
