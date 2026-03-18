import React, { useState, useEffect } from "react";
import {
  Box, Typography, Grid, CircularProgress, Chip, Button,
  ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import {
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Area, AreaChart, Brush, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import axios from "axios";
import { TrendingUp, TrendingDown, Refresh, Lock } from "@mui/icons-material";

const API = "https://riskguardian.onrender.com/api/v1";

interface AnalyticsData {
  balance: number; equity: number; current_profit: number; currency: string;
  return_pct: number; max_drawdown: number; win_rate: number; total_trades: number;
  winning_trades: number; losing_trades: number; avg_win: number; avg_loss: number;
  profit_factor: number; best_trade: number; worst_trade: number;
  best_day: number; worst_day: number; net_profit: number;
  total_profit: number; total_loss: number; initial_balance: number;
  equity_data: Array<{ date: string; balance: number; drawdown: number }>;
  pnl_by_date: Record<string, number>;
}

// â”€â”€â”€ NEW: Lock history types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface LockEvent {
  id: number;
  date: string;
  reason: string;
  reason_label: string;
  duration_minutes: number;
  triggered_by: string;
  daily_loss_at_trigger: number | null;
  notes: string;
}

interface LockHistory {
  total_locks: number;
  locks_this_week: number;
  locks_last_week: number;
  avg_duration_minutes: number;
  most_common_reason: string;
  reason_breakdown: Record<string, number>;
  weekly_counts: Array<{ week: string; count: number }>;
  recent_events: LockEvent[];
}

// â”€â”€â”€ Existing sub-components (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CustomTooltip = ({ active, payload, label, isEquity }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <Box sx={{ background: 'rgba(10,14,26,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', px: 2.5, py: 2, backdropFilter: 'blur(20px)', minWidth: 160 }}>
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</Typography>
      <Typography sx={{ fontSize: '20px', fontWeight: 800, color: isEquity ? '#22c55e' : '#ef4444', fontFamily: '"DM Mono",monospace' }}>
        {isEquity ? `$${Number(val).toFixed(2)}` : `${Number(val).toFixed(2)}%`}
      </Typography>
      <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', mt: 0.5 }}>{isEquity ? 'Account Balance' : 'Drawdown from Peak'}</Typography>
    </Box>
  );
};

