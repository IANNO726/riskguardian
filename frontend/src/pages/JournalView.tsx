import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Grid, Avatar, CircularProgress, Select, MenuItem, FormControl, InputLabel,
  Collapse, Tooltip,
} from '@mui/material';
import {
  Add, Edit, Delete, Close, OpenInNew,
  Psychology, AutoAwesome, Refresh, ShowChart, Lock,
  ExpandMore, ExpandLess, WarningAmberRounded, CheckCircleOutline, ErrorOutline,
} from '@mui/icons-material';
import axios from 'axios';
import { usePlan, startCheckout } from '../hooks/usePlan';

const API = 'https://riskguardian.onrender.com/api/v1';
const RISKGUARDIAN_TEMPLATE = 'https://riskguardian.io/journal-template';

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// Robust date parser
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const parseDateSafe = (raw: string | null | undefined): Date | null => {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === 'null' || s === 'undefined') return null;

  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct;

  const mt5Full = s.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (mt5Full) {
    const [, yr, mo, dy, hr, mn, sc] = mt5Full;
    return new Date(`${yr}-${mo}-${dy}T${hr}:${mn}:${sc}`);
  }
  const mt5Date = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (mt5Date) {
    const [, yr, mo, dy] = mt5Date;
    return new Date(`${yr}-${mo}-${dy}`);
  }
  const slashFull = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (slashFull) {
    const [, dd, mm, yr, hr, mn, sc] = slashFull;
    return new Date(`${yr}-${mm}-${dd}T${hr}:${mn}:${sc}`);
  }
  const slashDate = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashDate) {
    const [, dd, mm, yr] = slashDate;
    return new Date(`${yr}-${mm}-${dd}`);
  }
  if (/^\d{9,13}$/.test(s)) {
    const n = parseInt(s, 10);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  return null;
};

const fmt = (raw: string | null | undefined): string => {
  const d = parseDateSafe(raw);
  if (!d) return 'Invalid Date';
  try {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '�€”'; }
};

