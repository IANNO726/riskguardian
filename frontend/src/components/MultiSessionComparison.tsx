/**
 * MultiSessionComparison.tsx
 * --------------------------
 * Compare up to 5 prop firm challenge simulation sessions side-by-side.
 * Loaded from localStorage (saved sessions) or manually imported.
 *
 * Usage in Simulator.tsx:
 *   import MultiSessionComparison from './MultiSessionComparison'
 *   // Render as a separate tab or page section
 *   <MultiSessionComparison />
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Button, CircularProgress,
  Card, CardContent, IconButton, Tooltip,
} from '@mui/material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Delete, Compare, Add, EmojiEvents, Refresh } from '@mui/icons-material';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// localStorage key for saved sessions
const SAVED_SESSIONS_KEY = 'rg_saved_sim_sessions';

interface SessionSummary {
  label:              string;
  firm:               string;
  account_size:       number;
  final_balance:      number;
  total_pnl:          number;
  profit_pct:         number;
  win_rate:           number;
  total_trades:       number;
  wins:               number;
  losses:             number;
  avg_win:            number;
  avg_loss:           number;
  expectancy:         number;
  max_drawdown_pct:   number;
  max_consec_losses:  number;
  days_traded:        number;
  passed:             boolean;
  profit_target_pct:  number;
  dd_limit_pct:       number;
  equity_curve:       Array<{ trade: number; balance: number; pnl_pct: number; drawdown: number }>;
}

interface Winner {
  winner:    string | null;
  value:     number | null;
  label:     string;
  direction: string;
}

interface CompareResult {
  sessions:        SessionSummary[];
  winners:         Record<string, Winner>;
  score_tally:     Record<string, number>;
  overall_winner:  string | null;
}

interface SavedSession {
  id:         string;
  label:      string;
  saved_at:   string;
  firm:       string;
  account:    number;
  session:    Record<string, any>;
}

// Colours for up to 5 sessions
const SESSION_COLORS = ['#38bdf8','#a855f7','#22c55e','#f59e0b','#ef4444'];

function loadSavedSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SAVED_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: SavedSession[]) {
  try {
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

// ── Main component ─────────────────────────────────────────────────────────────

const MultiSessionComparison: React.FC = () => {
  const [saved,    setSaved]    = useState<SavedSession[]>(loadSavedSessions);
  const [selected, setSelected] = useState<string[]>([]);  // ids to compare
  const [result,   setResult]   = useState<CompareResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Load saved sessions on mount
  useEffect(() => {
    setSaved(loadSavedSessions());
  }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setResult(null);
  };

  const deleteSession = (id: string) => {
    const updated = saved.filter(s => s.id !== id);
    setSaved(updated);
    saveSessions(updated);
    setSelected(prev => prev.filter(x => x !== id));
    setResult(null);
  };

  const runComparison = async () => {
    if (selected.length < 2) {
      setError('Select at least 2 sessions to compare');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const sessionsToCompare = selected.map(id => saved.find(s => s.id === id)?.session).filter(Boolean);
      const labels = selected.map(id => saved.find(s => s.id === id)?.label || 'Session');
      const resp = await axios.post(`${API}/simulator/compare`, {
        sessions: sessionsToCompare,
        labels,
      });
      setResult(resp.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Save current simulator session (called from Simulator parent) ─────────
  // This function is exported for use by the parent Simulator component:
  // saveSimSession(session, rules, label)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _saveSession = (session: Record<string, any>, rules: Record<string, any>, label?: string) => {
    const id = `sess_${Date.now()}`;
    const firm = rules?.name || 'Custom';
    const entry: SavedSession = {
      id,
      label: label || `${firm} — ${new Date().toLocaleDateString()}`,
      saved_at: new Date().toISOString(),
      firm,
      account: session.initial_balance || session.balance || 0,
      session: { ...session, rules },
    };
    const updated = [entry, ...saved].slice(0, 10);  // keep last 10
    setSaved(updated);
    saveSessions(updated);
    return id;
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 0 } }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>
            Multi-Session Comparison
          </Typography>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
            Compare up to 5 challenge sessions side-by-side
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {selected.length >= 2 && (
            <Button
              onClick={runComparison}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={15} /> : <Compare />}
              sx={{ borderRadius: '12px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontWeight: 700, textTransform: 'none', px: 3 }}
            >
              {loading ? 'Comparing…' : `Compare ${selected.length} Sessions`}
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Box sx={{ p: 2, mb: 2, borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <Typography sx={{ fontSize: '13px', color: '#ef4444' }}>⚠ {error}</Typography>
        </Box>
      )}

      {/* Saved sessions list */}
      {saved.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, borderRadius: '18px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <Typography sx={{ fontSize: '40px', mb: 2, opacity: 0.3 }}>📊</Typography>
          <Typography sx={{ fontSize: '16px', color: 'rgba(255,255,255,0.3)', mb: 1 }}>
            No saved sessions yet
          </Typography>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.2)' }}>
            Complete a challenge simulation and click "Save Session" to compare here
          </Typography>
        </Box>
      ) : (
        <>
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.1em', mb: 1.5 }}>
            {selected.length > 0 ? `${selected.length} selected` : 'Select sessions to compare (min 2, max 5)'}
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 2, mb: 3 }}>
            {saved.map((sess, idx) => {
              const isSelected = selected.includes(sess.id);
              const selIdx     = selected.indexOf(sess.id);
              const color      = isSelected ? SESSION_COLORS[selIdx] : 'rgba(255,255,255,0.2)';
              const pnl        = (sess.session.balance || 0) - sess.account;
              const pnlPct     = sess.account > 0 ? (pnl / sess.account * 100).toFixed(2) : '0.00';

              return (
                <Box
                  key={sess.id}
                  onClick={() => toggleSelect(sess.id)}
                  sx={{
                    p: 2, borderRadius: '14px', cursor: 'pointer',
                    background: isSelected ? `${color}12` : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: color, background: `${color}08` },
                    position: 'relative',
                  }}
                >
                  {isSelected && (
                    <Box sx={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '11px', fontWeight: 900, color: 'white' }}>{selIdx + 1}</Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pr: 3 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sess.label}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        {sess.firm} · ${sess.account.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip
                      label={`${pnl >= 0 ? '+' : ''}${pnlPct}%`}
                      size="small"
                      sx={{ height: 22, fontSize: '12px', fontWeight: 700,
                        background: pnl >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                        color: pnl >= 0 ? '#22c55e' : '#ef4444',
                        border: `1px solid ${pnl >= 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      }}
                    />
                    <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                      {new Date(sess.saved_at).toLocaleDateString()}
                    </Typography>
                    <Tooltip title="Delete session">
                      <IconButton
                        size="small"
                        onClick={e => { e.stopPropagation(); deleteSession(sess.id); }}
                        sx={{ ml: 'auto', color: 'rgba(255,255,255,0.2)', p: 0.3, '&:hover': { color: '#ef4444' } }}
                      >
                        <Delete sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {/* Comparison result */}
      {result && <ComparisonResult result={result} />}
    </Box>
  );
};


// ── Comparison result component ───────────────────────────────────────────────

const ComparisonResult: React.FC<{ result: CompareResult }> = ({ result }) => {
  const { sessions, winners, score_tally, overall_winner } = result;

  // Build combined equity curve data
  const maxTrades = Math.max(...sessions.map(s => s.equity_curve?.length || 0));
  const curveData = Array.from({ length: maxTrades }, (_, i) => {
    const pt: Record<string, any> = { trade: i + 1 };
    sessions.forEach((sess, si) => {
      const curve = sess.equity_curve || [];
      if (i < curve.length) {
        pt[`pnl_${si}`]  = curve[i].pnl_pct;
        pt[`dd_${si}`]   = curve[i].drawdown;
      }
    });
    return pt;
  });

  const metrics = [
    { key: 'profit_pct',       label: 'Net Profit %',     fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
    { key: 'win_rate',         label: 'Win Rate',          fmt: (v: number) => `${v}%` },
    { key: 'expectancy',       label: 'Expectancy',        fmt: (v: number) => `$${v.toFixed(2)}` },
    { key: 'max_drawdown_pct', label: 'Max DD',            fmt: (v: number) => `${v.toFixed(2)}%` },
    { key: 'avg_win',          label: 'Avg Win',           fmt: (v: number) => `$${v.toFixed(2)}` },
    { key: 'avg_loss',         label: 'Avg Loss',          fmt: (v: number) => `$${v.toFixed(2)}` },
    { key: 'max_consec_losses',label: 'Max Consec Losses', fmt: (v: number) => `${v}` },
    { key: 'total_trades',     label: 'Trades',            fmt: (v: number) => `${v}` },
  ];

  return (
    <Box>
      {/* Overall winner banner */}
      {overall_winner && (
        <Box sx={{ p: 2.5, mb: 3, borderRadius: '16px', background: 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', gap: 2 }}>
          <EmojiEvents sx={{ color: '#fbbf24', fontSize: 32 }} />
          <Box>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>OVERALL WINNER</Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24' }}>{overall_winner}</Typography>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              Won {score_tally[overall_winner]} of {Object.keys(score_tally).length > 1 ? (metrics.length - 1) : metrics.length} metrics
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            {Object.entries(score_tally).sort((a,b) => b[1]-a[1]).map(([label, score], i) => (
              <Box key={i} sx={{ textAlign: 'center', px: 1.5, py: 1, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: SESSION_COLORS[sessions.findIndex(s => s.label === label)] || 'white' }}>{score}</Typography>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{label.slice(0,12)}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Passed / Blown status row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {sessions.map((sess, i) => (
          <Box key={i} sx={{ flex: '1 1 160px', p: 2, borderRadius: '14px', background: sess.passed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${sess.passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: SESSION_COLORS[i] }} />
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{sess.label}</Typography>
            </Box>
            <Typography sx={{ fontSize: '22px', fontWeight: 800, color: sess.passed ? '#22c55e' : '#ef4444' }}>
              {sess.passed ? '✅ PASSED' : '❌ BLOWN'}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
              {sess.firm} · ${sess.account_size?.toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Metrics comparison table */}
      <Box sx={{ mb: 3, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: `200px ${sessions.map(() => '1fr').join(' ')}`, background: 'rgba(255,255,255,0.04)' }}>
          <Box sx={{ p: 1.5, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Metric</Typography>
          </Box>
          {sessions.map((sess, i) => (
            <Box key={i} sx={{ p: 1.5, textAlign: 'center', borderRight: i < sessions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: SESSION_COLORS[i] }} />
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: SESSION_COLORS[i] }}>{sess.label}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {metrics.map((metric, mi) => {
          const winner = winners[metric.key];
          return (
            <Box
              key={mi}
              sx={{ display: 'grid', gridTemplateColumns: `200px ${sessions.map(() => '1fr').join(' ')}`, borderTop: '1px solid rgba(255,255,255,0.05)', '&:hover': { background: 'rgba(255,255,255,0.015)' } }}
            >
              <Box sx={{ p: 1.5, borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{metric.label}</Typography>
              </Box>
              {sessions.map((sess, si) => {
                const val = (sess as any)[metric.key];
                const isWinner = winner?.winner === sess.label && winner?.direction !== 'info';
                const isPositive = metric.key === 'profit_pct' || metric.key === 'expectancy' || metric.key === 'avg_win' || metric.key === 'win_rate';
                const isBad = metric.key === 'avg_loss' || metric.key === 'max_drawdown_pct' || metric.key === 'max_consec_losses';
                const numVal = typeof val === 'number' ? val : 0;
                const textColor = isWinner ? SESSION_COLORS[si] :
                  isPositive && numVal > 0 ? '#22c55e' :
                  isPositive && numVal < 0 ? '#ef4444' :
                  'rgba(255,255,255,0.7)';

                return (
                  <Box
                    key={si}
                    sx={{ p: 1.5, textAlign: 'center', borderRight: si < sessions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: isWinner ? `${SESSION_COLORS[si]}08` : 'transparent' }}
                  >
                    <Typography sx={{ fontSize: '14px', fontWeight: isWinner ? 800 : 500, color: textColor, fontFamily: 'monospace' }}>
                      {metric.fmt(numVal)}
                    </Typography>
                    {isWinner && (
                      <Typography sx={{ fontSize: '9px', color: SESSION_COLORS[si], fontWeight: 700, textTransform: 'uppercase', mt: 0.3 }}>
                        ★ BEST
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>

      {/* Equity curves overlay chart */}
      {curveData.length > 1 && (
        <Box sx={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', p: 2.5, mb: 3 }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', mb: 2 }}>P&L % Over Time</Typography>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="trade" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
              <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
              {sessions.map((_, si) => (
                <Area
                  key={si}
                  type="monotone"
                  dataKey={`pnl_${si}`}
                  stroke={SESSION_COLORS[si]}
                  fill={`${SESSION_COLORS[si]}15`}
                  strokeWidth={2}
                  dot={false}
                  name={sessions[si].label}
                />
              ))}
              <RechartsTooltip
                contentStyle={{ background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                formatter={(val: any, name: string) => [`${val?.toFixed(2)}%`, name]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
};

export { loadSavedSessions, saveSessions };
export type { SavedSession };
export default MultiSessionComparison;