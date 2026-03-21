import React, { useState } from "react";
import {
  Typography, TextField, Button, CircularProgress, Box,
  InputAdornment, IconButton, Switch, Chip,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Lock as LockIcon, Person as PersonIcon, Dns as DnsIcon, Check,
} from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";

const PLAN_CONFIG: Record<string, {
  label: string; color: string; emoji: string;
  monthlyPriceId: string; annualPriceId: string;
}> = {
  free: {
    label: 'Free Trial', color: '#a855f7', emoji: '🎁',
    monthlyPriceId: '', annualPriceId: '',
  },
  starter: {
    label: 'Starter', color: '#38bdf8', emoji: '🚀',
    monthlyPriceId: 'price_1TDPhq6JfXB9ffkP38i9ULEn',
    annualPriceId:  'price_1TDPhq6JfXB9ffkP38i9ULEn',
  },
  pro: {
    label: 'Pro', color: '#22c55e', emoji: '⚡',
    monthlyPriceId: 'price_1TDPde6JfXB9ffkPxRCQBNx5',
    annualPriceId:  'price_1TDPde6JfXB9ffkPxRCQBNx5',
  },
  growth: {
    label: 'Growth', color: '#f97316', emoji: '📈',
    monthlyPriceId: 'price_1TDPfG6JfXB9ffkPrcZMjF6K',
    annualPriceId:  'price_1TDPfG6JfXB9ffkPrcZMjF6K',
  },
  enterprise: {
    label: 'Enterprise', color: '#ef4444', emoji: '🏢',
    monthlyPriceId: 'price_1TDPgk6JfXB9ffkPQURl7vi4',
    annualPriceId:  'price_1TDPgk6JfXB9ffkPQURl7vi4',
  },
};

const steps = [
  { id: 0, label: "Broker",  icon: "🔗", color: "#38bdf8", desc: "Connect MT5 account"    },
  { id: 1, label: "Risk",    icon: "🛡️", color: "#ef4444", desc: "Set risk limits"         },
  { id: 2, label: "Alerts",  icon: "🔔", color: "#a855f7", desc: "Configure notifications" },
  { id: 3, label: "AI",      icon: "🤖", color: "#22c55e", desc: "Enable AI monitoring"    },
];