const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const chartData = data.map((v, i) => ({ v, i }));
  const gradId = `spark${color.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const RingProgress: React.FC<{ value: number; color: string; size?: number }> = ({ value, color, size = 80 }) => {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '13px', fontWeight: 800, color, fontFamily: '"DM Mono",monospace' }}>{value.toFixed(0)}%</Typography>
      </Box>
    </Box>
  );
};

// â”€â”€â”€ NEW: Lock History Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LockHistorySection: React.FC = () => {
  const [data,    setData]    = useState<LockHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/analytics/lock-history`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress sx={{ color: '#ef4444' }} size={32} />
    </Box>
  );

  if (!data || data.total_locks === 0) return (
    <Box sx={{ p: 4, borderRadius: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
      <Typography sx={{ fontSize: '40px', opacity: 0.2, mb: 1.5 }}>ðŸ”’</Typography>
      <Typography sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.3)' }}>No lock events yet</Typography>
      <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.18)', mt: 0.5 }}>Lock events will appear here when you activate Risk Lock</Typography>
    </Box>
  );

  const weekTrend = data.locks_this_week - data.locks_last_week;
  const avgDurStr = data.avg_duration_minutes >= 60
    ? `${(data.avg_duration_minutes / 60).toFixed(1)}h`
    : `${data.avg_duration_minutes}m`;

  const reasonColors: Record<string, string> = {
    'ðŸ˜¤ Revenge Trade': '#f97316',
    'ðŸ“‰ Loss Limit':    '#ef4444',
    'ðŸ§˜ Manual':        '#38bdf8',
    'ðŸ¤– Auto Loss':     '#a855f7',
    'ðŸ”’ Risk Lock':     '#fbbf24',
  };

  const barData = Object.entries(data.reason_breakdown).map(([reason, count]) => ({
    reason: reason.replace(/^[^\s]+\s/, ''), // strip emoji for bar label
    full: reason,
    count,
    fill: reasonColors[reason] || '#38bdf8',
  }));

  return (
    <Box>
      {/* â”€â”€ Header â”€â”€ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Lock sx={{ color: '#ef4444', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>Risk Lock History</Typography>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Discipline tracking â€” your emotional guardrails</Typography>
        </Box>
      </Box>

      {/* â”€â”€ KPI row â”€â”€ */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            label: 'Total Locks',
            value: data.total_locks.toString(),
            sub: 'all time',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.08)',
            border: 'rgba(239,68,68,0.2)',
            icon: 'ðŸ”’',
          },
          {
            label: 'This Week',
            value: data.locks_this_week.toString(),
            sub: weekTrend === 0 ? 'same as last week'
              : weekTrend > 0 ? `â†‘ ${weekTrend} more than last week`
              : `â†“ ${Math.abs(weekTrend)} fewer than last week`,
            color: data.locks_this_week === 0 ? '#22c55e' : data.locks_this_week <= 2 ? '#fbbf24' : '#ef4444',
            bg: data.locks_this_week === 0 ? 'rgba(34,197,94,0.08)' : data.locks_this_week <= 2 ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.08)',
            border: data.locks_this_week === 0 ? 'rgba(34,197,94,0.2)' : data.locks_this_week <= 2 ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)',
            icon: data.locks_this_week === 0 ? 'âœ…' : 'ðŸ“…',
          },
          {
            label: 'Avg Duration',
            value: avgDurStr,
            sub: 'per lock session',
            color: '#38bdf8',
            bg: 'rgba(56,189,248,0.08)',
            border: 'rgba(56,189,248,0.2)',
            icon: 'â±',
          },
          {
            label: 'Top Trigger',
            value: data.most_common_reason,
            sub: 'most common reason',
            color: '#a855f7',
            bg: 'rgba(168,85,247,0.08)',
            border: 'rgba(168,85,247,0.2)',
            icon: 'ðŸ”',
          },
        ].map(card => (
          <Grid item xs={6} md={3} key={card.label}>
            <Box sx={{ p: 2.5, borderRadius: '16px', background: card.bg, border: `1px solid ${card.border}`, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{card.label}</Typography>
                <Typography sx={{ fontSize: '16px' }}>{card.icon}</Typography>
              </Box>
              <Typography sx={{ fontSize: card.label === 'Top Trigger' ? '14px' : '26px', fontWeight: 800, color: card.color, fontFamily: '"DM Mono",monospace', lineHeight: 1.2, mb: 0.5 }}>
                {card.value}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{card.sub}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* â”€â”€ Charts row â”€â”€ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>

        {/* Weekly bar chart */}
        <Grid item xs={12} md={7}>
          <Box sx={{ p: 3, borderRadius: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', mb: 2 }}>ðŸ”’ Locks Per Week (Last 8 Weeks)</Typography>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.weekly_counts} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="week" stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ background: 'rgba(10,14,26,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '13px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.weekly_counts.map((entry, i) => (
                    <Cell key={i} fill={entry.count === 0 ? 'rgba(255,255,255,0.08)' : entry.count <= 2 ? '#fbbf24' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>

        {/* Reason breakdown */}
        <Grid item xs={12} md={5}>
          <Box sx={{ p: 3, borderRadius: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', mb: 2 }}>ðŸ§  Lock Triggers Breakdown</Typography>
            {barData.map(item => {
              const total = barData.reduce((s, b) => s + b.count, 0);
              const pct   = total > 0 ? Math.round(item.count / total * 100) : 0;
              return (
                <Box key={item.reason} sx={{ mb: 1.8 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
                    <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{item.full}</Typography>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: item.fill, fontFamily: '"DM Mono",monospace' }}>{item.count}Ã—</Typography>
                  </Box>
                  <Box sx={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: item.fill, transition: 'width 0.8s ease', boxShadow: `0 0 8px ${item.fill}66` }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Grid>
      </Grid>

      {/* â”€â”€ Recent events list â”€â”€ */}
      <Box sx={{ p: 3, borderRadius: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', mb: 2 }}>ðŸ“‹ Recent Lock Events</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {data.recent_events.slice(0, 10).map(event => {
            const dur = event.duration_minutes >= 60
              ? `${(event.duration_minutes / 60).toFixed(1)}h`
              : `${event.duration_minutes}m`;
            const d = new Date(event.date);
            const dateStr = isNaN(d.getTime()) ? 'â€”' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const accentColor = reasonColors[event.reason_label] || '#38bdf8';
            return (
              <Box key={event.id} sx={{
                display: 'flex', alignItems: 'center', gap: 2,
                p: 2, borderRadius: '14px',
                background: `${accentColor}08`,
                border: `1px solid ${accentColor}22`,
                flexWrap: 'wrap',
              }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: `${accentColor}18`, border: `1px solid ${accentColor}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  ðŸ”’
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{event.reason_label}</Typography>
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{dateStr}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
                  <Chip label={`â± ${dur}`} size="small" sx={{ height: 24, fontSize: '12px', fontWeight: 700, background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}35` }} />
                  {event.triggered_by === 'auto' && (
                    <Chip label="ðŸ¤– Auto" size="small" sx={{ height: 24, fontSize: '11px', fontWeight: 600, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }} />
                  )}
                  {event.daily_loss_at_trigger != null && event.daily_loss_at_trigger < 0 && (
                    <Chip label={`P&L $${event.daily_loss_at_trigger.toFixed(2)}`} size="small" sx={{ height: 24, fontSize: '11px', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} />
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

// â”€â”€â”€ Auto-Lock Config Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AutoLockConfigPanel: React.FC = () => {
  const [enabled,    setEnabled]    = useState(false);
  const [threshold,  setThreshold]  = useState(2.0);
  const [minutes,    setMinutes]    = useState(60);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    axios.get(`${API}/cooldown/auto-lock/config`)
      .then(r => {
        setEnabled(r.data.enabled || false);
        setThreshold(r.data.loss_threshold_pct || 2.0);
        setMinutes(r.data.cooldown_minutes || 60);
      }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/cooldown/auto-lock/config`, {
        enabled, loss_threshold_pct: threshold, cooldown_minutes: minutes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ p: 3, borderRadius: '20px', background: enabled ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.025)', border: `1px solid ${enabled ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ fontSize: '22px' }}>ðŸ¤–</Box>
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>Auto-Lock Trigger</Typography>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Automatically locks trading when daily loss hits threshold</Typography>
          </Box>
        </Box>
        <Box
          onClick={() => setEnabled(v => !v)}
          sx={{
            width: 52, height: 28, borderRadius: 14, cursor: 'pointer',
            background: enabled ? '#ef4444' : 'rgba(255,255,255,0.12)',
            border: `2px solid ${enabled ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
            position: 'relative', transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          <Box sx={{
            position: 'absolute', top: 2, left: enabled ? 24 : 2, width: 20, height: 20,
            borderRadius: '50%', background: 'white', transition: 'left 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }} />
        </Box>
      </Box>

      {/* Config fields */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
            Daily Loss Threshold
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="input"
              type="number"
              min={0.5} max={20} step={0.5}
              value={threshold}
              onChange={(e: any) => setThreshold(parseFloat(e.target.value))}
              disabled={!enabled}
              sx={{
                width: '100%', p: '10px 14px', borderRadius: '12px',
                background: enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: enabled ? 'white' : 'rgba(255,255,255,0.25)',
                fontSize: '16px', fontWeight: 700, fontFamily: '"DM Mono",monospace',
                outline: 'none', opacity: enabled ? 1 : 0.5,
              }}
            />
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap' }}>% of balance</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
            Auto-Lock Duration
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[30, 60, 120, 240].map(m => (
              <Button key={m} disabled={!enabled} onClick={() => setMinutes(m)}
                sx={{
                  px: 2, py: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: '13px',
                  background: minutes === m ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${minutes === m ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: minutes === m ? '#ef4444' : 'rgba(255,255,255,0.4)',
                  opacity: enabled ? 1 : 0.4,
                }}>
                {m >= 60 ? `${m/60}h` : `${m}m`}
              </Button>
            ))}
          </Box>
        </Grid>
      </Grid>

      {enabled && (
        <Box sx={{ mb: 2, p: 2, borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
            âš¡ When your daily loss reaches <strong style={{ color: '#ef4444' }}>{threshold}% of balance</strong>, Risk Lock activates automatically for <strong style={{ color: '#ef4444' }}>{minutes >= 60 ? `${minutes/60}h` : `${minutes}m`}</strong> and logs the event to your journal.
          </Typography>
        </Box>
      )}

      <Button onClick={save} disabled={saving}
        sx={{
          px: 3, py: 1.2, borderRadius: '12px', textTransform: 'none', fontWeight: 700, fontSize: '14px',
          background: saved ? 'rgba(34,197,94,0.2)' : enabled ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${saved ? 'rgba(34,197,94,0.4)' : enabled ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: saved ? '#22c55e' : enabled ? '#ef4444' : 'rgba(255,255,255,0.4)',
        }}>
        {saving ? 'Savingâ€¦' : saved ? 'âœ… Saved!' : 'Save Settings'}
      </Button>
    </Box>
  );
};

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AnalyticsView: React.FC = () => {
  const [mode, setMode] = useState<"equity" | "drawdown">("equity");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => { fetchAnalytics(); setLastUpdate(new Date()); }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const r = await axios.get(`${API}/analytics/performance`);
      setData(r.data);
    } catch {}
    finally { setLoading(false); if (manual) setRefreshing(false); }
  };

  if (loading || !data) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0b1120', gap: 2 }}>
      <CircularProgress sx={{ color: '#38bdf8' }} size={48} />
      <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>Loading analytics...</Typography>
    </Box>
  );

  const isEquity = mode === "equity";
  const chartKey = isEquity ? "balance" : "drawdown";
  const chartColor = isEquity ? "#22c55e" : "#ef4444";
  const sparkData = data.equity_data.slice(-14).map(d => d.balance);
  const totalTrades = data.winning_trades + data.losing_trades;
  const winPct = totalTrades > 0 ? (data.winning_trades / totalTrades) * 100 : 0;
  const pfColor = data.profit_factor >= 2 ? '#22c55e' : data.profit_factor >= 1 ? '#fbbf24' : '#ef4444';

  const cardBase = {
    p: 3, borderRadius: '20px', position: 'relative', overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
    '&:hover': { transform: 'translateY(-5px)' },
    '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px' },
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      p: { xs: 2, sm: 3, md: 4 },
      background: 'radial-gradient(ellipse at 10% 0%,rgba(34,197,94,0.07),transparent 45%), radial-gradient(ellipse at 90% 10%,rgba(56,189,248,0.07),transparent 45%), radial-gradient(ellipse at 50% 100%,rgba(168,85,247,0.05),transparent 50%), #0b1120',
      color: 'white',
    }}>

      {/* â”€â”€ Header â”€â”€ */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 3, md: 4 }, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 4, height: 32, borderRadius: 2, background: 'linear-gradient(180deg,#38bdf8,#22c55e)' }} />
            <Typography sx={{ fontSize: { xs: '22px', md: '30px' }, fontWeight: 800, background: 'linear-gradient(90deg,#38bdf8,#22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
              Trading Performance
            </Typography>
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', ml: '20px' }}>
            Live account analytics & risk metrics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: '10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'livePulse 2s infinite' }} />
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', letterSpacing: '0.1em' }}>LIVE</Typography>
          </Box>
          <Button onClick={() => fetchAnalytics(true)} disabled={refreshing} size="small"
            startIcon={refreshing ? <CircularProgress size={14} sx={{ color: '#38bdf8' }} /> : <Refresh sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', textTransform: 'none', fontWeight: 600, px: 2, fontSize: '13px' }}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* â”€â”€ KPI Cards Row â”€â”€ */}
      <Grid container spacing={{ xs: 1.5, md: 2.5 }} sx={{ mb: { xs: 3, md: 4 } }}>
        <Grid item xs={12} sm={6} xl={3}>
          <Box sx={{ ...cardBase, background: 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(56,189,248,0.03))', border: '1px solid rgba(56,189,248,0.2)', '&:hover': { ...cardBase['&:hover'], boxShadow: '0 20px 50px rgba(56,189,248,0.18)' }, '&::before': { ...cardBase['&::before'], background: 'linear-gradient(90deg,transparent,#38bdf8,transparent)' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Account Balance</Typography>
                <Typography sx={{ fontSize: { xs: '24px', md: '28px' }, fontWeight: 800, color: '#38bdf8', fontFamily: '"DM Mono",monospace', lineHeight: 1 }}>${data.balance.toFixed(2)}</Typography>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', mt: 0.5 }}>{data.currency} â€¢ Initial: ${data.initial_balance.toFixed(0)}</Typography>
              </Box>
              <Box sx={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>ðŸ’°</Box>
            </Box>
            <MiniSparkline data={sparkData} color="#38bdf8" />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} xl={3}>
          <Box sx={{ ...cardBase, background: data.return_pct >= 0 ? 'linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.03))' : 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.03))', border: `1px solid ${data.return_pct >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, '&:hover': { ...cardBase['&:hover'], boxShadow: `0 20px 50px ${data.return_pct >= 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}` }, '&::before': { ...cardBase['&::before'], background: `linear-gradient(90deg,transparent,${data.return_pct >= 0 ? '#22c55e' : '#ef4444'},transparent)` } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Total Return</Typography>
                <Typography sx={{ fontSize: { xs: '24px', md: '28px' }, fontWeight: 800, color: data.return_pct >= 0 ? '#22c55e' : '#ef4444', fontFamily: '"DM Mono",monospace', lineHeight: 1 }}>{data.return_pct >= 0 ? '+' : ''}{data.return_pct.toFixed(2)}%</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  {data.net_profit >= 0 ? <TrendingUp sx={{ fontSize: 13, color: '#22c55e' }} /> : <TrendingDown sx={{ fontSize: 13, color: '#ef4444' }} />}
                  <Typography sx={{ fontSize: '12px', color: data.net_profit >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>${Math.abs(data.net_profit).toFixed(2)}</Typography>
                </Box>
              </Box>
              <Box sx={{ width: 42, height: 42, borderRadius: '12px', background: data.return_pct >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${data.return_pct >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{data.return_pct >= 0 ? 'ðŸ“ˆ' : 'ðŸ“‰'}</Box>
            </Box>
            <Box sx={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${Math.min(Math.abs(data.return_pct), 100)}%`, borderRadius: 2, background: data.return_pct >= 0 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#dc2626,#ef4444)', transition: 'width 1s ease' }} />
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} xl={3}>
          <Box sx={{ ...cardBase, background: 'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(168,85,247,0.03))', border: '1px solid rgba(168,85,247,0.2)', '&:hover': { ...cardBase['&:hover'], boxShadow: '0 20px 50px rgba(168,85,247,0.18)' }, '&::before': { ...cardBase['&::before'], background: 'linear-gradient(90deg,transparent,#a855f7,transparent)' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>Win Rate</Typography>
                <Typography sx={{ fontSize: { xs: '24px', md: '28px' }, fontWeight: 800, color: winPct >= 50 ? '#22c55e' : '#f59e0b', fontFamily: '"DM Mono",monospace', lineHeight: 1, mb: 1 }}>{winPct.toFixed(1)}%</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ px: 1.5, py: 0.4, borderRadius: '6px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>{data.winning_trades}W</Typography>
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.4, borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>{data.losing_trades}L</Typography>
                  </Box>
                </Box>
              </Box>
              <RingProgress value={winPct} color={winPct >= 50 ? '#22c55e' : '#f59e0b'} size={84} />
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} xl={3}>
          <Box sx={{ ...cardBase, background: 'linear-gradient(135deg,rgba(239,68,68,0.08),rgba(251,191,36,0.05))', border: '1px solid rgba(239,68,68,0.18)', '&:hover': { ...cardBase['&:hover'], boxShadow: '0 20px 50px rgba(239,68,68,0.12)' }, '&::before': { ...cardBase['&::before'], background: 'linear-gradient(90deg,transparent,#ef4444,#fbbf24,transparent)' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>Max Drawdown</Typography>
                <Typography sx={{ fontSize: { xs: '24px', md: '28px' }, fontWeight: 800, color: '#ef4444', fontFamily: '"DM Mono",monospace', lineHeight: 1 }}>{data.max_drawdown.toFixed(2)}%</Typography>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', mt: 0.5 }}>From peak equity</Typography>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Profit Factor</Typography>
                  <Typography sx={{ fontSize: '22px', fontWeight: 800, color: pfColor, fontFamily: '"DM Mono",monospace' }}>{data.profit_factor.toFixed(2)}</Typography>
                  <Typography sx={{ fontSize: '10px', color: pfColor, fontWeight: 600 }}>{data.profit_factor >= 2 ? 'âœ… Excellent' : data.profit_factor >= 1 ? 'âš ï¸ Acceptable' : 'âŒ Below 1.0'}</Typography>
                </Box>
              </Box>
              <Box sx={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>âš ï¸</Box>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* â”€â”€ Chart Section â”€â”€ */}
      <Box sx={{ borderRadius: '24px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', mb: { xs: 3, md: 4 }, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 2, md: 3 }, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', background: isEquity ? 'rgba(34,197,94,0.03)' : 'rgba(239,68,68,0.03)' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: { xs: '15px', md: '17px' }, fontWeight: 700, color: 'white' }}>
                {isEquity ? 'ðŸ“ˆ Equity Curve' : 'ðŸ“‰ Drawdown Chart'}
              </Typography>
              <Chip label="30 Days" size="small" sx={{ height: 20, fontSize: '10px', fontWeight: 700, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }} />
            </Box>
            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', mt: 0.5 }}>
              {isEquity ? `Balance: $${data.balance.toFixed(2)}` : `Max drawdown: ${data.max_drawdown.toFixed(2)}%`}
            </Typography>
          </Box>
          <ToggleButtonGroup value={mode} exclusive onChange={(e, val) => val && setMode(val)} size="small"
            sx={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', p: 0.5, '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '8px !important', px: { xs: 1.5, md: 2.5 }, py: 0.8, fontSize: '12px', fontWeight: 600, textTransform: 'none', transition: 'all 0.2s', '&.Mui-selected': { background: isEquity ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: isEquity ? '#22c55e' : '#ef4444' } } }}>
            <ToggleButton value="equity">ðŸ“ˆ Equity</ToggleButton>
            <ToggleButton value="drawdown">ðŸ“‰ Drawdown</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ px: { xs: 0.5, md: 3 }, pt: 3, pb: 1 }}>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={data.equity_data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="mainAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="75%" stopColor={chartColor} stopOpacity={0.04} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
                <filter id="chartGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => isEquity ? `$${v}` : `${v}%`} width={68} />
              <Tooltip content={<CustomTooltip isEquity={isEquity} />} />
              {!isEquity && <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />}
              <Area type="monotone" dataKey={chartKey} stroke={chartColor} strokeWidth={2.5} fill="url(#mainAreaGrad)" dot={false} activeDot={{ r: 5, fill: chartColor, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2 }} filter="url(#chartGlow)" />
              <Brush dataKey="date" height={26} stroke="rgba(255,255,255,0.08)" fill="rgba(255,255,255,0.02)" travellerWidth={8} startIndex={Math.max(0, data.equity_data.length - 14)} />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ px: { xs: 2, md: 4 }, py: 2, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: { xs: 2, md: 4 }, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Best Day',    value: `+$${data.best_day.toFixed(2)}`,   color: '#22c55e' },
            { label: 'Worst Day',   value: `$${data.worst_day.toFixed(2)}`,   color: '#ef4444' },
            { label: 'Best Trade',  value: `+$${data.best_trade.toFixed(2)}`, color: '#38bdf8' },
            { label: 'Worst Trade', value: `$${data.worst_trade.toFixed(2)}`, color: '#f59e0b' },
          ].map(s => (
            <Box key={s.label}>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: s.color, fontFamily: '"DM Mono",monospace' }}>{s.value}</Typography>
            </Box>
          ))}
          <Box sx={{ ml: 'auto' }}>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>Last updated</Typography>
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{lastUpdate.toLocaleTimeString()}</Typography>
          </Box>
        </Box>
      </Box>

      {/* â”€â”€ Stats + Calendar â”€â”€ */}
      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 3, md: 4 } }}>
        <Grid item xs={12} lg={7}>
          <Box sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: '24px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px' }}>ðŸ“‹</Box>
              <Box>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>Detailed Statistics</Typography>
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{data.total_trades} total trades analyzed</Typography>
              </Box>
            </Box>
            <Grid container spacing={1.5}>
              {[
                { label: 'Total Profit',  value: `+$${data.total_profit.toFixed(2)}`,                                  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',  icon: 'ðŸ’š' },
                { label: 'Total Loss',    value: `-$${data.total_loss.toFixed(2)}`,                                    color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)', icon: 'ðŸ”´' },
                { label: 'Net P&L',       value: `${data.net_profit >= 0 ? '+' : ''}$${data.net_profit.toFixed(2)}`,  color: data.net_profit >= 0 ? '#22c55e' : '#ef4444', bg: data.net_profit >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: data.net_profit >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', icon: 'ðŸ’°' },
                { label: 'Avg Win',       value: `+$${data.avg_win.toFixed(2)}`,                                       color: '#22c55e', bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.15)', icon: 'â¬†ï¸' },
                { label: 'Avg Loss',      value: `-$${data.avg_loss.toFixed(2)}`,                                      color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.15)', icon: 'â¬‡ï¸' },
                { label: 'Profit Factor', value: data.profit_factor.toFixed(2),                                        color: pfColor,   bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', icon: 'âš–ï¸' },
                { label: 'Best Trade',    value: `+$${data.best_trade.toFixed(2)}`,                                    color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.2)', icon: 'ðŸ†' },
                { label: 'Worst Trade',   value: `$${data.worst_trade.toFixed(2)}`,                                    color: '#f59e0b', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)', icon: 'âš¡' },
                { label: 'Total Trades',  value: `${data.total_trades}`,                                               color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.2)', icon: 'ðŸ“Š' },
              ].map((row) => (
                <Grid item xs={6} sm={4} key={row.label}>
                  <Box sx={{ p: { xs: 1.5, md: 2 }, borderRadius: '14px', background: row.bg, border: `1px solid ${row.border}`, transition: 'all 0.2s', height: '100%', '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${row.border}` } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
                      <Typography sx={{ fontSize: '12px' }}>{row.icon}</Typography>
                      <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{row.label}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: { xs: '15px', md: '17px' }, fontWeight: 800, color: row.color, fontFamily: '"DM Mono",monospace', lineHeight: 1 }}>{row.value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 2.5, p: 2.5, borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#22c55e' }}>ðŸ† Wins: {data.winning_trades} ({winPct.toFixed(1)}%)</Typography>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>âŒ Losses: {data.losing_trades} ({(100-winPct).toFixed(1)}%)</Typography>
              </Box>
              <Box sx={{ height: 10, borderRadius: 5, background: 'rgba(239,68,68,0.3)', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${winPct}%`, background: 'linear-gradient(90deg,#16a34a,#22c55e)', borderRadius: 5, transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 0 12px rgba(34,197,94,0.5)' }} />
              </Box>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Box sx={{ p: { xs: 2.5, md: 3 }, borderRadius: '24px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px' }}>ðŸ“…</Box>
              <Box>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>Daily P&L Calendar</Typography>
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Green = profit â€¢ Red = loss</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
              {[{ c: '#22c55e', bg: 'rgba(34,197,94,0.15)', l: 'Profit day' }, { c: '#ef4444', bg: 'rgba(239,68,68,0.15)', l: 'Loss day' }, { c: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.04)', l: 'No trades' }].map(l => (
                <Box key={l.l} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 11, height: 11, borderRadius: '3px', background: l.bg, border: `1px solid ${l.c}` }} />
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{l.l}</Typography>
                </Box>
              ))}
            </Box>
            <Calendar
              locale="en-US"
              calendarType="gregory"
              tileContent={({ date }) => {
                const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                const pnl = data.pnl_by_date[key];
                if (!pnl) return null;
                return <div className="pnl-pill">{pnl > 0 ? `+${pnl.toFixed(0)}` : pnl.toFixed(0)}</div>;
              }}
              tileClassName={({ date }) => {
                const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                const pnl = data.pnl_by_date[key];
                if (!pnl) return 'no-trade-day';
                return pnl > 0 ? 'profit-day' : 'loss-day';
              }}
            />
          </Box>
        </Grid>
      </Grid>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          NEW: Risk Lock History section
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Box sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: '24px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(239,68,68,0.15)', mb: { xs: 3, md: 4 }, position: 'relative', overflow: 'hidden' }}>
        {/* Faint red glow in top-right */}
        <Box sx={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(239,68,68,0.08),transparent 70%)', pointerEvents: 'none' }} />
        <LockHistorySection />
        <AutoLockConfigPanel />
      </Box>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        @keyframes livePulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .react-calendar { width:100%!important; border:none; background:transparent; font-family:'DM Sans',sans-serif; }
        .react-calendar__navigation { margin-bottom:10px; }
        .react-calendar__navigation button { color:white; font-size:14px; font-weight:700; background:rgba(255,255,255,0.05); border-radius:10px; min-width:38px; height:38px; transition:all 0.2s; }
        .react-calendar__navigation button:enabled:hover { background:rgba(255,255,255,0.12); color:white; }
        .react-calendar__navigation__label { font-size:13px!important; font-weight:700!important; color:white!important; }
        .react-calendar__month-view__weekdays { color:rgba(255,255,255,0.35); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; }
        .react-calendar__month-view__weekdays__weekday abbr { text-decoration:none; }
        .react-calendar__tile { border-radius:10px; transition:all 0.2s; color:rgba(255,255,255,0.6); padding:8px 4px; background:rgba(255,255,255,0.02); border:1px solid transparent; font-weight:500; font-size:12px; min-height:50px; }
        .react-calendar__tile:enabled:hover { background:rgba(255,255,255,0.08)!important; }
        .react-calendar__tile--now { background:rgba(56,189,248,0.1)!important; border:1px solid rgba(56,189,248,0.3)!important; color:#38bdf8!important; font-weight:700; }
        .no-trade-day { background:rgba(255,255,255,0.02)!important; }
        .profit-day { background:rgba(34,197,94,0.12)!important; border:1px solid rgba(34,197,94,0.3)!important; }
        .loss-day { background:rgba(239,68,68,0.12)!important; border:1px solid rgba(239,68,68,0.3)!important; }
        .profit-day:enabled:hover { background:rgba(34,197,94,0.22)!important; }
        .loss-day:enabled:hover { background:rgba(239,68,68,0.22)!important; }
        .pnl-pill { font-size:9px; font-weight:800; font-family:'DM Mono',monospace; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .profit-day .pnl-pill { color:#22c55e; }
        .loss-day .pnl-pill { color:#ef4444; }
        .react-calendar__month-view__days__day--neighboringMonth { opacity:0.25; }
      `}</style>
    </Box>
  );
};

export default AnalyticsView;