const fmtFull = (raw: string | null | undefined): string => {
  const d = parseDateSafe(raw);
  if (!d) return '';
  try {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// Symbol mapper
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
interface SymbolInfo {
  useDerivChart: boolean;
  derivSymbol:   string;
  tvSymbol:      string;
  label:         string;
  isKnown:       boolean;
}

const mapSymbol = (raw: string): SymbolInfo => {
  if (!raw) return { useDerivChart: false, derivSymbol: '', tvSymbol: 'FX:EURUSD', label: 'EURUSD', isKnown: true };

  const s = raw.toUpperCase().trim().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ');
  const clean = s.replace(/[^A-Z0-9]/g, '');

  const derivSynthetics: Record<string, { code: string; label: string }> = {
    'VOLATILITY 10 INDEX':       { code: 'R_10',    label: 'Volatility 10 Index' },
    'VOLATILITY 25 INDEX':       { code: 'R_25',    label: 'Volatility 25 Index' },
    'VOLATILITY 50 INDEX':       { code: 'R_50',    label: 'Volatility 50 Index' },
    'VOLATILITY 75 INDEX':       { code: 'R_75',    label: 'Volatility 75 Index' },
    'VOLATILITY 100 INDEX':      { code: 'R_100',   label: 'Volatility 100 Index' },
    'VOLATILITY 10 (1S) INDEX':  { code: '1HZ10V',  label: 'Volatility 10 (1s) Index' },
    'VOLATILITY 25 (1S) INDEX':  { code: '1HZ25V',  label: 'Volatility 25 (1s) Index' },
    'VOLATILITY 50 (1S) INDEX':  { code: '1HZ50V',  label: 'Volatility 50 (1s) Index' },
    'VOLATILITY 75 (1S) INDEX':  { code: '1HZ75V',  label: 'Volatility 75 (1s) Index' },
    'VOLATILITY 100 (1S) INDEX': { code: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    'V10':  { code: 'R_10',  label: 'Volatility 10 Index' },
    'V25':  { code: 'R_25',  label: 'Volatility 25 Index' },
    'V50':  { code: 'R_50',  label: 'Volatility 50 Index' },
    'V75':  { code: 'R_75',  label: 'Volatility 75 Index' },
    'V100': { code: 'R_100', label: 'Volatility 100 Index' },
    'JUMP 10 INDEX':  { code: 'JD10',  label: 'Jump 10 Index' },
    'JUMP 25 INDEX':  { code: 'JD25',  label: 'Jump 25 Index' },
    'JUMP 50 INDEX':  { code: 'JD50',  label: 'Jump 50 Index' },
    'JUMP 75 INDEX':  { code: 'JD75',  label: 'Jump 75 Index' },
    'JUMP 100 INDEX': { code: 'JD100', label: 'Jump 100 Index' },
    'JUMP10INDEX':    { code: 'JD10',  label: 'Jump 10 Index' },
    'JUMP25INDEX':    { code: 'JD25',  label: 'Jump 25 Index' },
    'JUMP50INDEX':    { code: 'JD50',  label: 'Jump 50 Index' },
    'JUMP75INDEX':    { code: 'JD75',  label: 'Jump 75 Index' },
    'JUMP100INDEX':   { code: 'JD100', label: 'Jump 100 Index' },
    'JD10':  { code: 'JD10',  label: 'Jump 10 Index' },
    'JD25':  { code: 'JD25',  label: 'Jump 25 Index' },
    'JD50':  { code: 'JD50',  label: 'Jump 50 Index' },
    'JD75':  { code: 'JD75',  label: 'Jump 75 Index' },
    'JD100': { code: 'JD100', label: 'Jump 100 Index' },
    'CRASH 300':   { code: 'CRASH300N', label: 'Crash 300 Index' },
    'CRASH 500':   { code: 'CRASH500',  label: 'Crash 500 Index' },
    'CRASH 1000':  { code: 'CRASH1000', label: 'Crash 1000 Index' },
    'BOOM 300':    { code: 'BOOM300N',  label: 'Boom 300 Index' },
    'BOOM 500':    { code: 'BOOM500',   label: 'Boom 500 Index' },
    'BOOM 1000':   { code: 'BOOM1000',  label: 'Boom 1000 Index' },
    'CRASH300':    { code: 'CRASH300N', label: 'Crash 300 Index' },
    'CRASH500':    { code: 'CRASH500',  label: 'Crash 500 Index' },
    'CRASH1000':   { code: 'CRASH1000', label: 'Crash 1000 Index' },
    'BOOM300':     { code: 'BOOM300N',  label: 'Boom 300 Index' },
    'BOOM500':     { code: 'BOOM500',   label: 'Boom 500 Index' },
    'BOOM1000':    { code: 'BOOM1000',  label: 'Boom 1000 Index' },
    'STEP INDEX':      { code: 'STPINDX',    label: 'Step Index' },
    'RANGE BREAK 100': { code: 'RBREAKB100', label: 'Range Break 100 Index' },
    'RANGE BREAK 200': { code: 'RBREAKB200', label: 'Range Break 200 Index' },
    'DEX 600 DOWN':  { code: 'DEX600DN',  label: 'DEX 600 Down Index' },
    'DEX 600 UP':    { code: 'DEX600UP',  label: 'DEX 600 Up Index' },
    'DEX 900 DOWN':  { code: 'DEX900DN',  label: 'DEX 900 Down Index' },
    'DEX 900 UP':    { code: 'DEX900UP',  label: 'DEX 900 Up Index' },
    'DEX 1500 DOWN': { code: 'DEX1500DN', label: 'DEX 1500 Down Index' },
    'DEX 1500 UP':   { code: 'DEX1500UP', label: 'DEX 1500 Up Index' },
  };

  if (derivSynthetics[s])     return { useDerivChart: true, derivSymbol: derivSynthetics[s].code, tvSymbol: '', label: derivSynthetics[s].label, isKnown: true };
  if (derivSynthetics[clean]) return { useDerivChart: true, derivSymbol: derivSynthetics[clean].code, tvSymbol: '', label: derivSynthetics[clean].label, isKnown: true };

  if (s.includes('JUMP') || clean.startsWith('JD')) {
    const num = s.match(/\d+/)?.[0] || '25';
    return { useDerivChart: true, derivSymbol: `JD${num}`, tvSymbol: '', label: `Jump ${num} Index`, isKnown: true };
  }
  if (s.includes('CRASH')) {
    const num = s.match(/\d+/)?.[0] || '500';
    return { useDerivChart: true, derivSymbol: `CRASH${num}`, tvSymbol: '', label: `Crash ${num} Index`, isKnown: true };
  }
  if (s.includes('BOOM')) {
    const num = s.match(/\d+/)?.[0] || '500';
    return { useDerivChart: true, derivSymbol: `BOOM${num}`, tvSymbol: '', label: `Boom ${num} Index`, isKnown: true };
  }
  if (s.includes('VOLAT') || s.includes('VOLATILITY') || clean.match(/^V\d+$/) || clean.match(/^R\d+$/)) {
    const num = s.match(/\d+/)?.[0] || '75';
    return { useDerivChart: true, derivSymbol: `R_${num}`, tvSymbol: '', label: `Volatility ${num} Index`, isKnown: true };
  }
  if (s.includes('STEP'))  return { useDerivChart: true, derivSymbol: 'STPINDX',    tvSymbol: '', label: 'Step Index',            isKnown: true };
  if (s.includes('RANGE')) return { useDerivChart: true, derivSymbol: 'RBREAKB100', tvSymbol: '', label: 'Range Break 100 Index', isKnown: true };

  const forexPairs = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','NZDUSD','USDCAD','GBPJPY','EURJPY','EURGBP','EURAUD','EURCAD','EURCHF','AUDCAD','AUDNZD','AUDCHF','CADJPY','CHFJPY','NZDCAD','NZDJPY','GBPAUD','GBPCAD','GBPCHF','GBPNZD','USDSGD','USDMXN','USDZAR','USDNOK','USDSEK'];
  if (forexPairs.includes(clean)) return { useDerivChart: false, derivSymbol: '', tvSymbol: `FX:${clean}`, label: clean, isKnown: true };

  if (clean.includes('XAU') || s.includes('GOLD'))     return { useDerivChart: false, derivSymbol: '', tvSymbol: 'FX:XAUUSD',       label: 'XAU/USD',    isKnown: true };
  if (clean.includes('XAG') || s.includes('SILVER'))   return { useDerivChart: false, derivSymbol: '', tvSymbol: 'FX:XAGUSD',       label: 'XAG/USD',    isKnown: true };
  if (s.includes('OIL') || s.includes('WTI'))          return { useDerivChart: false, derivSymbol: '', tvSymbol: 'NYMEX:CL1!',      label: 'WTI Oil',    isKnown: true };
  if (s.includes('BRENT'))                              return { useDerivChart: false, derivSymbol: '', tvSymbol: 'NYMEX:BB1!',      label: 'Brent Oil',  isKnown: true };
  if (clean.includes('BTC') || s.includes('BITCOIN'))  return { useDerivChart: false, derivSymbol: '', tvSymbol: 'BINANCE:BTCUSDT', label: 'BTC/USDT',   isKnown: true };
  if (clean.includes('ETH') || s.includes('ETHEREUM')) return { useDerivChart: false, derivSymbol: '', tvSymbol: 'BINANCE:ETHUSDT', label: 'ETH/USDT',   isKnown: true };
  if (clean.includes('SOL')) return { useDerivChart: false, derivSymbol: '', tvSymbol: 'BINANCE:SOLUSDT', label: 'SOL/USDT', isKnown: true };
  if (clean.includes('XRP')) return { useDerivChart: false, derivSymbol: '', tvSymbol: 'BINANCE:XRPUSDT', label: 'XRP/USDT', isKnown: true };
  if (s.includes('NAS') || s.includes('US100'))  return { useDerivChart: false, derivSymbol: '', tvSymbol: 'NASDAQ:NDX',    label: 'NASDAQ 100', isKnown: true };
  if (s.includes('SPX') || s.includes('US500'))  return { useDerivChart: false, derivSymbol: '', tvSymbol: 'SP:SPX',        label: 'S&P 500',    isKnown: true };
  if (s.includes('DOW') || s.includes('US30'))   return { useDerivChart: false, derivSymbol: '', tvSymbol: 'DJ:DJI',        label: 'Dow Jones',  isKnown: true };
  if (s.includes('DAX') || s.includes('GER40'))  return { useDerivChart: false, derivSymbol: '', tvSymbol: 'XETR:DAX',      label: 'DAX 40',     isKnown: true };
  if (s.includes('FTSE') || s.includes('UK100')) return { useDerivChart: false, derivSymbol: '', tvSymbol: 'SPREADEX:FTSE', label: 'FTSE 100',   isKnown: true };

  if (clean.length >= 6) return { useDerivChart: false, derivSymbol: '', tvSymbol: `FX:${clean.slice(0,6)}`, label: clean.slice(0,6), isKnown: false };
  return { useDerivChart: false, derivSymbol: '', tvSymbol: 'FX:EURUSD', label: raw, isKnown: false };
};

const getBestInterval = (entryRaw: string, exitRaw?: string): { tv: string; deriv: string; label: string } => {
  const entry = parseDateSafe(entryRaw);
  if (!entry) return { tv: '60', deriv: '3600', label: '1H' };
  const exit  = parseDateSafe(exitRaw) ?? new Date();
  const mins  = Math.abs(exit.getTime() - entry.getTime()) / 60000;
  if (mins <= 15)   return { tv: '1',   deriv: '60',    label: '1m' };
  if (mins <= 60)   return { tv: '5',   deriv: '300',   label: '5m' };
  if (mins <= 240)  return { tv: '15',  deriv: '900',   label: '15m' };
  if (mins <= 1440) return { tv: '60',  deriv: '3600',  label: '1H' };
  if (mins <= 7200) return { tv: '240', deriv: '14400', label: '4H' };
  return               { tv: 'D',   deriv: '86400', label: '1D' };
};

const buildChartUrls = (entry: JournalEntry): { embedUrl: string; fullUrl: string } => {
  const sym      = mapSymbol(entry.symbol || '');
  const interval = getBestInterval(entry.entry_date, entry.exit_date);
  const d        = parseDateSafe(entry.entry_date);
  const dateStr  = d ? d.toISOString().split('T')[0] : '';
  if (sym.useDerivChart) {
    return {
      embedUrl: `https://charts.binary.com/charts/?symbol=${sym.derivSymbol}&granularity=${interval.deriv}&chartType=candlestick&theme=dark`,
      fullUrl:  `https://charts.deriv.com/deriv?symbol=${sym.derivSymbol}&granularity=${interval.deriv}`,
    };
  }
  return {
    embedUrl: `https://www.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(sym.tvSymbol)}&interval=${interval.tv}&theme=dark&style=1&locale=en&toolbar_bg=%230a0e1a&enable_publishing=false&hide_top_toolbar=false&save_image=true&container_id=tv_chart`,
    fullUrl:  `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym.tvSymbol)}&interval=${interval.tv}${dateStr ? `&date=${dateStr}` : ''}`,
  };
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// Types
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
interface JournalEntry {
  id: number;
  trade_id?: number;
  symbol?: string;
  entry_date: string;
  exit_date?: string;
  trade_outcome?: string;
  profit_loss?: number;
  entry_price?: number;
  exit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  lot_size?: number;
  trade_direction?: string;
  notes: string;
  lessons_learned?: string;
  emotional_state?: string;
  strategy_used?: string;
  notion_link?: string;
  ai_feedback?: string;
}

interface RevengeInstance {
  loss_trade_id:    number;
  revenge_trade_id: number;
  loss_pnl:         number;
  normal_lot:       number;
  revenge_lot:      number;
  gap_minutes:      number;
  symbol:           string;
  date:             string;
}

interface BehaviorData {
  discipline_score:       number;
  revenge_trading: {
    flagged:    boolean;
    count:      number;
    instances:  RevengeInstance[];
  };
  overtrading: {
    flagged:      boolean;
    peak_day:     string | null;
    peak_count:   number;
    avg_daily:    number;
    flagged_days: string[];
  };
  failure_probability:     string;
  failure_probability_raw: number;
  insight_bullets:         string[];
  sample_size:             number;
  emotional_losses:        number;
  doc_ratio_pct:           number;
}

const EMOTION_OPTIONS  = ['Calm','Confident','Anxious','Fearful','Greedy','Disciplined','Frustrated','Excited','Neutral'];
const STRATEGY_OPTIONS = ['Trend Following','Breakout','Scalping','Swing Trading','News Trading','Support/Resistance','Price Action','Other'];

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// AI Feedback (per-trade)
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const generateAIFeedback = (entry: JournalEntry): string => {
  const pnl   = entry.profit_loss ?? 0;
  const isWin = pnl > 0;
  const emotion  = entry.emotional_state?.toLowerCase() || '';
  const lessons  = entry.lessons_learned?.toLowerCase() || '';
  let fb = '';

  const neg = ['anxious','fearful','greedy','frustrated','excited'];
  const pos = ['calm','confident','disciplined','neutral'];
  const hasNeg = neg.some(e => emotion.includes(e));
  const hasPos = pos.some(e => emotion.includes(e));

  if (isWin && hasNeg)       fb += `�š�️ **Emotional Warning:** You made a profit but traded while feeling ${entry.emotional_state}. Wins under negative emotional states can reinforce bad habits.\n\n`;
  else if (!isWin && hasNeg) fb += `�Ÿ”� **Emotional Risk:** Trading while ${entry.emotional_state} likely contributed to this loss. Consider a cooldown before your next trade.\n\n`;
  else if (hasPos)           fb += `�œ… **Emotional Discipline:** Trading with a ${entry.emotional_state} mindset is exactly what separates professionals from amateurs.\n\n`;

  if (entry.entry_price && entry.stop_loss && entry.take_profit) {
    const risk   = Math.abs(entry.entry_price - entry.stop_loss);
    const reward = Math.abs(entry.take_profit  - entry.entry_price);
    const rr = risk > 0 ? (reward / risk).toFixed(2) : null;
    if (rr) {
      const n = parseFloat(rr);
      if (n >= 2)      fb += `�Ÿ“� **Risk/Reward: ${rr}:1** �€” Excellent. You're targeting more than 2�— your risk.\n\n`;
      else if (n >= 1) fb += `�Ÿ“� **Risk/Reward: ${rr}:1** �€” Acceptable, but aim for at least 2:1 to build a sustainable edge.\n\n`;
      else             fb += `�Ÿ“� **Risk/Reward: ${rr}:1** �€” Poor. You're risking more than you could gain.\n\n`;
    }
  }

  if (pnl > 100)       fb += `�Ÿ’� **Strong Result:** +$${pnl.toFixed(2)} is a solid gain. ${entry.strategy_used ? `Your ${entry.strategy_used} strategy executed well.` : ''} Document exactly what you did right.\n\n`;
  else if (pnl > 0)    fb += `�Ÿ“ˆ **Positive Trade:** +$${pnl.toFixed(2)} logged. Small consistent wins compound over time.\n\n`;
  else if (pnl < -100) fb += `�Ÿ”� **Significant Loss:** -$${Math.abs(pnl).toFixed(2)} �€” Review your entry criteria. Was your stop loss respected?\n\n`;
  else if (pnl < 0)    fb += `�Ÿ“‰ **Managed Loss:** -$${Math.abs(pnl).toFixed(2)} �€” If within your risk parameters, this is acceptable.\n\n`;

  if (lessons && lessons.length > 10) fb += `�Ÿ“š **Learning Mindset:** Great job documenting lessons �€” reviewing these weekly will compound your growth.\n\n`;
  else fb += `�Ÿ’� **Improvement Tip:** Log your lessons �€” even winning trades have things to learn from.\n\n`;

  if (!entry.strategy_used) fb += `�ŸŽ� **Strategy Tracking:** No strategy logged. If you can't name your strategy, you might be trading on impulse.\n\n`;

  let score = 50;
  if (isWin) score += 20;
  if (hasPos) score += 15;
  if (lessons && lessons.length > 10) score += 10;
  if (entry.strategy_used) score += 5;
  if (entry.notes && entry.notes.length > 30) score += 5;
  if (hasNeg) score -= 10;
  if (entry.entry_price && entry.stop_loss && entry.take_profit) score += 5;
  score = Math.min(100, Math.max(0, score));

  const sc = score >= 70 ? '�ŸŸ�' : score >= 50 ? '�ŸŸ�' : '�Ÿ”�';
  fb += `${sc} **Trade Quality Score: ${score}/100**\n`;
  fb += score >= 70 ? 'Excellent execution �€” keep this standard.' : score >= 50 ? 'Decent trade �€” small improvements will compound.' : 'Focus on discipline and process over profits.';
  return fb;
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// FeedbackPanel
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const FeedbackPanel: React.FC<{ entry: JournalEntry }> = ({ entry }) => {
  const [feedback, setFeedback] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [shown,    setShown]    = useState(false);

  const getFeedback = () => {
    setLoading(true);
    setTimeout(() => { setFeedback(generateAIFeedback(entry)); setLoading(false); setShown(true); }, 1200);
  };

  if (!shown) return (
    <Button onClick={getFeedback} disabled={loading} size="small"
      startIcon={loading ? <CircularProgress size={14} /> : <AutoAwesome sx={{ fontSize: 14 }} />}
      sx={{ mt: 1.5, borderRadius: '8px', background: 'linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.15))', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', fontSize: '13px', fontWeight: 600, textTransform: 'none', px: 2.5, py: 1, '&:hover': { background: 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(236,72,153,0.25))' } }}>
      {loading ? 'Analyzing trade...' : '�œ� Get AI Feedback'}
    </Button>
  );

  return (
    <Box sx={{ mt: 2, p: 2, borderRadius: '12px', background: 'linear-gradient(135deg,rgba(168,85,247,0.08),rgba(236,72,153,0.05))', border: '1px solid rgba(168,85,247,0.2)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Psychology sx={{ fontSize: 16, color: '#a855f7' }} />
        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Trade Analysis</Typography>
        <Button onClick={() => setShown(false)} size="small" sx={{ ml: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'none', minWidth: 0, p: 0 }}>Refresh</Button>
      </Box>
      {feedback.split('\n\n').filter(Boolean).map((para, i) => (
        <Typography key={i} sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, mb: 1 }}>
          {para.split('**').map((part, j) => j % 2 === 1 ? <strong key={j} style={{ color: 'white' }}>{part}</strong> : part)}
        </Typography>
      ))}
    </Box>
  );
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// LockEventCard
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const LockEventCard: React.FC<{ entry: JournalEntry }> = ({ entry }) => {
  let reason      = 'manual';
  let duration    = 60;
  let triggeredBy = 'button';

  if (entry.ai_feedback?.startsWith('LOCK_EVENT|')) {
    const parts = entry.ai_feedback.split('|');
    if (parts.length >= 4) {
      reason      = parts[1];
      triggeredBy = parts[3];
      try { duration = parseInt(parts[2]) || 60; } catch { duration = 60; }
    }
  }

  const reasonConfig: Record<string, { label: string; color: string; icon: string }> = {
    revenge_trade:    { label: 'Revenge Trade',  color: '#f97316', icon: '�Ÿ˜�' },
    revenge_detected: { label: 'Revenge Trade',  color: '#f97316', icon: '�Ÿ˜�' },
    loss_limit:       { label: 'Loss Limit',      color: '#ef4444', icon: '�Ÿ“‰' },
    auto_loss_limit:  { label: 'Auto Loss Limit', color: '#a855f7', icon: '�Ÿ�–' },
    manual:           { label: 'Manual Lock',     color: '#38bdf8', icon: '�Ÿ�˜' },
    risk_lock:        { label: 'Risk Lock',       color: '#fbbf24', icon: '�Ÿ”’' },
  };

  const cfg      = reasonConfig[reason] ?? { label: reason.replace(/_/g, ' '), color: '#38bdf8', icon: '�Ÿ”’' };
  const isAuto   = triggeredBy === 'auto';
  const pnl      = entry.profit_loss;

  return (
    <Card sx={{ background: `${cfg.color}0a`, border: `1px solid ${cfg.color}30`, borderRadius: '18px', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 12px 40px ${cfg.color}20` }, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${cfg.color},transparent)` }} />
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Avatar sx={{ width: 44, height: 44, background: `${cfg.color}20`, border: `1px solid ${cfg.color}40`, fontSize: '22px' }}>
            <Lock sx={{ color: cfg.color, fontSize: 22 }} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>�Ÿ”’ Risk Lock</Typography>
              {isAuto && <Chip label="�Ÿ�– Auto" size="small" sx={{ height: 20, fontSize: '10px', fontWeight: 700, background: 'rgba(168,85,247,0.2)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)' }} />}
            </Box>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{fmt(entry.entry_date)}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={`${cfg.icon} ${cfg.label}`} size="small" sx={{ height: 26, fontSize: '12px', fontWeight: 700, background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }} />
          <Chip label={`⏱ ${duration >= 60 ? `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}` : `${duration}m`}`} size="small" sx={{ height: 26, fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }} />
          {pnl != null && <Chip label={`P&L: ${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`} size="small" sx={{ height: 26, fontSize: '12px', fontWeight: 700, background: pnl >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: pnl >= 0 ? '#22c55e' : '#ef4444', border: `1px solid ${pnl >= 0 ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}` }} />}
        </Box>
        {entry.notes && (
          <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', mb: 1.5 }}>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.notes}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, opacity: 0.7 }} />
          <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            Triggered by: <span style={{ color: cfg.color, fontWeight: 600 }}>{isAuto ? 'Auto-lock watcher' : 'Manual button'}</span>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// PriceLevelsPanel
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const PriceLevelsPanel: React.FC<{ entry: JournalEntry }> = ({ entry }) => {
  const rr = (() => {
    if (!entry.entry_price || !entry.stop_loss || !entry.take_profit) return null;
    const risk   = Math.abs(entry.entry_price - entry.stop_loss);
    const reward = Math.abs(entry.take_profit  - entry.entry_price);
    return risk > 0 ? +(reward / risk).toFixed(2) : null;
  })();
  const rrColor = !rr ? '#fbbf24' : rr >= 2 ? '#22c55e' : rr >= 1 ? '#fbbf24' : '#ef4444';
  const levels = [
    { key: 'entry', label: 'ENTRY',       price: entry.entry_price, color: '#38bdf8', icon: '�†’', bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.30)' },
    { key: 'sl',    label: 'STOP LOSS',   price: entry.stop_loss,   color: '#ef4444', icon: '�Ÿ›‘', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)'  },
    { key: 'tp',    label: 'TAKE PROFIT', price: entry.take_profit, color: '#22c55e', icon: '�ŸŽ�', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)'  },
    { key: 'exit',  label: 'EXIT',        price: entry.exit_price,  color: '#fbbf24', icon: '�œ•',  bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)' },
  ].filter(l => l.price != null) as typeof levels;
  if (levels.length === 0) return null;
  return (
    <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, background: 'linear-gradient(0deg,rgba(10,14,26,0.97) 80%,transparent)', backdropFilter: 'blur(6px)', borderTop: '1px solid rgba(255,255,255,0.07)', p: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', mr: 0.5 }}>�Ÿ“� Levels</Typography>
      {levels.map(lvl => {
        const priceStr = lvl.price! > 99 ? lvl.price!.toFixed(2) : lvl.price!.toFixed(5);
        return (
          <Box key={lvl.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1.5, py: 0.6, borderRadius: '8px', background: lvl.bg, border: `1px solid ${lvl.border}` }}>
            <Typography sx={{ fontSize: '11px' }}>{lvl.icon}</Typography>
            <Box>
              <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, lineHeight: 1 }}>{lvl.label}</Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: lvl.color, fontFamily: '"Roboto Mono",monospace', lineHeight: 1.3 }}>{priceStr}</Typography>
            </Box>
          </Box>
        );
      })}
      {rr && (
        <Box sx={{ ml: 'auto', px: 2, py: 0.8, borderRadius: '10px', background: `${rrColor}18`, border: `1px solid ${rrColor}44`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Risk:Reward</Typography>
          <Typography sx={{ fontSize: '18px', fontWeight: 900, color: rrColor, fontFamily: '"Roboto Mono",monospace', lineHeight: 1.2 }}>{rr}:1</Typography>
        </Box>
      )}
    </Box>
  );
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// TradingView Modal
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const TradingViewModal: React.FC<{ entry: JournalEntry; open: boolean; onClose: () => void }> = ({ entry, open, onClose }) => {
  const sym      = mapSymbol(entry.symbol || '');
  const interval = getBestInterval(entry.entry_date, entry.exit_date);
  const { embedUrl, fullUrl } = buildChartUrls(entry);
  const [chartLoaded, setChartLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!open) { setChartLoaded(false); return; }
    const t = setTimeout(() => setChartLoaded(true), 1200);
    return () => clearTimeout(t);
  }, [open]);

  const hasLevels = !!(entry.entry_price || entry.stop_loss || entry.take_profit || entry.exit_price);
  const rr = (() => {
    if (!entry.entry_price || !entry.stop_loss || !entry.take_profit) return null;
    const risk   = Math.abs(entry.entry_price - entry.stop_loss);
    const reward = Math.abs(entry.take_profit  - entry.entry_price);
    return risk > 0 ? (reward / risk).toFixed(2) : null;
  })();
  const rrNum   = rr ? parseFloat(rr) : 0;
  const rrColor = rrNum >= 2 ? '#22c55e' : rrNum >= 1 ? '#fbbf24' : '#ef4444';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { background: '#0a0e1a', color: 'white', borderRadius: '20px', border: '1px solid rgba(56,189,248,0.2)', height: '90vh', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, pt: 2.5, px: 3, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: sym.useDerivChart ? 'rgba(168,85,247,0.06)' : 'rgba(56,189,248,0.04)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: sym.useDerivChart ? 'linear-gradient(135deg,rgba(168,85,247,0.3),rgba(236,72,153,0.2))' : 'linear-gradient(135deg,rgba(56,189,248,0.25),rgba(34,197,94,0.15))', border: `1px solid ${sym.useDerivChart ? 'rgba(168,85,247,0.4)' : 'rgba(56,189,248,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShowChart sx={{ color: sym.useDerivChart ? '#a855f7' : '#38bdf8', fontSize: 24 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.3 }}>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>{sym.label}</Typography>
              <Chip label={interval.label} size="small" sx={{ height: 22, fontSize: '11px', fontWeight: 700, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }} />
              <Chip label={sym.useDerivChart ? '�œ“ Deriv Chart' : '�œ“ TradingView'} size="small" sx={{ height: 22, fontSize: '11px', fontWeight: 700, background: sym.useDerivChart ? 'rgba(168,85,247,0.15)' : 'rgba(34,197,94,0.12)', color: sym.useDerivChart ? '#a855f7' : '#22c55e', border: `1px solid ${sym.useDerivChart ? 'rgba(168,85,247,0.3)' : 'rgba(34,197,94,0.3)'}` }} />
              {hasLevels && <Chip label="�Ÿ“� Levels overlaid" size="small" sx={{ height: 22, fontSize: '11px', fontWeight: 600, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }} />}
              {rr && <Chip label={`RR ${rr}:1`} size="small" sx={{ height: 22, fontSize: '11px', fontWeight: 800, background: 'rgba(168,85,247,0.15)', color: rrColor, border: `1px solid ${rrColor}55` }} />}
            </Box>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{fmtFull(entry.entry_date)}{entry.trade_direction && ` · ${entry.trade_direction}`}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button onClick={() => window.open(fullUrl, '_blank')} startIcon={<OpenInNew />} size="small" sx={{ borderRadius: '10px', background: sym.useDerivChart ? 'rgba(168,85,247,0.12)' : 'rgba(56,189,248,0.12)', border: `1px solid ${sym.useDerivChart ? 'rgba(168,85,247,0.35)' : 'rgba(56,189,248,0.35)'}`, color: sym.useDerivChart ? '#a855f7' : '#38bdf8', textTransform: 'none', fontWeight: 700, fontSize: '13px', px: 2, py: 0.8 }}>Open Full Chart</Button>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', width: 36, height: 36 }}><Close /></IconButton>
        </Box>
      </DialogTitle>
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Box sx={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <iframe src={embedUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title={sym.useDerivChart ? 'Deriv Chart' : 'TradingView Chart'} onLoad={() => setChartLoaded(true)} />
          {!chartLoaded && (
            <Box sx={{ position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, zIndex: 20 }}>
              <CircularProgress sx={{ color: sym.useDerivChart ? '#a855f7' : '#38bdf8' }} size={40} />
              <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Loading {sym.label} chart�€�</Typography>
            </Box>
          )}
          {chartLoaded && hasLevels && <PriceLevelsPanel entry={entry} />}
        </Box>
        <Box sx={{ width: 260, borderLeft: '1px solid rgba(255,255,255,0.08)', p: 2.5, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5, flexShrink: 0, background: 'rgba(255,255,255,0.015)', '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(56,189,248,0.3)', borderRadius: '4px' } }}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Trade Details</Typography>
          {entry.trade_direction && (
            <Box sx={{ p: 1.5, borderRadius: '12px', background: entry.trade_direction === 'BUY' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${entry.trade_direction === 'BUY' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: entry.trade_direction === 'BUY' ? '#22c55e' : '#ef4444' }}>{entry.trade_direction === 'BUY' ? '�–� BUY' : '�–� SELL'}</Typography>
            </Box>
          )}
          {[
            { label: 'Entry Price', value: entry.entry_price, color: '#38bdf8', icon: '�†’', bg: 'rgba(56,189,248,0.08)', bdr: 'rgba(56,189,248,0.2)' },
            { label: 'Stop Loss',   value: entry.stop_loss,   color: '#ef4444', icon: '�Ÿ›‘', bg: 'rgba(239,68,68,0.08)', bdr: 'rgba(239,68,68,0.2)' },
            { label: 'Take Profit', value: entry.take_profit, color: '#22c55e', icon: '�ŸŽ�', bg: 'rgba(34,197,94,0.08)',  bdr: 'rgba(34,197,94,0.2)' },
            { label: 'Exit Price',  value: entry.exit_price,  color: '#fbbf24', icon: '�œ•',  bg: 'rgba(251,191,36,0.08)', bdr: 'rgba(251,191,36,0.2)' },
          ].map(item => (
            <Box key={item.label} sx={{ p: 1.5, borderRadius: '10px', background: item.value != null ? item.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${item.value != null ? item.bdr : 'rgba(255,255,255,0.06)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: item.value != null ? 1 : 0.45 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '14px', width: 20 }}>{item.icon}</Typography>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{item.label}</Typography>
              </Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: item.value != null ? item.color : 'rgba(255,255,255,0.2)', fontFamily: '"Roboto Mono",monospace' }}>
                {item.value != null ? (Number(item.value) > 99 ? Number(item.value).toFixed(2) : Number(item.value).toFixed(5)) : 'Not set'}
              </Typography>
            </Box>
          ))}
          {entry.profit_loss != null && (
            <Box sx={{ p: 2, borderRadius: '12px', background: entry.profit_loss >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${entry.profit_loss >= 0 ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Profit / Loss</Typography>
              <Typography sx={{ fontSize: '26px', fontWeight: 800, color: entry.profit_loss >= 0 ? '#22c55e' : '#ef4444', fontFamily: '"Roboto Mono",monospace' }}>
                {entry.profit_loss >= 0 ? '+' : ''}${entry.profit_loss.toFixed(2)}
              </Typography>
            </Box>
          )}
          {entry.lot_size != null && (
            <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Lot Size</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', fontFamily: '"Roboto Mono",monospace' }}>{entry.lot_size}</Typography>
            </Box>
          )}
          {entry.strategy_used && (
            <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Strategy</Typography>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa' }}>{entry.strategy_used}</Typography>
            </Box>
          )}
          {entry.emotional_state && (
            <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Emotion</Typography>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#c084fc' }}>{entry.emotional_state}</Typography>
            </Box>
          )}
          <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Auto Timeframe</Typography>
            <Chip label={interval.label} size="small" sx={{ height: 22, fontSize: '12px', fontWeight: 800, background: 'rgba(56,189,248,0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)' }} />
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// ChartUpgradePrompt
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const ChartUpgradePrompt: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { background: '#0f172a', color: 'white', borderRadius: '20px', border: '1px solid rgba(56,189,248,0.2)' } }}>
    <DialogContent sx={{ textAlign: 'center', p: 4 }}>
      <Typography sx={{ fontSize: '52px', mb: 2 }}>�Ÿ“ˆ</Typography>
      <Typography sx={{ fontSize: '22px', fontWeight: 800, color: 'white', mb: 1 }}>TradingView Charts</Typography>
      <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', mb: 3, lineHeight: 1.7 }}>
        View your trades on a live chart with entry, SL, and TP levels. Available on{' '}
        <span style={{ color: '#a855f7', fontWeight: 700 }}>Pro</span> and{' '}
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>Enterprise</span> plans.
      </Typography>
      <Button onClick={() => { startCheckout('pro'); onClose(); }} fullWidth sx={{ py: 1.8, borderRadius: '12px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontWeight: 700, textTransform: 'none', fontSize: '15px', mb: 1.5 }}>Upgrade to Pro �€” $49/mo �†’</Button>
      <Button onClick={onClose} fullWidth sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'none', fontSize: '13px' }}>Maybe later</Button>
    </DialogContent>
  </Dialog>
);

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// BehaviorReport �€” Phase 4 AI Behavioral Analysis card
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const ScoreRing: React.FC<{ value: number; size?: number; label: string; color: string }> = ({ value, size = 80, label, color }) => {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (value / 100) * circumference;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: size > 70 ? '20px' : '15px', fontWeight: 900, color, fontFamily: '"Roboto Mono",monospace', lineHeight: 1 }}>{value}</Typography>
        <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
      </Box>
    </Box>
  );
};

const MetricPill: React.FC<{
  icon: React.ReactNode; label: string; value: string; sub?: string;
  flagged: boolean; flagColor?: string; okColor?: string;
  expanded?: boolean; onToggle?: () => void; hasDetail?: boolean;
}> = ({ icon, label, value, sub, flagged, flagColor = '#ef4444', okColor = '#22c55e', expanded, onToggle, hasDetail }) => {
  const color = flagged ? flagColor : okColor;
  return (
    <Box onClick={hasDetail ? onToggle : undefined} sx={{ flex: '1 1 200px', minWidth: 0, p: 2, borderRadius: '14px', background: `${color}0a`, border: `1px solid ${color}28`, cursor: hasDetail ? 'pointer' : 'default', transition: 'all 0.2s', '&:hover': hasDetail ? { background: `${color}14`, borderColor: `${color}45` } : {} }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ color, fontSize: 18, display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>{label}</Typography>
        {hasDetail && <Box sx={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}>{expanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}</Box>}
      </Box>
      <Typography sx={{ fontSize: '22px', fontWeight: 900, color, fontFamily: '"Roboto Mono",monospace', lineHeight: 1, mb: 0.3 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', mt: 0.4 }}>{sub}</Typography>}
    </Box>
  );
};

const BehaviorReport: React.FC<{ days: number | null; refreshToken: number }> = ({ days, refreshToken }) => {
  const [data,          setData]          = useState<BehaviorData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [showRevenge,   setShowRevenge]   = useState(false);
  const [showOvertrade, setShowOvertrade] = useState(false);
  const [collapsed,     setCollapsed]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const params = days ? `?days=${days}` : '';
      const r = await axios.get(`${API}/journal/behavior-report${params}`);
      setData(r.data);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [days]);

  // Re-run whenever days filter changes OR parent signals a refresh (sync completed)
  useEffect(() => { load(); }, [load, refreshToken]);

  const scoreColor = (s: number) => s >= 75 ? '#22c55e' : s >= 50 ? '#fbbf24' : '#ef4444';
  const failColor  = (p: number) => p >= 60 ? '#ef4444' : p >= 35 ? '#fbbf24' : '#22c55e';
  const failLabel  = (p: number) => p >= 60 ? 'HIGH' : p >= 35 ? 'MODERATE' : 'LOW';

  return (
    <Box sx={{ mb: 3, borderRadius: '22px', background: 'linear-gradient(135deg,rgba(168,85,247,0.07),rgba(56,189,248,0.04))', border: '1px solid rgba(168,85,247,0.2)', overflow: 'hidden', position: 'relative' }}>
      <Box sx={{ height: '2px', background: 'linear-gradient(90deg,transparent,#a855f7 40%,#38bdf8 70%,transparent)' }} />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: collapsed ? 2.5 : 1.5, borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
        <Psychology sx={{ color: '#a855f7', fontSize: 22 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>AI Behavioral Analysis</Typography>
          {!collapsed && data && (
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', mt: 0.2 }}>
              Based on {data.sample_size} trade{data.sample_size !== 1 ? 's' : ''}
              {days ? <span style={{ color: '#38bdf8', marginLeft: 6 }}>· last {days} days</span> : <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: 6 }}>· all time</span>}
            </Typography>
          )}
        </Box>
        <Tooltip title="Refresh report">
          <IconButton size="small" onClick={e => { e.stopPropagation(); load(); }} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#a855f7' } }}>
            <Refresh sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)' }}>
          {collapsed ? <ExpandMore sx={{ fontSize: 18 }} /> : <ExpandLess sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      <Collapse in={!collapsed}>
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 3 }}>
            <CircularProgress size={20} sx={{ color: '#a855f7' }} />
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Analysing your trading behaviour�€�</Typography>
          </Box>
        )}
        {error && !loading && (
          <Box sx={{ px: 3, py: 3 }}>
            <Typography sx={{ fontSize: '13px', color: '#ef4444' }}>�š�️ Could not load behavior report. Make sure the backend is running.</Typography>
          </Box>
        )}
        {data && !loading && (
          <Box sx={{ px: 3, pb: 3, pt: 2 }}>
            {/* Score row */}
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', mb: 3, flexWrap: 'wrap' }}>
              <ScoreRing value={data.discipline_score} color={scoreColor(data.discipline_score)} label="Score" size={88} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: '28px', fontWeight: 900, color: scoreColor(data.discipline_score), fontFamily: '"Roboto Mono",monospace', lineHeight: 1 }}>
                    {data.discipline_score}<span style={{ fontSize: '14px', opacity: 0.6 }}>/100</span>
                  </Typography>
                  <Typography sx={{ fontSize: '14px', fontWeight: 700, color: scoreColor(data.discipline_score) }}>Discipline Score</Typography>
                </Box>
                <Box sx={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', mb: 1.5, maxWidth: 380 }}>
                  <Box sx={{ height: '100%', width: `${data.discipline_score}%`, borderRadius: 3, background: `linear-gradient(90deg,${scoreColor(data.discipline_score)}88,${scoreColor(data.discipline_score)})`, transition: 'width 0.8s ease' }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={`Failure Risk: ${failLabel(data.failure_probability_raw)}`}
                    size="small"
                    icon={data.failure_probability_raw >= 60 ? <ErrorOutline sx={{ fontSize: '13px !important' }} /> : data.failure_probability_raw >= 35 ? <WarningAmberRounded sx={{ fontSize: '13px !important' }} /> : <CheckCircleOutline sx={{ fontSize: '13px !important' }} />}
                    sx={{ height: 26, fontSize: '12px', fontWeight: 700, background: `${failColor(data.failure_probability_raw)}18`, color: failColor(data.failure_probability_raw), border: `1px solid ${failColor(data.failure_probability_raw)}40` }}
                  />
                  <Chip label={`${data.doc_ratio_pct}% documented`} size="small" sx={{ height: 26, fontSize: '12px', fontWeight: 600, background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }} />
                </Box>
              </Box>
              <ScoreRing value={Math.round(data.failure_probability_raw)} color={failColor(data.failure_probability_raw)} label="Fail %" size={72} />
            </Box>

            {/* Metric pills */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
              <MetricPill icon={<span style={{ fontSize: 17 }}>�Ÿ˜�</span>} label="Revenge Trades" value={data.revenge_trading.flagged ? `${data.revenge_trading.count}` : '0'} sub={data.revenge_trading.flagged ? 'oversized lots after loss' : 'none detected'} flagged={data.revenge_trading.flagged} flagColor="#f97316" hasDetail={data.revenge_trading.flagged && (data.revenge_trading.instances ?? []).length > 0} expanded={showRevenge} onToggle={() => setShowRevenge(v => !v)} />
              <MetricPill icon={<span style={{ fontSize: 17 }}>�Ÿ“Š</span>} label="Overtrading Days" value={data.overtrading.flagged ? `${(data.overtrading.flagged_days ?? []).length}` : '0'} sub={data.overtrading.flagged ? `peak ${data.overtrading.peak_count} trades${data.overtrading.peak_day ? ` on ${data.overtrading.peak_day}` : ''}` : `avg ${data.overtrading.avg_daily}/day`} flagged={data.overtrading.flagged} flagColor="#f59e0b" hasDetail={data.overtrading.flagged && (data.overtrading.flagged_days ?? []).length > 0} expanded={showOvertrade} onToggle={() => setShowOvertrade(v => !v)} />
              <MetricPill icon={<span style={{ fontSize: 17 }}>�Ÿ˜Ÿ</span>} label="Emotional Losses" value={`${data.emotional_losses}`} sub={data.emotional_losses > 0 ? 'loss under negative emotion' : 'none detected'} flagged={data.emotional_losses > 0} flagColor="#a855f7" />
              <MetricPill icon={<span style={{ fontSize: 17 }}>�ŸŽ�</span>} label="Failure Probability" value={data.failure_probability} sub={failLabel(data.failure_probability_raw) + ' risk'} flagged={data.failure_probability_raw >= 35} flagColor={failColor(data.failure_probability_raw)} okColor="#22c55e" />
            </Box>

            {/* Revenge drill-down */}
            <Collapse in={showRevenge}>
              <Box sx={{ mb: 2, p: 2, borderRadius: '12px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#f97316', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Revenge Trade Instances</Typography>
                {(data.revenge_trading.instances ?? []).map((ins, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1, pb: 1, borderBottom: i < (data.revenge_trading.instances ?? []).length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', minWidth: 100 }}>{ins.date.slice(0, 16)}</Typography>
                    <Typography sx={{ fontSize: '12px', color: '#f97316', fontWeight: 700 }}>{ins.symbol}</Typography>
                    <Typography sx={{ fontSize: '12px', color: '#ef4444' }}>Loss: ${ins.loss_pnl}</Typography>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Lot: <span style={{ color: '#f97316', fontWeight: 700 }}>{ins.revenge_lot}</span><span style={{ opacity: 0.5 }}> (normal: {ins.normal_lot})</span></Typography>
                    <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>⏱ +{ins.gap_minutes}m later</Typography>
                  </Box>
                ))}
              </Box>
            </Collapse>

            {/* Overtrading drill-down */}
            <Collapse in={showOvertrade}>
              <Box sx={{ mb: 2, p: 2, borderRadius: '12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Overtrading Days</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {(data.overtrading.flagged_days ?? []).map(day => (
                    <Chip key={day} label={day} size="small" sx={{ height: 24, fontSize: '11px', fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }} />
                  ))}
                </Box>
              </Box>
            </Collapse>

            {/* Insight bullets */}
            <Box sx={{ borderRadius: '14px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', p: 2 }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>�Ÿ’� AI Insights</Typography>
              {(data.insight_bullets ?? []).map((bullet, i) => (
                <Typography key={i} sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, mb: 0.5 }}>{bullet}</Typography>
              ))}
            </Box>
          </Box>
        )}
      </Collapse>
    </Box>
  );
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// Helpers
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const filterByDays = (entries: JournalEntry[], days: number | null) => {
  if (!days) return entries;
  // "7 Days" = from start of (today - 6 days) onward, matching backend exactly.
  // Today counts as day 1, so we go back (days - 1) full days.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);
  return entries.filter(e => {
    const d = parseDateSafe(e.entry_date);
    return d ? d >= cutoff : false;
  });
};

// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
// Main Component
// �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
const JournalView: React.FC = () => {
  const { features, plan } = usePlan();
  const canViewChart = plan === 'pro' || plan === 'enterprise';

  const [entries,      setEntries]      = useState<JournalEntry[]>([]);
  const [filter,       setFilter]       = useState<'all'|'wins'|'losses'|'locks'>('all');
  const [historyDays,  setHistoryDays]  = useState<number|null>(null);
  const [loading,      setLoading]      = useState(true);
  // Incrementing this tells BehaviorReport to reload after a sync completes
  const [behaviorRefreshToken, setBehaviorRefreshToken] = useState(0);
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry|null>(null);
  const [syncing,      setSyncing]      = useState(false);
  const [resyncing,    setResyncing]    = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; sub?: string;
    icon: string; color: string; confirmLabel: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', icon: '�š�️', color: '#f97316', confirmLabel: 'Confirm', onConfirm: () => {} });

  const showConfirm  = (opts: typeof confirmDialog) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(d => ({ ...d, open: false }));
  const [chartEntry,   setChartEntry]   = useState<JournalEntry|null>(null);
  const [showUpgrade,  setShowUpgrade]  = useState(false);
  const [notionMode,   setNotionMode]   = useState<'template'|'custom'>('template');

  const emptyForm = { symbol: '', notes: '', lessons_learned: '', emotional_state: '', strategy_used: '', notion_link: '', entry_price: '', exit_price: '', stop_loss: '', take_profit: '', lot_size: '', trade_direction: 'BUY', entry_date: '', exit_date: '' };
  const [formData, setFormData] = useState(emptyForm);
  const fd = (k: string, v: string) => setFormData(p => ({ ...p, [k]: v }));

  const fetchEntries = useCallback(async () => {
    try { const r = await axios.get(`${API}/journal/`); setEntries(r.data || []); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Upgrade gate
  if (!features.ai_journal) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 0%,rgba(168,85,247,0.15),transparent 60%),#0b1120', p: 4 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
          <Typography sx={{ fontSize: '64px', mb: 2 }}>�Ÿ”’</Typography>
          <Typography sx={{ fontSize: '32px', fontWeight: 800, color: 'white', mb: 1 }}>AI Trading Journal</Typography>
          <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', mb: 4 }}>
            The AI Journal is a <span style={{ color: '#a855f7', fontWeight: 700 }}>Pro feature</span>. Track trades, emotions, and discipline with chart integration.
          </Typography>
          <Box sx={{ p: 3, borderRadius: '16px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', mb: 4, textAlign: 'left' }}>
            {['AI emotion & discipline tracking','Automatic MT5 trade sync','Deriv/TradingView chart per trade �€” Pro/Enterprise','Entry, SL & TP visualization','90-day trade history','�œ� AI feedback on every trade'].map(f => (
              <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{f}</Typography>
              </Box>
            ))}
          </Box>
          <Button onClick={() => startCheckout('pro')} sx={{ px: 5, py: 2, borderRadius: '14px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontSize: '16px', fontWeight: 700, textTransform: 'none' }}>
            Upgrade to Pro �€” $49/mo �†’
          </Button>
          <Typography sx={{ mt: 2, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Cancel anytime.</Typography>
        </Box>
      </Box>
    );
  }

  const syncMT5 = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API}/journal/sync-mt5`);
      await fetchEntries();
      setBehaviorRefreshToken(t => t + 1);  // auto-refresh behavior card
    } catch {}
    finally { setSyncing(false); }
  };

  const resyncMT5 = async () => {
    showConfirm({
      open: true,
      title: 'Fix & Re-sync MT5 Trades',
      message: 'This will delete all auto-imported MT5 trades and re-import them with corrected entry & exit prices.',
      sub: 'Manually created entries will be kept.',
      icon: '�Ÿ”„',
      color: '#f97316',
      confirmLabel: 'Yes, Re-sync Now',
      onConfirm: async () => {
        closeConfirm(); setResyncing(true);
        try {
          await axios.post(`${API}/journal/resync-mt5`);
          await fetchEntries();
          setBehaviorRefreshToken(t => t + 1);  // auto-refresh behavior card
        } catch {}
        finally { setResyncing(false); }
      },
    });
  };

  const handleOpenDialog = (entry?: JournalEntry) => {
    if (entry) {
      setEditingEntry(entry);
      const normalizeForInput = (raw?: string) => {
        const d = parseDateSafe(raw);
        if (!d) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setFormData({
        symbol: entry.symbol||'', notes: entry.notes||'', lessons_learned: entry.lessons_learned||'',
        emotional_state: entry.emotional_state||'', strategy_used: entry.strategy_used||'',
        notion_link: entry.notion_link||'',
        entry_price: entry.entry_price?.toString()||'', exit_price: entry.exit_price?.toString()||'',
        stop_loss: entry.stop_loss?.toString()||'', take_profit: entry.take_profit?.toString()||'',
        lot_size: entry.lot_size?.toString()||'', trade_direction: entry.trade_direction||'BUY',
        entry_date: normalizeForInput(entry.entry_date),
        exit_date:  normalizeForInput(entry.exit_date),
      });
    } else {
      setEditingEntry(null);
      setFormData(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
        exit_price:  formData.exit_price  ? parseFloat(formData.exit_price)  : null,
        stop_loss:   formData.stop_loss   ? parseFloat(formData.stop_loss)   : null,
        take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
        lot_size:    formData.lot_size    ? parseFloat(formData.lot_size)    : null,
      };
      if (editingEntry) await axios.put(`${API}/journal/${editingEntry.id}`, payload);
      else              await axios.post(`${API}/journal/`, payload);
      fetchEntries(); setDialogOpen(false);
    } catch {}
  };

  const handleDelete = async (id: number) => {
    showConfirm({
      open: true, title: 'Delete Journal Entry',
      message: 'This trade entry will be permanently removed from your journal.',
      sub: 'This action cannot be undone.',
      icon: '�Ÿ—‘️', color: '#ef4444', confirmLabel: 'Delete Entry',
      onConfirm: async () => {
        closeConfirm();
        await axios.delete(`${API}/journal/${id}`);
        fetchEntries();
      },
    });
  };

  // Filter logic
  let displayed = [...entries];
  if (filter === 'wins')   displayed = displayed.filter(e => (e.profit_loss ?? 0) > 0 && e.symbol !== 'RISK_LOCK');
  if (filter === 'losses') displayed = displayed.filter(e => (e.profit_loss ?? 0) < 0 && e.symbol !== 'RISK_LOCK');
  if (filter === 'locks')  displayed = displayed.filter(e => e.symbol === 'RISK_LOCK');
  displayed = filterByDays(displayed, historyDays);
  displayed.sort((a, b) => {
    const da = parseDateSafe(a.entry_date)?.getTime() ?? 0;
    const db = parseDateSafe(b.entry_date)?.getTime() ?? 0;
    return db - da;
  });

  const tradedEntries = displayed.filter(e => e.symbol !== 'RISK_LOCK');
  const wins          = tradedEntries.filter(e => (e.profit_loss ?? 0) > 0);
  const lockCount     = displayed.filter(e => e.symbol === 'RISK_LOCK').length;
  const totalPnl      = tradedEntries.reduce((s, e) => s + (e.profit_loss ?? 0), 0);
  const winRate       = tradedEntries.length > 0 ? (wins.length / tradedEntries.length * 100).toFixed(0) : '0';

  const inputSx = {
    '& .MuiOutlinedInput-root': { color: 'white', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused fieldset': { borderColor: '#a855f7' } },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)' },
  };

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 4 }, background: 'radial-gradient(circle at 20% 0%,rgba(168,85,247,0.08),transparent 40%),#0b1120', color: 'white' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '32px', fontWeight: 800, background: 'linear-gradient(90deg,#a855f7,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 0.5 }}>AI Trading Journal</Typography>
          <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)' }}>Track trades �€� Analyze emotions �€� View on TradingView</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button onClick={syncMT5} disabled={syncing || resyncing} startIcon={syncing ? <CircularProgress size={16} /> : <Refresh />} sx={{ borderRadius: '12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 600, textTransform: 'none', px: 2.5 }}>
            {syncing ? 'Syncing...' : 'Sync MT5 Trades'}
          </Button>
          <Button onClick={resyncMT5} disabled={syncing || resyncing} startIcon={resyncing ? <CircularProgress size={16} sx={{ color: '#f97316' }} /> : <Refresh sx={{ fontSize: 16 }} />} sx={{ borderRadius: '12px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', fontWeight: 600, textTransform: 'none', px: 2.5 }}>
            {resyncing ? 'Re-syncing...' : '�Ÿ”„ Fix & Re-sync'}
          </Button>
          <Button onClick={() => handleOpenDialog()} startIcon={<Add />} sx={{ borderRadius: '12px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontWeight: 700, textTransform: 'none', px: 2.5, '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(168,85,247,0.35)' } }}>
            New Entry
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          { label: 'Total Entries', display: tradedEntries.length.toString(), color: '#38bdf8', glow: 'rgba(56,189,248,0.18)', border: 'rgba(56,189,248,0.22)', bg: 'linear-gradient(135deg,rgba(56,189,248,0.10),rgba(56,189,248,0.03))', icon: '�Ÿ““', sub: 'trades logged' },
          { label: 'Win Rate', display: `${winRate}%`, color: '#22c55e', glow: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.22)', bg: 'linear-gradient(135deg,rgba(34,197,94,0.10),rgba(34,197,94,0.03))', icon: '�Ÿ�†', sub: `${wins.length} wins` },
          { label: 'Total P&L', display: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`, color: totalPnl >= 0 ? '#22c55e' : '#ef4444', glow: totalPnl >= 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)', border: totalPnl >= 0 ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)', bg: totalPnl >= 0 ? 'linear-gradient(135deg,rgba(34,197,94,0.10),rgba(34,197,94,0.03))' : 'linear-gradient(135deg,rgba(239,68,68,0.10),rgba(239,68,68,0.03))', icon: totalPnl >= 0 ? '�Ÿ“ˆ' : '�Ÿ“‰', sub: 'net profit/loss' },
          { label: 'Risk Locks', display: lockCount === 0 ? '�€”' : lockCount.toString(), color: lockCount === 0 ? '#4ade80' : '#f97316', glow: lockCount === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(249,115,22,0.18)', border: lockCount === 0 ? 'rgba(74,222,128,0.2)' : 'rgba(249,115,22,0.22)', bg: lockCount === 0 ? 'linear-gradient(135deg,rgba(74,222,128,0.08),rgba(74,222,128,0.02))' : 'linear-gradient(135deg,rgba(249,115,22,0.10),rgba(249,115,22,0.03))', icon: lockCount === 0 ? '�œ…' : '�Ÿ”’', sub: lockCount === 0 ? 'no locks today' : 'locks triggered' },
        ].map(stat => (
          <Grid item xs={6} md={3} key={stat.label}>
            <Box sx={{ p: 0, borderRadius: '20px', background: stat.bg, border: `1px solid ${stat.border}`, boxShadow: `0 4px 32px ${stat.glow},inset 0 1px 0 rgba(255,255,255,0.06)`, overflow: 'hidden', position: 'relative', transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', '&:hover': { transform: 'translateY(-6px) scale(1.02)', boxShadow: `0 16px 48px ${stat.glow},inset 0 1px 0 rgba(255,255,255,0.08)` }, '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${stat.color},transparent)` } }}>
              <Box sx={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: stat.color, opacity: 0.06, filter: 'blur(20px)', pointerEvents: 'none' }} />
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{stat.label}</Typography>
                  <Box sx={{ fontSize: '18px', lineHeight: 1 }}>{stat.icon}</Box>
                </Box>
                <Typography sx={{ fontSize: { xs: '28px', md: '34px' }, fontWeight: 800, color: stat.color, fontFamily: '"Roboto Mono",monospace', lineHeight: 1, mb: 1, letterSpacing: '-0.02em' }}>{stat.display}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: stat.color, opacity: 0.7 }} />
                  <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{stat.sub}</Typography>
                </Box>
                {stat.label === 'Win Rate' && (
                  <Box sx={{ mt: 2, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${Math.min(parseFloat(winRate), 100)}%`, borderRadius: 2, background: `linear-gradient(90deg,${stat.color}88,${stat.color})` }} />
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* �”€�”€ Phase 4: AI Behavioral Analysis card �€” synced with time filter + auto-refresh �”€�”€ */}
      <BehaviorReport days={historyDays} refreshToken={behaviorRefreshToken} />

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { v: 'all',    l: 'All' },
          { v: 'wins',   l: '�œ… Wins' },
          { v: 'losses', l: '�Œ Losses' },
          { v: 'locks',  l: '�Ÿ”’ Locks' },
        ].map(f => (
          <Chip key={f.v} label={f.l} onClick={() => setFilter(f.v as any)}
            sx={{ height: 38, fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: filter === f.v ? 'linear-gradient(135deg,#a855f7,#ec4899)' : 'rgba(255,255,255,0.06)', color: filter === f.v ? 'white' : 'rgba(255,255,255,0.6)', border: filter === f.v ? 'none' : '1px solid rgba(255,255,255,0.1)' }} />
        ))}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[{ v: null, l: 'All Time' }, { v: 7, l: '7 Days' }, { v: 30, l: '30 Days' }, { v: 90, l: '90 Days' }].map(d => (
            <Chip key={String(d.v)} label={d.l} onClick={() => setHistoryDays(d.v)}
              sx={{ height: 34, fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: historyDays === d.v ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)', color: historyDays === d.v ? '#38bdf8' : 'rgba(255,255,255,0.4)', border: historyDays === d.v ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)' }} />
          ))}
        </Box>
      </Box>

      {/* Entry Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: '#a855f7' }} /></Box>
      ) : displayed.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 12 }}>
          <Typography sx={{ fontSize: '56px', opacity: 0.15, mb: 2 }}>�Ÿ““</Typography>
          <Typography sx={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)', mb: 1 }}>No journal entries</Typography>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.2)' }}>Add your first entry or sync MT5 trades above</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {displayed.map(entry => {
            if (entry.symbol === 'RISK_LOCK') {
              return (
                <Grid item xs={12} md={6} lg={4} key={entry.id}>
                  <LockEventCard entry={entry} />
                </Grid>
              );
            }

            const pnl    = entry.profit_loss ?? 0;
            const isWin  = pnl > 0;
            const hasPnl = entry.profit_loss != null;
            const rr = (() => {
              if (!entry.entry_price || !entry.stop_loss || !entry.take_profit) return null;
              const risk   = Math.abs(entry.entry_price - entry.stop_loss);
              const reward = Math.abs(entry.take_profit - entry.entry_price);
              return risk > 0 ? (reward / risk).toFixed(2) : null;
            })();

            return (
              <Grid item xs={12} md={6} lg={4} key={entry.id}>
                <Card sx={{ background: hasPnl ? (isWin ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)') : 'rgba(255,255,255,0.03)', border: `1px solid ${hasPnl ? (isWin ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.08)'}`, borderRadius: '18px', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }, position: 'relative', overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: hasPnl ? (isWin ? 'linear-gradient(90deg,transparent,#22c55e,transparent)' : 'linear-gradient(90deg,transparent,#ef4444,transparent)') : 'linear-gradient(90deg,transparent,#a855f7,transparent)' }} />
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 44, height: 44, background: hasPnl ? (isWin ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#dc2626)') : 'linear-gradient(135deg,#a855f7,#ec4899)', fontSize: '18px' }}>
                          {hasPnl ? (isWin ? '�Ÿ�†' : '�Ÿ“‰') : '�Ÿ““'}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: '17px', fontWeight: 700, color: 'white' }}>{mapSymbol(entry.symbol || '').label || entry.symbol || 'General Entry'}</Typography>
                          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{fmt(entry.entry_date)}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => handleOpenDialog(entry)} sx={{ color: '#38bdf8', background: 'rgba(56,189,248,0.1)', width: 32, height: 32 }}><Edit sx={{ fontSize: 16 }} /></IconButton>
                        <IconButton size="small" onClick={() => handleDelete(entry.id)} sx={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', width: 32, height: 32 }}><Delete sx={{ fontSize: 16 }} /></IconButton>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                      {entry.trade_direction && <Chip label={entry.trade_direction === 'BUY' ? '�–� BUY' : '�–� SELL'} size="small" sx={{ height: 26, fontSize: '12px', fontWeight: 700, background: entry.trade_direction === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: entry.trade_direction === 'BUY' ? '#22c55e' : '#ef4444', border: `1px solid ${entry.trade_direction === 'BUY' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }} />}
                      {hasPnl && <Chip label={`${isWin ? '+' : ''}$${pnl.toFixed(2)}`} size="small" sx={{ height: 26, fontSize: '13px', fontWeight: 700, background: isWin ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: isWin ? '#22c55e' : '#ef4444', border: `1px solid ${isWin ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }} />}
                      {entry.lot_size && <Chip label={`${entry.lot_size} lot`} size="small" sx={{ height: 26, fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }} />}
                      {rr && <Chip label={`RR ${rr}:1`} size="small" sx={{ height: 26, fontSize: '11px', fontWeight: 700, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }} />}
                    </Box>

                    {(entry.entry_price != null || entry.stop_loss != null || entry.take_profit != null || entry.exit_price != null) && (
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
                        {[
                          { label: 'ENTRY', value: entry.entry_price, color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)' },
                          { label: 'EXIT',  value: entry.exit_price,  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
                          { label: 'SL',    value: entry.stop_loss,   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)' },
                          { label: 'TP',    value: entry.take_profit, color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)' },
                        ].map(p => p.value != null && (
                          <Box key={p.label} sx={{ p: 1, borderRadius: '8px', background: p.bg, border: `1px solid ${p.border}` }}>
                            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>{p.label}</Typography>
                            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: p.color, fontFamily: '"Roboto Mono",monospace' }}>{p.value}</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}

                    {entry.notes && <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, mb: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.notes}</Typography>}

                    {entry.lessons_learned && (
                      <Box sx={{ p: 1.5, borderRadius: '8px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', mb: 1.5 }}>
                        <Typography sx={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600, mb: 0.5 }}>�Ÿ’� LESSONS LEARNED</Typography>
                        <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{entry.lessons_learned}</Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                      {entry.strategy_used && <Chip label={`�Ÿ“Š ${entry.strategy_used}`} size="small" sx={{ height: 26, fontSize: '12px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }} />}
                      {entry.emotional_state && <Chip label={`�Ÿ˜� ${entry.emotional_state}`} size="small" sx={{ height: 26, fontSize: '12px', background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }} />}
                      {entry.notion_link && <Chip icon={<OpenInNew sx={{ fontSize: '11px !important' }} />} label="Notion" size="small" onClick={() => window.open(entry.notion_link, '_blank')} sx={{ height: 26, fontSize: '12px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)', cursor: 'pointer' }} />}
                    </Box>

                    <Button onClick={() => canViewChart ? setChartEntry(entry) : setShowUpgrade(true)} fullWidth startIcon={<ShowChart />}
                      sx={{ mb: 1, borderRadius: '10px', py: 1.2, background: canViewChart ? 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(34,197,94,0.1))' : 'rgba(255,255,255,0.04)', border: canViewChart ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(255,255,255,0.1)', color: canViewChart ? '#38bdf8' : 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'none', fontSize: '13px', '&:hover': { transform: 'translateY(-1px)' } }}>
                      {canViewChart ? '�Ÿ“ˆ View on TradingView' : '�Ÿ”’ View Chart �€” Pro / Enterprise'}
                    </Button>

                    <FeedbackPanel entry={entry} />
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {chartEntry && <TradingViewModal entry={chartEntry} open={!!chartEntry} onClose={() => setChartEntry(null)} />}
      {showUpgrade && <ChartUpgradePrompt onClose={() => setShowUpgrade(false)} />}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onClose={closeConfirm} maxWidth="xs" fullWidth PaperProps={{ sx: { background: 'transparent', boxShadow: 'none', overflow: 'visible' } }}>
        <Box sx={{ borderRadius: '24px', background: 'linear-gradient(135deg,#0f172a,#0b1120)', border: `1px solid ${confirmDialog.color}30`, overflow: 'hidden', position: 'relative', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${confirmDialog.color}20` }}>
          <Box sx={{ height: '3px', background: `linear-gradient(90deg,transparent,${confirmDialog.color},transparent)` }} />
          <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle,${confirmDialog.color}18,transparent 70%)`, pointerEvents: 'none' }} />
          <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '16px', background: `${confirmDialog.color}18`, border: `1px solid ${confirmDialog.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>{confirmDialog.icon}</Box>
              <Box>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>{confirmDialog.title}</Typography>
                <Typography sx={{ fontSize: '13px', color: `${confirmDialog.color}cc`, mt: 0.3, fontWeight: 600 }}>Action required</Typography>
              </Box>
            </Box>
            <Box sx={{ p: 2.5, borderRadius: '14px', background: `${confirmDialog.color}08`, border: `1px solid ${confirmDialog.color}18`, mb: 2 }}>
              <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{confirmDialog.message}</Typography>
              {confirmDialog.sub && <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', mt: 1, display: 'flex', alignItems: 'center', gap: 0.8 }}>�š�️ {confirmDialog.sub}</Typography>}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={closeConfirm} fullWidth sx={{ py: 1.4, borderRadius: '14px', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontSize: '14px', textTransform: 'none', '&:hover': { background: 'rgba(255,255,255,0.05)', color: 'white' } }}>Cancel</Button>
              <Button onClick={confirmDialog.onConfirm} fullWidth sx={{ py: 1.4, borderRadius: '14px', background: `linear-gradient(135deg,${confirmDialog.color},${confirmDialog.color}cc)`, color: 'white', fontWeight: 700, fontSize: '14px', textTransform: 'none', boxShadow: `0 4px 20px ${confirmDialog.color}40`, '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 28px ${confirmDialog.color}55` }, transition: 'all 0.2s' }}>{confirmDialog.confirmLabel}</Button>
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { background: '#0f172a', color: 'white', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontSize: '22px', fontWeight: 700 }}>{editingEntry ? '�œ�️ Edit Entry' : '�Ÿ““ New Entry'}</Typography>
          <IconButton onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={7}>
              <TextField label="Symbol (e.g. EURUSD, Jump 25 Index)" value={formData.symbol} onChange={e => fd('symbol', e.target.value)} fullWidth sx={inputSx} />
            </Grid>
            <Grid item xs={12} sm={5}>
              <FormControl fullWidth sx={inputSx}>
                <InputLabel>Direction</InputLabel>
                <Select value={formData.trade_direction} label="Direction" onChange={e => fd('trade_direction', e.target.value)} sx={{ color: 'white' }}>
                  <MenuItem value="BUY"  sx={{ background: '#0f172a', color: '#22c55e', fontWeight: 700 }}>�–� BUY</MenuItem>
                  <MenuItem value="SELL" sx={{ background: '#0f172a', color: '#ef4444', fontWeight: 700 }}>�–� SELL</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="Entry Date & Time" type="datetime-local" value={formData.entry_date} onChange={e => fd('entry_date', e.target.value)} fullWidth sx={inputSx} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Exit Date & Time" type="datetime-local" value={formData.exit_date} onChange={e => fd('exit_date', e.target.value)} fullWidth sx={inputSx} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', mt: 0.5 }}>Price Levels</Typography>
          <Grid container spacing={2}>
            {[['entry_price','Entry Price'],['exit_price','Exit Price'],['stop_loss','Stop Loss'],['take_profit','Take Profit']].map(([key, label]) => (
              <Grid item xs={6} sm={3} key={key}>
                <TextField label={label} type="number" value={(formData as any)[key]} onChange={e => fd(key, e.target.value)} fullWidth sx={inputSx} inputProps={{ step: 'any' }} />
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label="Lot Size" type="number" value={formData.lot_size} onChange={e => fd('lot_size', e.target.value)} fullWidth sx={inputSx} inputProps={{ step: 'any' }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth sx={inputSx}>
                <InputLabel>Emotional State</InputLabel>
                <Select value={formData.emotional_state} label="Emotional State" onChange={e => fd('emotional_state', e.target.value)} sx={{ color: 'white' }}>
                  {EMOTION_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ background: '#0f172a', color: 'white' }}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth sx={inputSx}>
                <InputLabel>Strategy</InputLabel>
                <Select value={formData.strategy_used} label="Strategy" onChange={e => fd('strategy_used', e.target.value)} sx={{ color: 'white' }}>
                  {STRATEGY_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ background: '#0f172a', color: 'white' }}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <TextField label="Trade Notes" value={formData.notes} onChange={e => fd('notes', e.target.value)} multiline rows={3} fullWidth sx={inputSx} />
          <TextField label="Lessons Learned" value={formData.lessons_learned} onChange={e => fd('lessons_learned', e.target.value)} multiline rows={2} fullWidth sx={inputSx} />
          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', mb: 1.5 }}>�Ÿ““ RiskGuardian Notion Template (Optional)</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              {['template','custom'].map(m => (
                <Button key={m} onClick={() => setNotionMode(m as any)} size="small"
                  sx={{ flex: 1, borderRadius: '10px', textTransform: 'none', fontSize: '13px', fontWeight: 600, ...(notionMode === m ? { background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white' } : { border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }) }}>
                  {m === 'template' ? '�Ÿ“‹ RiskGuardian Template' : '�Ÿ”— Custom Link'}
                </Button>
              ))}
            </Box>
            {notionMode === 'template' ? (
              <Button href={RISKGUARDIAN_TEMPLATE} target="_blank" fullWidth startIcon={<OpenInNew />} onClick={() => fd('notion_link', RISKGUARDIAN_TEMPLATE)} sx={{ py: 1.5, borderRadius: '10px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontWeight: 600, textTransform: 'none' }}>
                Open RiskGuardian Template
              </Button>
            ) : (
              <TextField placeholder="https://notion.so/..." value={formData.notion_link} onChange={e => fd('notion_link', e.target.value)} fullWidth sx={inputSx} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" sx={{ borderRadius: '12px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', fontWeight: 700, textTransform: 'none', px: 4 }}>
            {editingEntry ? 'Update' : 'Save Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JournalView;

