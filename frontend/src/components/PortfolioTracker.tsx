/**
 * PortfolioTracker.tsx
 * --------------------
 * Portfolio exposure tracker + margin calculator.
 * Shows combined risk of all open positions, currency exposure,
 * correlation warnings, and margin requirements.
 *
 * Can be added to the main dashboard or Risk Check page.
 * Place in: src/components/PortfolioTracker.tsx
 */

import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Chip, Button, TextField, IconButton,
  Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Card, CardContent, Collapse,
} from '@mui/material';
import { Add, Delete, Calculate, ExpandMore, ExpandLess, Warning } from '@mui/icons-material';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com/api/v1';

interface Position {
  id:            string;
  symbol:        string;
  direction:     'buy' | 'sell';
  lots:          number | string;
  entry:         number | string;
  sl:            number | string;
  tp:            number | string;
  current_price: number | string;
}

interface PositionDetail {
  symbol:         string;
  direction:      string;
  lots:           number;
  entry:          number;
  sl:             number | null;
  tp:             number | null;
  pip_value:      number;
  risk_dollar:    number;
  reward_dollar:  number;
  rr:             number | null;
  risk_pct:       number;
  margin_usd:     number;
  unrealised_pnl: number;
}

interface AnalysisResult {
  position_count:         number;
  account_balance:        number;
  leverage:               number;
  total_risk_dollar:      number;
  total_risk_pct:         number;
  risk_status:            string;
  risk_color:             string;
  total_margin_usd:       number;
  margin_level_pct:       number;
  free_margin:            number;
  total_potential_reward: number;
  portfolio_rr:           number | null;
  positions:              PositionDetail[];
  correlation_warnings:   Array<{ pair_a: string; pair_b: string; correlation: number; risk_label: string; note: string }>;
  currency_exposure:      Array<{ currency: string; net_usd: number; direction: string }>;
  flags:                  Array<{ type: string; msg: string }>;
}

const emptyPosition = (): Position => ({
  id:            crypto.randomUUID?.() || `pos_${Date.now()}`,
  symbol:        '',
  direction:     'buy',
  lots:          '',
  entry:         '',
  sl:            '',
  tp:            '',
  current_price: '',
});

const POPULAR_PAIRS = [
  'EURUSD','GBPUSD','USDJPY','XAUUSD','GBPJPY','EURJPY','AUDUSD','USDCAD','USDCHF',
  'NZDUSD','CHFJPY','EURGBP','EURAUD','AUDJPY','CADJPY',
];

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white', background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#a855f7' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)', fontSize: '13px' },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
};

