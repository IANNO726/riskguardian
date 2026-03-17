import React, { useState, useEffect, useRef } from 'react';
import { Box, Avatar, Typography, Menu, MenuItem, Divider, CircularProgress } from '@mui/material';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useBranding } from '../hooks/useBranding';
import TradeBlockBanner from './TradeBlockBanner';
import TrialBanner from './TrialBanner';
import {
  KeyboardArrowDown as ArrowDownIcon,
  CheckCircle as CheckIcon,
  Add as AddIcon,
  AccountBalance,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import axios from 'axios';
import MobileNav from './MobileNav';
import SupportWidget from './SupportWidget';
import { usePlan, startCheckout } from '../hooks/usePlan';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface TradingAccount {
  id: number; account_name: string; platform: string;
  broker_name: string; account_number: string;
  last_balance: number; last_equity: number;
  currency: string; is_default: boolean;
}

const PLAN_CONFIG: Record<string, { label: string; color: string; color2: string; glow: string }> = {
  free:       { label: 'FREE',       color: '#64748b', color2: '#475569', glow: '100,116,139' },
  starter:    { label: 'STARTER',    color: '#38bdf8', color2: '#0ea5e9', glow: '56,189,248'  },
  pro:        { label: 'PRO',        color: '#a855f7', color2: '#7c3aed', glow: '168,85,247'  },
  enterprise: { label: 'ENTERPRISE', color: '#f59e0b', color2: '#d97706', glow: '245,158,11'  },
};

const NAV_ITEMS = [
  { to: '/app',            label: 'Dashboard',  icon: '⬡', sub: 'Overview & stats',    end: true,  minPlan: null,      color: '#38bdf8', glow: '56,189,248'   },
  { to: '/app/accounts',   label: 'Accounts',   icon: '⊞', sub: 'Multi-account view',  end: false, minPlan: 'starter', color: '#22c55e', glow: '34,197,94'    },
  { to: '/app/terminal',   label: 'Terminal',   icon: '⌬', sub: 'Live MT5 positions',   end: false, minPlan: 'starter', color: '#22c55e', glow: '34,197,94'    },
  { to: '/app/risk-check', label: 'Risk Check', icon: '🎯', sub: 'Pre-trade analysis',  end: false, minPlan: 'starter', color: '#f59e0b', glow: '245,158,11'   },
  { to: '/app/simulator',  label: 'Simulator',  icon: '🏆', sub: 'Prop firm practice',  end: false, minPlan: 'starter', color: '#22c55e', glow: '34,197,94'    },
  { to: '/app/analytics',  label: 'Analytics',  icon: '◈', sub: 'Performance data',     end: false, minPlan: 'pro',     color: '#a855f7', glow: '168,85,247'   },
  { to: '/app/history',    label: 'History',    icon: '◷', sub: 'Past trades',           end: false, minPlan: null,      color: '#f59e0b', glow: '245,158,11'   },
  { to: '/app/settings',   label: 'Settings',   icon: '◎', sub: 'Account & billing',    end: false, minPlan: null,      color: '#fb7185', glow: '251,113,133'  },
];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { branding }          = useBranding();
  const navigate              = useNavigate();
  const location              = useLocation();
  const { plan, refreshPlan } = usePlan();
  const [anchorEl, setAnchorEl]               = useState<null | HTMLElement>(null);
  const [accounts, setAccounts]               = useState<TradingAccount[]>([]);
  const [currentAccount, setCurrentAccount]   = useState<TradingAccount | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [upgradeLoading, setUpgradeLoading]   = useState(false);
  const [collapsed, setCollapsed]             = useState(false);
  const [hovered, setHovered]                 = useState(false);
  const [mouseY, setMouseY]                   = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const open = Boolean(anchorEl);

  const isLoggedIn   = () => !!localStorage.getItem('access_token');
  const isExpanded   = !collapsed || hovered;
  const isPro        = plan === 'pro' || plan === 'enterprise';
  const isEnterprise = plan === 'enterprise';
  const isStarter    = plan === 'starter' || isPro;
  const planCfg      = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = sidebarRef.current?.getBoundingClientRect();
    if (rect) setMouseY(((e.clientY - rect.top) / rect.height) * 100);
  };

  const fetchAccounts = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await axios.get(`${API}/api/v1/accounts-multi/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(res.data);
      const def = res.data.find((a: TradingAccount) => a.is_default);
      setCurrentAccount(def || res.data[0] || null);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.clear(); navigate('/login'); }
    } finally { setLoading(false); }
  };

  const switchAccount = async (id: number) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;
    setCurrentAccount(account);
    const token = localStorage.getItem('access_token');
    try {
      await axios.post(`${API}/api/v1/accounts-multi/${id}/set-default`, {}, { headers: { Authorization: `Bearer ${token}` } });
      window.location.reload();
    } catch {}
    setAnchorEl(null);
  };

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  useEffect(() => {
    if (isLoggedIn()) { fetchAccounts(); refreshPlan?.(); }
    else setLoading(false);
  }, []);

  const isActive = (to: string, end?: boolean) => {
    const hash = location.hash.replace('#', '');
    if (end) return hash === to || hash === to + '/';
    return hash.startsWith(to);
  };

  const sidebarW = isExpanded ? 256 : 76;

  if (!isLoggedIn()) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', background: '#050810' }}>
        <Box sx={{ width: 76, background: '#050810' }} />
        <Box sx={{ flex: 1, p: 4, color: '#fff' }}>{children}</Box>
      </Box>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { font-family: 'Outfit', sans-serif !important; }
        .nav-item { transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1) !important; }
        .nav-item:hover { transform: translateX(4px) !important; }
        .nav-item.active-item { transform: translateX(4px) !important; }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .plan-badge-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .logo-float { animation: float 4s ease-in-out infinite; }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>

      <Box sx={{ display: 'flex', minHeight: '100vh', background: '#050810', '@media (max-width: 768px)': { flexDirection: 'column' } }}>
        <MobileNav />

        {/* ══ SIDEBAR ══ */}
        <Box
          ref={sidebarRef}
          onMouseEnter={() => collapsed && setHovered(true)}
          onMouseLeave={() => { setHovered(false); }}
          onMouseMove={handleMouseMove}
          sx={{
            width: sidebarW, minWidth: sidebarW,
            transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1), min-width 0.35s cubic-bezier(0.4,0,0.2,1)',
            position: 'relative', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', zIndex: 200,
            '@media (max-width: 768px)': { display: 'none' },
            background: 'linear-gradient(160deg, #0d1117 0%, #080c14 50%, #060910 100%)',
            borderRight: `1px solid rgba(${planCfg.glow}, 0.15)`,
            '&::before': {
              content: '""', position: 'absolute', inset: 0, zIndex: 0,
              backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(${planCfg.glow}, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 20% 100%, rgba(${planCfg.glow}, 0.06) 0%, transparent 50%)`,
              pointerEvents: 'none',
            },
            '&::after': {
              content: '""', position: 'absolute', left: '-40px', top: `${mouseY - 15}%`,
              width: '120px', height: '30%',
              background: `radial-gradient(ellipse, rgba(${planCfg.glow}, 0.08) 0%, transparent 70%)`,
              pointerEvents: 'none', transition: 'top 0.3s ease', zIndex: 0,
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* ── LOGO ── */}
            <Box sx={{ px: 2, pt: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 72 }}>
              <Box className="logo-float" sx={{
                width: 40, height: 40, borderRadius: '13px', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(56,189,248,0.25) 0%, rgba(34,197,94,0.15) 100%)',
                border: '1px solid rgba(56,189,248,0.4)',
                boxShadow: '0 0 0 1px rgba(56,189,248,0.1), 0 8px 32px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', cursor: 'pointer', transition: 'all 0.3s',
                '&:hover': { transform: 'scale(1.08) rotate(-5deg)', boxShadow: '0 0 0 1px rgba(56,189,248,0.25), 0 12px 40px rgba(56,189,248,0.35), inset 0 1px 0 rgba(255,255,255,0.2)' },
              }} onClick={() => setCollapsed(!collapsed)}>
                <Box sx={{ position: 'absolute', inset: -4, borderRadius: '17px', border: '1px solid rgba(56,189,248,0.3)', animation: 'pulse-ring 2.5s ease-out infinite' }} />
                <Box sx={{ position: 'absolute', inset: -1, borderRadius: '14px', background: 'linear-gradient(135deg, rgba(56,189,248,0.4), rgba(34,197,94,0.4))', filter: 'blur(8px)', opacity: 0.35, zIndex: 0 }} />
                <Typography sx={{ fontSize: '20px', lineHeight: 1, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.8))' }}>🛡️</Typography>
              </Box>

              {isExpanded && (
                <Box sx={{ overflow: 'hidden', flex: 1 }}>
                  <Typography sx={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, whiteSpace: 'nowrap', background: `linear-gradient(90deg, #fff 30%, ${planCfg.color})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: `drop-shadow(0 0 8px rgba(${planCfg.glow},0.4))` }}>
                    {branding.brand_name}
                  </Typography>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, px: 1, py: 0.3, borderRadius: '20px', overflow: 'hidden', position: 'relative', background: `linear-gradient(90deg, rgba(${planCfg.glow},0.2), rgba(${planCfg.glow},0.1))`, border: `1px solid rgba(${planCfg.glow}, 0.35)`, boxShadow: `0 2px 8px rgba(${planCfg.glow}, 0.2)` }}>
                    <Box className="plan-badge-shimmer" sx={{ position: 'absolute', inset: 0, borderRadius: '20px' }} />
                    <Box sx={{ position: 'relative', width: 6, height: 6 }}>
                      <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `rgb(${planCfg.glow})`, animation: 'pulse-ring 1.8s ease-out infinite' }} />
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `rgb(${planCfg.glow})`, boxShadow: `0 0 6px rgb(${planCfg.glow})` }} />
                    </Box>
                    <Typography sx={{ fontSize: '9px', fontWeight: 800, color: planCfg.color, letterSpacing: '0.12em', position: 'relative' }}>{planCfg.label}</Typography>
                  </Box>
                </Box>
              )}

              {isExpanded && (
                <Box onClick={() => { setCollapsed(!collapsed); setHovered(false); }} sx={{ width: 24, height: 24, borderRadius: '8px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.2s', '&:hover': { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.15)' } }}>
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1, transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', display: 'block' }}>‹</Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ mx: 2, mb: 2, height: '1px', background: `linear-gradient(90deg, transparent, rgba(${planCfg.glow},0.3), transparent)` }} />

            {/* ── ACCOUNT CARD ── */}
            <Box sx={{ px: 1.5, mb: 2 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={20} sx={{ color: planCfg.color }} />
                </Box>
              ) : currentAccount ? (
                <>
                  <Box onClick={(e) => setAnchorEl(e.currentTarget as HTMLElement)} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.2,
                    px: isExpanded ? 1.5 : 0.5, py: 1.3,
                    borderRadius: '14px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    justifyContent: isExpanded ? 'flex-start' : 'center', transition: 'all 0.25s',
                    '&:hover': { background: 'rgba(255,255,255,0.07)', borderColor: `rgba(${planCfg.glow},0.25)`, boxShadow: `0 4px 20px rgba(${planCfg.glow},0.1)`, transform: 'translateY(-1px)' },
                    '&::before': { content: '""', position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(${planCfg.glow},0.05), transparent)`, borderRadius: '14px' },
                  }}>
                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar sx={{ width: 32, height: 32, background: `linear-gradient(135deg, rgba(${planCfg.glow},0.4), rgba(${planCfg.glow},0.1))`, border: `1px solid rgba(${planCfg.glow},0.3)`, boxShadow: `0 0 12px rgba(${planCfg.glow},0.2)`, fontSize: '13px' }}>
                        <AccountBalance sx={{ fontSize: 15, color: planCfg.color }} />
                      </Avatar>
                      <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', border: '1.5px solid #060910', boxShadow: '0 0 6px #22c55e' }} />
                    </Box>
                    {isExpanded && (
                      <>
                        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: 1, mb: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                            {currentAccount.account_name}
                          </Typography>
                          <Typography sx={{ fontSize: '11px', color: refreshing ? '#f59e0b' : '#22c55e', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
                            {refreshing ? '⟳ syncing...' : `$${currentAccount.last_balance.toLocaleString('en', { minimumFractionDigits: 2 })}`}
                          </Typography>
                        </Box>
                        <ArrowDownIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 15, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                      </>
                    )}
                  </Box>

                  <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { mt: 1, minWidth: 290, background: 'linear-gradient(160deg, #141928, #0a0d1a)', border: `1px solid rgba(${planCfg.glow}, 0.15)`, borderRadius: '16px', boxShadow: `0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(${planCfg.glow},0.05)`, overflow: 'hidden' }}}>
                    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Your Accounts · {accounts.length}</Typography>
                    </Box>
                    {accounts.map((acc) => (
                      <MenuItem key={acc.id} onClick={() => switchAccount(acc.id)} sx={{ mx: 1, my: 0.5, borderRadius: '10px', py: 1.5, px: 1.5, background: acc.id === currentAccount.id ? `rgba(${planCfg.glow},0.1)` : 'transparent', border: acc.id === currentAccount.id ? `1px solid rgba(${planCfg.glow},0.25)` : '1px solid transparent', '&:hover': { background: 'rgba(255,255,255,0.05)' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                          <Avatar sx={{ width: 34, height: 34, background: acc.id === currentAccount.id ? `linear-gradient(135deg,#22c55e,#3b82f6)` : 'rgba(255,255,255,0.07)', fontSize: '13px' }}>
                            <AccountBalance sx={{ fontSize: 16 }} />
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{acc.account_name}</Typography>
                              {acc.id === currentAccount.id && <CheckIcon sx={{ fontSize: 13, color: '#22c55e' }} />}
                            </Box>
                            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{acc.platform} · {acc.broker_name}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>${acc.last_balance.toFixed(2)}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                    <Box sx={{ mx: 1, mt: 0.5, mb: 1, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <MenuItem onClick={() => { setAnchorEl(null); navigate('/app/accounts'); }} sx={{ borderRadius: '10px', py: 1.2, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', '&:hover': { background: 'rgba(34,197,94,0.12)' } }}>
                        <AddIcon sx={{ mr: 1, color: '#22c55e', fontSize: 16 }} />
                        <Typography sx={{ color: '#22c55e', fontWeight: 600, fontSize: '13px' }}>Manage All Accounts</Typography>
                      </MenuItem>
                    </Box>
                  </Menu>
                </>
              ) : (
                <Box onClick={() => navigate('/app/accounts')} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1.5, borderRadius: '14px', cursor: 'pointer', background: 'rgba(34,197,94,0.05)', border: '1px dashed rgba(34,197,94,0.25)', '&:hover': { background: 'rgba(34,197,94,0.1)' }, transition: 'all 0.2s' }}>
                  <AddIcon sx={{ color: '#22c55e', fontSize: 16 }} />
                  {isExpanded && <Typography sx={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>Add Account</Typography>}
                </Box>
              )}
            </Box>

            {/* ── NAV LABEL ── */}
            {isExpanded && (
              <Typography sx={{ px: 2.5, mb: 1, fontSize: '10px', fontWeight: 800, color: `rgba(${planCfg.glow},0.7)`, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Menu</Typography>
            )}

            {/* ── NAV ITEMS ── */}
            <Box className="sidebar-scroll" sx={{ px: 1.5, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {NAV_ITEMS.map(({ to, label, icon, sub, end, minPlan, color: itemColor, glow: itemGlow }) => {
                const active = isActive(to, end);
                const locked = minPlan === 'starter' ? !isStarter : minPlan === 'pro' ? !isPro : false;
                return (
                  <NavLink key={to} to={to} end={end} style={{ textDecoration: 'none' }}>
                    <Box className={`nav-item${active ? ' active-item' : ''}`} sx={{
                      display: 'flex', alignItems: 'center',
                      gap: isExpanded ? 1.4 : 0,
                      justifyContent: isExpanded ? 'flex-start' : 'center',
                      px: isExpanded ? 1.4 : 0, py: isExpanded ? 1.2 : 1.3,
                      mb: 0.6, borderRadius: '13px', cursor: locked ? 'not-allowed' : 'pointer',
                      position: 'relative', overflow: 'hidden', opacity: locked ? 0.35 : 1,
                      background: active ? `linear-gradient(135deg, rgba(${itemGlow},0.22) 0%, rgba(${itemGlow},0.08) 100%)` : `rgba(${itemGlow},0.03)`,
                      border: active ? `1px solid rgba(${itemGlow},0.4)` : `1px solid rgba(${itemGlow},0.06)`,
                      boxShadow: active ? `0 4px 24px rgba(${itemGlow},0.18), inset 0 1px 0 rgba(255,255,255,0.07)` : 'none',
                      transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                      '&:hover': !locked ? { background: active ? undefined : 'rgba(255,255,255,0.05)', borderColor: active ? undefined : 'rgba(255,255,255,0.09)', boxShadow: active ? undefined : `0 2px 12px rgba(${planCfg.glow},0.06)` } : {},
                      '&::before': active ? { content: '""', position: 'absolute', left: 0, top: '15%', bottom: '15%', width: '3px', borderRadius: '0 3px 3px 0', background: itemColor, boxShadow: `0 0 12px rgba(${itemGlow},0.8), 0 0 4px rgba(${itemGlow},1)` } : {},
                      '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: '12px', background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)' },
                    }}>
                      <Box sx={{ width: 38, height: 38, borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? `linear-gradient(135deg, rgba(${itemGlow},0.3), rgba(${itemGlow},0.1))` : `rgba(${itemGlow},0.1)`, border: active ? `1px solid rgba(${itemGlow},0.45)` : `1px solid rgba(${itemGlow},0.2)`, transition: 'all 0.25s', boxShadow: active ? `0 0 20px rgba(${itemGlow},0.35), inset 0 1px 0 rgba(255,255,255,0.1)` : `0 0 8px rgba(${itemGlow},0.1)` }}>
                        <Typography sx={{ fontSize: '16px', lineHeight: 1, color: itemColor, opacity: active ? 1 : 0.7, filter: active ? `drop-shadow(0 0 10px rgba(${itemGlow},1))` : `drop-shadow(0 0 4px rgba(${itemGlow},0.4))`, transition: 'all 0.25s' }}>
                          {icon}
                        </Typography>
                      </Box>
                      {isExpanded && (
                        <Box sx={{ flex: 1, overflow: 'hidden' }}>
                          <Typography sx={{ fontSize: '14px', fontWeight: active ? 800 : 600, color: active ? '#fff' : 'rgba(255,255,255,0.92)', lineHeight: 1, mb: 0.3, letterSpacing: '-0.01em', transition: 'all 0.2s' }}>{label}</Typography>
                          <Typography sx={{ fontSize: '11px', color: active ? itemColor : 'rgba(255,255,255,0.55)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'all 0.2s' }}>{sub}</Typography>
                        </Box>
                      )}
                      {isExpanded && locked && <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>🔒</Typography>}
                      {isExpanded && active && !locked && <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: itemColor, boxShadow: `0 0 10px ${itemColor}, 0 0 4px ${itemColor}`, flexShrink: 0 }} />}
                    </Box>
                  </NavLink>
                );
              })}

              {/* Journal */}
              {(isStarter || isPro) && (() => {
                const active = isActive('/app/journal');
                return (
                  <NavLink to="/app/journal" style={{ textDecoration: 'none' }}>
                    <Box className={`nav-item${active ? ' active-item' : ''}`} sx={{ display: 'flex', alignItems: 'center', gap: isExpanded ? 1.4 : 0, justifyContent: isExpanded ? 'flex-start' : 'center', px: isExpanded ? 1.4 : 0, py: isExpanded ? 1.2 : 1.3, mb: 0.6, borderRadius: '13px', cursor: 'pointer', position: 'relative', overflow: 'hidden', background: active ? `linear-gradient(135deg, rgba(${planCfg.glow},0.22), rgba(${planCfg.glow},0.08))` : `rgba(${planCfg.glow},0.03)`, border: active ? `1px solid rgba(${planCfg.glow},0.4)` : `1px solid rgba(${planCfg.glow},0.07)`, boxShadow: active ? `0 4px 24px rgba(${planCfg.glow},0.18), inset 0 1px 0 rgba(255,255,255,0.07)` : 'none', transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)', '&:hover': { background: active ? undefined : 'rgba(255,255,255,0.05)' }, '&::before': active ? { content: '""', position: 'absolute', left: 0, top: '15%', bottom: '15%', width: '3px', borderRadius: '0 3px 3px 0', background: `linear-gradient(180deg,${planCfg.color},${planCfg.color2})`, boxShadow: `0 0 12px rgba(${planCfg.glow},0.8)` } : {} }}>
                      <Box sx={{ width: 38, height: 38, borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? `linear-gradient(135deg,rgba(${planCfg.glow},0.3),rgba(${planCfg.glow},0.1))` : `rgba(${planCfg.glow},0.1)`, border: active ? `1px solid rgba(${planCfg.glow},0.45)` : `1px solid rgba(${planCfg.glow},0.2)`, boxShadow: active ? `0 0 20px rgba(${planCfg.glow},0.35), inset 0 1px 0 rgba(255,255,255,0.1)` : `0 0 8px rgba(${planCfg.glow},0.1)`, transition: 'all 0.25s' }}>
                        <Typography sx={{ fontSize: '18px', lineHeight: 1, color: planCfg.color, opacity: active ? 1 : 0.7, filter: active ? `drop-shadow(0 0 10px rgba(${planCfg.glow},1))` : `drop-shadow(0 0 4px rgba(${planCfg.glow},0.4))` }}>◫</Typography>
                      </Box>
                      {isExpanded && (
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                            <Typography sx={{ fontSize: '13px', fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.6)', lineHeight: 1 }}>{isPro ? 'AI Journal' : 'Journal'}</Typography>
                            {isPro && <Box sx={{ px: 0.7, py: 0.15, borderRadius: '4px', background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.35)' }}><Typography sx={{ fontSize: '7px', fontWeight: 900, color: '#c084fc', letterSpacing: '0.1em' }}>AI</Typography></Box>}
                          </Box>
                          <Typography sx={{ fontSize: '10px', color: active ? `rgba(${planCfg.glow},0.9)` : 'rgba(255,255,255,0.4)', lineHeight: 1 }}>{isPro ? 'Pattern analysis' : 'Trade reflections'}</Typography>
                        </Box>
                      )}
                      {isExpanded && active && <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: planCfg.color, boxShadow: `0 0 10px ${planCfg.color}, 0 0 4px ${planCfg.color}`, flexShrink: 0 }} />}
                    </Box>
                  </NavLink>
                );
              })()}

              {/* Enterprise */}
              {isEnterprise && (() => {
                const active = isActive('/app/enterprise');
                return (
                  <NavLink to="/app/enterprise" style={{ textDecoration: 'none' }}>
                    <Box className={`nav-item${active ? ' active-item' : ''}`} sx={{ display: 'flex', alignItems: 'center', gap: isExpanded ? 1.4 : 0, justifyContent: isExpanded ? 'flex-start' : 'center', px: isExpanded ? 1.4 : 0, py: isExpanded ? 1.0 : 1.2, mb: 0.5, borderRadius: '12px', cursor: 'pointer', background: active ? 'rgba(245,158,11,0.12)' : 'transparent', border: active ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent', transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)', '&:hover': { background: 'rgba(245,158,11,0.07)' } }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)', border: active ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                        <Typography sx={{ fontSize: '16px', color: active ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>♛</Typography>
                      </Box>
                      {isExpanded && (
                        <Box>
                          <Typography sx={{ fontSize: '13px', fontWeight: active ? 700 : 500, color: active ? '#f59e0b' : 'rgba(255,255,255,0.6)', lineHeight: 1, mb: 0.3 }}>Enterprise</Typography>
                          <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)', lineHeight: 1 }}>White label & API</Typography>
                        </Box>
                      )}
                    </Box>
                  </NavLink>
                );
              })()}
            </Box>

            {/* ── BOTTOM ── */}
            <Box sx={{ px: 1.5, pb: 2.5, pt: 1.5 }}>
              {isExpanded && <TrialBanner plan={plan} />}
              {isExpanded && (plan === 'free' || plan === 'starter') && (
                <Box onClick={() => !upgradeLoading && startCheckout(plan === 'free' ? 'starter' : 'pro', setUpgradeLoading)} sx={{ mb: 1.5, p: 1.5, borderRadius: '14px', cursor: upgradeLoading ? 'not-allowed' : 'pointer', background: `linear-gradient(135deg, rgba(${planCfg.glow},0.15) 0%, rgba(${planCfg.glow},0.05) 100%)`, border: `1px solid rgba(${planCfg.glow},0.3)`, boxShadow: `0 4px 20px rgba(${planCfg.glow},0.1), inset 0 1px 0 rgba(255,255,255,0.06)`, textAlign: 'center', transition: 'all 0.25s', position: 'relative', overflow: 'hidden', '&:hover': !upgradeLoading ? { transform: 'translateY(-2px)', boxShadow: `0 8px 32px rgba(${planCfg.glow},0.2), inset 0 1px 0 rgba(255,255,255,0.08)` } : {}, '&::before': { content: '""', position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)', animation: 'shimmer 3s infinite' } }}>
                  {upgradeLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <CircularProgress size={12} sx={{ color: planCfg.color }} />
                      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: planCfg.color }}>Opening Stripe...</Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography sx={{ fontSize: '12px', fontWeight: 800, color: planCfg.color, mb: 0.3, letterSpacing: '-0.01em' }}>⚡ Upgrade to {plan === 'free' ? 'Starter' : 'Pro'}</Typography>
                      <Typography sx={{ fontSize: '10px', color: `rgba(${planCfg.glow},0.5)` }}>Unlock all features</Typography>
                    </>
                  )}
                </Box>
              )}
              <Box sx={{ height: '1px', background: `linear-gradient(90deg, transparent, rgba(${planCfg.glow},0.15), transparent)`, mb: 1.5 }} />
              <Box onClick={handleLogout} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, justifyContent: isExpanded ? 'flex-start' : 'center', px: isExpanded ? 1.4 : 0, py: 0.9, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { background: 'rgba(239,68,68,0.08)', '& .logout-icon': { color: '#ef4444' }, '& .logout-text': { color: 'rgba(239,68,68,0.8)' } } }}>
                <LogoutIcon className="logout-icon" sx={{ fontSize: 15, color: 'rgba(255,255,255,0.2)', transition: 'color 0.2s', flexShrink: 0 }} />
                {isExpanded && <Typography className="logout-text" sx={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.25)', transition: 'color 0.2s' }}>Sign out</Typography>}
              </Box>
              {isExpanded && (
                <Box sx={{ mt: 1.5, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>v1.0.0 · Beta</Typography>
                </Box>
              )}
            </Box>

          </Box>
        </Box>

        {/* ── MAIN CONTENT ── */}
        <Box sx={{ flex: 1, color: '#fff', overflow: 'auto', transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)', '@media (max-width: 768px)': { paddingTop: '60px', paddingBottom: '70px' } }}>
          {children}
        </Box>

        <SupportWidget />
      </Box>
    </>
  );
};

export default AppShell;
