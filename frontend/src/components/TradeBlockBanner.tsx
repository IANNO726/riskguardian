/**
 * TradeBlockBanner �€” shows a full-width red banner on all pages
 * when a risk rule has blocked new trades.
 *
 * Add to AppShell.tsx inside the main content area:
 *   import TradeBlockBanner from './TradeBlockBanner';
 *   ...
 *   <TradeBlockBanner />
 *   {children}
 */
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Collapse } from '@mui/material';
import { Block, CheckCircle } from '@mui/icons-material';
import axios from 'axios';

const API = 'https://riskguardian.onrender.com/api/v1';

const TradeBlockBanner: React.FC = () => {
  const [isBlocked,   setIsBlocked]   = useState(false);
  const [reason,      setReason]      = useState('');
  const [unblocking,  setUnblocking]  = useState(false);

  const token   = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStatus = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/risk-rules/status`, { headers });
      setIsBlocked(res.data.is_blocked);
      setReason(res.data.reason || '');
    } catch {}
  };

  const unblock = async () => {
    setUnblocking(true);
    try {
      await axios.post(`${API}/risk-rules/unblock`, {}, { headers });
      setIsBlocked(false);
      setReason('');
    } catch {}
    finally { setUnblocking(false); }
  };

  // Poll every 15s
  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Collapse in={isBlocked}>
      <Box sx={{
        mx: 2, mt: 2, p: 2, borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.1))',
        border: '1px solid rgba(239,68,68,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 2,
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
          '50%':       { boxShadow: '0 0 0 6px rgba(239,68,68,0.15)' },
        },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Block sx={{ color: '#ef4444', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#ef4444', letterSpacing: '0.02em' }}>
              �Ÿš� NEW TRADES BLOCKED BY RISK RULE
            </Typography>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', mt: 0.2 }}>
              {reason || 'A risk rule has blocked new trading activity'}
            </Typography>
          </Box>
        </Box>
        <Button onClick={unblock} disabled={unblocking} startIcon={<CheckCircle sx={{ fontSize: 16 }} />}
          sx={{ borderRadius: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', fontWeight: 700, textTransform: 'none', fontSize: '13px', px: 2.5, py: 1, '&:hover': { background: 'rgba(239,68,68,0.3)' } }}>
          {unblocking ? 'Unblocking...' : 'Override & Unblock'}
        </Button>
      </Box>
    </Collapse>
  );
};

export default TradeBlockBanner;