const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const plan = searchParams.get('plan') || localStorage.getItem('selected_plan') || 'free';
  const planInfo = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

  const [activeStep, setActiveStep]     = useState(0);
  const [loading, setLoading]           = useState(false);
  const [loadingMsg, setLoadingMsg]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const API = process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com';

  const [form, setForm] = useState({
    broker: "", account: "", password: "", server: "",
    dailyLoss: 5, maxDD: 10, riskPerTrade: 1, minRR: 2,
    telegram: true, email: true, sms: false,
    emotionalAI: true, predictiveAI: true, optimizerAI: true,
  });

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleFinish = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) { navigate("/login"); return; }

      setLoadingMsg('Saving your configuration...');
      const responses = await Promise.all([
        fetch(`${API}/api/v1/setup/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            broker:  { broker_name: form.broker, account_number: form.account, password: form.password, server: form.server },
            risk:    { daily_loss: Number(form.dailyLoss), max_dd: Number(form.maxDD), risk_per_trade: Number(form.riskPerTrade), min_rr: Number(form.minRR) },
            alerts:  { telegram: form.telegram, email: form.email, sms: form.sms },
            ai:      { emotional: form.emotionalAI, predictive: form.predictiveAI, optimizer: form.optimizerAI },
            plan,
          }),
        }),
        ...(plan !== 'free' && planInfo.monthlyPriceId ? [
          fetch(`${API}/api/v1/billing/create-checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ plan }),
          })
        ] : [])
      ]);

      const setupData = await responses[0].json();
      const setupOk = responses[0].ok || setupData.detail === "Setup already completed";
      if (!setupOk) { alert(setupData.detail || "Setup failed"); return; }

      if (plan === 'free' || !planInfo.monthlyPriceId) {
        navigate('/app');
        return;
      }

      setLoadingMsg('Redirecting to secure payment...');
      const checkoutData = await (responses[1] as Response).json();
      if (checkoutData.checkout_url) {
        window.top!.location.href = checkoutData.checkout_url;
      } else {
        alert('Payment setup failed. Please try again.');
      }

    } catch (err) {
      console.error(err);
      alert("Setup error — check your connection");
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const si = (accent = '#38bdf8') => ({
    '& .MuiOutlinedInput-root': {
      color: 'white', borderRadius: '14px', background: '#111827',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: `${accent}66` },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: '1.5px' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: { xs: '14px', sm: '16px' } },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& input': { fontFamily: '"Roboto Mono",monospace', fontSize: { xs: '14px', sm: '17px' }, color: 'white', padding: { xs: '12px 10px 12px 0', sm: '16px 14px 16px 0' }, background: 'transparent' },
    '& input:-webkit-autofill': { WebkitBoxShadow: '0 0 0 1000px #111827 inset', WebkitTextFillColor: '#ffffff', caretColor: '#ffffff' },
  });

  const ToggleRow: React.FC<{
    icon: string; label: string; desc: string;
    checked: boolean; onChange: (v: boolean) => void; color: string;
  }> = ({ icon, label, desc, checked, onChange, color }) => (
    <Box onClick={() => onChange(!checked)} sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      p: 2.5, borderRadius: '16px', cursor: 'pointer',
      background: checked ? `${color}10` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${checked ? `${color}35` : 'rgba(255,255,255,0.07)'}`,
      transition: 'all 0.25s',
      '&:hover': { background: checked ? `${color}18` : 'rgba(255,255,255,0.05)' },
      mb: 1.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: '14px',
          background: checked ? `${color}20` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${checked ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', transition: 'all 0.25s', flexShrink: 0,
        }}>{icon}</Box>
        <Box>
          <Typography sx={{ fontSize: '17px', fontWeight: 700, color: 'white', mb: 0.2 }}>{label}</Typography>
          <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>{desc}</Typography>
        </Box>
      </Box>
      <Switch checked={checked} onChange={e => { e.stopPropagation(); onChange(e.target.checked); }}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked': { color },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: color },
        }} />
    </Box>
  );

  const renderStep = () => {
    switch (activeStep) {
      case 0: return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Broker Name" fullWidth autoComplete="off"
            InputLabelProps={{ shrink: true }} value={form.broker}
            onChange={e => update("broker", e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><DnsIcon sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment> }}
            sx={si('#38bdf8')} />
          <TextField label="Account Number" fullWidth autoComplete="off"
            InputLabelProps={{ shrink: true }} value={form.account}
            onChange={e => update("account", e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment> }}
            sx={si('#38bdf8')} />
          <TextField label="MT5 Password" fullWidth autoComplete="new-password"
            InputLabelProps={{ shrink: true }} value={form.password}
            onChange={e => update("password", e.target.value)}
            type={showPassword ? "text" : "password"}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)}
                    sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#38bdf8' } }}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }} sx={si('#38bdf8')} />
          <TextField label="Server" fullWidth autoComplete="off"
            InputLabelProps={{ shrink: true }} value={form.server}
            onChange={e => update("server", e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><DnsIcon sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment> }}
            sx={si('#38bdf8')} />
        </Box>
      );

      case 1: return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { label: 'Daily Loss Limit', key: 'dailyLoss',    color: '#ef4444', emoji: '🔴', desc: '% of account balance' },
            { label: 'Max Drawdown',     key: 'maxDD',        color: '#f97316', emoji: '🟠', desc: '% from peak equity'  },
            { label: 'Risk Per Trade',   key: 'riskPerTrade', color: '#facc15', emoji: '🟡', desc: '% per position'      },
            { label: 'Min Risk/Reward',  key: 'minRR',        color: '#22c55e', emoji: '🟢', desc: 'Minimum RR ratio'    },
          ].map(f => (
            <Box key={f.key} sx={{
              display: 'flex', alignItems: 'center', gap: 2, p: 2,
              borderRadius: '16px', background: `${f.color}08`,
              border: `1px solid ${f.color}20`, transition: 'all 0.2s',
              '&:hover': { background: `${f.color}12` },
            }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: `${f.color}15`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px' }}>{f.emoji}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.2 }}>{f.label}</Typography>
                <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>{f.desc}</Typography>
              </Box>
              <TextField type="number" size="small" value={(form as any)[f.key]}
                onChange={e => update(f.key, e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ color: f.color, fontSize: '14px', fontWeight: 700 }}>%</Typography></InputAdornment> }}
                sx={{ width: 100, '& .MuiOutlinedInput-root': { color: f.color, fontFamily: '"Roboto Mono",monospace', fontWeight: 800, fontSize: '18px', borderRadius: '12px', background: `${f.color}10`, '& fieldset': { borderColor: `${f.color}30` }, '&:hover fieldset': { borderColor: `${f.color}60` }, '&.Mui-focused fieldset': { borderColor: f.color } }, '& input': { textAlign: 'center', color: f.color, fontFamily: '"Roboto Mono",monospace', fontWeight: 800, padding: '9px 4px' } }} />
            </Box>
          ))}
        </Box>
      );

      case 2: return (
        <Box>
          <ToggleRow icon="📧" label="Email Alerts"    desc="Detailed trade reports & summaries"  checked={form.email}    onChange={v => update("email",    v)} color="#22c55e" />
          <ToggleRow icon="📱" label="Telegram Alerts" desc="Instant push notifications"          checked={form.telegram} onChange={v => update("telegram", v)} color="#38bdf8" />
          <ToggleRow icon="💬" label="SMS Alerts"      desc="Critical SMS warnings on your phone" checked={form.sms}      onChange={v => update("sms",      v)} color="#a855f7" />
        </Box>
      );

      case 3: return (
        <Box>
          <Box sx={{ mb: 3, p: 2, borderRadius: '14px', background: `${planInfo.color}10`, border: `1px solid ${planInfo.color}30`, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ fontSize: '28px' }}>{planInfo.emoji}</Typography>
            <Box>
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: planInfo.color }}>{planInfo.label} Plan</Typography>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                {plan === 'free' ? 'You will be taken to your dashboard after setup' : 'You will be taken to secure payment after setup'}
              </Typography>
            </Box>
          </Box>
          <ToggleRow icon="🧠" label="Emotional Detection" desc="Detect overtrading & revenge trading patterns" checked={form.emotionalAI}  onChange={v => update("emotionalAI",  v)} color="#22c55e" />
          <ToggleRow icon="🔮" label="Predictive Alerts"   desc="AI-powered early warning signals"              checked={form.predictiveAI} onChange={v => update("predictiveAI", v)} color="#38bdf8" />
          <ToggleRow icon="⚡" label="Risk Optimizer"      desc="Automatically suggest position size adjustments" checked={form.optimizerAI}  onChange={v => update("optimizerAI",  v)} color="#a855f7" />
        </Box>
      );

      default: return null;
    }
  };

  const current = steps[activeStep];

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 10% 0%,rgba(56,189,248,0.1),transparent 50%), radial-gradient(ellipse at 90% 100%,rgba(168,85,247,0.1),transparent 50%), radial-gradient(ellipse at 50% 50%,rgba(34,197,94,0.04),transparent 60%), #080e1a',
      p: { xs: 2, md: 3 },
    }}>
      <Box sx={{ width: '100%', maxWidth: 560, borderRadius: '28px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>

        {/* Top accent bar */}
        <Box sx={{ height: '3px', background: `linear-gradient(90deg,transparent,${planInfo.color},${current.color},transparent)` }} />

        {/* Header */}
        <Box sx={{ px: { xs: 3, md: 4 }, pt: 4, pb: 3, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Box sx={{ width: 4, height: 32, borderRadius: 2, background: 'linear-gradient(180deg,#38bdf8,#a855f7)' }} />
              <Typography sx={{ fontSize: { xs: '22px', sm: '28px' }, fontWeight: 800, background: 'linear-gradient(90deg,#38bdf8,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em', whiteSpace: { xs: 'nowrap', sm: 'normal' } }}>
                RiskGuardian Setup
              </Typography>
            </Box>
            <Chip label={`${planInfo.emoji} ${planInfo.label}`} size="small"
              sx={{ background: `${planInfo.color}18`, border: `1px solid ${planInfo.color}40`, color: planInfo.color, fontWeight: 700, fontSize: '12px' }} />
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: { xs: '13px', sm: '16px' }, ml: '20px' }}>
            Let's get your trading platform configured
          </Typography>
        </Box>

        {/* Step progress */}
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, pt: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            {steps.map((s, i) => {
              const done   = i < activeStep;
              const active = i === activeStep;
              return (
                <Box key={s.id} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', background: done ? s.color : active ? `${s.color}20` : 'rgba(255,255,255,0.05)', border: `2px solid ${done || active ? s.color : 'rgba(255,255,255,0.1)'}`, boxShadow: active ? `0 0 16px ${s.color}60` : 'none', fontSize: done ? '14px' : '16px' }}>
                    {done ? <Check sx={{ fontSize: 16, color: 'white' }} /> : <span>{s.icon}</span>}
                  </Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: active ? 700 : 500, color: active ? s.color : done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' }}>
                    {s.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg,${steps[0].color},${current.color})`, width: `${(activeStep / (steps.length - 1)) * 100}%`, transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)' }} />
          </Box>
        </Box>

        {/* Step header */}
        <Box sx={{ px: { xs: 2, md: 4 }, pb: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, p: { xs: 2, sm: 2.5 }, borderRadius: '18px', background: `${current.color}08`, border: `1px solid ${current.color}20` }}>
            <Box sx={{ width: { xs: 44, sm: 52 }, height: { xs: 44, sm: 52 }, borderRadius: { xs: '13px', sm: '15px' }, background: `linear-gradient(135deg,${current.color}40,${current.color}20)`, border: `1px solid ${current.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: { xs: '20px', sm: '24px' }, flexShrink: 0, boxShadow: `0 4px 16px ${current.color}30` }}>
              {current.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: { xs: '15px', sm: '20px' }, fontWeight: 800, color: 'white', whiteSpace: { xs: 'nowrap', sm: 'normal' }, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {['Broker Connection','Risk Management','Alert Notifications','AI Monitoring'][activeStep]}
              </Typography>
              <Typography sx={{ fontSize: { xs: '11px', sm: '15px' }, color: 'rgba(255,255,255,0.45)', mt: 0.3, whiteSpace: { xs: 'nowrap', sm: 'normal' }, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {['Connect your MetaTrader 5 account','Set your trading risk limits','Choose how you want to be notified','Enable intelligent trade monitoring'][activeStep]}
              </Typography>
            </Box>
            <Box sx={{ flexShrink: 0, px: { xs: 1.5, sm: 2 }, py: { xs: 0.6, sm: 0.8 }, borderRadius: '10px', background: `${current.color}15`, border: `1px solid ${current.color}30` }}>
              <Typography sx={{ fontSize: { xs: '12px', sm: '14px' }, fontWeight: 800, color: current.color, whiteSpace: 'nowrap' }}>{activeStep + 1}/{steps.length}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Step content */}
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, pb: 3 }}>
          {renderStep()}
        </Box>

        {/* Footer navigation */}
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, pb: 4, pt: 1, display: 'flex', justifyContent: 'space-between', gap: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Button disabled={activeStep === 0 || loading} onClick={() => setActiveStep(p => p - 1)}
            sx={{ px: { xs: 2.5, sm: 3 }, py: 1.3, borderRadius: '14px', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontSize: { xs: '14px', sm: '15px' }, textTransform: 'none', whiteSpace: 'nowrap', '&:hover': { background: 'rgba(255,255,255,0.05)', color: 'white' }, '&:disabled': { color: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.05)' } }}>
            ← Back
          </Button>

          {activeStep === steps.length - 1 ? (
            <Button onClick={handleFinish} disabled={loading}
              sx={{ flex: 1, py: 1.4, borderRadius: '14px', background: `linear-gradient(135deg,${planInfo.color},#2563eb)`, color: 'white', fontWeight: 800, fontSize: { xs: '14px', sm: '16px' }, textTransform: 'none', whiteSpace: 'nowrap', boxShadow: `0 6px 24px ${planInfo.color}40`, '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 32px ${planInfo.color}50` }, '&:disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', transform: 'none' } }}>
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={18} sx={{ color: 'white' }} />
                  <span>{loadingMsg || 'Processing...'}</span>
                </Box>
              ) : plan === 'free' ? '🚀 Launch RiskGuardian' : `🚀 Launch & Pay for ${planInfo.label}`}
            </Button>
          ) : (
            <Button onClick={() => setActiveStep(p => p + 1)}
              sx={{ flex: 1, py: 1.4, borderRadius: '14px', background: `linear-gradient(135deg,${current.color}cc,${current.color}88)`, color: 'white', fontWeight: 800, fontSize: { xs: '14px', sm: '16px' }, textTransform: 'none', whiteSpace: 'nowrap', boxShadow: `0 6px 20px ${current.color}30`, '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 28px ${current.color}45`, background: `linear-gradient(135deg,${current.color},${current.color}cc)` } }}>
              Continue →
            </Button>
          )}
        </Box>
      </Box>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap');`}</style>
    </Box>
  );
};

export default SetupWizard;

