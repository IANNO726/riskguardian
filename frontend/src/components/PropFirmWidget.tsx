import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, Grid, Chip } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import { usePlan, startCheckout } from '../hooks/usePlan';

const API = (process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com') + '/api/v1/prop-firms';

interface Preset {
  name: string; firm: string; account_size: number;
  daily_loss_limit: number; max_drawdown: number;
  profit_target: number; color: string; logo: string;
}

interface ActiveProfile {
  active: boolean;
  profile?: {
    preset_key: string; firm_name: string; account_size: number;
    daily_loss_limit: number; max_drawdown: number;
    profit_target: number; color: string; logo: string;
  };
}

const PropFirmWidget: React.FC = () => {
  const { features: rawFeatures } = usePlan();
  const features = rawFeatures || {};
  const [active, setActive]       = useState<ActiveProfile>({ active: false });
  const [presets, setPresets]     = useState<Record<string, Preset>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading]     = useState(true);

  const token   = localStorage.getItem('access_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!features.prop_firm_profiles) { setLoading(false); return; }
    Promise.all([
      fetch(`${API}/active`,  { headers }).then(r => r.json()),
      fetch(`${API}/presets`, { headers }).then(r => r.json()),
    ]).then(([a, p]) => {
      setActive(a);
      setPresets(p.presets || {});
    }).finally(() => setLoading(false));
  }, [features]);

  const activate = async (key: string) => {
    await fetch(`${API}/activate/${key}`, { method: 'POST', headers });
    const res = await fetch(`${API}/active`, { headers });
    setActive(await res.json());
    setDialogOpen(false);
  };

  const deactivate = async () => {
    await fetch(`${API}/deactivate`, { method: 'POST', headers });
    setActive({ active: false });
  };

  // Locked for non-Pro
  if (!features.prop_firm_profiles) {
    return (
      <Box sx={{ p: 2.5, borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', opacity: 0.5, cursor: 'not-allowed', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BusinessIcon sx={{ color: '#a855f7', fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>Prop Firm Profiles</Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>FTMO, E8, TopstepFX...</Typography>
          </Box>
          <Box sx={{ fontSize: '10px', fontWeight: 700, color: '#a855f7', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', px: 1, py: 0.3 }}>PRO</Box>
        </Box>
        <Button onClick={() => startCheckout('pro')} fullWidth size="small"
          sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', fontWeight: 700, fontSize: '12px', textTransform: 'none', opacity: 1, cursor: 'pointer' }}>
          🔒 Upgrade to Pro
        </Button>
      </Box>
    );
  }

  if (loading) return null;

  // Active profile display
  if (active.active && active.profile) {
    const p = active.profile;
    return (
      <Box sx={{ p: 2.5, borderRadius: '16px', background: `linear-gradient(135deg, ${p.color}15, ${p.color}08)`, border: `1px solid ${p.color}44`, position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${p.color}, transparent)` } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography sx={{ fontSize: '28px' }}>{p.logo}</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{p.firm_name}</Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>${p.account_size.toLocaleString()} account</Typography>
          </Box>
          <Chip label="ACTIVE" size="small" sx={{ height: 22, fontSize: '10px', fontWeight: 700, background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}44` }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          {[
            { label: 'Daily Loss', value: `${p.daily_loss_limit}%`, color: '#ef4444' },
            { label: 'Max DD',     value: `${p.max_drawdown}%`,     color: '#f97316' },
            { label: 'Target',     value: `${p.profit_target}%`,    color: '#22c55e' },
          ].map(item => (
            <Box key={item.label} sx={{ flex: 1, textAlign: 'center', p: 1, borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: item.color }}>{item.value}</Typography>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{item.label}</Typography>
            </Box>
          ))}
        </Box>
        <Button onClick={deactivate} fullWidth size="small"
          sx={{ borderRadius: '10px', border: `1px solid ${p.color}44`, color: p.color, fontSize: '12px', textTransform: 'none', '&:hover': { background: `${p.color}11` } }}>
          Change Profile
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ p: 2.5, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #a855f7, transparent)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BusinessIcon sx={{ color: '#a855f7', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>Prop Firm Profiles</Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Auto-configure risk rules</Typography>
          </Box>
        </Box>
        <Button onClick={() => setDialogOpen(true)} fullWidth
          sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', fontWeight: 700, fontSize: '13px', textTransform: 'none', py: 1.2, '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(168,85,247,0.35)' } }}>
          🏢 Select Firm Profile
        </Button>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { background: '#0f172a', color: 'white', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ fontSize: '20px', fontWeight: 700 }}>🏢 Select Prop Firm Profile</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', mb: 3 }}>
            Automatically configure your risk rules to match your prop firm's requirements.
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(presets).map(([key, preset]) => (
              <Grid item xs={12} sm={6} key={key}>
                <Box onClick={() => activate(key)} sx={{ p: 2.5, borderRadius: '14px', cursor: 'pointer', background: `linear-gradient(135deg, ${preset.color}10, ${preset.color}05)`, border: `1px solid ${preset.color}33`, transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 8px 24px ${preset.color}22`, border: `1px solid ${preset.color}66` } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Typography sx={{ fontSize: '24px' }}>{preset.logo}</Typography>
                    <Box>
                      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{preset.name}</Typography>
                      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>${preset.account_size.toLocaleString()}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {[
                      { label: `DD ${preset.daily_loss_limit}%`, color: '#ef4444' },
                      { label: `Max ${preset.max_drawdown}%`,    color: '#f97316' },
                      { label: `+${preset.profit_target}%`,      color: '#22c55e' },
                    ].map(tag => (
                      <Box key={tag.label} sx={{ fontSize: '11px', fontWeight: 600, color: tag.color, background: `${tag.color}15`, border: `1px solid ${tag.color}33`, borderRadius: '6px', px: 1, py: 0.3 }}>
                        {tag.label}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PropFirmWidget;

