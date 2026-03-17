import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, LinearProgress, Collapse, CircularProgress } from '@mui/material';
import { startCheckout } from '../hooks/usePlan';
import { usePlan } from '../hooks/usePlan';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface ChecklistItem {
  id:          string;
  label:       string;
  description: string;
  emoji:       string;
  done:        boolean;
  loading:     boolean;
  action?:     { label: string; href?: string; onClick?: () => void };
}

interface OnboardingChecklistProps {
  connected: boolean;
  settings:  any;
}

const STORAGE_KEY          = 'rg_onboarding_dismissed';
const COMPLETION_FIRED_KEY = 'rg_onboarding_completion_fired';  // ✅ prevent duplicate API calls

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ connected, settings }) => {
  const { plan } = usePlan();
  const [expanded,        setExpanded]        = useState(true);
  const [dismissed,       setDismissed]       = useState(false);
  const [journalDone,     setJournalDone]     = useState(false);
  const [lockDone,        setLockDone]        = useState(false);
  const [journalLoading,  setJournalLoading]  = useState(true);
  const [lockLoading,     setLockLoading]     = useState(true);
  const [upgradeLoading,  setUpgradeLoading]  = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') setDismissed(true);
  }, []);

  const checkJournal = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { setJournalLoading(false); return; }
    try {
      const res  = await fetch(`${API}/api/v1/journal/entries?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const entries = Array.isArray(data) ? data : data?.entries ?? [];
      setJournalDone(entries.length > 0);
    } catch {
      setJournalDone(false);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  const checkLock = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { setLockLoading(false); return; }
    try {
      const res = await fetch(`${API}/api/v1/journal/lock-events?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data   = await res.json();
        const events = Array.isArray(data) ? data : data?.events ?? [];
        setLockDone(events.length > 0);
      } else {
        setLockDone(localStorage.getItem('rg_lock_activated') === 'true');
      }
    } catch {
      setLockDone(localStorage.getItem('rg_lock_activated') === 'true');
    } finally {
      setLockLoading(false);
    }
  }, []);

  useEffect(() => {
    checkJournal();
    checkLock();
  }, [checkJournal, checkLock]);

  const riskLimitsDone = !!(
    settings?.dailyLoss    > 0 ||
    settings?.maxDD        > 0 ||
    settings?.riskPerTrade > 0
  );

  const telegramDone = !!(
    settings?.telegram_enabled ||
    settings?.telegram_chat_id ||
    settings?.telegramChatId
  );

  const items: ChecklistItem[] = [
    {
      id:          'mt5',
      emoji:       '🖥️',
      label:       'Connect MetaTrader 5',
      description: 'Link your MT5 account so RiskGuardian can monitor your trades in real time.',
      done:        connected,
      loading:     false,
      action:      !connected ? { label: 'Connect MT5', href: '/app/settings' } : undefined,
    },
    {
      id:          'risk',
      emoji:       '🛡️',
      label:       'Set your risk limits',
      description: 'Define your daily loss, max drawdown, and risk per trade thresholds.',
      done:        riskLimitsDone,
      loading:     false,
      action:      !riskLimitsDone ? { label: 'Set limits', href: '/app/settings' } : undefined,
    },
    {
      id:          'lock',
      emoji:       '🔒',
      label:       'Activate your first Risk Lock',
      description: 'Use the Risk Lock button on the dashboard to block impulsive trading for a period.',
      done:        lockDone,
      loading:     lockLoading,
      action:      !lockDone && !lockLoading ? { label: 'Try it now', onClick: () => {
        document.getElementById('rg-risk-lock-btn')?.click();
      }} : undefined,
    },
    {
      id:          'journal',
      emoji:       '📔',
      label:       'Make your first journal entry',
      description: 'Log your first trade reflection. Journalling is proven to improve trading discipline.',
      done:        journalDone,
      loading:     journalLoading,
      action:      !journalDone && !journalLoading ? { label: 'Open Journal', href: '/app/journal' } : undefined,
    },
    {
      id:          'telegram',
      emoji:       '📱',
      label:       'Set up Telegram alerts',
      description: 'Get instant risk alerts on your phone even when the app is closed.',
      done:        telegramDone,
      loading:     false,
      action:      !telegramDone
        ? (plan === 'free' || plan === 'starter')
          ? { label: '⚡ Upgrade to Pro', onClick: () => startCheckout('pro', setUpgradeLoading) }
          : { label: 'Set up Telegram', href: '/app/settings' }
        : undefined,
    },
  ];

  const completedCount = items.filter(i => i.done).length;
  const totalCount     = items.length;
  const allDone        = completedCount === totalCount;
  const pct            = Math.round((completedCount / totalCount) * 100);

  // ✅ Track completion in admin dashboard — fires once per user, ever
  useEffect(() => {
    if (!allDone) return;
    if (localStorage.getItem(COMPLETION_FIRED_KEY) === 'true') return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    fetch(`${API}/api/v1/admin/onboarding/complete`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => {
        localStorage.setItem(COMPLETION_FIRED_KEY, 'true');
      })
      .catch(() => {
        // Silent fail — not critical, will retry next session
      });
  }, [allDone]);

  // Auto-dismiss after all done
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => {
        setDismissed(true);
        localStorage.setItem(STORAGE_KEY, 'true');
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  if (dismissed) return null;

  return (
    <Box sx={{
      mb: 3, borderRadius: '20px', overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(56,189,248,0.06), rgba(168,85,247,0.04))',
      border: '1px solid rgba(56,189,248,0.18)',
      boxShadow: '0 4px 30px rgba(56,189,248,0.06)',
      transition: 'all 0.3s ease',
    }}>

      {/* Header */}
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{
          px: 3, py: 2.2, display: 'flex', alignItems: 'center',
          gap: 2, cursor: 'pointer',
          '&:hover': { background: 'rgba(255,255,255,0.02)' },
        }}
      >
        {/* Progress ring */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <CircularProgress variant="determinate" value={100} size={44} thickness={3}
            sx={{ color: 'rgba(255,255,255,0.08)', position: 'absolute', top: 0, left: 0 }} />
          <CircularProgress variant="determinate" value={pct} size={44} thickness={3}
            sx={{ color: allDone ? '#22c55e' : '#38bdf8' }} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 800, color: allDone ? '#22c55e' : '#38bdf8' }}>
              {completedCount}/{totalCount}
            </Typography>
          </Box>
        </Box>

        {/* Title */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
              {allDone ? '🎉 Setup Complete!' : 'Getting Started'}
            </Typography>
            {allDone && (
              <Box sx={{ fontSize: '10px', fontWeight: 800, px: 1, py: 0.2, borderRadius: '6px', color: '#22c55e', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                DONE
              </Box>
            )}
          </Box>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)' }}>
            {allDone
              ? "You're all set — RiskGuardian is fully configured."
              : `${totalCount - completedCount} step${totalCount - completedCount !== 1 ? 's' : ''} remaining to get the most out of RiskGuardian`}
          </Typography>
        </Box>

        <Box sx={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', userSelect: 'none' }}>▾</Box>

        <Box
          onClick={e => { e.stopPropagation(); setDismissed(true); localStorage.setItem(STORAGE_KEY, 'true'); }}
          sx={{ fontSize: '16px', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', px: 0.5, '&:hover': { color: 'rgba(255,255,255,0.5)' } }}
        >✕</Box>
      </Box>

      {/* Progress bar */}
      <LinearProgress variant="determinate" value={pct} sx={{
        height: 3, background: 'rgba(255,255,255,0.06)',
        '& .MuiLinearProgress-bar': {
          background: allDone ? 'linear-gradient(90deg, #22c55e, #38bdf8)' : 'linear-gradient(90deg, #38bdf8, #a855f7)',
          transition: 'width 0.6s ease',
        },
      }} />

      {/* Checklist items */}
      <Collapse in={expanded}>
        <Box sx={{ px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map((item, idx) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, p: 1.8, borderRadius: '14px',
                background: item.done ? 'rgba(34,197,94,0.05)' : idx === items.findIndex(i => !i.done) ? 'rgba(56,189,248,0.06)' : 'rgba(255,255,255,0.02)',
                border: item.done ? '1px solid rgba(34,197,94,0.15)' : idx === items.findIndex(i => !i.done) ? '1px solid rgba(56,189,248,0.18)' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s',
              }}
            >
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: item.done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                border: item.done ? '1.5px solid rgba(34,197,94,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
                fontSize: item.done ? '16px' : '14px', transition: 'all 0.3s',
              }}>
                {item.loading ? <CircularProgress size={14} sx={{ color: '#38bdf8' }} /> : item.done ? '✓' : item.emoji}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: item.done ? 'rgba(255,255,255,0.45)' : 'white', textDecoration: item.done ? 'line-through' : 'none', mb: 0.2 }}>
                  {item.label}
                </Typography>
                {!item.done && (
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>
                    {item.description}
                  </Typography>
                )}
              </Box>

              {item.action && !item.done && (
                <Box
                  onClick={() => { if (item.action?.onClick) item.action.onClick(); else if (item.action?.href) window.location.hash = item.action.href; }}
                  sx={{
                    flexShrink: 0, px: 2, py: 0.8, borderRadius: '10px', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.8,
                    background: item.id === 'telegram' && (plan === 'free' || plan === 'starter') ? 'rgba(168,85,247,0.15)' : 'rgba(56,189,248,0.12)',
                    border: item.id === 'telegram' && (plan === 'free' || plan === 'starter') ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(56,189,248,0.3)',
                    color: item.id === 'telegram' && (plan === 'free' || plan === 'starter') ? '#a855f7' : '#38bdf8',
                    '&:hover': { transform: 'translateY(-1px)' }, transition: 'all 0.15s',
                  }}
                >
                  {upgradeLoading && item.id === 'telegram' ? <><CircularProgress size={10} sx={{ color: 'inherit' }} /> Opening...</> : item.action.label}
                </Box>
              )}

              {item.done && (
                <Box sx={{ flexShrink: 0, px: 1.5, py: 0.5, borderRadius: '8px', fontSize: '10px', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  Done
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default OnboardingChecklist;