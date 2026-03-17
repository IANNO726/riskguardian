import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { startCheckout } from '../hooks/usePlan';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface TrialStatus {
  trial_active:  boolean;
  trial_used:    boolean;
  days_left:     number;
  hours_left:    number;
  trial_ends:    string | null;
}

interface TrialBannerProps {
  plan: string;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ plan }) => {
  const [trial,          setTrial]          = useState<TrialStatus | null>(null);
  const [starting,       setStarting]       = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const fetchTrialStatus = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res  = await fetch(`${API}/api/v1/billing/trial-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTrial(data);
    } catch {}
  };

  const startTrial = async () => {
    const token = localStorage.getItem('access_token');
    if (!token || starting) return;
    setStarting(true);
    try {
      const res  = await fetch(`${API}/api/v1/billing/start-trial`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        // Update localStorage plan
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          user.plan = 'pro';
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('selected_plan', 'pro');
        } catch {}
        window.location.reload();
      } else {
        alert(data.detail || 'Could not start trial');
      }
    } catch {
      alert('Could not start trial — please try again');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => { fetchTrialStatus(); }, []);

  if (!trial) return null;

  // ── Active trial countdown ────────────────────────────────
  if (trial.trial_active && plan === 'pro') {
    const isLastDay = trial.days_left === 0;
    const color     = isLastDay ? '#ef4444' : trial.days_left <= 2 ? '#f59e0b' : '#a855f7';

    return (
      <Box sx={{
        mt: 1, mb: 1, p: 1.5, borderRadius: '12px',
        background: `rgba(${isLastDay ? '239,68,68' : trial.days_left <= 2 ? '245,158,11' : '168,85,247'},0.08)`,
        border: `1px solid ${color}30`,
      }}>
        {/* Countdown bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 800, color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ⚡ Pro Trial
          </Typography>
          <Typography sx={{ fontSize: '11px', fontWeight: 800, color, fontFamily: 'monospace' }}>
            {trial.days_left > 0 ? `${trial.days_left}d left` : `${trial.hours_left}h left`}
          </Typography>
        </Box>

        {/* Progress bar */}
        <Box sx={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', mb: 1 }}>
          <Box sx={{
            height: '100%', borderRadius: 2,
            width: `${Math.min(100, ((7 - trial.days_left) / 7) * 100)}%`,
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            transition: 'width 0.5s ease',
          }} />
        </Box>

        <Box
          onClick={() => !upgradeLoading && startCheckout('pro', setUpgradeLoading)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8,
            py: 0.8, borderRadius: '8px', cursor: upgradeLoading ? 'not-allowed' : 'pointer',
            background: `${color}18`, border: `1px solid ${color}35`,
            '&:hover': !upgradeLoading ? { background: `${color}28` } : {},
            transition: 'all 0.15s',
          }}
        >
          {upgradeLoading
            ? <><CircularProgress size={10} sx={{ color }} /> <Typography sx={{ fontSize: '10px', fontWeight: 700, color }}>Opening...</Typography></>
            : <Typography sx={{ fontSize: '10px', fontWeight: 700, color }}>Keep Pro after trial →</Typography>
          }
        </Box>
      </Box>
    );
  }

  // ── Trial CTA for free users who haven't used trial ───────
  if (!trial.trial_used && plan === 'free') {
    return (
      <Box
        onClick={startTrial}
        sx={{
          mt: 1, mb: 1, p: 1.5, borderRadius: '12px',
          background: 'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(56,189,248,0.07))',
          border: '1px solid rgba(168,85,247,0.28)',
          cursor: starting ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          transition: 'all 0.2s',
          '&:hover': !starting ? { background: 'linear-gradient(135deg,rgba(168,85,247,0.18),rgba(56,189,248,0.12))' } : {},
        }}
      >
        {starting ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={12} sx={{ color: '#a855f7' }} />
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#a855f7' }}>Activating...</Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#a855f7', mb: 0.3 }}>
              🎁 Try Pro Free
            </Typography>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
              7 days · No credit card
            </Typography>
          </>
        )}
      </Box>
    );
  }

  return null;
};

export default TrialBanner;