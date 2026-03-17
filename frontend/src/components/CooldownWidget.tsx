import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const API = 'http://localhost:8000/api/v1/cooldown';

interface CooldownStatus {
  active: boolean;
  minutes_remaining: number;
  reason: string;
  ends_at: string;
  message: string;
}

const REASONS = [
  { key: 'revenge_detected', label: '😤 Revenge Trade Lock', desc: 'Lock yourself after an emotional loss' },
  { key: 'loss_limit',       label: '📉 Loss Limit Hit',    desc: 'Daily loss limit reached' },
  { key: 'manual',           label: '🧘 Manual Cooldown',   desc: 'Step away to clear your head' },
];

const DURATIONS = [15, 30, 60, 120, 240];

interface CooldownWidgetProps {
  /** If the parent (RiskDashboard) already knows a lock is active, pass its endsAt ms */
  externalLockEndsAt?: number;
  /** Called when this widget starts a cooldown so the parent can sync */
  onCooldownStarted?: (endsAtMs: number, minutes: number) => void;
  /** Called when this widget cancels the cooldown */
  onCooldownStopped?: () => void;
}

const CooldownWidget: React.FC<CooldownWidgetProps> = ({
  externalLockEndsAt,
  onCooldownStarted,
  onCooldownStopped,
}) => {
  const [status,          setStatus]          = useState<CooldownStatus | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [dialogOpen,      setDialogOpen]      = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [selectedReason,  setSelectedReason]  = useState('manual');
  const [starting,        setStarting]        = useState(false);
  const [timeDisplay,     setTimeDisplay]     = useState('');

  const token   = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/status`, { headers });
      const data = await res.json();
      setStatus(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ── Countdown: prefer externalLockEndsAt if parent is driving ────────
  useEffect(() => {
    // Determine the authoritative endsAt
    const endsAtMs = externalLockEndsAt && externalLockEndsAt > Date.now()
      ? externalLockEndsAt
      : status?.active && status.ends_at
        ? new Date(status.ends_at).getTime()
        : 0;

    if (!endsAtMs) { setTimeDisplay(''); return; }

    const tick = () => {
      const diff = endsAtMs - Date.now();
      if (diff <= 0) { fetchStatus(); setTimeDisplay(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeDisplay(
        h > 0
          ? `${h}h ${m}m ${String(s).padStart(2, '0')}s`
          : `${m}m ${String(s).padStart(2, '0')}s`
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [status, externalLockEndsAt]);

  const startCooldown = async () => {
    setStarting(true);
    try {
      const res  = await fetch(`${API}/start`, {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ minutes: selectedMinutes, reason: selectedReason }),
      });
      const data = await res.json();
      setDialogOpen(false);
      await fetchStatus();

      // Notify parent so the overlay fires immediately
      if (onCooldownStarted) {
        const endsAtMs = data.ends_at
          ? new Date(data.ends_at).getTime()
          : Date.now() + selectedMinutes * 60 * 1000;
        onCooldownStarted(endsAtMs, selectedMinutes);
      }
    } finally { setStarting(false); }
  };

  const stopCooldown = async () => {
    await fetch(`${API}/stop`, { method: 'POST', headers });
    await fetchStatus();
    onCooldownStopped?.();
  };

  if (loading) return null;

  // Treat as active if either backend says so OR parent has an active lock
  const isActive = status?.active || (!!externalLockEndsAt && externalLockEndsAt > Date.now());

  // ── Active state ──────────────────────────────────────────────────────
  if (isActive) {
    return (
      <Box sx={{
        p: 2.5, borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
        border: '1px solid rgba(239,68,68,0.3)',
        position: 'relative', overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
        },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BlockIcon sx={{ color: '#ef4444', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>
              COOLDOWN ACTIVE
            </Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              {REASONS.find(r => r.key === status?.reason)?.label || 'Risk Lock'}
            </Typography>
          </Box>
        </Box>

        <Typography sx={{
          fontSize: '28px', fontWeight: 800, color: 'white',
          fontFamily: 'monospace', textAlign: 'center', mb: 2,
        }}>
          {timeDisplay || '…'}
        </Typography>

        <Button onClick={stopCooldown} fullWidth size="small" sx={{
          borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', fontSize: '12px', textTransform: 'none',
          '&:hover': { background: 'rgba(239,68,68,0.1)' },
        }}>
          Cancel Cooldown
        </Button>
      </Box>
    );
  }

  // ── Idle state ────────────────────────────────────────────────────────
  return (
    <>
      <Box sx={{
        p: 2.5, borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        position: 'relative', overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
        },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'rgba(56,189,248,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TimerIcon sx={{ color: '#38bdf8', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
              Revenge Trade Lock
            </Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              Force a cooldown period
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e' }} />
            <Typography sx={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>READY</Typography>
          </Box>
        </Box>

        <Button onClick={() => setDialogOpen(true)} fullWidth sx={{
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #ef4444, #f97316)',
          color: 'white', fontWeight: 700, fontSize: '13px', textTransform: 'none', py: 1.2,
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(239,68,68,0.35)' },
        }}>
          🛑 Activate Cooldown
        </Button>
      </Box>

      {/* ── Duration / Reason dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: {
          background: '#0f172a', color: 'white',
          borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
        }}}>
        <DialogTitle sx={{ fontSize: '20px', fontWeight: 700, pb: 1 }}>🛑 Start Cooldown</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', mb: 3 }}>
            Lock yourself out of trading for a set period to prevent emotional decisions.
          </Typography>

          {/* Reason */}
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Reason
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            {REASONS.map(r => (
              <Box key={r.key} onClick={() => setSelectedReason(r.key)} sx={{
                p: 2, borderRadius: '12px', cursor: 'pointer',
                background: selectedReason === r.key ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedReason === r.key ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.2s',
              }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{r.label}</Typography>
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{r.desc}</Typography>
              </Box>
            ))}
          </Box>

          {/* Duration */}
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Duration
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {DURATIONS.map(m => (
              <Box key={m} onClick={() => setSelectedMinutes(m)} sx={{
                px: 2, py: 1, borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                background: selectedMinutes === m ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${selectedMinutes === m ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: selectedMinutes === m ? '#ef4444' : 'rgba(255,255,255,0.6)',
                transition: 'all 0.2s',
              }}>
                {m >= 60 ? `${m / 60}h` : `${m}m`}
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={startCooldown} disabled={starting} variant="contained" sx={{
            background: 'linear-gradient(135deg, #ef4444, #f97316)',
            borderRadius: '10px', fontWeight: 700, textTransform: 'none', px: 3,
          }}>
            {starting
              ? <CircularProgress size={18} sx={{ color: 'white' }} />
              : `🛑 Lock for ${selectedMinutes >= 60 ? `${selectedMinutes / 60}h` : `${selectedMinutes}m`}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CooldownWidget;
