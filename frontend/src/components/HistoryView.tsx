import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Typography, Grid, Chip, CircularProgress,
  useMediaQuery, useTheme, TextField, InputAdornment,
} from "@mui/material";
import axios from "axios";
import MobileHistory from './MobileHistory';
import { Search, TrendingUp, TrendingDown } from "@mui/icons-material";

interface Trade {
  ticket: number;
  symbol: string;
  volume: number;
  profit: number;
  time: string;
  type: string;
  price: number;
}

interface Stats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
}

// �”€�”€ Ring Progress �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const RingProgress: React.FC<{ value: number; color: string; size?: number }> = ({ value, color, size = 72 }) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '12px', fontWeight: 800, color, fontFamily: '"Roboto Mono",monospace' }}>
          {value.toFixed(0)}%
        </Typography>
      </Box>
    </Box>
  );
};

const HistoryView: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { calculateStats(); }, [trades, filter]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get("https://riskguardian.onrender.com/api/v1/trades/history");
      if (res.data.trades && Array.isArray(res.data.trades)) setTrades(res.data.trades);
      setLoading(false);
    } catch { setLoading(false); }
  };

  const filterTrades = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 864e5);
    const monthAgo = new Date(now.getTime() - 30 * 864e5);
    return trades.filter(t => {
      const d = new Date(t.time);
      if (filter === 'today') return d >= today;
      if (filter === 'week') return d >= weekAgo;
      if (filter === 'month') return d >= monthAgo;
      return true;
    });
  };

  const calculateStats = () => {
    const filtered = filterTrades();
    if (!filtered.length) { setStats(null); return; }
    const winning = filtered.filter(t => t.profit > 0);
    const losing = filtered.filter(t => t.profit < 0);
    const totalProfit = winning.reduce((s, t) => s + t.profit, 0);
    const totalLoss = Math.abs(losing.reduce((s, t) => s + t.profit, 0));
    setStats({
      totalTrades: filtered.length,
      winningTrades: winning.length,
      losingTrades: losing.length,
      totalProfit, totalLoss,
      netProfit: filtered.reduce((s, t) => s + t.profit, 0),
      winRate: (winning.length / filtered.length) * 100,
      avgWin: winning.length > 0 ? totalProfit / winning.length : 0,
      avgLoss: losing.length > 0 ? totalLoss / losing.length : 0,
      largestWin: winning.length > 0 ? Math.max(...winning.map(t => t.profit)) : 0,
      largestLoss: losing.length > 0 ? Math.min(...losing.map(t => t.profit)) : 0,
    });
  };

  const filteredTrades = useMemo(() => {
    let list = filterTrades();
    if (search.trim()) list = list.filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()) || String(t.ticket).includes(search));
    return [...list].sort((a, b) => sortDir === 'desc' ? new Date(b.time).getTime() - new Date(a.time).getTime() : new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [trades, filter, search, sortDir]);

  if (isMobile) return <MobileHistory />;

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0b1120', gap: 2 }}>
      <CircularProgress sx={{ color: '#38bdf8' }} size={48} />
      <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>Loading trade history...</Typography>
    </Box>
  );

  const winPct = stats ? stats.winRate : 0;
  const pfColor = stats && stats.totalLoss > 0 ? (stats.totalProfit / stats.totalLoss >= 2 ? '#22c55e' : stats.totalProfit / stats.totalLoss >= 1 ? '#fbbf24' : '#ef4444') : '#22c55e';

  return (
    <Box sx={{
      minHeight: '100vh',
      p: { xs: 2, sm: 3, md: 4 },
      background: 'radial-gradient(ellipse at 10% 0%,rgba(56,189,248,0.07),transparent 45%), radial-gradient(ellipse at 90% 10%,rgba(168,85,247,0.06),transparent 45%), radial-gradient(ellipse at 50% 100%,rgba(34,197,94,0.05),transparent 50%), #0b1120',
      color: 'white',
    }}>

      {/* �”€�”€ Header �”€�”€ */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 3, md: 4 }, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 4, height: 32, borderRadius: 2, background: 'linear-gradient(180deg,#a855f7,#38bdf8)' }} />
            <Typography sx={{ fontSize: { xs: '22px', md: '30px' }, fontWeight: 800, background: 'linear-gradient(90deg,#a855f7,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
              Trade History
            </Typography>
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', ml: '20px' }}>
            Closed MT5 positions �€� {trades.length} total records
          </Typography>
        </Box>

        {/* Filter Pills */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'today', 'week', 'month'] as const).map((f) => {
            const active = filter === f;
            const labels: Record<string, string> = { all: 'All Time', today: 'Today', week: '7 Days', month: '30 Days' };
            return (
              <Box key={f} onClick={() => setFilter(f)}
                sx={{ px: 2.5, py: 1, borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', letterSpacing: '0.05em', transition: 'all 0.2s', userSelect: 'none',
                  background: active ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#a855f7' : 'rgba(255,255,255,0.45)',
                  border: `1px solid ${active ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: active ? '0 0 16px rgba(168,85,247,0.25)' : 'none',
                  '&:hover': { background: active ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.07)' },
                }}>
                {labels[f]}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* �”€�”€ KPI Cards �”€�”€ */}
      {stats ? (
        <Grid container spacing={{ xs: 1.5, md: 2.5 }} sx={{ mb: { xs: 3, md: 4 } }}>

          {/* Net P&L */}
          <Grid item xs={12} sm={6} xl={3}>
            <Box sx={{ p: 3, borderRadius: '20px', background: stats.netProfit >= 0 ? 'linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.03))' : 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.03))', border: `1px solid ${stats.netProfit >= 0 ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`, position: 'relative', overflow: 'hidden', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 16px 40px ${stats.netProfit >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }, '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${stats.netProfit >= 0 ? '#22c55e' : '#ef4444'},transparent)` } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Net P&L</Typography>
                  <Typography sx={{ fontSize: { xs: '26px', md: '30px' }, fontWeight: 800, color: stats.netProfit >= 0 ? '#22c55e' : '#ef4444', fontFamily: '"Roboto Mono",monospace', lineHeight: 1 }}>
                    {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.8 }}>
                    {stats.netProfit >= 0 ? <TrendingUp sx={{ fontSize: 13, color: '#22c55e' }} /> : <TrendingDown sx={{ fontSize: 13, color: '#ef4444' }} />}
                    <Typography sx={{ fontSize: '11px', color: stats.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                      Profit: ${stats.totalProfit.toFixed(2)} �€� Loss: ${stats.totalLoss.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ width: 42, height: 42, borderRadius: '12px', background: stats.netProfit >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${stats.netProfit >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                  {stats.netProfit >= 0 ? '�Ÿ’�' : '�Ÿ’�'}
                </Box>
              </Box>
              {/* P&L bar */}
              <Box sx={{ mt: 2.5, display: 'flex', gap: 0.5, height: 5, borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ flex: stats.totalProfit, background: 'linear-gradient(90deg,#16a34a,#22c55e)', borderRadius: 3 }} />
                <Box sx={{ flex: stats.totalLoss, background: 'linear-gradient(90deg,#dc2626,#ef4444)', borderRadius: 3 }} />
              </Box>
            </Box>
          </Grid>

          {/* Win Rate */}
          <Grid item xs={12} sm={6} xl={3}>
            <Box sx={{ p: 3, borderRadius: '20px', background: 'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(168,85,247,0.03))', border: '1px solid rgba(168,85,247,0.2)', position: 'relative', overflow: 'hidden', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 40px rgba(168,85,247,0.15)' }, '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#a855f7,transparent)' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>Win Rate</Typography>
                  <Typography sx={{ fontSize: { xs: '26px', md: '30px' }, fontWeight: 800, color: winPct >= 50 ? '#22c55e' : '#f59e0b', fontFamily: '"Roboto Mono",monospace', lineHeight: 1, mb: 1 }}>{winPct.toFixed(1)}%</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ px: 1.5, py: 0.4, borderRadius: '6px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>{stats.winningTrades}W</Typography>
                    </Box>
                    <Box sx={{ px: 1.5, py: 0.4, borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>{stats.losingTrades}L</Typography>
                    </Box>
                    <Box sx={{ px: 1.5, py: 0.4, borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{stats.totalTrades}T</Typography>
                    </Box>
                  </Box>
                </Box>
                <RingProgress value={winPct} color={winPct >= 50 ? '#22c55e' : '#f59e0b'} size={80} />
              </Box>
            </Box>
          </Grid>

          {/* Largest Win */}
          <Grid item xs={12} sm={6} xl={3}>
            <Box sx={{ p: 3, borderRadius: '20px', background: 'linear-gradient(135deg,rgba(56,189,248,0.08),rgba(56,189,248,0.03))', border: '1px solid rgba(56,189,248,0.18)', position: 'relative', overflow: 'hidden', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 40px rgba(56,189,248,0.12)' }, '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#38bdf8,transparent)' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Largest Win</Typography>
                  <Typography sx={{ fontSize: { xs: '26px', md: '30px' }, fontWeight: 800, color: '#22c55e', fontFamily: '"Roboto Mono",monospace', lineHeight: 1 }}>+${stats.largestWin.toFixed(2)}</Typography>
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Avg Win</Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#22c55e', fontFamily: '"Roboto Mono",monospace' }}>+${stats.avgWin.toFixed(2)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>�Ÿ�†</Box>
              </Box>
            </Box>
          </Grid>

          {/* Largest Loss */}
          <Grid item xs={12} sm={6} xl={3}>
            <Box sx={{ p: 3, borderRadius: '20px', background: 'linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.03))', border: '1px solid rgba(239,68,68,0.18)', position: 'relative', overflow: 'hidden', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 40px rgba(239,68,68,0.12)' }, '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,#ef4444,transparent)' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Largest Loss</Typography>
                  <Typography sx={{ fontSize: { xs: '26px', md: '30px' }, fontWeight: 800, color: '#ef4444', fontFamily: '"Roboto Mono",monospace', lineHeight: 1 }}>${stats.largestLoss.toFixed(2)}</Typography>
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Avg Loss</Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#ef4444', fontFamily: '"Roboto Mono",monospace' }}>-${stats.avgLoss.toFixed(2)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>�š�</Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      ) : (
        /* Empty stats placeholder */
        <Box sx={{ mb: 4, p: 2.5, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: '22px' }}>�Ÿ“Š</Typography>
          <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>No trades found for the selected period</Typography>
        </Box>
      )}

      {/* �”€�”€ Trades Table �”€�”€ */}
      <Box sx={{ borderRadius: '24px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        {/* Table Header Bar */}
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3, pb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(168,85,247,0.03)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>�Ÿ“œ</Box>
            <Box>
              <Typography sx={{ fontSize: '16px', fontWeight: 700 }}>Closed Trades</Typography>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{filteredTrades.length} records</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search symbol or ticket..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} /></InputAdornment>,
                sx: { color: 'white', fontSize: '13px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: 'rgba(168,85,247,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#a855f7' } }
              }}
              sx={{ width: { xs: '100%', sm: 220 } }}
            />
            {/* Sort toggle */}
            <Box onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              sx={{ px: 2, py: 1, borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, transition: 'all 0.2s', '&:hover': { background: 'rgba(255,255,255,0.1)' } }}>
              {sortDir === 'desc' ? '�†“' : '�†‘'} Date
            </Box>
          </Box>
        </Box>

        {filteredTrades.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '52px', opacity: 0.15, mb: 2 }}>�Ÿ“�</Typography>
            <Typography sx={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', mb: 0.5 }}>No trades found</Typography>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.2)' }}>{search ? 'Try a different search term' : 'Close some positions to see them here'}</Typography>
          </Box>
        ) : (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {/* Column Headers */}
            <Grid container sx={{ px: 2, mb: 1.5, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: '#Ticket', xs: 2 },
                { label: 'Symbol', xs: 2.5 },
                { label: 'Type', xs: 1.5 },
                { label: 'Volume', xs: 1.5 },
                { label: 'Date & Time', xs: 2.5 },
                { label: 'P / L', xs: 2, align: 'right' as const },
              ].map(col => (
                <Grid item xs={col.xs} key={col.label}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: col.align || 'left' }}>
                    {col.label}
                  </Typography>
                </Grid>
              ))}
            </Grid>

            {/* Rows */}
            {filteredTrades.map((trade, idx) => {
              const isBuy = trade.type.toLowerCase().includes('buy');
              const isWin = trade.profit >= 0;
              return (
                <Box key={trade.ticket}
                  sx={{
                    display: 'flex', alignItems: 'center', px: 2, py: 2, borderRadius: '14px', mb: 1,
                    background: isWin ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
                    border: `1px solid ${isWin ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}`,
                    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                    '&:hover': {
                      background: isWin ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${isWin ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      transform: 'translateX(6px) scale(1.005)',
                      boxShadow: `0 4px 20px ${isWin ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}`,
                    }
                  }}>
                  <Grid container alignItems="center">
                    {/* Ticket */}
                    <Grid item xs={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: isWin ? '#22c55e' : '#ef4444', boxShadow: `0 0 6px ${isWin ? '#22c55e' : '#ef4444'}`, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: '"Roboto Mono",monospace' }}>#{trade.ticket}</Typography>
                      </Box>
                    </Grid>

                    {/* Symbol */}
                    <Grid item xs={2.5}>
                      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', letterSpacing: '0.02em' }}>{trade.symbol}</Typography>
                      <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono",monospace' }}>@ {trade.price?.toFixed(2) ?? '�€”'}</Typography>
                    </Grid>

                    {/* Type */}
                    <Grid item xs={1.5}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: '8px', background: isBuy ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${isBuy ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}` }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 800, color: isBuy ? '#22c55e' : '#ef4444', letterSpacing: '0.05em' }}>
                          {isBuy ? '�–�' : '�–�'} {trade.type}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Volume */}
                    <Grid item xs={1.5}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', fontFamily: '"Roboto Mono",monospace' }}>{trade.volume}</Typography>
                      <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>lots</Typography>
                    </Grid>

                    {/* Date */}
                    <Grid item xs={2.5}>
                      <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', fontFamily: '"Roboto Mono",monospace' }}>
                        {new Date(trade.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono",monospace' }}>
                        {new Date(trade.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Grid>

                    {/* P&L */}
                    <Grid item xs={2} sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '18px', fontWeight: 800, color: isWin ? '#22c55e' : '#ef4444', fontFamily: '"Roboto Mono",monospace', lineHeight: 1 }}>
                        {isWin ? '+' : ''}${trade.profit.toFixed(2)}
                      </Typography>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, mt: 0.5, px: 1.2, py: 0.3, borderRadius: '6px', background: isWin ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                        <Typography sx={{ fontSize: '9px', fontWeight: 800, color: isWin ? '#22c55e' : '#ef4444', letterSpacing: '0.08em' }}>
                          {isWin ? '�–� WIN' : '�–� LOSS'}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              );
            })}

            {/* Table Footer Summary */}
            {stats && filteredTrades.length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, px: 2 }}>
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                  Showing {filteredTrades.length} of {trades.length} trades
                </Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box>
                    <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Profit</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#22c55e', fontFamily: '"Roboto Mono",monospace' }}>+${stats.totalProfit.toFixed(2)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Loss</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#ef4444', fontFamily: '"Roboto Mono",monospace' }}>-${stats.totalLoss.toFixed(2)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Net</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: stats.netProfit >= 0 ? '#22c55e' : '#ef4444', fontFamily: '"Roboto Mono",monospace' }}>
                      {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap');
        input::placeholder { color: rgba(255,255,255,0.25) !important; }
      `}</style>
    </Box>
  );
};

export default HistoryView;




