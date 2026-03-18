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

// â”€â”€ Plan config (match your Stripe Price IDs here) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PLAN_CONFIG: Record<string, {
  label: string; color: string; emoji: string;
  monthlyPriceId: string; annualPriceId: string;
}> = {
  free: {
    label: 'Free Trial', color: '#a855f7', emoji: 'ðŸŽ',
    monthlyPriceId: '',  // No Stripe needed for free
    annualPriceId:  '',
  },
  starter: {
    label: 'Starter', color: '#38bdf8', emoji: 'ðŸš€',
    monthlyPriceId: 'price_1T65ru6JfXB9ffkPoNcx8gEI',  // â† Replace with your Stripe Price ID
    annualPriceId:  'price_1T65ru6JfXB9ffkPoNcx8gEI',   // â† Replace with your Stripe Price ID
  },
  pro: {
    label: 'Pro', color: '#22c55e', emoji: 'âš¡',
    monthlyPriceId: 'price_1T65rv6JfXB9ffkPxiCNxwRb',      // â† Replace with your Stripe Price ID
    annualPriceId:  'price_1T65rv6JfXB9ffkPxiCNxwRb',       // â† Replace with your Stripe Price ID
  },
  enterprise: {
    label: 'Enterprise', color: '#f97316', emoji: 'ðŸ¢',
    monthlyPriceId: 'price_1T65rw6JfXB9ffkPJkN5jn0m', // â† Replace with your Stripe Price ID
    annualPriceId:  'price_1T65rw6JfXB9ffkPJkN5jn0m',  // â† Replace with your Stripe Price ID
  },
};

const steps = [
  { id: 0, label: "Broker",  icon: "ðŸ”—", color: "#38bdf8", desc: "Connect MT5 account"    },
  { id: 1, label: "Risk",    icon: "ðŸ›¡ï¸", color: "#ef4444", desc: "Set risk limits"         },
  { id: 2, label: "Alerts",  icon: "ðŸ””", color: "#a855f7", desc: "Configure notifications" },
  { id: 3, label: "AI",      icon: "ðŸ¤–", color: "#22c55e", desc: "Enable AI monitoring"    },
];

