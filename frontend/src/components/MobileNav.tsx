import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Book as BookIcon,
  Menu as MenuIcon,
  AccountBalance,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import { usePlan, startCheckout } from '../hooks/usePlan';
import axios from 'axios';

const API = 'http://localhost:8000';

const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { plan } = usePlan();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountName, setAccountName] = useState('My Account');
  const [accountBalance, setAccountBalance] = useState('—');

  const currentPath = location.pathname;

  // ── Load current account info ──────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    axios.get(`${API}/api/v1/accounts-multi/`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      const def = data.find((a: any) => a.is_default) || data[0];
      if (def) {
        setAccountName(def.account_name);
        setAccountBalance(`$${def.last_balance.toFixed(2)}`);
      }
    }).catch(() => {});
  }, []);

  const bottomNavItems = [
    { path: '/app',            label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/app/analytics',  label: 'Analytics', icon: <AnalyticsIcon /> },
    { path: '/app/history',    label: 'History',   icon: <HistoryIcon /> },
    { path: '/app/journal',    label: 'Journal',   icon: <BookIcon /> },
  ];

  const drawerItems = [
    { path: '/app/terminal', label: 'Terminal', icon: <TerminalIcon /> },
    { path: '/app/settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
    free:       { label: 'FREE',       color: '#9aa4b2' },
    starter:    { label: 'STARTER',    color: '#38bdf8' },
    pro:        { label: 'PRO',        color: '#a855f7' },
    enterprise: { label: 'ENTERPRISE', color: '#f59e0b' },
  };
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

  return (
    <>
      {/* Top App Bar */}
      <AppBar
        position="fixed"
        sx={{
          background: 'linear-gradient(90deg, #0a0e1a 0%, #0f1828 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(56,189,248,0.2)',
          display: { xs: 'block', md: 'none' }
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: '8px',
              background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AccountBalance sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h6" sx={{
              fontWeight: 800,
              background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              RiskGuardian
            </Typography>
          </Box>

          {/* Plan badge in top bar */}
          <Box sx={{
            fontSize: '10px', fontWeight: 800, color: planCfg.color,
            border: `1px solid ${planCfg.color}40`, borderRadius: '6px',
            px: 1, py: 0.3,
          }}>
            {planCfg.label}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Bottom Navigation */}
      <BottomNavigation
        value={currentPath}
        onChange={(_, newValue) => navigate(newValue)}
        sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(180deg, #0f1828 0%, #0a0e1a 100%)',
          borderTop: '1px solid rgba(56,189,248,0.2)',
          display: { xs: 'flex', md: 'none' },
          '& .MuiBottomNavigationAction-root': {
            color: 'rgba(255,255,255,0.5)',
            '&.Mui-selected': { color: '#38bdf8' }
          }
        }}
      >
        {bottomNavItems.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            value={item.path}
            icon={item.icon}
            sx={{
              minWidth: 'auto',
              '& .MuiBottomNavigationAction-label': { fontSize: '10px', fontWeight: 600 }
            }}
          />
        ))}
      </BottomNavigation>

      {/* Side Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            background: 'linear-gradient(180deg, #0f1828 0%, #0a0e1a 100%)',
            color: 'white',
          }
        }}
      >
        {/* Account Info — now dynamic */}
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Avatar sx={{
              width: 48, height: 48,
              background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
            }}>
              <AccountBalance />
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>
                {accountName}
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#22c55e', fontFamily: 'monospace' }}>
                {accountBalance}
              </Typography>
            </Box>
          </Box>
          {/* Plan badge */}
          <Box sx={{
            display: 'inline-block', fontSize: '10px', fontWeight: 800,
            color: planCfg.color, background: `${planCfg.color}18`,
            border: `1px solid ${planCfg.color}40`, borderRadius: '6px',
            px: 1.2, py: 0.3, mt: 0.5,
          }}>
            {planCfg.label} PLAN
          </Box>
        </Box>

        {/* Menu Items */}
        <List sx={{ flex: 1 }}>
          {drawerItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => { navigate(item.path); setDrawerOpen(false); }}
                sx={{ py: 2, '&:hover': { background: 'rgba(56,189,248,0.1)' } }}
              >
                <ListItemIcon sx={{ color: '#38bdf8', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {/* ✅ Upgrade CTA — only for free/starter users */}
        {(plan === 'free' || plan === 'starter') && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <Box
              onClick={() => { startCheckout(plan === 'free' ? 'starter' : 'pro'); setDrawerOpen(false); }}
              sx={{
                m: 2, p: 2, borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(56,189,248,0.1))',
                border: '1px solid rgba(168,85,247,0.3)',
                '&:hover': { background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(56,189,248,0.18))' }
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#a855f7' }}>
                ⚡ Upgrade to {plan === 'free' ? 'Starter' : 'Pro'}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mt: 0.3 }}>
                Unlock more features
              </Typography>
            </Box>
          </>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Logout */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleLogout}
            sx={{ py: 2, color: '#ef4444', '&:hover': { background: 'rgba(239,68,68,0.1)' } }}
          >
            <ListItemIcon sx={{ color: '#ef4444', minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>

        {/* Version */}
        <Box sx={{ p: 2, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
            Version 1.0.0 Beta
          </Typography>
        </Box>
      </Drawer>
    </>
  );
};

export default MobileNav;
