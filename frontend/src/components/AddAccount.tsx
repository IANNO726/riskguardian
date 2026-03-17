import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AddAccount: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    platform: 'MT5',
    account_number: '',
    broker_name: '',
    server: '',
    password: '',
    account_name: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        setError('Please login first');
        navigate('/login');
        return;
      }

      const response = await axios.post(
        'http://localhost:8000/api/v1/accounts-multi/',
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      setSuccess(`Account "${response.data.account_name}" added successfully! ✅`);
      
      // Reset form
      setFormData({
        platform: 'MT5',
        account_number: '',
        broker_name: '',
        server: '',
        password: '',
        account_name: '',
      });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/');
        window.location.reload(); // Reload to fetch new accounts
      }, 2000);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err.response?.data?.detail || 'Failed to add account. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const premiumCard = {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: 'linear-gradient(90deg, #22c55e, #3b82f6, #a855f7)',
    }
  };

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(56,189,248,0.5)' },
      '&.Mui-focused fieldset': { borderColor: '#38bdf8' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
    '& input, & .MuiSelect-select': { 
      color: 'white',
      fontFamily: '"DM Mono", monospace'
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      p: { xs: 2, md: 5 },
      background: 'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.08), transparent 40%), #0b1120',
      color: 'white',
      fontFamily: '"DM Sans", sans-serif',
    }}>
      {/* Back Button */}
      <Button
        onClick={() => navigate('/')}
        startIcon={<ArrowBack />}
        sx={{
          mb: 3,
          color: 'rgba(255,255,255,0.6)',
          '&:hover': {
            color: '#38bdf8',
            background: 'rgba(56,189,248,0.1)',
          }
        }}
      >
        Back to Dashboard
      </Button>

      <Box sx={{ mb: 5 }}>
        <Typography sx={{
          fontSize: { xs: '28px', md: '36px' },
          fontWeight: 800,
          background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
          mb: 1
        }}>
          ➕ Add Trading Account
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          Connect a new MT5, MT4, or cTrader account
        </Typography>
      </Box>

      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={8}>
          <Card sx={premiumCard}>
            <CardContent sx={{ p: 4 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
                  {error}
                </Alert>
              )}
              
              {success && (
                <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>
                  {success}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      label="Platform"
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      sx={inputStyles}
                    >
                      <MenuItem value="MT5">MetaTrader 5</MenuItem>
                      <MenuItem value="MT4" disabled>MetaTrader 4 (Coming Soon)</MenuItem>
                      <MenuItem value="cTrader" disabled>cTrader (Coming Soon)</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Account Name (Optional)"
                      placeholder="e.g., My Demo Account"
                      value={formData.account_name}
                      onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                      sx={inputStyles}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="Account Number"
                      placeholder="e.g., 6009324"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      sx={inputStyles}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="Broker Name"
                      placeholder="e.g., Deriv"
                      value={formData.broker_name}
                      onChange={(e) => setFormData({ ...formData, broker_name: e.target.value })}
                      sx={inputStyles}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="Server"
                      placeholder="e.g., Deriv-Demo"
                      value={formData.server}
                      onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                      sx={inputStyles}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      type="password"
                      label="Password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      sx={inputStyles}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ borderRadius: '12px', mb: 2 }}>
                      <Typography sx={{ fontSize: '13px' }}>
                        🔒 Your credentials are encrypted and stored securely. We use industry-standard encryption to protect your data.
                      </Typography>
                    </Alert>
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      fullWidth
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                      sx={{
                        py: 2,
                        borderRadius: '12px',
                        background: 'linear-gradient(90deg, #2563eb, #22c55e)',
                        fontSize: '16px',
                        fontWeight: 700,
                        textTransform: 'none',
                        color: 'white',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 30px rgba(37,99,235,0.4)',
                        },
                        '&:disabled': {
                          background: 'rgba(255,255,255,0.1)',
                        }
                      }}
                    >
                      {loading ? 'Adding Account...' : 'Add Account'}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      `}</style>
    </Box>
  );
};

export default AddAccount;
