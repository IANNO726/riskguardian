import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Box, Typography, Grid, LinearProgress } from '@mui/material';
import { getRiskDashboard } from '../services/api';
import { useLiveTrades } from '../hooks/useLiveTrades';

import TerminalHUD from './TerminalHUD';
import TradeTape from './TradeTape';
import RiskAlarm from './RiskAlarm';
import EquityCurve from './EquityCurve';

/* ---------- Types ---------- */

interface RuleStatus {
  current: number;
  limit: number;
  status: string;
}

interface RiskData {
  account_balance: number;
  current_equity: number;
  daily_pnl: number;
  daily_pnl_percentage: number;
  risk_score: number;
  risk_level: string;
  active_positions: number;
  total_exposure: number;
  rules_status: Record<string, RuleStatus>;
}

/* ---------- Demo fallback ---------- */

const demoData: RiskData = {
  account_balance: 10000,
  current_equity: 10170,
  daily_pnl: 170,
  daily_pnl_percentage: 1.7,
  risk_score: 35,
  risk_level: 'Low',
  active_positions: 2,
  total_exposure: 1500,
  rules_status: {
    daily_loss_limit: { current: 1.7, limit: 2, status: 'safe' },
    max_drawdown: { current: 0, limit: 5, status: 'safe' },
    consecutive_losses: { current: 0, limit: 3, status: 'safe' }
  }
};

/* ---------- Animated counter ---------- */

const useAnimatedValue = (target: number, duration: number = 500) => {
  const [value, setValue] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    if (prev.current === target) return;

    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + diff * eased);

      if (progress < 1) requestAnimationFrame(animate);
      else prev.current = target;
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
};

/* ---------- Dashboard ---------- */

const RiskDashboard: React.FC = () => {
  const [riskData, setRiskData] = useState<RiskData>(demoData);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const equityHistory = useRef<number[]>([]);

  const {
    balance,
    equity,
    connected,
    latency,
    events,
    activePositions,
    dailyPnl,
    dailyPnlPct
  } = useLiveTrades();

  /* ---------- Fetch backend snapshot ---------- */

  useEffect(() => {
    fetchRiskData();
  }, []);

  useEffect(() => {
    if (balance !== null) setLastUpdate(new Date());
  }, [balance, equity]);

  const fetchRiskData = async () => {
    try {
      const response = await getRiskDashboard();
      setRiskData(response.data || demoData);
    } catch {
      setRiskData(demoData);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- LIVE values ---------- */

  const liveBalance = balance ?? riskData.account_balance;
  const liveEquity = equity ?? riskData.current_equity;
  const liveProfit = dailyPnl ?? riskData.daily_pnl;
  const liveProfitPct = dailyPnlPct ?? riskData.daily_pnl_percentage;
  const livePositions = activePositions ?? riskData.active_positions;

  /* ---------- Equity history buffer (performance safe) ---------- */

  useEffect(() => {
    if (!liveEquity) return;

    equityHistory.current.push(liveEquity);

    if (equityHistory.current.length > 200)
      equityHistory.current.shift();

  }, [liveEquity]);

  const curveData = useMemo(
    () => [...equityHistory.current],
    [liveEquity]
  );

  /* ---------- Animated ---------- */

  const animBalance = useAnimatedValue(liveBalance);
  const animEquity = useAnimatedValue(liveEquity);
  const animProfit = useAnimatedValue(liveProfit);

  if (loading) return <LinearProgress />;

  const riskScore = riskData.risk_score;
  const riskColor =
    riskScore < 40 ? '#00e676' :
    riskScore < 70 ? '#ffab40' :
    '#ff5252';

  /* ---------- UI ---------- */

  return (
    <Box sx={{
      minHeight: '100vh',
      p: 3,
      background: '#0b0b11',
      color: '#fff',
      fontFamily: 'monospace'
    }}>

      <Typography variant="h4" sx={{ mb: 1 }}>
        Trading Terminal
      </Typography>

      <Typography sx={{ mb: 2, opacity: 0.6 }}>
        Last update: {lastUpdate.toLocaleTimeString()}
      </Typography>

      {/* Connection Panel */}

      <Box sx={{
        mb: 3,
        p: 2,
        borderRadius: 2,
        background: connected ? 'rgba(0,230,118,0.08)' : 'rgba(255,82,82,0.08)',
        border: `1px solid ${connected ? '#00e676' : '#ff5252'}`
      }}>
        MT5: {connected ? '🟢 LIVE' : '🔴 DISCONNECTED'}
        {' '}| Latency: {latency ?? '--'} ms
      </Box>

      {/* Stats */}

      <Grid container spacing={2}>

        <Grid item xs={12} md={4}>
          <Box sx={{ p: 3, borderRadius: 2, background: '#151522' }}>
            Balance
            <Typography variant="h5">${animBalance.toFixed(2)}</Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ p: 3, borderRadius: 2, background: '#151522' }}>
            Equity
            <Typography variant="h5">${animEquity.toFixed(2)}</Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ p: 3, borderRadius: 2, background: '#151522' }}>
            Daily P&L
            <Typography
              variant="h5"
              sx={{ color: liveProfit >= 0 ? '#00e676' : '#ff5252' }}
            >
              ${animProfit.toFixed(2)} ({liveProfitPct.toFixed(2)}%)
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, borderRadius: 2, background: '#151522' }}>
            Active Positions
            <Typography variant="h3">{livePositions}</Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, borderRadius: 2, background: '#151522' }}>
            Risk Score
            <Typography variant="h4" sx={{ color: riskColor }}>
              {riskScore}/100
            </Typography>
          </Box>
        </Grid>

      </Grid>

      {/* Equity Curve */}

      <Box sx={{ mt: 3 }}>
        <EquityCurve data={curveData} />
      </Box>

      {/* Event Log */}

      <Box sx={{
        mt: 3,
        p: 2,
        borderRadius: 2,
        background: '#05050a',
        fontSize: 12,
        maxHeight: 150,
        overflow: 'auto'
      }}>
        {events.slice(-50).map((e, i) => (
          <div key={i}>{e}</div>
        ))}
      </Box>

      {/* Terminal Overlays */}

      <TerminalHUD profit={liveProfit} connected={connected} />
      <TradeTape events={events} />
      <RiskAlarm riskScore={riskScore} />

    </Box>
  );
};

export default RiskDashboard;