const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read plan from URL, fallback to localStorage, fallback to 'free'
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

      // Step 1 â€” save setup
      setLoadingMsg('Saving your configuration...');
      const [setupRes, checkoutRes] = await Promise.all([
        fetch(`${API}/api/v1/setup/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            broker:  { broker_name: form.broker, account_number: form.account, password: form.password, server: form.server },
            risk:    { daily_loss: Number(form.dailyLoss), max_dd: Number(form.maxDD), risk_per_trade: Number(form.riskPerTrade), min_rr: Number(form.minRR) },
            alerts:  { telegram: form.telegram, email: form.email, sms: form.sms },
            ai:      { emotional: form.emotionalAI, predictive: form.predictiveAI, optimizer: form.optimizerAI },
            plan:    plan,
          }),
        }),
        // Fire checkout request in parallel for paid plans
        ...(plan !== 'free' && planInfo.monthlyPriceId ? [
          fetch(`${API}/api/v1/billing/create-checkout-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              plan,
              price_id:    planInfo.monthlyPriceId,
              success_url: `${window.location.origin}/#/app?payment=success&plan=${plan}`,
              cancel_url:  `${window.location.origin}/#/setup?plan=${plan}`,
            }),
          })
        ] : [])
      ]);

      const setupData = await setupRes.json();
      const setupOk = setupRes.ok || setupData.detail === "Setup already completed";
      if (!setupOk) { alert(setupData.detail || "Setup failed"); return; }

      // Free plan â€” go straight to dashboard
      if (plan === 'free' || !planInfo.monthlyPriceId) {
        navigate('/app');
        return;
      }

      // Paid plan â€” redirect to Stripe
      setLoadingMsg('Redirecting to secure payment...');
      const checkoutData = await (checkoutRes as Response).json();

      if (checkoutData.checkout_url) {
        window.top!.location.href = checkoutData.checkout_url;
      } else {
        console.error('Checkout error:', checkoutData);
        alert('Payment setup failed. Please try again.');
      }

    } catch (err) {
      console.error(err);
      alert("Setup error â€” check your connection");
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // â”€â”€ Shared input style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const si = (accent = '#38bdf8') => ({
    '& .MuiOutlinedInput-root': {
      color: 'white', borderRadius: '14px', background: '#111827',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: `${accent}66` },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: '1.5px' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '16px' },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& input': { fontFamily: '"Roboto Mono",monospace', fontSize: '17px', color: 'white', padding: '16px 14px 16px 0', background: 'transparent' },
    '& input:-webkit-autofill': { WebkitBoxShadow: '0 0 0 1000px #111827 inset', WebkitTextFillColor: '#ffffff', caretColor: '#ffffff' },
    '& .MuiInputAdornment-root svg': { fontSize: '22px' },
  });

  // â”€â”€ Toggle row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ToggleRow: React.FC<{ icon: string; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; color: string }> =
    ({ icon, label, desc, checked, onChange, color }) => (
      <Box onClick={() => onChange(!checked)}
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2.5, borderRadius: '16px', cursor: 'pointer', background: checked ? `${color}10` : 'rgba(255,255,255,0.03)', border: `1px solid ${checked ? `${color}35` : 'rgba(255,255,255,0.07)'}`, transition: 'all 0.25s', '&:hover': { background: checked ? `${color}18` : 'rgba(255,255,255,0.05)' }, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '14px', background: checked ? `${color}20` : 'rgba(255,255,255,0.05)', border: `1px solid ${checked ? `${color}40` : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', transition: 'all 0.25s', flexShrink: 0 }}>{icon}</Box>
          <Box>
            <Typography sx={{ fontSize: '17px', fontWeight: 700, color: 'white', mb: 0.2 }}>{label}</Typography>
            <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>{desc}</Typography>
          </Box>
        </Box>
        <Switch checked={checked} onChange={e => { e.stopPropagation(); onChange(e.target.checked); }}
          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: color } }} />
      </Box>
    );

  const renderStep = () => {
    switch (activeStep) {
      case 0: return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Broker Name"    fullWidth autoComplete="off" InputLabelProps={{ shrink: true }} value={form.broker}   onChange={e => update("broker",   e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><DnsIcon    sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment> }} sx={si('#38bdf8')} />
          <TextField label="Account Number" fullWidth autoComplete="off" InputLabelProps={{ shrink: true }} value={form.account}  onChange={e => update("account",  e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment> }} sx={si('#38bdf8')} />
          <TextField label="MT5 Password"   fullWidth autoComplete="new-password" InputLabelProps={{ shrink: true }} value={form.password} onChange={e => update("password", e.target.value)}
            type={showPassword ? "text" : "password"}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment>,
              endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#38bdf8' } }}>{showPassword ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>,
            }} sx={si('#38bdf8')} />
          <TextField label="Server"         fullWidth autoComplete="off" InputLabelProps={{ shrink: true }} value={form.server}   onChange={e => update("server",   e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><DnsIcon    sx={{ color: '#38bdf8', fontSize: 22 }} /></InputAdornment> }} sx={si('#38bdf8')} />
        </Box>
      );
      case 1: return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { label: 'Daily Loss Limit', key: 'dailyLoss',    color: '#ef4444', emoji: 'ðŸ”´', desc: '% of account balance' },
            { label: 'Max Drawdown',     key: 'maxDD',        color: '#f97316', emoji: 'ðŸŸ ', desc: '% from peak equity'  },
            { label: 'Risk Per Trade',   key: 'riskPerTrade', color: '#facc15', emoji: 'ðŸŸ¡', desc: '% per position'      },
            { label: 'Min Risk/Reward',  key: 'minRR',        color: '#22c55e', emoji: 'ðŸŸ¢', desc: 'Minimum RR ratio'    },
          ].map(f => (
            <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: '16px', background: `${f.color}08`, border: `1px solid ${f.color}20`, transition: 'all 0.2s', '&:hover': { background: `${f.color}12` } }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: `${f.color}15`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px' }}>{f.emoji}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.2 }}>{f.label}</Typography>
                <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>{f.desc}</Typography>
              </Box>
              <TextField type="number" size="small" value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ color: f.color, fontSize: '14px', fontWeight: 700 }}>%</Typography></InputAdornment> }}
                sx={{ width: 100, '& .MuiOutlinedInput-root': { color: f.color, fontFamily: '"Roboto Mono",monospace', fontWeight: 800, fontSize: '18px', borderRadius: '12px', background: `${f.color}10`, '& fieldset': { borderColor: `${f.color}30` }, '&:hover fieldset': { borderColor: `${f.color}60` }, '&.Mui-focused fieldset': { borderColor: f.color } }, '& input': { textAlign: 'center', color: f.color, fontFamily: '"Roboto Mono",monospace', fontWeight: 800, padding: '9px 4px' } }} />
            </Box>
          ))}
        </Box>
      );
      case 2: return (
        <Box>
          <ToggleRow icon="ðŸ“§" label="Email Alerts"    desc="Detailed trade reports & summaries"  checked={form.email}    onChange={v => update("email",    v)} color="#22c55e" />
          <ToggleRow icon="ðŸ“±" label="Telegram Alerts" desc="Instant push notifications"          checked={form.telegram} onChange={v => update("telegram", v)} color="#38bdf8" />
          <ToggleRow icon="ðŸ’¬" label="SMS Alerts"      desc="Critical SMS warnings on your phone" checked={form.sms}      onChange={v => update("sms",      v)} color="#a855f7" />
        </Box>
      );
      case 3: return (
        <Box>
          {/* Plan reminder before launch */}
          <Box sx={{ mb: 3, p: 2, borderRadius: '14px', background: `${planInfo.color}10`, border: `1px solid ${planInfo.color}30`, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ fontSize: '28px' }}>{planInfo.emoji}</Typography>
            <Box>
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: planInfo.color }}>
                {planInfo.label} Plan
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                {plan === 'free'
                  ? 'You will be taken to your dashboard after setup'
                  : 'You will be taken to secure payment after setup'}
              </Typography>
            </Box>
          </Box>
          <ToggleRow icon="ðŸ§ " label="Emotional Detection" desc="Detect overtrading & revenge trading patterns" checked={form.emotionalAI}  onChange={v => update("emotionalAI",  v)} color="#22c55e" />
          <ToggleRow icon="ðŸ”®" label="Predictive Alerts"   desc="AI-powered early warning signals"              checked={form.predictiveAI} onChange={v => update("predictiveAI", v)} color="#38bdf8" />
          <ToggleRow icon="âš¡" label="Risk Optimizer"      desc="Automatically suggest position size adjustments" checked={form.optimizerAI}  onChange={v => update("optimizerAI",  v)} color="#a855f7" />
        </Box>
      );
      default: return null;
    }
  };

  const current = steps[activeStep];

  const launchLabel = () => {
    if (loading) return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={18} sx={{ color: 'white' }} />
        <span>{loadingMsg || 'Processing...'}</span>
      </Box>
    );
    if (plan === 'free') return 'ðŸš€ Launch RiskGuardian';
    return `ðŸš€ Launch & Pay for ${planInfo.label}`;
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 10% 0%,rgba(56,189,248,0.1),transparent 50%), radial-gradient(ellipse at 90% 100%,rgba(168,85,247,0.1),transparent 50%), radial-gradient(ellipse at 50% 50%,rgba(34,197,94,0.04),transparent 60%), #080e1a',
      p: { xs: 2, md: 3 },
    }}>

      <Box sx={{ width: '100%', maxWidth: 560, borderRadius: '28px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>

        {/* â”€â”€ Top accent bar â”€â”€ */}
        <Box sx={{ height: '3px', background: `linear-gradient(90deg,transparent,${planInfo.color},${current.color},transparent)` }} />

        {/* â”€â”€ Header â”€â”€ */}
        <Box sx={{ px: { xs: 3, md: 4 }, pt: 4, pb: 3, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Box sx={{ width: 4, height: 32, borderRadius: 2, background: 'linear-gradient(180deg,#38bdf8,#a855f7)' }} />
              <Typography sx={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(90deg,#38bdf8,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
                RiskGuardian Setup
              </Typography>
            </Box>
            {/* Plan badge in header */}
            <Chip
              label={`${planInfo.emoji} ${planInfo.label}`}
              size="small"
              sx={{
                background: `${planInfo.color}18`,
                border: `1px solid ${planInfo.color}40`,
                color: planInfo.color,
                fontWeight: 700, fontSize: '12px',
              }}
            />
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '16px', ml: '20px' }}>
            Let's get your trading platform configured
          </Typography>
        </Box>

        {/* â”€â”€ Step Progress â”€â”€ */}
        <Box sx={{ px: { xs: 3, md: 4 }, pt: 3, pb: 2 }}>
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
            <Box sx={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg,${steps[0].color},${current.color})`, width: `${((activeStep) / (steps.length - 1)) * 100}%`, transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)' }} />
          </Box>
        </Box>

        {/* â”€â”€ Step header â”€â”€ */}
        <Box sx={{ px: { xs: 3, md: 4 }, pb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, borderRadius: '18px', background: `${current.color}08`, border: `1px solid ${current.color}20` }}>
            <Box sx={{ width: 52, height: 52, borderRadius: '15px', background: `linear-gradient(135deg,${current.color}40,${current.color}20)`, border: `1px solid ${current.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0, boxShadow: `0 4px 16px ${current.color}30` }}>
              {current.icon}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>
                {['Broker Connection', 'Risk Management', 'Alert Notifications', 'AI Monitoring'][activeStep]}
              </Typography>
              <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', mt: 0.3 }}>
                {['Connect your MetaTrader 5 account', 'Set your trading risk limits', 'Choose how you want to be notified', 'Enable intelligent trade monitoring'][activeStep]}
              </Typography>
            </Box>
            <Box sx={{ ml: 'auto', px: 2, py: 0.8, borderRadius: '10px', background: `${current.color}15`, border: `1px solid ${current.color}30` }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 800, color: current.color }}>{activeStep + 1} / {steps.length}</Typography>
            </Box>
          </Box>
        </Box>

        {/* â”€â”€ Step content â”€â”€ */}
        <Box sx={{ px: { xs: 3, md: 4 }, pb: 3 }}>
          {renderStep()}
        </Box>

        {/* â”€â”€ Footer navigation â”€â”€ */}
        <Box sx={{ px: { xs: 3, md: 4 }, pb: 4, pt: 1, display: 'flex', justifyContent: 'space-between', gap: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Button
            disabled={activeStep === 0 || loading}
            onClick={() => setActiveStep(p => p - 1)}
            sx={{ px: 3, py: 1.3, borderRadius: '14px', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontSize: '15px', textTransform: 'none', transition: 'all 0.2s', '&:hover': { background: 'rgba(255,255,255,0.05)', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }, '&:disabled': { color: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.05)' } }}>
            â† Back
          </Button>

          {activeStep === steps.length - 1 ? (
            <Button onClick={handleFinish} disabled={loading}
              sx={{ flex: 1, py: 1.4, borderRadius: '14px', background: `linear-gradient(135deg,${planInfo.color},#2563eb)`, color: 'white', fontWeight: 800, fontSize: '16px', textTransform: 'none', boxShadow: `0 6px 24px ${planInfo.color}40`, transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 32px ${planInfo.color}50` }, '&:disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', transform: 'none' } }}>
              {launchLabel()}
            </Button>
          ) : (
            <Button onClick={() => setActiveStep(p => p + 1)}
              sx={{ flex: 1, py: 1.4, borderRadius: '14px', background: `linear-gradient(135deg,${current.color}cc,${current.color}88)`, color: 'white', fontWeight: 800, fontSize: '16px', textTransform: 'none', boxShadow: `0 6px 20px ${current.color}30`, transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 28px ${current.color}45`, background: `linear-gradient(135deg,${current.color},${current.color}cc)` } }}>
              Continue â†’
            </Button>
          )}
        </Box>
      </Box>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap');
      `}</style>
    </Box>
  );
};

export default SetupWizard;

