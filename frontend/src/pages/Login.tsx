import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Alert, CircularProgress, InputAdornment, IconButton, Chip, FormControlLabel, Checkbox,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com';

const PLAN_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  free:       { label: 'Free Trial',  color: '#a855f7', emoji: '🎁' },
  starter:    { label: 'Starter',     color: '#38bdf8', emoji: '🚀' },
  pro:        { label: 'Pro',         color: '#22c55e', emoji: '⚡' },
  growth:     { label: 'Growth',      color: '#f97316', emoji: '📈' },
  enterprise: { label: 'Enterprise',  color: '#ef4444', emoji: '🏢' },
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan     = searchParams.get('plan') || '';
  const planInfo = plan ? PLAN_CONFIG[plan] : null;

  const [loading,      setLoading]      = useState(false);
  const [checking,     setChecking]     = useState(true);
  const [error,        setError]        = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,   setRememberMe]   = useState(true);
  const [formData,     setFormData]     = useState({ username: '', password: '' });

  // ── Auto-login: if valid token exists, skip login screen ──────
  useEffect(() => {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (!token) { setChecking(false); return; }

    axios.get(`${API_BASE_URL}/api/v1/auth-multi/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      const user = res.data;
      localStorage.setItem('user', JSON.stringify(user));
      const redirectTo = localStorage.getItem('redirect_after_login');
      localStorage.removeItem('redirect_after_login');
      if (plan) {
        navigate(user.setup_complete ? `/checkout?plan=${plan}` : `/setup?plan=${plan}`);
      } else {
        navigate(user.setup_complete ? (redirectTo || '/app') : '/setup');
      }
    }).catch(() => {
      localStorage.removeItem('access_token');
      sessionStorage.removeItem('access_token');
      setChecking(false);
    });
  }, []);

  // ── Pre-fill username if saved ─────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('saved_username');
    if (saved) setFormData(f => ({ ...f, username: saved }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formBody = new URLSearchParams();
      formBody.append('username', formData.username);
      formBody.append('password', formData.password);

      const response = await axios.post(
        `${API_BASE_URL}/api/v1/auth-multi/login`,
        formBody,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, user } = response.data;

      if (rememberMe) {
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('saved_username', formData.username);
      } else {
        sessionStorage.setItem('access_token', access_token);
        localStorage.removeItem('saved_username');
      }
      localStorage.setItem('user', JSON.stringify(user));

      const setupDone  = user?.setup_complete;
      const redirectTo = localStorage.getItem('redirect_after_login');
      localStorage.removeItem('redirect_after_login');

      if (plan) {
        localStorage.setItem('selected_plan', plan);
        navigate(setupDone ? `/checkout?plan=${plan}` : `/setup?plan=${plan}`);
      } else {
        navigate(setupDone ? (redirectTo || '/app') : '/setup');
      }

    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Incorrect username or password.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1120' }}>
      <CircularProgress sx={{ color: '#38bdf8' }} />
    </Box>
  );

  const premiumCard = {
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px',
    position: 'relative' as const,
    '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: planInfo ? `linear-gradient(90deg, #22c55e, ${planInfo.color}, #a855f7)` : 'linear-gradient(90deg, #22c55e, #3b82f6, #a855f7)' },
  };

  const inputStyles = {
    '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.05)', borderRadius: '12px', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: 'rgba(56,189,248,0.5)' }, '&.Mui-focused fieldset': { borderColor: '#38bdf8' } },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
    '& input': { color: 'white', fontFamily: '"DM Mono", monospace' },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.08), transparent 40%), #0b1120', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 450 }}>

        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography sx={{ fontSize: '42px', fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em', mb: 1 }}>RiskGuardian</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Multi-Platform Trading Management</Typography>
        </Box>

        {planInfo && (
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Chip label={`${planInfo.emoji} ${planInfo.label} Plan Selected`}
              sx={{ background: `${planInfo.color}18`, border: `1px solid ${planInfo.color}40`, color: planInfo.color, fontWeight: 700, fontSize: '13px', px: 1 }} />
          </Box>
        )}

        <Card sx={premiumCard}>
          <CardContent sx={{ p: 4 }}>
            <Typography sx={{ fontSize: '24px', fontWeight: 700, color: 'white', mb: 1 }}>Welcome Back</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', mb: 4 }}>
              {planInfo ? `Log in to activate your ${planInfo.label} plan` : 'Login to access your trading accounts'}
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
              <TextField fullWidth required label="Username"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                sx={{ ...inputStyles, mb: 3 }} />

              <TextField fullWidth required label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                InputProps={{ endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )}}
                sx={{ ...inputStyles, mb: 1 }} />

              {/* Keep me logged in */}
              <FormControlLabel
                control={<Checkbox checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: '#38bdf8' } }} />}
                label={<Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Keep me logged in</Typography>}
                sx={{ mb: 3, display: 'block' }}
              />

              <Button type="submit" fullWidth disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
                sx={{ py: 2, borderRadius: '12px', background: planInfo ? `linear-gradient(90deg, ${planInfo.color}, #2563eb)` : 'linear-gradient(90deg, #2563eb, #22c55e)', fontSize: '16px', fontWeight: 700, textTransform: 'none', color: 'white', mb: 3, '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 30px rgba(37,99,235,0.4)' }, '&:disabled': { background: 'rgba(255,255,255,0.1)' } }}>
                {loading ? 'Logging in...' : planInfo ? `Login & Activate ${planInfo.label} →` : 'Login →'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                  Don't have an account?{' '}
                  <Link to={plan ? `/register?plan=${plan}` : '/register'} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>
                    Register here
                  </Link>
                </Typography>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
    </Box>
  );
};

export default Login;