const PortfolioTracker: React.FC = () => {
  const [positions,   setPositions]   = useState<Position[]>([emptyPosition()]);
  const [balance,     setBalance]     = useState<string>('10000');
  const [leverage,    setLeverage]    = useState<string>('100');
  const [result,      setResult]      = useState<AnalysisResult | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Margin calculator state (standalone)
  const [marginSymbol,   setMarginSymbol]   = useState('EURUSD');
  const [marginLots,     setMarginLots]     = useState('1.0');
  const [marginEntry,    setMarginEntry]    = useState('1.085');
  const [marginLeverage, setMarginLeverage] = useState('100');
  const [marginResult,   setMarginResult]   = useState<any>(null);
  const [marginLoading,  setMarginLoading]  = useState(false);

  const addPosition = () => setPositions(p => [...p, emptyPosition()]);

  const removePosition = (id: string) =>
    setPositions(p => p.filter(x => x.id !== id));

  const updatePosition = (id: string, field: keyof Position, value: string) =>
    setPositions(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));

  const analyze = useCallback(async () => {
    const validPositions = positions.filter(p => p.symbol && p.lots && p.entry);
    if (validPositions.length === 0) {
      setError('Add at least one complete position (symbol, lots, entry)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        positions: validPositions.map(p => ({
          symbol:        p.symbol,
          direction:     p.direction,
          lots:          parseFloat(String(p.lots)) || 0.01,
          entry:         parseFloat(String(p.entry)) || 1,
          sl:            p.sl ? parseFloat(String(p.sl)) : null,
          tp:            p.tp ? parseFloat(String(p.tp)) : null,
          current_price: p.current_price ? parseFloat(String(p.current_price)) : null,
        })),
        account_balance: parseFloat(balance) || 10000,
        leverage:        parseInt(leverage) || 100,
      };
      const resp = await axios.post(`${API}/portfolio/analyze`, payload);
      setResult(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [positions, balance, leverage]);

  const calcMargin = async () => {
    setMarginLoading(true);
    try {
      const resp = await axios.get(`${API}/portfolio/margin`, {
        params: { symbol: marginSymbol, lots: parseFloat(marginLots), entry: parseFloat(marginEntry), leverage: parseInt(marginLeverage) },
      });
      setMarginResult(resp.data);
    } catch {}
    setMarginLoading(false);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 0 } }}>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '22px', fontWeight: 800, color: 'white', mb: 0.5 }}>
          Portfolio Exposure Tracker
        </Typography>
        <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
          Combined risk, margin, and correlation analysis for all open positions
        </Typography>
      </Box>

      {/* Account settings row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="Account Balance ($)"
          value={balance}
          onChange={e => setBalance(e.target.value)}
          type="number"
          sx={{ ...inputSx, width: 200 }}
          inputProps={{ step: 'any' }}
          size="small"
        />
        <FormControl sx={{ ...inputSx, width: 140 }} size="small">
          <InputLabel>Leverage</InputLabel>
          <Select value={leverage} label="Leverage" onChange={e => setLeverage(e.target.value)} sx={{ color: 'white' }}>
            {['10','20','30','50','100','200','400','500'].map(l => (
              <MenuItem key={l} value={l} sx={{ background: '#0f172a', color: 'white' }}>1:{l}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Positions */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Open Positions ({positions.length})
          </Typography>
          <Button
            onClick={addPosition}
            startIcon={<Add />}
            size="small"
            sx={{ borderRadius: '10px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', textTransform: 'none', fontWeight: 600 }}
          >
            Add Position
          </Button>
        </Box>

        {positions.map((pos, idx) => (
          <Box
            key={pos.id}
            sx={{ mb: 1.5, p: 2, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                Position {idx + 1}
              </Typography>
              {positions.length > 1 && (
                <IconButton size="small" onClick={() => removePosition(pos.id)} sx={{ ml: 'auto', color: 'rgba(239,68,68,0.5)', p: 0.3, '&:hover': { color: '#ef4444' } }}>
                  <Delete sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {/* Symbol */}
              <Box sx={{ minWidth: 140 }}>
                <TextField
                  label="Symbol"
                  value={pos.symbol}
                  onChange={e => updatePosition(pos.id, 'symbol', e.target.value.toUpperCase())}
                  size="small"
                  placeholder="EURUSD"
                  sx={{ ...inputSx, width: '100%' }}
                  inputProps={{ list: `pairs_${pos.id}` }}
                />
                <datalist id={`pairs_${pos.id}`}>
                  {POPULAR_PAIRS.map(p => <option key={p} value={p} />)}
                </datalist>
              </Box>

              {/* Direction */}
              <FormControl sx={{ ...inputSx, minWidth: 100 }} size="small">
                <InputLabel>Dir</InputLabel>
                <Select value={pos.direction} label="Dir" onChange={e => updatePosition(pos.id, 'direction', e.target.value)} sx={{ color: pos.direction === 'buy' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                  <MenuItem value="buy"  sx={{ background: '#0f172a', color: '#22c55e', fontWeight: 700 }}>â–² BUY</MenuItem>
                  <MenuItem value="sell" sx={{ background: '#0f172a', color: '#ef4444', fontWeight: 700 }}>â–¼ SELL</MenuItem>
                </Select>
              </FormControl>

              {/* Lots */}
              <TextField label="Lots" value={pos.lots} onChange={e => updatePosition(pos.id, 'lots', e.target.value)} size="small" type="number" sx={{ ...inputSx, width: 90 }} inputProps={{ step: 'any' }} />

              {/* Entry */}
              <TextField label="Entry" value={pos.entry} onChange={e => updatePosition(pos.id, 'entry', e.target.value)} size="small" type="number" sx={{ ...inputSx, width: 120 }} inputProps={{ step: 'any' }} />

              {/* SL */}
              <TextField label="Stop Loss" value={pos.sl} onChange={e => updatePosition(pos.id, 'sl', e.target.value)} size="small" type="number" sx={{ ...inputSx, width: 120 }} inputProps={{ step: 'any' }} />

              {/* TP */}
              <TextField label="Take Profit" value={pos.tp} onChange={e => updatePosition(pos.id, 'tp', e.target.value)} size="small" type="number" sx={{ ...inputSx, width: 120 }} inputProps={{ step: 'any' }} />

              {/* Current price */}
              <TextField label="Current Price" value={pos.current_price} onChange={e => updatePosition(pos.id, 'current_price', e.target.value)} size="small" type="number" sx={{ ...inputSx, width: 130 }} inputProps={{ step: 'any' }} />
            </Box>
          </Box>
        ))}
      </Box>

      {error && (
        <Box sx={{ p: 1.5, mb: 2, borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <Typography sx={{ fontSize: '13px', color: '#ef4444' }}>âš  {error}</Typography>
        </Box>
      )}

      <Button
        onClick={analyze}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} /> : <Calculate />}
        fullWidth
        sx={{ mb: 3, py: 1.5, borderRadius: '14px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontWeight: 700, textTransform: 'none', fontSize: '15px' }}
      >
        {loading ? 'Analysingâ€¦' : 'Analyze Portfolio'}
      </Button>

      {/* Results */}
      {result && <PortfolioResults result={result} showDetails={showDetails} onToggleDetails={() => setShowDetails(v => !v)} />}

      {/* â”€â”€ Margin Calculator (standalone) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Box sx={{ mt: 4, borderRadius: '18px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', p: 2.5 }}>
        <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.5 }}>ðŸ§® Margin Calculator</Typography>
        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', mb: 2 }}>
          Calculate the margin required for a single position
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ minWidth: 140 }}>
            <TextField label="Symbol" value={marginSymbol} onChange={e => setMarginSymbol(e.target.value.toUpperCase())} size="small" sx={{ ...inputSx, width: '100%' }} inputProps={{ list: 'margin_pairs' }} />
            <datalist id="margin_pairs">{POPULAR_PAIRS.map(p => <option key={p} value={p} />)}</datalist>
          </Box>
          <TextField label="Lots" value={marginLots} onChange={e => setMarginLots(e.target.value)} size="small" type="number" sx={{ ...inputSx, width: 90 }} inputProps={{ step: 'any' }} />
          <TextField label="Entry Price" value={marginEntry} onChange={e => setMarginEntry(e.target.value)} size="small" type="number" sx={{ ...inputSx, width: 130 }} inputProps={{ step: 'any' }} />
          <FormControl sx={{ ...inputSx, width: 120 }} size="small">
            <InputLabel>Leverage</InputLabel>
            <Select value={marginLeverage} label="Leverage" onChange={e => setMarginLeverage(e.target.value)} sx={{ color: 'white' }}>
              {['10','20','30','50','100','200','400','500'].map(l => (
                <MenuItem key={l} value={l} sx={{ background: '#0f172a', color: 'white' }}>1:{l}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            onClick={calcMargin}
            disabled={marginLoading}
            startIcon={marginLoading ? <CircularProgress size={14} /> : <Calculate />}
            sx={{ borderRadius: '12px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 600, textTransform: 'none', px: 2.5, whiteSpace: 'nowrap' }}
          >
            Calculate
          </Button>
        </Box>

        {marginResult && (
          <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>MARGIN REQUIRED</Typography>
                <Typography sx={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                  ${marginResult.margin_required?.toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>PIP VALUE</Typography>
                <Typography sx={{ fontSize: '22px', fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
                  ${marginResult.pip_value_usd?.toFixed(4)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>NOTIONAL</Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                  ${marginResult.notional_usd?.toLocaleString()}
                </Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', mt: 1.5 }}>
              {marginResult.note}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};


// â”€â”€ Portfolio results component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PortfolioResults: React.FC<{
  result: AnalysisResult;
  showDetails: boolean;
  onToggleDetails: () => void;
}> = ({ result, showDetails, onToggleDetails }) => {
  const {
    total_risk_dollar, total_risk_pct, risk_status, risk_color,
    total_margin_usd, margin_level_pct, free_margin,
    total_potential_reward, portfolio_rr,
    positions, correlation_warnings, currency_exposure, flags,
    account_balance,
  } = result;

  return (
    <Box>
      {/* Flags */}
      {flags.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {flags.map((flag, i) => {
            const colors: Record<string, string> = { danger: '#ef4444', warning: '#f59e0b', info: '#38bdf8' };
            const color = colors[flag.type] || '#38bdf8';
            return (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 1, borderRadius: '10px', background: `${color}0c`, border: `1px solid ${color}28` }}>
                <Warning sx={{ color, fontSize: 16, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{flag.msg}</Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Main stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 2, mb: 3 }}>
        {[
          { label: 'Total Risk', value: `$${total_risk_dollar.toFixed(2)}`, sub: `${total_risk_pct.toFixed(2)}% of balance`, color: risk_color },
          { label: 'Risk Status', value: risk_status, sub: `${result.position_count} positions`, color: risk_color },
          { label: 'Margin Used', value: `$${total_margin_usd.toFixed(0)}`, sub: `${margin_level_pct}% margin level`, color: margin_level_pct < 200 ? '#ef4444' : '#22c55e' },
          { label: 'Free Margin', value: `$${free_margin.toFixed(0)}`, sub: `of $${account_balance.toLocaleString()}`, color: free_margin > 0 ? '#22c55e' : '#ef4444' },
          { label: 'Max Reward', value: `$${total_potential_reward.toFixed(2)}`, sub: portfolio_rr ? `Portfolio RR ${portfolio_rr}:1` : 'Set TPs for RR', color: '#a855f7' },
        ].map((stat, i) => (
          <Box key={i} sx={{ p: 2, borderRadius: '14px', background: `${stat.color}08`, border: `1px solid ${stat.color}20` }}>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 0.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>{stat.label}</Typography>
            <Typography sx={{ fontSize: '20px', fontWeight: 800, color: stat.color, fontFamily: 'monospace', lineHeight: 1.2 }}>{stat.value}</Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', mt: 0.3 }}>{stat.sub}</Typography>
          </Box>
        ))}
      </Box>

      {/* Currency exposure */}
      {currency_exposure.length > 0 && (
        <Box sx={{ mb: 3, p: 2, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', mb: 1.5 }}>
            Currency Exposure (Net USD)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {currency_exposure.map((exp, i) => (
              <Chip
                key={i}
                label={`${exp.currency} ${exp.direction} $${Math.abs(exp.net_usd).toLocaleString()}`}
                size="small"
                sx={{ background: exp.direction === 'LONG' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: exp.direction === 'LONG' ? '#22c55e' : '#ef4444', border: `1px solid ${exp.direction === 'LONG' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, fontWeight: 600 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Correlation warnings */}
      {correlation_warnings.length > 0 && (
        <Box sx={{ mb: 3, p: 2, borderRadius: '14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.08em', mb: 1.5 }}>
            âš¡ Correlation Warnings
          </Typography>
          {correlation_warnings.slice(0, 5).map((warn, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, p: 1.5, borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Chip label={`${warn.pair_a} ${warn.dir_a}`} size="small" sx={{ height: 22, fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>+</Typography>
                <Chip label={`${warn.pair_b} ${warn.dir_b}`} size="small" sx={{ height: 22, fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'white' }} />
              </Box>
              <Typography sx={{ fontSize: '12px', color: warn.risk_label.includes('HIGH') ? '#ef4444' : warn.risk_label.includes('MODERATE') ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                {warn.risk_label}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', ml: 'auto' }}>
                corr: {warn.correlation > 0 ? '+' : ''}{warn.correlation.toFixed(2)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Per-position details (collapsible) */}
      <Box sx={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }} onClick={onToggleDetails}>
          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
            Position Details
          </Typography>
          <IconButton size="small" sx={{ ml: 'auto', color: 'rgba(255,255,255,0.3)' }}>
            {showDetails ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
          </IconButton>
        </Box>
        <Collapse in={showDetails}>
          {positions.map((pos, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2, borderTop: '1px solid rgba(255,255,255,0.05)', '&:hover': { background: 'rgba(255,255,255,0.015)' } }}>
              <Box sx={{ minWidth: 100 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{pos.symbol}</Typography>
                <Chip label={pos.direction} size="small" sx={{ height: 20, fontSize: '11px', fontWeight: 700, mt: 0.3, background: pos.direction === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: pos.direction === 'BUY' ? '#22c55e' : '#ef4444', border: `1px solid ${pos.direction === 'BUY' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }} />
              </Box>
              {[
                { label: 'Lots', value: pos.lots },
                { label: 'Risk $', value: `$${pos.risk_dollar?.toFixed(2)}`, color: '#ef4444' },
                { label: 'Risk %', value: `${pos.risk_pct?.toFixed(3)}%`, color: pos.risk_pct > 2 ? '#ef4444' : '#22c55e' },
                { label: 'Margin', value: `$${pos.margin_usd?.toFixed(0)}` },
                { label: 'Pip Val', value: `$${pos.pip_value?.toFixed(4)}` },
                { label: 'Unrealised', value: pos.unrealised_pnl !== 0 ? `${pos.unrealised_pnl >= 0 ? '+' : ''}$${pos.unrealised_pnl?.toFixed(2)}` : 'â€”', color: pos.unrealised_pnl >= 0 ? '#22c55e' : '#ef4444' },
                { label: 'RR', value: pos.rr ? `${pos.rr}:1` : 'â€”', color: pos.rr && pos.rr >= 2 ? '#22c55e' : pos.rr && pos.rr >= 1 ? '#f59e0b' : '#ef4444' },
              ].map((stat, si) => (
                <Box key={si} sx={{ minWidth: 70 }}>
                  <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', mb: 0.3 }}>{stat.label}</Typography>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: stat.color || 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{stat.value}</Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Collapse>
      </Box>
    </Box>
  );
};

export default PortfolioTracker;

