/**
 * useRiskRules — Background Risk Rule Evaluator
 *
 * Drop this hook into RiskDashboardClean.tsx (or any page with live data).
 * It polls every 30 seconds, sends account metrics to the backend,
 * and shows a toast + triggers cooldown if any rule fires.
 *
 * Usage:
 *   const { isBlocked, blockReason, triggeredRules } = useRiskRules(accountSnapshot);
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:8000/api/v1';
const POLL_INTERVAL = 30_000; // 30 seconds

export interface AccountSnapshot {
  balance:            number;
  equity:             number;
  daily_pnl:          number;
  open_positions:     number;
  consecutive_losses: number;
  last_trade_pnl:     number;
  peak_equity:        number;
  win_rate_last20:    number;
}

export interface TriggeredRule {
  rule_id:      number;
  rule_name:    string;
  action:       string;
  action_value: number;
  actual_value: number;
  message:      string;
}

interface RuleEngineState {
  isBlocked:      boolean;
  blockReason:    string;
  triggeredRules: TriggeredRule[];
  lastEvaluated:  Date | null;
  evaluate:       (snap: AccountSnapshot) => Promise<void>;
}

export function useRiskRules(snap: AccountSnapshot | null): RuleEngineState {
  const [isBlocked,      setIsBlocked]      = useState(false);
  const [blockReason,    setBlockReason]    = useState('');
  const [triggeredRules, setTriggeredRules] = useState<TriggeredRule[]>([]);
  const [lastEvaluated,  setLastEvaluated]  = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const token   = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Check current block status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API}/risk-rules/status`, { headers });
        setIsBlocked(res.data.is_blocked);
        setBlockReason(res.data.reason || '');
      } catch {}
    };
    if (token) fetchStatus();
  }, []);

  const evaluate = useCallback(async (snapshot: AccountSnapshot) => {
    if (!token) return;
    try {
      const res = await axios.post(`${API}/risk-rules/evaluate`, snapshot, { headers });
      const data = res.data;

      setIsBlocked(data.is_blocked);
      setBlockReason(data.block_reason || '');
      setLastEvaluated(new Date());

      if (data.triggered > 0) {
        setTriggeredRules(data.triggered_rules);
        // Fire browser notification if permitted
        if (Notification.permission === 'granted') {
          data.triggered_rules.forEach((r: TriggeredRule) => {
            new Notification('⚠️ RiskGuardian Rule Triggered', {
              body: r.message,
              icon: '/favicon.ico',
            });
          });
        }
      } else {
        setTriggeredRules([]);
      }
    } catch {}
  }, [token]);

  // Auto-poll every 30s when snap changes
  useEffect(() => {
    if (!snap || !token) return;

    // Evaluate immediately on first call
    evaluate(snap);

    // Then poll every 30s
    intervalRef.current = setInterval(() => evaluate(snap), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [snap?.balance, snap?.equity, snap?.daily_pnl, snap?.consecutive_losses]);

  return { isBlocked, blockReason, triggeredRules, lastEvaluated, evaluate };
}
