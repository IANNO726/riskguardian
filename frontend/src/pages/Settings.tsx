import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, TextField, Button, Switch, Grid,
  Alert, Snackbar, CircularProgress, Slide,
  Tooltip, useMediaQuery, useTheme, InputAdornment, Divider,
} from "@mui/material";
import {
  Save as SaveIcon, Refresh as RefreshIcon,
  Lock as LockIcon, Person as PersonIcon, Dns as DnsIcon,
  LockOutlined,
  CreditCard as CreditCardIcon, OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import { usePlan, startCheckout } from '../hooks/usePlan';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com';

const PLAN_CONFIG = {
  free:       { label: 'Free Trial',  color: '#9aa4b2', emoji: 'ðŸŽ', next: 'starter' },
  starter:    { label: 'Starter',     color: '#38bdf8', emoji: 'ðŸš€', next: 'pro'     },
  pro:        { label: 'Pro',         color: '#a855f7', emoji: 'âš¡', next: 'enterprise' },
  enterprise: { label: 'Enterprise',  color: '#f59e0b', emoji: 'ðŸ‘‘', next: null      },
};

const PLAN_PRICES: Record<string, string> = {
  free: '$0/mo', starter: '$19/mo', pro: '$49/mo', enterprise: '$149/mo',
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TELEGRAM CONNECT PANEL  (self-contained, drop-in)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const TelegramPanel: React.FC = () => {
  const [status,  setStatus]  = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [chatId,  setChatId]  = useState<string | null>(null);
  const [link,    setLink]    = useState('');
  const [testing, setTesting] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [flash,   setFlash]   = useState<{ text: string; ok: boolean } | null>(null);

  const token = () => localStorage.getItem('access_token') || '';

  const showFlash = (text: string, ok: boolean) => {
    setFlash({ text, ok });
    setTimeout(() => setFlash(null), 4000);
  };

  const loadStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/v1/telegram/connect-link`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.connected) {
        setStatus('connected');
        setChatId(data.chat_id);
      } else {
        setStatus('disconnected');
        setLink(data.link || '');
      }
    } catch {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleDisconnect = async () => {
    try {
      await fetch(`${API}/api/v1/telegram/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      setStatus('disconnected');
      setChatId(null);
      showFlash('Telegram disconnected', true);
      await loadStatus();
    } catch {
      showFlash('Failed to disconnect', false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res  = await fetch(`${API}/api/v1/telegram/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      showFlash(data.message ? `âœ… ${data.message}` : 'âœ… Test alert sent! Check Telegram.', true);
    } catch {
      showFlash('âŒ Could not reach server', false);
    } finally {
      setTesting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const badge = {
    loading:      { bg: 'rgba(100,116,139,0.12)', color: '#64748b', border: 'rgba(100,116,139,0.3)', label: 'â—Œ Checking...' },
    connected:    { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', border: 'rgba(34,197,94,0.3)',   label: 'â— Connected'    },
    disconnected: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)',  label: 'â—‹ Not connected' },
  }[status];

  return (
    <Box sx={{
      borderRadius: '20px',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Flash notification */}
      {flash && (
        <Box sx={{
          position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
          px: 2, py: 1.5, borderRadius: '12px', backdropFilter: 'blur(10px)',
          background: flash.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${flash.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: 'white', fontSize: '13px', fontWeight: 600,
        }}>
          {flash.text}
        </Box>
      )}

      {/* Header */}
      <Box sx={{
        px: 3, pt: 2.5, pb: 2.5,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '13px', flexShrink: 0,
          background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
        }}>
          âœˆï¸
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>
            Telegram Connection
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', mt: 0.3 }}>
            One-click setup Â· Instant risk warnings on your phone
          </Typography>
        </Box>
        {/* Status badge */}
        <Box sx={{ px: 2, py: 0.8, borderRadius: '20px', background: badge.bg, border: `1px solid ${badge.border}` }}>
          <Typography sx={{ fontSize: '11px', fontWeight: 800, color: badge.color, letterSpacing: '0.05em' }}>
            {badge.label}
          </Typography>
        </Box>
      </Box>

      {/* â”€â”€ CONNECTED STATE â”€â”€ */}
      {status === 'connected' && (
        <Box sx={{ p: 3 }}>
          {/* Connected banner */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: '14px',
            background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', mb: 2.5,
          }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
              background: 'rgba(34,197,94,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
            }}>ðŸ›¡ï¸</Box>
            <Box>
              <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '14px' }}>
                Telegram is active â€” alerts are live
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', mt: 0.2 }}>
                Chat ID: {chatId}
              </Typography>
            </Box>
          </Box>

          {/* Alert types list */}
          <Box sx={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', mb: 2.5 }}>
            {[
              { icon: 'ðŸ”´', label: 'Kill switch fired',          color: '#ef4444' },
              { icon: 'âš ï¸',  label: '80% daily limit warning',   color: '#f59e0b' },
              { icon: 'ðŸŸ¡', label: '50% daily limit warning',    color: '#eab308' },
              { icon: 'ðŸ”„', label: 'Consecutive loss cooldown',  color: '#38bdf8' },
              { icon: 'ðŸ“Š', label: 'Trade closed P&L update',    color: '#a855f7' },
              { icon: 'ðŸ“…', label: 'Daily trading summary',      color: '#22c55e' },
            ].map((a, i, arr) => (
              <Box key={a.label} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2,
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', flex: 1 }}>
                  {a.label}
                </Typography>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: a.color, boxShadow: `0 0 6px ${a.color}` }} />
              </Box>
            ))}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              onClick={handleTest}
              disabled={testing}
              fullWidth
              sx={{
                py: 1.3, borderRadius: '12px',
                background: 'linear-gradient(135deg,#2563eb,#38bdf8)',
                color: 'white', fontWeight: 700, fontSize: '13px', textTransform: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
                '&:disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' },
              }}
            >
              {testing ? 'â³ Sending...' : 'ðŸ“¨ Send Test Alert'}
            </Button>
            <Button
              onClick={handleDisconnect}
              sx={{
                px: 2.5, py: 1.3, borderRadius: '12px', whiteSpace: 'nowrap',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: 'rgba(239,68,68,0.8)', fontWeight: 600, fontSize: '13px', textTransform: 'none',
                '&:hover': { background: 'rgba(239,68,68,0.14)' },
              }}
            >
              Disconnect
            </Button>
          </Box>
        </Box>
      )}

      {/* â”€â”€ DISCONNECTED STATE â”€â”€ */}
      {status === 'disconnected' && (
        <Box sx={{ p: 3 }}>
          {/* Warning */}
          <Box sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 2, borderRadius: '12px', mb: 2.5,
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
            borderLeft: '3px solid #f59e0b',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>âš ï¸</span>
            <Typography sx={{ color: 'rgba(245,158,11,0.9)', fontSize: '13px', lineHeight: 1.6 }}>
              <strong style={{ color: '#f59e0b' }}>Alerts not active.</strong> When your kill switch
              fires or daily limit is hit, you won't be notified in time. Connect Telegram to stay protected.
            </Typography>
          </Box>

          {/* 3-step instructions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
            {[
              'Click the button below to open your personal Telegram link',
              'Press START in Telegram â€” takes 2 seconds',
              'Come back here and click "Refresh status" â€” you\'re done âœ…',
            ].map((text, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0, mt: 0.2,
                  background: 'linear-gradient(135deg,#2563eb,#38bdf8)',
                  color: 'white', fontWeight: 800, fontSize: '11px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i + 1}
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.6, pt: 0.2 }}>
                  {text}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Connect button + copy */}
          {link && (
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
              <Button
                component="a"
                href={link}
                target="_blank"
                rel="noreferrer"
                fullWidth
                sx={{
                  py: 1.5, borderRadius: '12px',
                  background: 'linear-gradient(135deg,#0088cc,#38bdf8)',
                  color: 'white', fontWeight: 800, fontSize: '14px', textTransform: 'none',
                  boxShadow: '0 4px 20px rgba(0,136,204,0.4)', textDecoration: 'none',
                }}
              >
                âœˆï¸ &nbsp; Connect Telegram â€” 10 seconds
              </Button>
              <Tooltip title={copied ? 'Copied!' : 'Copy link'} placement="top">
                <Button
                  onClick={handleCopy}
                  sx={{
                    width: 52, height: 52, minWidth: 'unset', borderRadius: '12px', flexShrink: 0,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: copied ? '#22c55e' : 'rgba(255,255,255,0.5)', fontSize: '18px',
                  }}
                >
                  {copied ? 'âœ“' : 'â§‰'}
                </Button>
              </Tooltip>
            </Box>
          )}

          {/* Refresh link */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>
              Already pressed START in Telegram?
            </Typography>
            <Button
              onClick={loadStatus}
              sx={{
                p: 0, minWidth: 'unset', color: '#38bdf8',
                fontSize: '12px', fontWeight: 600, textTransform: 'none', textDecoration: 'underline',
              }}
            >
              Refresh status
            </Button>
          </Box>
        </Box>
      )}

      {/* â”€â”€ LOADING STATE â”€â”€ */}
      {status === 'loading' && (
        <Box sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <CircularProgress size={20} sx={{ color: '#38bdf8' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            Checking connection...
          </Typography>
        </Box>
      )}
    </Box>
  );
};


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN SETTINGS COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const Settings: React.FC = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { plan, features, expiresAt } = usePlan();

  const [settings,         setSettings]         = useState<any>(null);
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [portalLoading,    setPortalLoading]    = useState(false);
  const [upgradeLoading,   setUpgradeLoading]   = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');
  const [toast,            setToast]            = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({ open: false, message: '', severity: 'success' });
  const [notification,     setNotification]     = useState({ open: false, message: '', type: 'success' as 'success' | 'error' });

  const showToast = (message: string, severity: 'success' | 'error' | 'warning') =>
    setToast({ open: true, message, severity });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch(`${API}/api/v1/settings/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setSettings(d); setLoading(false); })
      .catch(() => { setSettings({}); setLoading(false); });
  }, []);

  const update = (field: string, value: any) =>
    setSettings((s: any) => ({ ...s, [field]: value }));

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API}/api/v1/settings/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        isMobile
          ? showToast('Settings saved!', 'success')
          : setNotification({ open: true, message: 'Settings saved successfully! âœ…', type: 'success' });
      } else throw new Error();
    } catch {
      isMobile
        ? showToast('Failed to save', 'error')
        : setNotification({ open: true, message: 'Failed to save settings âŒ', type: 'error' });
    } finally { setSaving(false); }
  };

  const reconnectMT5 = async () => {
    setConnectionStatus('connecting');
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(`${API}/api/v1/settings/reconnect`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data  = await res.json();
      setConnectionStatus('connected');
      isMobile
        ? showToast(data.message || 'Reconnected!', 'success')
        : setNotification({ open: true, message: data.message || 'Reconnected! ðŸ”—', type: 'success' });
    } catch {
      setConnectionStatus('disconnected');
      isMobile
        ? showToast('Reconnection failed', 'error')
        : setNotification({ open: true, message: 'Reconnection failed âš ï¸', type: 'error' });
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const { data } = await axios.post(
        `${API}/api/v1/billing/create-portal-session`,
        { return_url: `${window.location.origin}/#/app/settings` },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.top!.location.href = data.portal_url;
    } catch {
      showToast('Could not open billing portal', 'error');
    } finally { setPortalLoading(false); }
  };

  const handleUpgrade = async (targetPlan: string) => {
    setUpgradeLoading(targetPlan);
    try { await startCheckout(targetPlan as any); }
    catch { showToast('Could not start checkout', 'error'); setUpgradeLoading(''); }
  };

  const planCfg = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.free;
  const nextPlan = planCfg.next ? PLAN_CONFIG[planCfg.next as keyof typeof PLAN_CONFIG] : null;

  // â”€â”€ Shared styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const si = (accent = '#38bdf8') => ({
    '& .MuiOutlinedInput-root': {
      color: 'white', borderRadius: '14px', background: 'rgba(255,255,255,0.04)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: `${accent}66` },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: '1.5px' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)', fontSize: '15px' },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& input': { fontFamily: '"DM Mono",monospace', fontSize: '16px', color: 'white', padding: '14px 14px 14px 0' },
    '& .MuiInputAdornment-root svg': { fontSize: '22px' },
  });

  // â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ToggleRow: React.FC<{
    icon: string; label: string; desc: string;
    checked: boolean; onChange: (v: boolean) => void; color: string;
  }> = ({ icon, label, desc, checked, onChange, color }) => (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      p: 2.5, borderRadius: '16px',
      background: checked ? `${color}12` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${checked ? `${color}35` : 'rgba(255,255,255,0.07)'}`,
      transition: 'all 0.25s',
      '&:hover': { background: checked ? `${color}18` : 'rgba(255,255,255,0.05)' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: '14px', fontSize: '22px', flexShrink: 0,
          background: checked ? `${color}20` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${checked ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s',
        }}>
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.3 }}>{label}</Typography>
          <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>{desc}</Typography>
        </Box>
      </Box>
      <Switch
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked': { color },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: color },
        }}
      />
    </Box>
  );

  const LockedToggle: React.FC<{ label: string; desc: string; icon: string }> = ({ label, desc, icon }) => (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Box sx={{ fontSize: '14px', fontWeight: 700, mb: 0.5 }}>ðŸ”’ Pro Plan Required</Box>
          <Box sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            Upgrade to <span style={{ color: '#a855f7', fontWeight: 700 }}>Pro</span> to unlock.
          </Box>
        </Box>
      }
      arrow
      placement="top"
    >
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        p: 2.5, borderRadius: '16px', background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)', opacity: 0.45,
        cursor: 'not-allowed', filter: 'grayscale(40%)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '14px', fontSize: '22px',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </Box>
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.3 }}>{label}</Typography>
            <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>{desc}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockOutlined sx={{ fontSize: 16, color: '#a855f7' }} />
          <Box sx={{
            fontSize: '11px', fontWeight: 700, color: '#a855f7',
            background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: '8px', px: 1.2, py: 0.4,
          }}>
            PRO
          </Box>
        </Box>
      </Box>
    </Tooltip>
  );

  const ConnBadge = () => {
    const map: Record<string, string[]> = {
      connected:    ['rgba(34,197,94,0.12)',  '#22c55e', 'rgba(34,197,94,0.3)',  'â— LIVE'],
      connecting:   ['rgba(245,158,11,0.12)', '#f59e0b', 'rgba(245,158,11,0.3)', 'â—Œ CONNECTING'],
      disconnected: ['rgba(239,68,68,0.12)',  '#ef4444', 'rgba(239,68,68,0.3)',  'â—‹ OFFLINE'],
    };
    const [bg, color, border, label] = map[connectionStatus];
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1, borderRadius: '12px', background: bg, border: `1px solid ${border}` }}>
        <Typography sx={{ fontSize: '13px', fontWeight: 800, color, letterSpacing: '0.06em' }}>{label}</Typography>
      </Box>
    );
  };

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0b1120', gap: 2 }}>
      <CircularProgress sx={{ color: '#38bdf8' }} size={48} />
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>Loading settings...</Typography>
    </Box>
  );

  return (
    <Box sx={{
      minHeight: '100vh', p: { xs: 2, md: 4 }, color: 'white',
      background: 'radial-gradient(ellipse at 10% 0%,rgba(56,189,248,0.07),transparent 45%), radial-gradient(ellipse at 90% 10%,rgba(34,197,94,0.06),transparent 45%), radial-gradient(ellipse at 50% 100%,rgba(168,85,247,0.05),transparent 50%), #0b1120',
    }}>

      {/* â”€â”€ PAGE HEADER â”€â”€ */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 3, md: 4 }, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 4, height: 36, borderRadius: 2, background: 'linear-gradient(180deg,#38bdf8,#22c55e)' }} />
            <Typography sx={{
              fontSize: { xs: '24px', md: '32px' }, fontWeight: 800, letterSpacing: '-0.02em',
              background: 'linear-gradient(90deg,#38bdf8,#22c55e)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Platform Settings
            </Typography>
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', ml: '20px' }}>
            Configure your trading platform and risk parameters
          </Typography>
        </Box>
        <Button
          onClick={saveSettings}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <SaveIcon sx={{ fontSize: 20 }} />}
          sx={{
            px: 4, py: 1.4, borderRadius: '14px',
            background: 'linear-gradient(135deg,#2563eb,#22c55e)',
            color: 'white', fontWeight: 700, fontSize: '15px', textTransform: 'none',
            boxShadow: '0 6px 24px rgba(37,99,235,0.35)', transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 32px rgba(37,99,235,0.5)' },
            '&:disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' },
          }}
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </Box>

      {/* â”€â”€ SUBSCRIPTION CARD â”€â”€ */}
      <Box sx={{
        borderRadius: '24px', background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', mb: 3, position: 'relative',
        '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${planCfg.color},transparent)` },
      }}>
        <Box sx={{ px: { xs: 2.5, md: 4 }, pt: 3, pb: 3, borderBottom: '1px solid rgba(255,255,255,0.06)', background: `${planCfg.color}08` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 54, height: 54, borderRadius: '16px', background: `${planCfg.color}20`, border: `1px solid ${planCfg.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>
                {planCfg.emoji}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '21px', fontWeight: 700, color: 'white' }}>Subscription</Typography>
                <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', mt: 0.4 }}>Manage your plan and billing</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.2, borderRadius: '14px', background: `${planCfg.color}15`, border: `1px solid ${planCfg.color}35` }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: planCfg.color, boxShadow: `0 0 8px ${planCfg.color}` }} />
              <Typography sx={{ fontSize: '14px', fontWeight: 800, color: planCfg.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {planCfg.label} Plan
              </Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                {PLAN_PRICES[plan]}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2.5, md: 4 } }}>
          <Grid container spacing={3}>
            {/* Plan features */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 3, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                  Current Plan Features
                </Typography>
                {[
                  { label: 'Trading Accounts',   val: features.max_accounts === 999 ? 'Unlimited' : `${features.max_accounts} account${features.max_accounts !== 1 ? 's' : ''}`, ok: features.max_accounts > 0 },
                  { label: 'AI Journal',          val: features.ai_journal        ? 'Included' : 'Not included', ok: features.ai_journal        },
                  { label: 'Telegram Alerts',     val: features.telegram_alerts   ? 'Included' : 'Not included', ok: features.telegram_alerts   },
                  { label: 'Prop Firm Profiles',  val: features.prop_firm_profiles ? 'Included' : 'Not included', ok: features.prop_firm_profiles },
                  { label: 'Priority Support',    val: features.priority_support  ? 'Included' : 'Not included', ok: features.priority_support  },
                  { label: 'Trade History',       val: `${features.trade_history_days} days`,                    ok: features.trade_history_days > 0 },
                ].map(f => (
                  <Box key={f.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>{f.label}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: f.ok ? '#22c55e' : 'rgba(255,255,255,0.2)' }} />
                      <Typography sx={{ fontSize: '14px', fontWeight: 600, color: f.ok ? 'white' : 'rgba(255,255,255,0.3)' }}>{f.val}</Typography>
                    </Box>
                  </Box>
                ))}
                {expiresAt && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                      Next billing: <span style={{ color: 'white', fontWeight: 600 }}>{new Date(expiresAt).toLocaleDateString()}</span>
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
            {/* Actions */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                {nextPlan && planCfg.next && (
                  <Box sx={{ p: 3, borderRadius: '16px', background: `${nextPlan.color}08`, border: `1px solid ${nextPlan.color}25` }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: nextPlan.color, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>âš¡ Upgrade Available</Typography>
                    <Typography sx={{ fontSize: '15px', fontWeight: 700, color: 'white', mb: 0.5 }}>{nextPlan.emoji} {nextPlan.label} Plan â€” {PLAN_PRICES[planCfg.next]}</Typography>
                    <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', mb: 2 }}>
                      {planCfg.next === 'starter'    && 'Unlock Terminal, custom risk rules & 30-day history'}
                      {planCfg.next === 'pro'        && 'Unlock AI Journal, Telegram alerts & prop firm profiles'}
                      {planCfg.next === 'enterprise' && 'Unlock white label, team management & API access'}
                    </Typography>
                    <Button
                      onClick={() => handleUpgrade(planCfg.next!)}
                      disabled={upgradeLoading === planCfg.next}
                      fullWidth
                      startIcon={upgradeLoading === planCfg.next ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
                      sx={{
                        py: 1.4, borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '14px', textTransform: 'none',
                        background: `linear-gradient(135deg,${nextPlan.color},${nextPlan.color}bb)`,
                        boxShadow: `0 4px 20px ${nextPlan.color}35`, transition: 'all .2s',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 28px ${nextPlan.color}50` },
                        '&:disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' },
                      }}
                    >
                      {upgradeLoading === planCfg.next ? 'Redirecting...' : `Upgrade to ${nextPlan.label} â†’`}
                    </Button>
                  </Box>
                )}
                {plan !== 'free' && (
                  <Box sx={{ p: 3, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <Typography sx={{ fontSize: '15px', fontWeight: 700, color: 'white', mb: 0.5 }}>ðŸ¦ Manage Billing</Typography>
                    <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', mb: 2 }}>Update payment method, view invoices, or cancel your subscription</Typography>
                    <Button
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      fullWidth
                      startIcon={portalLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CreditCardIcon />}
                      endIcon={!portalLoading && <OpenInNewIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        py: 1.4, borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '14px', textTransform: 'none',
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', transition: 'all .2s',
                        '&:hover': { background: 'rgba(255,255,255,0.12)', transform: 'translateY(-1px)' },
                        '&:disabled': { color: 'rgba(255,255,255,0.3)' },
                      }}
                    >
                      {portalLoading ? 'Opening...' : 'Manage Subscription'}
                    </Button>
                  </Box>
                )}
                {plan === 'free' && (
                  <Box sx={{ p: 3, borderRadius: '16px', background: 'linear-gradient(135deg,rgba(56,189,248,0.08),rgba(34,197,94,0.06))', border: '1px solid rgba(56,189,248,0.2)', textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '24px', mb: 1 }}>ðŸš€</Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.5 }}>Ready to upgrade?</Typography>
                    <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', mb: 2 }}>Start with Starter at just $19/mo</Typography>
                    <Button onClick={() => handleUpgrade('starter')} fullWidth
                      sx={{ py: 1.4, borderRadius: '12px', background: 'linear-gradient(135deg,#38bdf8,#22c55e)', color: 'white', fontWeight: 700, textTransform: 'none' }}>
                      Get Started â†’
                    </Button>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* â”€â”€ MT5 CONNECTION CARD â”€â”€ */}
      <Box sx={{
        borderRadius: '24px', background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', mb: 3, position: 'relative',
        '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#38bdf8,transparent)' },
      }}>
        <Box sx={{ px: { xs: 2.5, md: 4 }, pt: 3, pb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(56,189,248,0.03)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 54, height: 54, borderRadius: '16px', background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: '0 4px 20px rgba(14,165,233,0.35)', flexShrink: 0 }}>ðŸ”—</Box>
            <Box>
              <Typography sx={{ fontSize: '21px', fontWeight: 700, color: 'white' }}>MT5 Broker Connection</Typography>
              <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', mt: 0.4 }}>MetaTrader 5 platform credentials</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ConnBadge />
            <Button
              onClick={reconnectMT5}
              disabled={connectionStatus === 'connecting'}
              startIcon={connectionStatus === 'connecting' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
              sx={{
                px: 3, py: 1.2, borderRadius: '12px', fontWeight: 700, fontSize: '14px', textTransform: 'none',
                background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8',
                transition: 'all 0.2s', '&:hover': { background: 'rgba(56,189,248,0.22)' },
                '&:disabled': { color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.1)' },
              }}
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnect MT5'}
            </Button>
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2.5, md: 4 } }}>
          <Grid container spacing={3}>
            {[
              { label: 'Broker Name',    key: 'broker',   icon: <DnsIcon    sx={{ color: '#38bdf8', fontSize: 22 }} /> },
              { label: 'Account Number', key: 'account',  icon: <PersonIcon sx={{ color: '#38bdf8', fontSize: 22 }} /> },
              { label: 'Password',       key: 'password', icon: <LockIcon   sx={{ color: '#38bdf8', fontSize: 22 }} />, type: 'password' },
              { label: 'Server',         key: 'server',   icon: <DnsIcon    sx={{ color: '#38bdf8', fontSize: 22 }} /> },
            ].map(f => (
              <Grid item xs={12} sm={6} key={f.key}>
                <TextField
                  label={f.label} type={f.type || 'text'} fullWidth
                  value={settings?.[f.key] || ''}
                  onChange={e => update(f.key, e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">{f.icon}</InputAdornment> }}
                  sx={si('#38bdf8')}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* â”€â”€ RISK + NOTIFICATIONS â”€â”€ */}
      <Grid container spacing={3}>

        {/* Risk Management */}
        <Grid item xs={12} lg={6}>
          <Box sx={{
            borderRadius: '24px', background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', height: '100%', position: 'relative',
            '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#ef4444,transparent)' },
          }}>
            <Box sx={{ px: { xs: 2.5, md: 4 }, pt: 3, pb: 3, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(239,68,68,0.03)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 54, height: 54, borderRadius: '16px', background: 'linear-gradient(135deg,#ef4444,#f87171)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: '0 4px 20px rgba(239,68,68,0.35)', flexShrink: 0 }}>ðŸ›¡ï¸</Box>
                <Box>
                  <Typography sx={{ fontSize: '21px', fontWeight: 700, color: 'white' }}>Risk Management</Typography>
                  <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', mt: 0.4 }}>Protect your capital with smart limits</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ p: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {[
                { label: 'Daily Loss Limit', key: 'dailyLoss',    color: '#ef4444', emoji: 'ðŸ”´', desc: '% of account balance' },
                { label: 'Max Drawdown',     key: 'maxDD',        color: '#f97316', emoji: 'ðŸŸ ', desc: '% from peak equity'  },
                { label: 'Risk Per Trade',   key: 'riskPerTrade', color: '#facc15', emoji: 'ðŸŸ¡', desc: '% per position'      },
                { label: 'Min Risk/Reward',  key: 'minRR',        color: '#22c55e', emoji: 'ðŸŸ¢', desc: 'Minimum RR ratio'    },
              ].map(f => (
                <Box key={f.key} sx={{
                  display: 'flex', alignItems: 'center', gap: 2, p: 2.5, borderRadius: '16px',
                  background: `${f.color}08`, border: `1px solid ${f.color}20`, transition: 'all 0.2s',
                  '&:hover': { background: `${f.color}12`, border: `1px solid ${f.color}35` },
                }}>
                  <Box sx={{ width: 46, height: 46, borderRadius: '13px', background: `${f.color}15`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '22px' }}>{f.emoji}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.3 }}>{f.label}</Typography>
                    <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>{f.desc}</Typography>
                  </Box>
                  <TextField
                    type="number" size="small"
                    value={settings?.[f.key] || ''}
                    onChange={e => update(f.key, e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ color: f.color, fontSize: '15px', fontWeight: 700 }}>%</Typography></InputAdornment> }}
                    sx={{
                      width: 110,
                      '& .MuiOutlinedInput-root': {
                        color: f.color, fontFamily: '"DM Mono",monospace', fontWeight: 800, fontSize: '18px',
                        borderRadius: '12px', background: `${f.color}10`,
                        '& fieldset': { borderColor: `${f.color}30` },
                        '&:hover fieldset': { borderColor: `${f.color}60` },
                        '&.Mui-focused fieldset': { borderColor: f.color },
                      },
                      '& input': { textAlign: 'center', color: f.color, fontFamily: '"DM Mono",monospace', fontWeight: 800, padding: '10px 8px' },
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Grid>

        {/* Alert Notifications */}
        <Grid item xs={12} lg={6}>
          <Box sx={{
            borderRadius: '24px', background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', height: '100%', position: 'relative',
            '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#a855f7,transparent)' },
          }}>
            <Box sx={{ px: { xs: 2.5, md: 4 }, pt: 3, pb: 3, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(168,85,247,0.03)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 54, height: 54, borderRadius: '16px', background: 'linear-gradient(135deg,#a855f7,#c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: '0 4px 20px rgba(168,85,247,0.35)', flexShrink: 0 }}>ðŸ””</Box>
                <Box>
                  <Typography sx={{ fontSize: '21px', fontWeight: 700, color: 'white' }}>Alert Notifications</Typography>
                  <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', mt: 0.4 }}>Stay informed about critical events</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ p: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Upgrade banner â€” only when Telegram locked */}
              {!features.telegram_alerts && (
                <Box sx={{
                  p: 2.5, borderRadius: '16px',
                  background: 'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(236,72,153,0.07))',
                  border: '1px solid rgba(168,85,247,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
                }}>
                  <Box>
                    <Typography sx={{ fontSize: '15px', fontWeight: 700, color: 'white', mb: 0.5 }}>ðŸ”’ Telegram & SMS alerts require Pro</Typography>
                    <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Upgrade for instant push notifications</Typography>
                  </Box>
                  <Box
                    onClick={() => startCheckout('pro')}
                    sx={{
                      px: 2.5, py: 1.2, borderRadius: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                      background: 'linear-gradient(135deg,#a855f7,#ec4899)',
                      fontSize: '14px', fontWeight: 700, color: 'white', transition: 'all .2s',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(168,85,247,0.4)' },
                    }}
                  >
                    Upgrade to Pro â†’
                  </Box>
                </Box>
              )}

              {/* Toggle rows */}
              <ToggleRow icon="ðŸ“§" label="Email Alerts"    desc="Detailed trade reports & summaries" checked={settings?.email    || false} onChange={v => update('email',    v)} color="#22c55e" />
              {features.telegram_alerts
                ? <ToggleRow icon="ðŸ“±" label="Telegram Alerts" desc="Instant push notifications"  checked={settings?.telegram || false} onChange={v => update('telegram', v)} color="#38bdf8" />
                : <LockedToggle label="Telegram Alerts" desc="Instant push notifications" icon="ðŸ“±" />
              }
              {features.sms_alerts
                ? <ToggleRow icon="ðŸ’¬" label="SMS Alerts" desc="Critical SMS warnings"             checked={settings?.sms      || false} onChange={v => update('sms',      v)} color="#a855f7" />
                : <LockedToggle label="SMS Alerts" desc="Critical SMS warnings" icon="ðŸ’¬" />
              }

              {/* â”€â”€ TELEGRAM CONNECT PANEL â”€â”€ */}
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 0.5 }} />
              <Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 1.5 }}>
                  Telegram Bot Setup
                </Typography>

                {features.telegram_alerts ? (
                  <TelegramPanel />
                ) : (
                  /* Locked placeholder */
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 2, p: 2.5, borderRadius: '16px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', opacity: 0.5,
                  }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '11px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>âœˆï¸</Box>
                    <Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 600 }}>Telegram Connect</Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', mt: 0.3 }}>Available on Pro plan and above</Typography>
                    </Box>
                    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LockOutlined sx={{ fontSize: 15, color: '#a855f7' }} />
                      <Box sx={{ fontSize: '10px', fontWeight: 700, color: '#a855f7', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '7px', px: 1, py: 0.4 }}>PRO</Box>
                    </Box>
                  </Box>
                )}
              </Box>

            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Mobile toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(t => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={(props) => <Slide {...props} direction="up" />}
      >
        <Alert severity={toast.severity} sx={{ borderRadius: '12px', fontWeight: 600 }}>
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Desktop notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={() => setNotification(n => ({ ...n, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification(n => ({ ...n, open: false }))}
          severity={notification.type}
          sx={{
            borderRadius: '14px', fontWeight: 700, fontSize: '15px', backdropFilter: 'blur(10px)',
            background: notification.type === 'success' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
            color: 'white', '& .MuiAlert-icon': { color: 'white' }, boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');`}</style>
    </Box>
  );
};

export default Settings;

