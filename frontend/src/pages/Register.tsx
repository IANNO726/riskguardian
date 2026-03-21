import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Alert, CircularProgress, InputAdornment, IconButton, Chip,
} from '@mui/material';
import { Visibility, VisibilityOff, PersonAdd as RegisterIcon } from '@mui/icons-material';
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

// Map backend error messages to user-friendly ones
const friendlyError = (detail: any): string => {
  if (!detail) return 'Registration failed. Please try again.';
  if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(', ');
  const msg = String(detail).toLowerCase();
  if (msg.includes('username already')) return '⚠️ That username is already taken. Please choose a different one.';
  if (msg.includes('email already'))    return '⚠️ That email is already registered. Try logging in instead.';
  if (msg.includes('username'))         return '⚠️ Username is invalid or already in use.';
  if (msg.includes('email'))            return '⚠️ Email address is invalid or already registered.';
  return typeof detail === 'string' ? detail : 'Registration failed. Please try again.';
};

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan     = searchParams.get('plan') || 'free';
  const planInfo = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData,     setFormData]     = useState({ username: '', email: '', password: '', full_name: '' });

  // Track which field caused the error for inline highlighting
  const [fieldError, setFieldError] = useState<'username' | 'email' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldError(null);

    // Basic client-side validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/auth-multi/register`,
        formData
      );

      const { access_token, user } = response.data;

      // New users are remembered by default
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('selected_plan', plan);
      localStorage.setItem('saved_username', formData.username);

      navigate(`/setup?plan=${plan}`);

    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg    = friendlyError(detail);
      setError(msg);

      // Highlight the relevant field
      const lower = String(detail || '').toLowerCase();
      if (lower.includes('username')) setFieldError('username');
      else if (lower.includes('email')) setFieldError('email');
    } finally {
      setLoading(false);
    }
  };

  const premiumCard = {
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px',
    position: 'relative' as const,
    '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, #22c55e, ${planInfo.color}, #a855f7)` },
  };

  const inputStyles = (highlight?: boolean) => ({
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
      '& fieldset': { borderColor: highlight ? '#ef4444' : 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: highlight ? '#ef4444' : 'rgba(56,189,248,0.5)' },
      '&.Mui-focused fieldset': { borderColor: highlight ? '#ef4444' : '#38bdf8' },
    },
    '& .MuiInputLabel-root': { color: highlight ? '#ef4444' : 'rgba(255,255,255,0.6)' },
    '& input': { color: 'white', fontFamily: '"DM Mono", monospace' },
  });

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.08), transparent 40%), #0b1120', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 450 }}>

        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography sx={{ fontSize: '42px', fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em', mb: 1 }}>RiskGuardian</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Multi-Platform Trading Management</Typography>
        </Box>

        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Chip label={`${planInfo.emoji} ${planInfo.label} Plan Selected`}
            sx={{ background: `${planInfo.color}18`, border: `1px solid ${planInfo.color}40`, color: planInfo.color, fontWeight: 700, fontSize: '13px', px: 1 }} />
        </Box>

        <Card sx={premiumCard}>
          <CardContent sx={{ p: 4 }}>
            <Typography sx={{ fontSize: '24px', fontWeight: 700, color: 'white', mb: 1 }}>Create Account</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', mb: 4 }}>
              {plan === 'free' ? 'Start your 14-day free trial — no card needed' : `Set up your ${planInfo.label} plan account`}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}
                action={
                  // If email is taken, show "Login instead" button
                  String(error).toLowerCase().includes('email') || String(error).toLowerCase().includes('already registered') ? (
                    <Button size="small" sx={{ color: '#38bdf8', fontSize: '12px', fontWeight: 700 }}
                      onClick={() => navigate(`/login?plan=${plan}`)}>
                      Login →
                    </Button>
                  ) : undefined
                }>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField fullWidth required label="Full Name"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                sx={{ ...inputStyles(), mb: 3 }} />

              <TextField fullWidth required label="Username"
                value={formData.username}
                onChange={e => { setFormData({ ...formData, username: e.target.value }); if (fieldError === 'username') setFieldError(null); }}
                helperText={fieldError === 'username' ? 'This username is already taken' : ''}
                FormHelperTextProps={{ sx: { color: '#ef4444' } }}
                sx={{ ...inputStyles(fieldError === 'username'), mb: 3 }} />

              <TextField fullWidth required type="email" label="Email"
                value={formData.email}
                onChange={e => { setFormData({ ...formData, email: e.target.value }); if (fieldError === 'email') setFieldError(null); }}
                helperText={fieldError === 'email' ? 'This email is already registered — try logging in' : ''}
                FormHelperTextProps={{ sx: { color: '#ef4444' } }}
                sx={{ ...inputStyles(fieldError === 'email'), mb: 3 }} />

              <TextField fullWidth required label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                helperText="At least 6 characters"
                FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.3)' } }}
                InputProps={{ endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )}}
                sx={{ ...inputStyles(), mb: 4 }} />

              <Button type="submit" fullWidth disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <RegisterIcon />}
                sx={{ py: 2, borderRadius: '12px', background: `linear-gradient(90deg, ${planInfo.color}, #2563eb)`, fontSize: '16px', fontWeight: 700, textTransform: 'none', color: 'white', mb: 3, '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 30px ${planInfo.color}40` }, '&:disabled': { background: 'rgba(255,255,255,0.1)' } }}>
                {loading ? 'Creating Account...' : 'Create Account & Continue →'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                  Already have an account?{' '}
                  <Link to={`/login?plan=${plan}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>
                    Login here
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

export default Register;