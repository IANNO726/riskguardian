import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, LinearProgress, CircularProgress } from '@mui/material';

// Safe import
let useLiveTrades: any = () => ({
  balance: 0, equity: 0, dailyPnl: 0, dailyPnlPct: 0,
  activePositions: 0, connected: false, currency: 'USD',
  lastUpdated: null, positions: [],
});
try { const m = require('../hooks/useLiveTrades'); useLiveTrades = m.useLiveTrades || useLiveTrades; } catch {}

const API = process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com';
const n   = (v: any, fb = 0) => { const x = parseFloat(v); return isFinite(x) ? x : fb; };
const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Bottom nav tabs ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/app'           },
  { id: 'terminal',  label: 'Terminal',  icon: '💹', path: '/app/terminal'  },
  { id: 'risk',      label: 'Risk',      icon: '🎯', path: '/app/risk-check'},
  { id: 'analytics', label: 'Analytics', icon: '📈', path: '/app/analytics' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️', path: '/app/settings'  },
];

// ── Alert row ─────────────────────────────────────────────────────────────────
interface LiveAlert { id: number; type: string; message: string; time: Date; }

const MobileDashboard: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const live      = useLiveTrades();

  const balance         = n(live.balance);
  const equity          = n(live.equity, balance);
  const dailyPnl        = n(live.dailyPnl);
  const dailyPnlPct     = n(live.dailyPnlPct);
  const activePositions = n(live.activePositions);
  const connected       = live.connected;
  const currency        = live.currency || 'USD';

  const [settings,  setSettings]  = useState<any>(null);
  const [alerts,    setAlerts]    = useState<LiveAlert[]>([]);
  const [lockActive, setLockActive] = useState(false);
  const [timeLeft,   setTimeLeft]   = useState('');
  const [locking,    setLocking]    = useState(false);

  // ── Fetch alerts ─────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/v1/alerts-live/recent`);
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts.map((a: any) => ({
          id: a.id, type: a.type, message: a.message, time: new Date(a.time),
        })));
      }
    } catch {}
  }, []);

  // ── Fetch cooldown ────────────────────────────────────────────────────────
  const fetchCooldown = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(`${API}/api/v1/cooldown/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data  = await res.json();
      if (data.active && data.ends_at) {
        const ms   = new Date(data.ends_at).getTime();
        const diff = ms - Date.now();
        if (diff > 0) {
          setLockActive(true);
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m}m ${String(s).padStart(2, '0')}s`);
        } else {
          setLockActive(false);
          setTimeLeft('');
        }
      } else {
        setLockActive(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch(`${API}/api/v1/settings/`).then(r => r.json()).then(setSettings).catch(() => {});
    fetchAlerts();
    fetchCooldown();
    const i1 = setInterval(fetchAlerts,   5_000);
    const i2 = setInterval(fetchCooldown, 10_000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [fetchAlerts, fetchCooldown]);

  // ── Risk score ────────────────────────────────────────────────────────────
  const maxDrawdown  = balance > 0 ? Math.abs((balance - equity) / balance * 100) : 0;
  const riskScore = Math.round(
    Math.min(Math.abs(dailyPnlPct) / n(settings?.dailyLoss, 2), 1) * 40 +
    Math.min(maxDrawdown           / n(settings?.maxDD, 5),      1) * 35 +
    Math.min(activePositions / 5,                                   1) * 25
  );
  const riskColor = riskScore < 40 ? '#22c55e' : riskScore < 70 ? '#f59e0b' : '#ef4444';
  const riskLabel = riskScore < 40 ? 'LOW RISK' : riskScore < 70 ? 'MEDIUM' : 'HIGH RISK';

  // ── Quick risk lock ───────────────────────────────────────────────────────
  const handleQuickLock = async () => {
    if (lockActive) return;
    setLocking(true);
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`${API}/api/v1/cooldown/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ minutes: 60, reason: 'manual', notes: 'Mobile quick lock' }),
      });
      setLockActive(true);
      setTimeLeft('60m 00s');
      fetchAlerts();
    } catch {}
    setLocking(false);
  };

  // ── Active tab ────────────────────────────────────────────────────────────
  const hash    = location.hash.replace('#', '');
  const activeTab = TABS.find(t =>
    t.id === 'dashboard' ? (hash === '/app' || hash === '/app/') : hash.startsWith(t.path)
  )?.id || 'dashboard';

  const bg = '#080e1a';

  return (
    <Box sx={{
      minHeight: '100vh', background: bg, color: 'white',
      fontFamily: '"DM Sans",sans-serif',
      pb: '80px',   // space for bottom nav
      overflowX: 'hidden',
    }}>

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <Box sx={{
        px: 2, pt: 3, pb: 1.5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100,
        background: `${bg}ee`, backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <Box>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
            background: 'linear-gradient(90deg,#38bdf8,#22c55e)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            RiskGuardian
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', mt: 0.2 }}>
            Professional Trading Dashboard
          </Typography>
        </Box>

        {/* Connection status */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 0.7, borderRadius: '20px',
          background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
            animation: connected ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
          }} />
          <Typography sx={{ fontSize: 11, fontWeight: 700,
            color: connected ? '#22c55e' : '#ef4444' }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </Typography>
        </Box>
      </Box>

      {/* ── Risk Lock Banner (shown when active) ────────────────────────── */}
      {lockActive && (
        <Box sx={{
          mx: 2, mt: 2, p: 1.5, borderRadius: '14px',
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.35)',
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}>
          <Typography sx={{ fontSize: 20 }}>🔒</Typography>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
              Risk Lock Active
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              Time remaining: {timeLeft}
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Balance Hero Card ────────────────────────────────────────────── */}
      <Box sx={{ mx: 2, mt: 2, p: 2.5, borderRadius: '20px',
        background: 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(34,197,94,0.08))',
        border: '1px solid rgba(56,189,248,0.2)',
        position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100,
          borderRadius: '50%', background: 'rgba(56,189,248,0.08)', }} />
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.5 }}>
          Account Balance
        </Typography>
        <Typography sx={{ fontSize: 36, fontWeight: 800, color: 'white',
          fontFamily: '"DM Mono",monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>
          ${fmt(balance)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
          {currency} · Equity ${fmt(equity)}
        </Typography>
      </Box>

      {/* ── 4 Stat Cards ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mx: 2, mt: 1.5 }}>
        {[
          {
            label: 'Daily P&L',
            value: `${dailyPnl >= 0 ? '+' : ''}$${fmt(dailyPnl)}`,
            sub:   `${dailyPnlPct >= 0 ? '+' : ''}${dailyPnlPct.toFixed(2)}%`,
            color: dailyPnl >= 0 ? '#22c55e' : '#ef4444',
            icon:  dailyPnl >= 0 ? '📈' : '📉',
          },
          {
            label: 'Positions',
            value: activePositions.toString(),
            sub:   activePositions > 0 ? 'Open trades' : 'No open trades',
            color: '#ce93d8',
            icon:  '📋',
          },
          {
            label: 'Max Drawdown',
            value: `${maxDrawdown.toFixed(1)}%`,
            sub:   `Limit: ${n(settings?.maxDD, 5)}%`,
            color: maxDrawdown > n(settings?.maxDD, 5) * 0.8 ? '#ef4444' : '#64b5f6',
            icon:  '📉',
          },
          {
            label: 'Risk Score',
            value: riskScore.toString(),
            sub:   riskLabel,
            color: riskColor,
            icon:  riskScore < 40 ? '🟢' : riskScore < 70 ? '🟡' : '🔴',
          },
        ].map((card, i) => (
          <Box key={i} sx={{
            p: 2, borderRadius: '16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {card.label}
              </Typography>
              <Typography sx={{ fontSize: 16 }}>{card.icon}</Typography>
            </Box>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: card.color,
              fontFamily: '"DM Mono",monospace', mt: 1, lineHeight: 1 }}>
              {card.value}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mt: 0.5 }}>
              {card.sub}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Risk Gauge ───────────────────────────────────────────────────── */}
      <Box sx={{ mx: 2, mt: 1.5, p: 2.5, borderRadius: '16px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Risk Monitor
          </Typography>
          <Box sx={{ px: 1.5, py: 0.4, borderRadius: '20px',
            background: `${riskColor}20`, border: `1px solid ${riskColor}40` }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: riskColor }}>
              {riskLabel}
            </Typography>
          </Box>
        </Box>
        {[
          { label: 'Daily Loss',   value: Math.abs(dailyPnlPct), limit: n(settings?.dailyLoss,    2) },
          { label: 'Max Drawdown', value: maxDrawdown,           limit: n(settings?.maxDD,         5) },
          { label: 'Risk/Trade',   value: 0,                     limit: n(settings?.riskPerTrade,  1) },
        ].map((rule, i) => (
          <Box key={i} sx={{ mb: i < 2 ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                {rule.label}
              </Typography>
              <Typography sx={{ fontSize: 11, fontFamily: '"DM Mono",monospace',
                color: rule.value / rule.limit > 0.8 ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
                {rule.value.toFixed(1)} / {rule.limit}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min((rule.value / rule.limit) * 100, 100)}
              sx={{
                height: 6, borderRadius: 3,
                background: 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  background: rule.value / rule.limit > 0.8
                    ? 'linear-gradient(90deg,#f97316,#ef4444)'
                    : `linear-gradient(90deg,${riskColor}88,${riskColor})`,
                },
              }}
            />
          </Box>
        ))}
      </Box>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <Box sx={{ mx: 2, mt: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {/* Risk Lock Button */}
        <Box
          onClick={handleQuickLock}
          sx={{
            p: 2, borderRadius: '16px', cursor: lockActive ? 'default' : 'pointer',
            background: lockActive ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${lockActive ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.25)'}`,
            textAlign: 'center', transition: 'all 0.2s',
            '&:active': { transform: lockActive ? 'none' : 'scale(0.97)' },
          }}>
          <Typography sx={{ fontSize: 24, mb: 0.5 }}>
            {locking ? '⏳' : lockActive ? '🔒' : '🔓'}
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700,
            color: lockActive ? '#ef4444' : '#f59e0b' }}>
            {locking ? 'Locking...' : lockActive ? `LOCKED\n${timeLeft}` : 'Risk Lock'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', mt: 0.3 }}>
            {lockActive ? 'Active — 1h' : 'Tap to lock 1h'}
          </Typography>
        </Box>

        {/* Refresh */}
        <Box
          onClick={() => window.location.reload()}
          sx={{
            p: 2, borderRadius: '16px', cursor: 'pointer',
            background: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.2)',
            textAlign: 'center', transition: 'all 0.2s',
            '&:active': { transform: 'scale(0.97)' },
          }}>
          <Typography sx={{ fontSize: 24, mb: 0.5 }}>🔄</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
            Refresh
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', mt: 0.3 }}>
            Reload data
          </Typography>
        </Box>
      </Box>

      {/* ── Open Positions ───────────────────────────────────────────────── */}
      {live.positions && live.positions.length > 0 && (
        <Box sx={{ mx: 2, mt: 1.5, p: 2, borderRadius: '16px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.5 }}>
            Open Positions ({live.positions.length})
          </Typography>
          {live.positions.slice(0, 5).map((pos: any, i: number) => (
            <Box key={i} sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              py: 1.2, borderBottom: i < live.positions.length - 1
                ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                  {pos.symbol}
                </Typography>
                <Typography sx={{ fontSize: 11, color: pos.type === 'buy' || pos.type === 0
                  ? '#22c55e' : '#ef4444' }}>
                  {typeof pos.type === 'number' ? (pos.type === 0 ? 'BUY' : 'SELL')
                    : pos.type?.toUpperCase()} · {pos.volume} lots
                </Typography>
              </Box>
              <Typography sx={{
                fontSize: 14, fontWeight: 800,
                fontFamily: '"DM Mono",monospace',
                color: pos.profit >= 0 ? '#22c55e' : '#ef4444',
              }}>
                {pos.profit >= 0 ? '+' : ''}${n(pos.profit).toFixed(2)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Live Alerts ──────────────────────────────────────────────────── */}
      <Box sx={{ mx: 2, mt: 1.5, mb: 2, p: 2, borderRadius: '16px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Live Alerts
          </Typography>
          <Box sx={{ px: 1, py: 0.3, borderRadius: '8px',
            background: 'rgba(100,181,246,0.15)', border: '1px solid rgba(100,181,246,0.3)' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64b5f6' }}>
              REAL-TIME
            </Typography>
          </Box>
        </Box>
        {alerts.length === 0 ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 28, opacity: 0.2, mb: 0.5 }}>🔔</Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              No recent alerts
            </Typography>
          </Box>
        ) : alerts.slice(0, 4).map(alert => (
          <Box key={alert.id} sx={{
            mb: 1, p: 1.2, borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            borderLeft: `3px solid ${
              alert.type === 'success' ? '#22c55e' :
              alert.type === 'warning' ? '#f59e0b' :
              alert.type === 'error'   ? '#ef4444' : '#64b5f6'
            }`,
          }}>
            <Typography sx={{ fontSize: 12, color: 'white' }}>{alert.message}</Typography>
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace', mt: 0.3 }}>
              {alert.time.toLocaleTimeString()}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Bottom Navigation ────────────────────────────────────────────── */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: `${bg}f0`, backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        px: 1, pt: 0.8, pb: 'calc(0.8rem + env(safe-area-inset-bottom))',
      }}>
        {TABS.map(tab => {
          const active = tab.id === activeTab;
          return (
            <Box
              key={tab.id}
              onClick={() => navigate(tab.path)}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 0.3, px: 1.5, py: 0.8, borderRadius: '12px',
                cursor: 'pointer', minWidth: 52, transition: 'all 0.2s',
                background: active ? 'rgba(56,189,248,0.12)' : 'transparent',
                '&:active': { transform: 'scale(0.92)' },
              }}>
              <Typography sx={{
                fontSize: active ? 22 : 20, lineHeight: 1,
                filter: active ? 'drop-shadow(0 0 8px rgba(56,189,248,0.8))' : 'none',
                transition: 'all 0.2s',
              }}>
                {tab.icon}
              </Typography>
              <Typography sx={{
                fontSize: 9, fontWeight: active ? 800 : 500,
                color: active ? '#38bdf8' : 'rgba(255,255,255,0.35)',
                letterSpacing: '0.05em', transition: 'all 0.2s',
              }}>
                {tab.label}
              </Typography>
              {active && (
                <Box sx={{ width: 4, height: 4, borderRadius: '50%',
                  background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
              )}
            </Box>
          );
        })}
      </Box>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        body { overscroll-behavior: none; }
      `}</style>
    </Box>
  );
};

export default MobileDashboard;

