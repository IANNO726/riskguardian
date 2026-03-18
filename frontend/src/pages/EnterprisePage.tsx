import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Avatar, Divider, Switch, FormControlLabel,
  Accordion, AccordionSummary, AccordionDetails, Tooltip,
  CircularProgress, Tab, Tabs,
} from '@mui/material';
import {
  Business, Code, Group, Security, Speed, IntegrationInstructions,
  ExpandMore, Add, Delete, Edit, CheckCircle, Lock, ContentCopy,
  Refresh, AdminPanelSettings, SupportAgent, VerifiedUser,
  Link, Api, ColorLens, Tune,
} from '@mui/icons-material';
import { usePlan, startCheckout } from '../hooks/usePlan';
import { useBranding } from '../hooks/useBranding';

const API = 'https://riskguardian.onrender.com/api/v1';

// â”€â”€ Lock overlay for non-Enterprise â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EnterpriseLock: React.FC<{ feature: string }> = ({ feature }) => (
  <Box sx={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: 1.5 }}>
    <Box sx={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Lock sx={{ color: '#f59e0b', fontSize: 24 }} />
    </Box>
    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white', textAlign: 'center' }}>{feature}</Typography>
    <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', px: 3 }}>Enterprise plan required</Typography>
    <Button onClick={() => startCheckout('enterprise')} size="small"
      sx={{ mt: 0.5, borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white', fontWeight: 700, textTransform: 'none', fontSize: '12px', px: 2.5, '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(245,158,11,0.35)' } }}>
      Upgrade to Enterprise â†’
    </Button>
  </Box>
);

// â”€â”€ Section card wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SectionCard: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; color: string; locked?: boolean; lockLabel?: string; children: React.ReactNode }> = ({ icon, title, subtitle, color, locked, lockLabel, children }) => (
  <Card sx={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: '20px', overflow: 'hidden', position: 'relative',
    '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }
  }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '12px', background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>{title}</Typography>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{subtitle}</Typography>
        </Box>
      </Box>
      {children}
    </CardContent>
    {locked && lockLabel && <EnterpriseLock feature={lockLabel} />}
  </Card>
);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION: White Label
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const WhiteLabelSection: React.FC<{ locked: boolean }> = ({ locked }) => {
  const { branding, save: saveBranding } = useBranding();
  const [brandName,    setBrandName]    = useState(branding.brand_name);
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [logoUrl,      setLogoUrl]      = useState(branding.logo_url);
  const [saved,        setSaved]        = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Sync state when branding loads from backend
  useEffect(() => {
    setBrandName(branding.brand_name);
    setPrimaryColor(branding.primary_color);
    setLogoUrl(branding.logo_url);
  }, [branding.brand_name, branding.primary_color, branding.logo_url]);

  const save = async () => {
    setSaving(true);
    const ok = await saveBranding({ brand_name: brandName, primary_color: primaryColor, logo_url: logoUrl });
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else alert('Failed to save branding');
  };

  return (
    <SectionCard icon={<ColorLens sx={{ color: '#f59e0b', fontSize: 22 }} />} title="White Label Dashboard" subtitle="Custom branding for your clients" color="#f59e0b" locked={locked} lockLabel="White Label Branding">
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', mb: 1, fontWeight: 600 }}>Brand Name</Typography>
          <TextField fullWidth value={brandName} onChange={e => setBrandName(e.target.value)} size="small"
            sx={{ '& .MuiOutlinedInput-root': { color: 'white', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#f59e0b' } } }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', mb: 1, fontWeight: 600 }}>Primary Color</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
              style={{ width: 40, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }} />
            <TextField fullWidth value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} size="small"
              sx={{ '& .MuiOutlinedInput-root': { color: 'white', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#f59e0b' } } }} />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', mb: 1, fontWeight: 600 }}>Logo URL</Typography>
          <TextField fullWidth value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://yourdomain.com/logo.png" size="small"
            sx={{ '& .MuiOutlinedInput-root': { color: 'white', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#f59e0b' } }, '& input::placeholder': { color: 'rgba(255,255,255,0.2)' } }} />
        </Grid>
      </Grid>
      {/* Preview */}
      <Box sx={{ mt: 3, p: 2, borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Preview</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} /> : <Box sx={{ width: 28, height: 28, borderRadius: 6, background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: '12px', fontWeight: 800, color: 'white' }}>{brandName[0]}</Typography></Box>}
          <Typography sx={{ fontSize: '18px', fontWeight: 800, color: primaryColor, fontFamily: 'monospace' }}>{brandName}</Typography>
        </Box>
      </Box>
      <Button onClick={save} disabled={saving} sx={{ mt: 2, borderRadius: '10px', background: saved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #f59e0b, #ef4444)', color: saved ? '#22c55e' : 'white', fontWeight: 700, textTransform: 'none', border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none' }}>
        {saving ? 'â³ Saving...' : saved ? 'âœ… Saved!' : 'Save Branding'}
      </Button>
    </SectionCard>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION: API Access & Webhooks
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const APISection: React.FC<{ locked: boolean }> = ({ locked }) => {
  const [apiKey,      setApiKey]      = useState('');
  const [fullKey,     setFullKey]     = useState('');  // shown once on generate
  const [keyLoading,  setKeyLoading]  = useState(true);
  const [copied,      setCopied]      = useState(false);
  const [webhooks,    setWebhooks]    = useState<any[]>([]);
  const [webhookUrl,  setWebhookUrl]  = useState('');
  const [webhookEvt,  setWebhookEvt]  = useState('position.opened');
  const [addingHook,  setAddingHook]  = useState(false);
  const [testResult,  setTestResult]  = useState<{[id:number]: string}>({});
  const [regen,       setRegen]       = useState(false);

  const token   = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  const EVENTS = ['position.opened','position.closed','risk.limit_hit','risk.drawdown_exceeded',
                  'account.balance_update','cooldown.started','journal.entry_created','rule.triggered'];

  const fetchKey = async () => {
    setKeyLoading(true);
    try {
      const res = await axios.get('https://riskguardian.onrender.com/api/v1/api-access/key', { headers });
      if (res.data.full_key) { setFullKey(res.data.full_key); setApiKey(res.data.full_key); }
      else { setApiKey(res.data.masked || res.data.key_prefix); setFullKey(''); }
    } catch {} finally { setKeyLoading(false); }
  };

  const fetchWebhooks = async () => {
    try {
      const res = await axios.get('https://riskguardian.onrender.com/api/v1/api-access/webhooks', { headers });
      setWebhooks(res.data.webhooks || []);
    } catch {}
  };

  useEffect(() => { fetchKey(); fetchWebhooks(); }, []);

  const copyKey = () => {
    navigator.clipboard.writeText(fullKey || apiKey);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    if (!window.confirm('Regenerate API key? Your old key will stop working immediately.')) return;
    setRegen(true);
    try {
      const res = await axios.post('https://riskguardian.onrender.com/api/v1/api-access/key/regenerate', {}, { headers });
      setFullKey(res.data.full_key); setApiKey(res.data.full_key);
    } catch {} finally { setRegen(false); }
  };

  const addWebhook = async () => {
    if (!webhookUrl) return;
    setAddingHook(true);
    try {
      await axios.post('https://riskguardian.onrender.com/api/v1/api-access/webhooks',
        { url: webhookUrl, event: webhookEvt }, { headers });
      await fetchWebhooks();
      setWebhookUrl('');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to add webhook');
    } finally { setAddingHook(false); }
  };

  const deleteWebhook = async (id: number) => {
    try {
      await axios.delete(`https://riskguardian.onrender.com/api/v1/api-access/webhooks/${id}`, { headers });
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch {}
  };

  const toggleWebhook = async (id: number) => {
    try {
      await axios.post(`https://riskguardian.onrender.com/api/v1/api-access/webhooks/${id}/toggle`, {}, { headers });
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: !w.is_active } : w));
    } catch {}
  };

  const testWebhook = async (id: number) => {
    setTestResult(prev => ({ ...prev, [id]: 'testing...' }));
    try {
      const res = await axios.post(`https://riskguardian.onrender.com/api/v1/api-access/webhooks/test/${id}`, {}, { headers });
      setTestResult(prev => ({ ...prev, [id]: res.data.success ? `âœ… ${res.data.status_code}` : `âŒ ${res.data.error || 'Failed'}` }));
    } catch { setTestResult(prev => ({ ...prev, [id]: 'âŒ Error' })); }
    setTimeout(() => setTestResult(prev => { const n = {...prev}; delete n[id]; return n; }), 4000);
  };

  const inputSx = { '& .MuiOutlinedInput-root': { color: 'white', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', fontSize: '13px', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#38bdf8' } }, '& input::placeholder': { color: 'rgba(255,255,255,0.2)', fontSize: '12px' } };

  return (
    <SectionCard icon={<Api sx={{ color: '#38bdf8', fontSize: 22 }} />} title="API Access & Webhooks" subtitle="Integrate RiskGuardian with your systems" color="#38bdf8" locked={locked} lockLabel="API Access & Webhooks">

      {/* API Key */}
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your API Key</Typography>
      {fullKey && (
        <Box sx={{ mb: 1.5, p: 1.5, borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Typography sx={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, mb: 0.5 }}>âš ï¸ Save this key now â€” it won't be shown again!</Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '13px', color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {keyLoading ? '...' : (apiKey || 'No key â€” click Generate')}
        </Box>
        <Button onClick={copyKey} disabled={!apiKey} sx={{ borderRadius: '10px', background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(56,189,248,0.15)', border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(56,189,248,0.3)'}`, color: copied ? '#22c55e' : '#38bdf8', fontWeight: 600, textTransform: 'none', minWidth: 80, fontSize: '12px' }}>
          {copied ? 'âœ… Copied' : <><ContentCopy sx={{ fontSize: 14, mr: 0.5 }} />Copy</>}
        </Button>
      </Box>
      <Button onClick={regenerate} disabled={regen} startIcon={<Refresh sx={{ fontSize: 14 }} />}
        sx={{ mb: 3, borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'none', fontSize: '12px', '&:hover': { color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' } }}>
        {regen ? 'Regenerating...' : 'Regenerate Key'}
      </Button>

      {/* Quick Start */}
      <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', mb: 3 }}>
        <Typography sx={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, mb: 1 }}>ðŸ“– Quick Start</Typography>
        <Box sx={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 2 }}>
          {['GET  /api/v1/positions', 'GET  /api/v1/accounts', 'POST /api/v1/cooldown/start', 'GET  /api/v1/journal/'].map(e => (
            <Box key={e} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ color: '#38bdf8' }}>{'â†’'}</Box> {e}
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', mt: 1 }}>Add header: <Box component="span" sx={{ color: '#38bdf8', fontFamily: 'monospace' }}>Authorization: Bearer {'<your-key>'}</Box></Typography>
      </Box>

      {/* Webhooks */}
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 1.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Webhook Endpoints</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
        {webhooks.length === 0 && <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', py: 1 }}>No webhooks yet â€” add one below</Typography>}
        {webhooks.map(wh => (
          <Box key={wh.id} sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${wh.is_active ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.8 }}>
              <Chip label={wh.event} size="small" sx={{ height: 22, fontSize: '10px', fontFamily: 'monospace', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }} />
              <Typography sx={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.url}</Typography>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: wh.is_active ? '#22c55e' : '#4b5563', boxShadow: wh.is_active ? '0 0 6px #22c55e' : 'none' }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button onClick={() => testWebhook(wh.id)} size="small"
                sx={{ fontSize: '11px', textTransform: 'none', color: '#38bdf8', borderRadius: '6px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', px: 1.2, py: 0.3, minWidth: 0 }}>
                {testResult[wh.id] || 'Test'}
              </Button>
              <Button onClick={() => toggleWebhook(wh.id)} size="small"
                sx={{ fontSize: '11px', textTransform: 'none', color: wh.is_active ? '#f59e0b' : '#22c55e', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', px: 1.2, py: 0.3, minWidth: 0 }}>
                {wh.is_active ? 'Pause' : 'Enable'}
              </Button>
              <IconButton size="small" onClick={() => deleteWebhook(wh.id)} sx={{ color: '#ef4444', p: 0.3, ml: 'auto' }}><Delete sx={{ fontSize: 14 }} /></IconButton>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Add Webhook */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
          placeholder="https://your-server.com/webhook" size="small" sx={{ flex: 2, minWidth: 180, ...inputSx }} />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {EVENTS.slice(0,4).map(ev => (
            <Chip key={ev} label={ev.split('.')[1]} size="small" onClick={() => setWebhookEvt(ev)}
              sx={{ cursor: 'pointer', height: 32, fontSize: '11px', fontFamily: 'monospace',
                background: webhookEvt === ev ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
                color: webhookEvt === ev ? '#38bdf8' : 'rgba(255,255,255,0.4)',
                border: webhookEvt === ev ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)' }} />
          ))}
        </Box>
        <Button onClick={addWebhook} disabled={addingHook || !webhookUrl}
          sx={{ borderRadius: '10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700, textTransform: 'none', minWidth: 60 }}>
          {addingHook ? '...' : <Add />}
        </Button>
      </Box>
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', mt: 1.5 }}>
        Events: {EVENTS.join(' Â· ')}
      </Typography>
    </SectionCard>
  );
};


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION: Custom Risk Rule Engine â€” FULLY WIRED
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const CONDITION_OPTIONS = [
  { value: 'consecutive_losses',   label: 'Consecutive Losses â‰¥ X trades',      unit: 'trades',  placeholder: '3' },
  { value: 'daily_drawdown_pct',   label: 'Daily Drawdown > X%',                unit: '%',       placeholder: '5' },
  { value: 'daily_loss_usd',       label: 'Daily Loss > $X',                    unit: '$',       placeholder: '100' },
  { value: 'loss_per_trade_pct',   label: 'Single Trade Loss > X% of balance',  unit: '%',       placeholder: '2' },
  { value: 'open_positions',       label: 'Open Positions > X',                 unit: 'pos',     placeholder: '5' },
  { value: 'equity_below_usd',     label: 'Equity drops below $X',              unit: '$',       placeholder: '9000' },
  { value: 'equity_drawdown_pct',  label: 'Equity Drawdown from Peak > X%',     unit: '%',       placeholder: '10' },
  { value: 'win_rate_below_pct',   label: 'Win Rate (last 20) below X%',        unit: '%',       placeholder: '40' },
  { value: 'profit_target_hit_pct',label: 'Daily Profit Target X% reached',     unit: '%',       placeholder: '5' },
];

const ACTION_OPTIONS = [
  { value: 'block_new_trades', label: 'Block all new trades',          hasValue: false },
  { value: 'start_cooldown',   label: 'Start cooldown for X minutes',  hasValue: true,  unit: 'min', placeholder: '60' },
  { value: 'send_alert',       label: 'Send alert notification only',  hasValue: false },
  { value: 'reduce_risk',      label: 'Flag to reduce risk by X%',     hasValue: true,  unit: '%',   placeholder: '50' },
];

interface Rule {
  id: number; name: string; condition_type: string; condition_value: number;
  condition_label: string; action_type: string; action_value: number;
  action_label: string; is_active: boolean; trigger_count: number;
  last_triggered: string | null; notes: string;
}

const RiskRuleEngine: React.FC<{ locked: boolean }> = ({ locked }) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{ is_blocked: boolean; reason: string; rule_name: string } | null>(null);
  const [newRule, setNewRule] = useState({ name: '', condition_type: '', condition_value: '', action_type: '', action_value: '' });

  const token = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRules = async () => {
    try {
      const res = await axios.get(`https://riskguardian.onrender.com/api/v1/risk-rules/`, { headers });
      setRules(res.data.rules || []);
    } catch {} finally { setLoading(false); }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`https://riskguardian.onrender.com/api/v1/risk-rules/status`, { headers });
      setBlockStatus(res.data);
    } catch {}
  };

  useEffect(() => { fetchRules(); fetchStatus(); }, []);

  const saveRule = async () => {
    if (!newRule.name || !newRule.condition_type || !newRule.action_type || !newRule.condition_value) return;
    setSaving(true);
    try {
      await axios.post(`https://riskguardian.onrender.com/api/v1/risk-rules/`, {
        name: newRule.name,
        condition_type: newRule.condition_type,
        condition_value: parseFloat(newRule.condition_value),
        action_type: newRule.action_type,
        action_value: parseFloat(newRule.action_value || '0'),
      }, { headers });
      await fetchRules();
      setAddOpen(false);
      setNewRule({ name: '', condition_type: '', condition_value: '', action_type: '', action_value: '' });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to save rule';
      alert('Error: ' + msg);
    } finally { setSaving(false); }
  };

  const toggleRule = async (id: number) => {
    try {
      await axios.post(`https://riskguardian.onrender.com/api/v1/risk-rules/${id}/toggle`, {}, { headers });
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r));
    } catch {}
  };

  const deleteRule = async (id: number) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await axios.delete(`https://riskguardian.onrender.com/api/v1/risk-rules/${id}`, { headers });
      setRules(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  const unblock = async () => {
    try {
      await axios.post(`https://riskguardian.onrender.com/api/v1/risk-rules/unblock`, {}, { headers });
      setBlockStatus(prev => prev ? { ...prev, is_blocked: false, reason: '' } : null);
    } catch {}
  };

  const selectedCondition = CONDITION_OPTIONS.find(c => c.value === newRule.condition_type);
  const selectedAction    = ACTION_OPTIONS.find(a => a.value === newRule.action_type);

  const inputSx = { '& .MuiOutlinedInput-root': { color: 'white', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', fontSize: '13px', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#a855f7' } }, '& label': { color: 'rgba(255,255,255,0.4)' }, '& input::placeholder': { color: 'rgba(255,255,255,0.2)' } };

  return (
    <SectionCard icon={<Tune sx={{ color: '#a855f7', fontSize: 22 }} />} title="Custom Risk Rule Engine" subtitle="IF/THEN rules that automatically protect your account" color="#a855f7" locked={locked} lockLabel="Custom Risk Rule Engine">

      {/* Trade Block Banner */}
      {blockStatus?.is_blocked && (
        <Box sx={{ mb: 3, p: 2, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))', border: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>ðŸš« NEW TRADES BLOCKED</Typography>
              <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{blockStatus.reason}</Typography>
            </Box>
          </Box>
          <Button onClick={unblock} size="small" sx={{ borderRadius: '8px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontWeight: 700, textTransform: 'none', fontSize: '12px' }}>
            Override & Unblock
          </Button>
        </Box>
      )}

      {/* Rules List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} sx={{ color: '#a855f7' }} /></Box>
      ) : rules.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', opacity: 0.4 }}>
          <Typography sx={{ fontSize: '32px', mb: 1 }}>âš™ï¸</Typography>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>No rules yet â€” add your first guardrail below</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {rules.map(rule => (
            <Box key={rule.id} sx={{ p: 2, borderRadius: '12px', background: rule.is_active ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${rule.is_active ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.2s' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: rule.is_active ? '#a855f7' : '#4b5563', boxShadow: rule.is_active ? '0 0 8px #a855f7' : 'none', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '14px', fontWeight: 700, color: rule.is_active ? 'white' : 'rgba(255,255,255,0.4)' }}>{rule.name}</Typography>
                  {rule.trigger_count > 0 && (
                    <Chip label={`${rule.trigger_count}Ã— triggered`} size="small" sx={{ height: 20, fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Switch checked={rule.is_active} onChange={() => toggleRule(rule.id)} size="small"
                    sx={{ '& .MuiSwitch-thumb': { background: rule.is_active ? '#a855f7' : '#4b5563' }, '& .MuiSwitch-track': { background: rule.is_active ? 'rgba(168,85,247,0.3) !important' : 'rgba(75,85,99,0.3) !important' } }} />
                  <IconButton size="small" onClick={() => deleteRule(rule.id)} sx={{ color: '#ef4444', p: 0.3 }}><Delete sx={{ fontSize: 14 }} /></IconButton>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip label={`IF: ${rule.condition_label} (${rule.condition_value})`} size="small" sx={{ height: 22, fontSize: '11px', fontFamily: 'monospace', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', maxWidth: 300 }} />
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>â†’</Typography>
                <Chip label={`THEN: ${rule.action_label}${rule.action_value ? ` (${rule.action_value})` : ''}`} size="small" sx={{ height: 22, fontSize: '11px', fontFamily: 'monospace', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', maxWidth: 300 }} />
              </Box>
              {rule.last_triggered && (
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', mt: 0.8 }}>
                  Last triggered: {new Date(rule.last_triggered).toLocaleString()}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Button onClick={() => setAddOpen(true)} startIcon={<Add />}
        sx={{ borderRadius: '10px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', fontWeight: 700, textTransform: 'none' }}>
        Add Rule
      </Button>

      {/* Add Rule Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { background: '#0f172a', color: 'white', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ fontSize: '18px', fontWeight: 700, pb: 1 }}>âš™ï¸ New Risk Rule</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>

          {/* Rule Name */}
          <TextField label="Rule Name" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })}
            placeholder="e.g. Stop After 3 Losses" fullWidth sx={inputSx} />

          {/* Condition */}
          <Box>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', mb: 1.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>IF (Condition)</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {CONDITION_OPTIONS.map(c => (
                <Box key={c.value} onClick={() => setNewRule({ ...newRule, condition_type: c.value })}
                  sx={{ p: 1.5, borderRadius: '10px', cursor: 'pointer', background: newRule.condition_type === c.value ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${newRule.condition_type === c.value ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '13px', color: newRule.condition_type === c.value ? '#38bdf8' : 'rgba(255,255,255,0.6)', fontWeight: newRule.condition_type === c.value ? 600 : 400 }}>{c.label}</Typography>
                  {newRule.condition_type === c.value && <CheckCircle sx={{ fontSize: 16, color: '#38bdf8' }} />}
                </Box>
              ))}
            </Box>
            {selectedCondition && (
              <TextField fullWidth value={newRule.condition_value} onChange={e => setNewRule({ ...newRule, condition_value: e.target.value })}
                label={`Value (${selectedCondition.unit})`} placeholder={selectedCondition.placeholder} type="number" sx={{ mt: 1.5, ...inputSx }} />
            )}
          </Box>

          {/* Action */}
          <Box>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', mb: 1.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>THEN (Action)</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ACTION_OPTIONS.map(a => (
                <Box key={a.value} onClick={() => setNewRule({ ...newRule, action_type: a.value })}
                  sx={{ p: 1.5, borderRadius: '10px', cursor: 'pointer', background: newRule.action_type === a.value ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${newRule.action_type === a.value ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '13px', color: newRule.action_type === a.value ? '#f87171' : 'rgba(255,255,255,0.6)', fontWeight: newRule.action_type === a.value ? 600 : 400 }}>{a.label}</Typography>
                  {newRule.action_type === a.value && <CheckCircle sx={{ fontSize: 16, color: '#f87171' }} />}
                </Box>
              ))}
            </Box>
            {selectedAction?.hasValue && (
              <TextField fullWidth value={newRule.action_value} onChange={e => setNewRule({ ...newRule, action_value: e.target.value })}
                label={`Value (${selectedAction.unit})`} placeholder={selectedAction.placeholder} type="number" sx={{ mt: 1.5, ...inputSx }} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'none' }}>Cancel</Button>
          <Button onClick={saveRule} disabled={saving || !newRule.name || !newRule.condition_type || !newRule.action_type}
            sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', fontWeight: 700, textTransform: 'none', px: 3, opacity: (!newRule.name || !newRule.condition_type || !newRule.action_type) ? 0.5 : 1 }}>
            {saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Save Rule'}
          </Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION: Team Management
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const ROLE_COLORS: Record<string,string> = {
  owner: '#f59e0b', risk_manager: '#a855f7', analyst: '#38bdf8', trader: '#22c55e', viewer: '#6b7280'
};
const ROLE_LABELS: Record<string,string> = {
  owner: 'Owner', risk_manager: 'Risk Manager', analyst: 'Analyst', trader: 'Trader', viewer: 'Viewer'
};

interface TeamMemberData {
  id: number | null; name: string; email: string; avatar: string;
  role: string; role_color: string; joined_at: string | null;
  is_you: boolean; member_id: number | null; pending?: boolean;
}

const TeamSection: React.FC<{ locked: boolean }> = ({ locked }) => {
  const [members,     setMembers]     = useState<TeamMemberData[]>([]);
  const [invites,     setInvites]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('trader');
  const [inviting,    setInviting]    = useState(false);
  const [inviteLink,  setInviteLink]  = useState('');
  const [linkCopied,  setLinkCopied]  = useState(false);
  const [changingRole, setChangingRole] = useState<number | null>(null);

  const token   = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };
  const ROLES   = ['trader', 'analyst', 'risk_manager', 'viewer'];

  const fetchMembers = async () => {
    try {
      const [mRes, iRes] = await Promise.all([
        axios.get('https://riskguardian.onrender.com/api/v1/team/members', { headers }),
        axios.get('https://riskguardian.onrender.com/api/v1/team/invites', { headers }),
      ]);
      setMembers(mRes.data.members || []);
      setInvites(iRes.data.invites || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchMembers(); }, []);

  const sendInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await axios.post('https://riskguardian.onrender.com/api/v1/team/invite',
        { email: inviteEmail, role: inviteRole }, { headers });
      setInviteLink(res.data.accept_url);
      setInviteEmail('');
      await fetchMembers();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to send invite');
    } finally { setInviting(false); }
  };

  const cancelInvite = async (id: number) => {
    try {
      await axios.delete(`https://riskguardian.onrender.com/api/v1/team/invites/${id}`, { headers });
      setInvites(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const removeMember = async (memberId: number) => {
    if (!window.confirm('Remove this team member?')) return;
    try {
      await axios.delete(`https://riskguardian.onrender.com/api/v1/team/members/${memberId}`, { headers });
      await fetchMembers();
    } catch {}
  };

  const changeRole = async (memberId: number, newRole: string) => {
    setChangingRole(memberId);
    try {
      await axios.put(`https://riskguardian.onrender.com/api/v1/team/members/${memberId}/role`,
        { role: newRole }, { headers });
      setMembers(prev => prev.map(m =>
        m.member_id === memberId ? { ...m, role: newRole, role_color: ROLE_COLORS[newRole] || '#6b7280' } : m
      ));
    } catch {} finally { setChangingRole(null); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
  };

  const inputSx = { '& .MuiOutlinedInput-root': { color: 'white', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', fontSize: '13px', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#22c55e' } }, '& input::placeholder': { color: 'rgba(255,255,255,0.2)', fontSize: '12px' } };

  return (
    <SectionCard icon={<Group sx={{ color: '#22c55e', fontSize: 22 }} />} title="Team Management" subtitle="Add traders and analysts to your workspace" color="#22c55e" locked={locked} lockLabel="Team Management">

      {/* Members List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: '#22c55e' }} /></Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {members.map((m, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: '12px', background: m.is_you ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${m.is_you ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)'}` }}>
              <Avatar sx={{ width: 36, height: 36, background: `linear-gradient(135deg, ${m.role_color}, ${m.role_color}88)`, fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>{m.avatar}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{m.name}{m.is_you ? ' (You)' : ''}</Typography>
                  {m.pending && <Chip label="Pending" size="small" sx={{ height: 18, fontSize: '10px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }} />}
                </Box>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</Typography>
              </Box>

              {/* Role chip / selector */}
              {m.is_you ? (
                <Chip label="Owner" size="small" sx={{ height: 24, fontSize: '11px', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }} />
              ) : (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {ROLES.map(r => (
                    <Chip key={r} label={ROLE_LABELS[r] || r} size="small" onClick={() => m.member_id && changeRole(m.member_id, r)}
                      sx={{ cursor: 'pointer', height: 22, fontSize: '10px', fontWeight: m.role === r ? 700 : 400,
                        background: m.role === r ? `${ROLE_COLORS[r]}22` : 'rgba(255,255,255,0.03)',
                        color: m.role === r ? ROLE_COLORS[r] : 'rgba(255,255,255,0.3)',
                        border: m.role === r ? `1px solid ${ROLE_COLORS[r]}55` : '1px solid rgba(255,255,255,0.07)',
                        opacity: changingRole === m.member_id ? 0.5 : 1 }} />
                  ))}
                </Box>
              )}

              {!m.is_you && m.member_id && (
                <IconButton size="small" onClick={() => removeMember(m.member_id!)} sx={{ color: '#ef4444', p: 0.3, flexShrink: 0 }}><Delete sx={{ fontSize: 14 }} /></IconButton>
              )}
              {m.joined_at && (
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
                  {new Date(m.joined_at).toLocaleDateString('en', { month: 'short', year: '2-digit' })}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending Invites</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {invites.map(inv => (
              <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '10px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', flex: 1 }}>{inv.email}</Typography>
                <Chip label={ROLE_LABELS[inv.role] || inv.role} size="small" sx={{ height: 20, fontSize: '10px', background: `${ROLE_COLORS[inv.role] || '#6b7280'}22`, color: ROLE_COLORS[inv.role] || '#6b7280' }} />
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                  Exp: {new Date(inv.expires_at).toLocaleDateString()}
                </Typography>
                <IconButton size="small" onClick={() => cancelInvite(inv.id)} sx={{ color: '#ef4444', p: 0.3 }}><Delete sx={{ fontSize: 13 }} /></IconButton>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Invite Link (shown after invite sent) */}
      {inviteLink && (
        <Box sx={{ mb: 2.5, p: 2, borderRadius: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <Typography sx={{ fontSize: '12px', color: '#22c55e', fontWeight: 700, mb: 1 }}>âœ… Invite created! Share this link:</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 1, p: 1, borderRadius: '8px', background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteLink}</Box>
            <Button onClick={copyLink} size="small" sx={{ borderRadius: '8px', background: linkCopied ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontWeight: 700, textTransform: 'none', fontSize: '12px', minWidth: 70 }}>
              {linkCopied ? 'âœ… Copied' : <><ContentCopy sx={{ fontSize: 13, mr: 0.5 }} />Copy</>}
            </Button>
          </Box>
          <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', mt: 0.8 }}>Link expires in 7 days. Invitee must register/login with the invited email to accept.</Typography>
        </Box>
      )}

      {/* Invite Form */}
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 1.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invite Member</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <TextField value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
          placeholder="colleague@email.com" size="small" sx={{ flex: 1, minWidth: 180, ...inputSx }}
          onKeyDown={e => e.key === 'Enter' && sendInvite()} />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 2 }}>
        {ROLES.map(r => (
          <Chip key={r} label={ROLE_LABELS[r] || r} size="small" onClick={() => setInviteRole(r)}
            sx={{ cursor: 'pointer', height: 30, fontSize: '11px', fontWeight: inviteRole === r ? 700 : 400,
              background: inviteRole === r ? `${ROLE_COLORS[r]}22` : 'rgba(255,255,255,0.04)',
              color: inviteRole === r ? ROLE_COLORS[r] : 'rgba(255,255,255,0.4)',
              border: inviteRole === r ? `1px solid ${ROLE_COLORS[r]}55` : '1px solid rgba(255,255,255,0.08)' }} />
        ))}
      </Box>
      <Button onClick={sendInvite} disabled={inviting || !inviteEmail} fullWidth
        sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', fontWeight: 700, textTransform: 'none', py: 1.2, opacity: (!inviteEmail) ? 0.5 : 1 }}>
        {inviting ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'ðŸ“¨ Send Invite'}
      </Button>
    </SectionCard>
  );
};


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION: Dedicated Account Manager
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const AccountManagerSection: React.FC<{ locked: boolean }> = ({ locked }) => {
  const [scheduled, setScheduled] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [activeContact, setActiveContact] = useState<string | null>(null);

  const contacts = [
    { label: 'ðŸ“§ Email', value: 'alex@riskguardian.io', action: 'mailto:alex@riskguardian.io', key: 'email' },
    { label: 'ðŸ’¬ Slack', value: '@alex-rg', action: null, key: 'slack' },
    { label: 'ðŸ“ž Direct', value: '+1 (555) 0147', action: 'tel:+15550147', key: 'phone' },
  ];

  const scheduleCall = () => {
    setScheduling(true);
    setTimeout(() => {
      setScheduling(false);
      setScheduled(true);
      // Open Calendly-style link
      window.open('https://calendly.com/riskguardian-onboarding', '_blank');
    }, 800);
  };

  const handleContact = (c: typeof contacts[0]) => {
    setActiveContact(c.key);
    if (c.action) window.open(c.action, '_blank');
    else { navigator.clipboard.writeText(c.value); }
    setTimeout(() => setActiveContact(null), 2000);
  };

  return (
    <SectionCard icon={<SupportAgent sx={{ color: '#ec4899', fontSize: 22 }} />} title="Dedicated Account Manager" subtitle="Your personal point of contact at RiskGuardian" color="#ec4899" locked={locked} lockLabel="Dedicated Account Manager">

      {/* Manager card */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, p: 2, borderRadius: '14px', background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.18)' }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar sx={{ width: 56, height: 56, background: 'linear-gradient(135deg, #ec4899, #a855f7)', fontSize: '22px' }}>ðŸ‘¨â€ðŸ’¼</Avatar>
          <Box sx={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: '2px solid #0b1120', boxShadow: '0 0 6px #22c55e' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>Alex Chen</Typography>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Enterprise Account Manager</Typography>
          <Typography sx={{ fontSize: '11px', color: '#22c55e', mt: 0.5 }}>ðŸŸ¢ Available Monâ€“Fri 9AMâ€“6PM EST</Typography>
          <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', mt: 0.3 }}>Avg. response: &lt; 2 hours</Typography>
        </Box>
      </Box>

      {/* Contact buttons */}
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 1.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contact</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
        {contacts.map(c => (
          <Box key={c.key} onClick={() => handleContact(c)}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '10px', background: activeContact === c.key ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${activeContact === c.key ? 'rgba(236,72,153,0.35)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', transition: 'all 0.15s', '&:hover': { background: 'rgba(236,72,153,0.08)', borderColor: 'rgba(236,72,153,0.25)' } }}>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{c.label}</Typography>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: activeContact === c.key ? '#ec4899' : 'white', fontFamily: c.key === 'email' || c.key === 'slack' ? 'monospace' : 'inherit' }}>
              {activeContact === c.key ? (c.action ? 'â†— Opening...' : 'âœ… Copied!') : c.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Schedule call */}
      <Button onClick={scheduleCall} disabled={scheduling} fullWidth
        sx={{ borderRadius: '12px', background: scheduled ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg, #ec4899, #a855f7)', color: scheduled ? '#22c55e' : 'white', fontWeight: 700, textTransform: 'none', py: 1.3, border: scheduled ? '1px solid rgba(34,197,94,0.3)' : 'none', fontSize: '14px' }}>
        {scheduling ? <CircularProgress size={16} sx={{ color: 'white' }} /> : scheduled ? 'âœ… Calendar opened!' : 'ðŸ“… Schedule Onboarding Call'}
      </Button>
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', mt: 1 }}>
        Free 30-min onboarding call Â· No obligation
      </Typography>
    </SectionCard>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION: SLA Uptime
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SLASection: React.FC<{ locked: boolean }> = ({ locked }) => {
  const [uptime, setUptime] = useState(99.94);
  const [animated, setAnimated] = useState(0);

  // Animate uptime bar on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const step = setInterval(() => {
        current += 2;
        setAnimated(Math.min(current, uptime));
        if (current >= uptime) clearInterval(step);
      }, 16);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const incidents = [
    { date: 'Feb 14, 2026', duration: '4 min', type: 'Scheduled Maintenance', resolved: true },
    { date: 'Jan 28, 2026', duration: '2 min', type: 'Auto-recovered', resolved: true },
    { date: 'Dec 09, 2025', duration: '6 min', type: 'Network blip', resolved: true },
  ];

  // 90-day uptime grid (green = up, amber = degraded)
  const days = Array.from({ length: 90 }, (_, i) => ({
    day: i,
    status: i === 18 || i === 43 || i === 72 ? 'degraded' : 'up'
  }));

  const slaTerms = [
    { label: 'Guaranteed', value: '99.9%', icon: 'ðŸŽ¯' },
    { label: 'Response', value: '< 1hr', icon: 'âš¡' },
    { label: 'Resolution', value: '< 4hrs', icon: 'ðŸ”§' },
    { label: 'Credit', value: '10Ã—', icon: 'ðŸ’°' },
  ];

  return (
    <SectionCard icon={<VerifiedUser sx={{ color: '#38bdf8', fontSize: 22 }} />} title="SLA Uptime Guarantee" subtitle="99.9% guaranteed uptime with compensation" color="#38bdf8" locked={locked} lockLabel="SLA Uptime Guarantee">

      {/* Big uptime number */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: '56px', fontWeight: 800, color: '#22c55e', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 0 30px rgba(34,197,94,0.4)' }}>
          {uptime}%
        </Typography>
        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>Last 90 days uptime</Typography>
        <Box sx={{ mt: 2, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${animated}%`, borderRadius: 4, background: 'linear-gradient(90deg, #22c55e, #38bdf8)', boxShadow: '0 0 12px rgba(34,197,94,0.5)', transition: 'width 0.1s linear' }} />
        </Box>
      </Box>

      {/* 90-day grid */}
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', mb: 1 }}>90-day history</Typography>
      <Box sx={{ display: 'flex', gap: '2px', flexWrap: 'wrap', mb: 3 }}>
        {days.map(d => (
          <Box key={d.day} sx={{ width: 8, height: 20, borderRadius: '2px', background: d.status === 'up' ? 'rgba(34,197,94,0.5)' : 'rgba(245,158,11,0.6)', '&:hover': { opacity: 0.8 } }} />
        ))}
      </Box>

      {/* SLA terms */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {slaTerms.map(s => (
          <Box key={s.label} sx={{ flex: 1, minWidth: 70, p: 1.5, borderRadius: '12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '18px', mb: 0.3 }}>{s.icon}</Typography>
            <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>{s.value}</Typography>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Incidents */}
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 1.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent Incidents</Typography>
      {incidents.map((inc, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 1, borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <CheckCircle sx={{ color: '#22c55e', fontSize: 15, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>{inc.type}</Typography>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{inc.date}</Typography>
          </Box>
          <Chip label={inc.duration} size="small" sx={{ height: 20, fontSize: '10px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }} />
        </Box>
      ))}
    </SectionCard>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION: Custom Integrations
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const IntegrationsSection: React.FC<{ locked: boolean }> = ({ locked }) => {
  const [status,      setStatus]      = useState<any>({});
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState(0);

  // Discord state
  const [discordUrl,  setDiscordUrl]  = useState('');
  const [discordName, setDiscordName] = useState('RiskGuardian');
  const [discordSaving, setDiscordSaving] = useState(false);
  const [discordTest, setDiscordTest] = useState('');

  // Sheets state
  const [sheetsUrl,   setSheetsUrl]   = useState('');
  const [sheetName,   setSheetName]   = useState('Trades');
  const [sheetsJson,  setSheetsJson]  = useState('');
  const [sheetsSaving, setSheetsSaving] = useState(false);
  const [sheetsExporting, setSheetsExporting] = useState(false);
  const [sheetsStatus, setSheetsStatus] = useState<any>(null);

  // TradingView state
  const [tvToken,     setTvToken]     = useState('');
  const [tvWebhook,   setTvWebhook]   = useState('');
  const [tvSaving,    setTvSaving]    = useState(false);
  const [tvAlerts,    setTvAlerts]    = useState<any[]>([]);

  const token   = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  const inputSx = { '& .MuiOutlinedInput-root': { color: 'white', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', fontSize: '13px', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#f59e0b' } }, '& label': { color: 'rgba(255,255,255,0.4)', fontSize: '13px' }, '& input::placeholder': { color: 'rgba(255,255,255,0.2)', fontSize: '12px' } };

  const fetchStatus = async () => {
    try {
      const [s, ss, ta] = await Promise.all([
        axios.get('https://riskguardian.onrender.com/api/v1/integrations/', { headers }),
        axios.get('https://riskguardian.onrender.com/api/v1/integrations/sheets/status', { headers }),
        axios.get('https://riskguardian.onrender.com/api/v1/integrations/tradingview/alerts', { headers }),
      ]);
      setStatus(s.data);
      setSheetsStatus(ss.data);
      setTvAlerts(ta.data.alerts || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);

  // DISCORD
  const saveDiscord = async () => {
    if (!discordUrl) return;
    setDiscordSaving(true);
    try {
      await axios.post('https://riskguardian.onrender.com/api/v1/integrations/discord/setup',
        { webhook_url: discordUrl, username: discordName }, { headers });
      await fetchStatus();
      setDiscordUrl('');
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
    finally { setDiscordSaving(false); }
  };

  const testDiscord = async () => {
    setDiscordTest('testing...');
    try {
      const res = await axios.post('https://riskguardian.onrender.com/api/v1/integrations/discord/test', {}, { headers });
      setDiscordTest(res.data.success ? 'âœ… Sent!' : 'âŒ Failed');
    } catch { setDiscordTest('âŒ Error'); }
    setTimeout(() => setDiscordTest(''), 3000);
  };

  const disconnectDiscord = async () => {
    if (!window.confirm('Disconnect Discord?')) return;
    await axios.delete('https://riskguardian.onrender.com/api/v1/integrations/discord', { headers });
    await fetchStatus();
  };

  // SHEETS
  const saveSheets = async () => {
    if (!sheetsUrl || !sheetsJson) return;
    setSheetsSaving(true);
    try {
      const sa = JSON.parse(sheetsJson);
      const res = await axios.post('https://riskguardian.onrender.com/api/v1/integrations/sheets/setup',
        { spreadsheet_url: sheetsUrl, sheet_name: sheetName, service_account: sa }, { headers });
      alert(res.data.message + `

Share your sheet with: ${res.data.share_with}`);
      await fetchStatus();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
    finally { setSheetsSaving(false); }
  };

  const exportSheets = async () => {
    setSheetsExporting(true);
    try {
      const res = await axios.post('https://riskguardian.onrender.com/api/v1/integrations/sheets/export', {}, { headers });
      alert(`âœ… ${res.data.message}`);
      await fetchStatus();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Export failed'); }
    finally { setSheetsExporting(false); }
  };

  const disconnectSheets = async () => {
    if (!window.confirm('Disconnect Google Sheets?')) return;
    await axios.delete('https://riskguardian.onrender.com/api/v1/integrations/sheets', { headers });
    await fetchStatus();
  };

  // TRADINGVIEW
  const saveTradingView = async () => {
    if (!tvToken) return;
    setTvSaving(true);
    try {
      const res = await axios.post('https://riskguardian.onrender.com/api/v1/integrations/tradingview/setup',
        { secret_token: tvToken }, { headers });
      setTvWebhook(res.data.webhook_url);
      await fetchStatus();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
    finally { setTvSaving(false); }
  };

  const disconnectTV = async () => {
    if (!window.confirm('Disconnect TradingView?')) return;
    await axios.delete('https://riskguardian.onrender.com/api/v1/integrations/tradingview', { headers });
    setTvWebhook(''); await fetchStatus();
  };

  const connectedCount = [status.discord?.connected, status.sheets?.connected, status.tradingview?.connected].filter(Boolean).length + (status.telegram?.connected ? 1 : 0);

  const tabSx = (active: boolean, color: string) => ({
    textTransform: 'none', fontSize: '13px', fontWeight: active ? 700 : 400,
    color: active ? color : 'rgba(255,255,255,0.4)',
    borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
    borderRadius: 0, minWidth: 0, px: 2, pb: 1,
  });

  return (
    <SectionCard icon={<IntegrationInstructions sx={{ color: '#f59e0b', fontSize: 22 }} />} title="Custom Integrations" subtitle="Connect RiskGuardian with your entire stack" color="#f59e0b" locked={locked} lockLabel="Custom Integrations">

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, p: 1.5, borderRadius: '12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
        {[
          { label: 'Connected', value: connectedCount, color: '#f59e0b' },
          { label: 'Telegram', value: 'âœ…', color: '#22c55e' },
          { label: 'Available', value: 3, color: 'rgba(255,255,255,0.3)' },
        ].map((s, i) => (
          <Box key={i} sx={{ textAlign: 'center', flex: 1 }}>
            <Typography sx={{ fontSize: '20px', fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</Typography>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', mb: 3 }}>
        {[
          { label: 'ðŸ’¬ Discord', color: '#5865f2', connected: status.discord?.connected },
          { label: 'ðŸ“Š Sheets', color: '#34a853', connected: status.sheets?.connected },
          { label: 'ðŸ“ˆ TradingView', color: '#2196f3', connected: status.tradingview?.connected },
        ].map((tab, i) => (
          <Button key={i} onClick={() => setActiveTab(i)} sx={tabSx(activeTab === i, tab.color)}>
            {tab.label}
            {tab.connected && <Box sx={{ ml: 0.8, width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 4px #22c55e', display: 'inline-block', verticalAlign: 'middle' }} />}
          </Button>
        ))}
      </Box>

      {/* â”€â”€ DISCORD TAB â”€â”€ */}
      {activeTab === 0 && (
        <Box>
          {status.discord?.connected ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: '12px', background: 'rgba(88,101,242,0.08)', border: '1px solid rgba(88,101,242,0.2)', mb: 2 }}>
                <Typography sx={{ fontSize: '24px' }}>ðŸ’¬</Typography>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>Discord Connected</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Risk alerts, rule triggers, and cooldowns are being sent to your channel</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={testDiscord} sx={{ flex: 1, borderRadius: '10px', background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', color: '#7289da', fontWeight: 700, textTransform: 'none' }}>
                  {discordTest || 'ðŸ”” Send Test'}
                </Button>
                <Button onClick={disconnectDiscord} sx={{ borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>
                  Disconnect
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(88,101,242,0.06)', border: '1px solid rgba(88,101,242,0.15)' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#7289da', mb: 1 }}>ðŸ“– How to get a Discord Webhook URL:</Typography>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
                  1. Open Discord â†’ Right-click a channel â†’ Edit Channel<br/>
                  2. Click Integrations â†’ Webhooks â†’ New Webhook<br/>
                  3. Copy the Webhook URL and paste below
                </Typography>
              </Box>
              <TextField value={discordUrl} onChange={e => setDiscordUrl(e.target.value)}
                label="Discord Webhook URL" placeholder="https://discord.com/api/webhooks/..." sx={inputSx} />
              <TextField value={discordName} onChange={e => setDiscordName(e.target.value)}
                label="Bot Display Name" placeholder="RiskGuardian" sx={inputSx} />
              <Button onClick={saveDiscord} disabled={discordSaving || !discordUrl} fullWidth
                sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #5865f2, #7289da)', color: 'white', fontWeight: 700, textTransform: 'none', py: 1.2 }}>
                {discordSaving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'ðŸ’¬ Connect Discord'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* â”€â”€ SHEETS TAB â”€â”€ */}
      {activeTab === 1 && (
        <Box>
          {status.sheets?.connected ? (
            <Box>
              <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.2)', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>Google Sheets Connected</Typography>
                </Box>
                {sheetsStatus?.last_export && (
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                    Last export: {new Date(sheetsStatus.last_export).toLocaleString()} Â· {sheetsStatus.last_rows} rows
                  </Typography>
                )}
                {sheetsStatus?.sheet_url && (
                  <Button onClick={() => window.open(sheetsStatus.sheet_url, '_blank')} size="small"
                    sx={{ mt: 1, fontSize: '11px', textTransform: 'none', color: '#34a853', borderRadius: '6px', background: 'rgba(52,168,83,0.1)', border: '1px solid rgba(52,168,83,0.2)', px: 1.5, py: 0.4 }}>
                    â†— Open Sheet
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={exportSheets} disabled={sheetsExporting} sx={{ flex: 1, borderRadius: '10px', background: 'rgba(52,168,83,0.15)', border: '1px solid rgba(52,168,83,0.3)', color: '#34a853', fontWeight: 700, textTransform: 'none' }}>
                  {sheetsExporting ? <CircularProgress size={16} sx={{ color: '#34a853' }} /> : 'ðŸ“Š Export Now'}
                </Button>
                <Button onClick={disconnectSheets} sx={{ borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>
                  Disconnect
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(52,168,83,0.06)', border: '1px solid rgba(52,168,83,0.15)' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#34a853', mb: 1 }}>ðŸ“– Setup Instructions:</Typography>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
                  1. Go to Google Cloud Console â†’ Create a Service Account<br/>
                  2. Download the JSON key file<br/>
                  3. Create a Google Sheet and share it with the service account email<br/>
                  4. Paste the Sheet URL and JSON key below
                </Typography>
              </Box>
              <TextField value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)}
                label="Google Sheets URL" placeholder="https://docs.google.com/spreadsheets/d/..." sx={inputSx} />
              <TextField value={sheetName} onChange={e => setSheetName(e.target.value)}
                label="Sheet/Tab Name" placeholder="Trades" sx={inputSx} />
              <TextField value={sheetsJson} onChange={e => setSheetsJson(e.target.value)}
                label="Service Account JSON" placeholder='{"type":"service_account","client_email":"..."}' multiline rows={3} sx={inputSx} />
              <Button onClick={saveSheets} disabled={sheetsSaving || !sheetsUrl || !sheetsJson} fullWidth
                sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #34a853, #0f9d58)', color: 'white', fontWeight: 700, textTransform: 'none', py: 1.2 }}>
                {sheetsSaving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'ðŸ“Š Connect Google Sheets'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* â”€â”€ TRADINGVIEW TAB â”€â”€ */}
      {activeTab === 2 && (
        <Box>
          {(status.tradingview?.connected || tvWebhook) ? (
            <Box>
              <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>TradingView Connected</Typography>
                </Box>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', mb: 1 }}>Paste this URL in your Pine Script alert webhook:</Typography>
                <Box sx={{ p: 1.2, borderRadius: '8px', background: 'rgba(0,0,0,0.4)', fontFamily: 'monospace', fontSize: '10px', color: '#38bdf8', wordBreak: 'break-all', mb: 1 }}>
                  {tvWebhook || `https://riskguardian.onrender.com/api/v1/integrations/tradingview/alert?token=YOUR_TOKEN&uid=YOUR_ID`}
                </Box>
                {tvWebhook && (
                  <Button onClick={() => { navigator.clipboard.writeText(tvWebhook); }} size="small"
                    sx={{ fontSize: '11px', textTransform: 'none', color: '#38bdf8', borderRadius: '6px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', px: 1.5, py: 0.4 }}>
                    <ContentCopy sx={{ fontSize: 12, mr: 0.5 }} /> Copy URL
                  </Button>
                )}
              </Box>

              {/* Pine Script example */}
              <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', mb: 2 }}>
                <Typography sx={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, mb: 1 }}>Pine Script Example:</Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8 }}>
                  {`alertcondition(crossover(ta.ema(close,9), ta.ema(close,21)))`}<br/>
                  {`alert('{"ticker":"' + syminfo.ticker + '","action":"buy","price":' + str.tostring(close) + '}')`}
                </Typography>
              </Box>

              {/* Recent alerts */}
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 1.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recent Alerts ({tvAlerts.length})
              </Typography>
              {tvAlerts.length === 0 ? (
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>No alerts received yet. Fire an alert from TradingView to test.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 200, overflow: 'auto' }}>
                  {tvAlerts.slice(0,10).map((a, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, p: 1.2, borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '14px' }}>{a.action === 'buy' ? 'ðŸŸ¢' : a.action === 'sell' ? 'ðŸ”´' : 'ðŸ””'}</Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>{a.ticker} <Box component="span" sx={{ color: a.action === 'buy' ? '#22c55e' : a.action === 'sell' ? '#ef4444' : '#38bdf8', textTransform: 'uppercase', fontSize: '10px' }}>{a.action}</Box></Typography>
                        <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{new Date(a.received_at).toLocaleString()}</Typography>
                      </Box>
                      {a.price > 0 && <Typography sx={{ fontSize: '12px', color: '#f59e0b', fontFamily: 'monospace' }}>${a.price}</Typography>}
                    </Box>
                  ))}
                </Box>
              )}
              <Button onClick={disconnectTV} sx={{ mt: 2, borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>
                Disconnect TradingView
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(33,150,243,0.06)', border: '1px solid rgba(33,150,243,0.15)' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#2196f3', mb: 1 }}>ðŸ“– How it works:</Typography>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
                  1. Set a secret token below (any password you choose)<br/>
                  2. Copy the generated webhook URL<br/>
                  3. In TradingView alert settings â†’ Webhook URL â†’ paste it<br/>
                  4. Alerts fire into RiskGuardian + forward to Discord
                </Typography>
              </Box>
              <TextField value={tvToken} onChange={e => setTvToken(e.target.value)}
                label="Secret Token" placeholder="my-secret-token-123" sx={inputSx}
                helperText="Choose any secret string â€” used to verify alerts come from you"
                FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.3)', fontSize: '11px' } }} />
              <Button onClick={saveTradingView} disabled={tvSaving || tvToken.length < 8} fullWidth
                sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #1565c0, #2196f3)', color: 'white', fontWeight: 700, textTransform: 'none', py: 1.2, opacity: tvToken.length < 8 ? 0.5 : 1 }}>
                {tvSaving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'ðŸ“ˆ Connect TradingView'}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </SectionCard>
  );
};


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN ENTERPRISE PAGE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const EnterprisePage: React.FC = () => {
  const { plan, features, refetch } = usePlan();
  const isEnterprise = plan === 'enterprise';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success' || !isEnterprise) {
      let tries = 0;
      const t = setInterval(() => {
        refetch();
        tries++;
        if (tries >= 10 || isEnterprise) clearInterval(t);
      }, 3000);
      return () => clearInterval(t);
    }
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 4 }, background: 'radial-gradient(circle at 20% 0%, rgba(245,158,11,0.08), transparent 40%), radial-gradient(circle at 80% 100%, rgba(168,85,247,0.06), transparent 40%), #0b1120', color: 'white' }}>

      {/* Header */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ px: 2, py: 0.6, borderRadius: '10px', background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))', border: '1px solid rgba(245,158,11,0.3)', fontSize: '11px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.12em' }}>
            ENTERPRISE
          </Box>
          {isEnterprise && <Chip icon={<CheckCircle sx={{ fontSize: '14px !important' }} />} label="Active" size="small" sx={{ height: 26, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', fontWeight: 700 }} />}
        </Box>
        <Typography sx={{ fontSize: { xs: '28px', md: '38px' }, fontWeight: 800, background: 'linear-gradient(90deg, #f59e0b, #ef4444, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 1 }}>
          Enterprise Command Center
        </Typography>
        <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', maxWidth: 600 }}>
          White label, API access, custom rules, team tools, dedicated support â€” everything you need to run RiskGuardian at scale.
        </Typography>
        {!isEnterprise && (
          <Box sx={{ mt: 3, p: 2.5, borderRadius: '16px', background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, maxWidth: 600 }}>
            <Box>
              <Typography sx={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>Unlock all Enterprise features</Typography>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>$149/mo Â· Cancel anytime</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button onClick={() => startCheckout('enterprise')} sx={{ borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white', fontWeight: 800, textTransform: 'none', px: 3, py: 1.2, fontSize: '14px' }}>
                Upgrade to Enterprise
              </Button>
              <Button onClick={refetch} sx={{ borderRadius: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'none', px: 2.5, py: 1.2, fontSize: '13px' }}>
                Already paid? Refresh
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* Feature grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}><WhiteLabelSection locked={!features.white_label} /></Grid>
        <Grid item xs={12} md={6}><APISection locked={!features.api_access} /></Grid>
        <Grid item xs={12}><RiskRuleEngine locked={!features.custom_risk_rules} /></Grid>
        <Grid item xs={12} md={6}><TeamSection locked={!features.team_management} /></Grid>
        <Grid item xs={12} md={6}><AccountManagerSection locked={!features.dedicated_manager} /></Grid>
        <Grid item xs={12} md={6}><SLASection locked={!features.sla_guarantee} /></Grid>
        <Grid item xs={12} md={6}><IntegrationsSection locked={!features.custom_integrations} /></Grid>
      </Grid>
    </Box>
  );
};

export default EnterprisePage;

