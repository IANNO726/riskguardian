/**
 * Simulator.tsx â€” Prop Firm Survival Simulator
 *
 * NEW in this version:
 *   Feature 1 â€” PassProbabilityGauge: live pass % gauge in the dashboard
 *   Feature 2 â€” EquityCurveChart: P&L + drawdown chart on the result screen
 *   Feature 3 â€” Session persistence: challenge survives page reload via localStorage
 *   Feature 4 â€” PsychologicalScenario: pressure moments injected mid-simulation
 *   Feature 5 â€” NewsCalendar: live ForexFactory events shown in trade form
 *   Feature 6 â€” MultiSessionComparison: compare up to 5 challenge sessions side-by-side
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography, Grid, CircularProgress, Chip, Tooltip, IconButton, Collapse } from "@mui/material";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from "recharts";

const API  = process.env.REACT_APP_API_URL || "https://riskguardian.onrender.com";
const tok  = () => localStorage.getItem("access_token") || "";
const hdrs = () => ({ Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" });

// â”€â”€ Session persistence keys â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STORAGE_KEY_SESSION  = "rg_sim_session";
const STORAGE_KEY_RULES    = "rg_sim_rules";
const STORAGE_KEY_METRICS  = "rg_sim_metrics";
const STORAGE_KEY_SAVED    = "rg_saved_sim_sessions";  // Feature 6 â€” saved sessions for comparison

// â”€â”€ Domain interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface SimTrade {
  symbol: string; lot_size: number; entry: number; sl: number; tp: number;
  result: string; direction: string;
  pnl: number; pnl_gross: number; commission: number;
  risk_pct: number; rr_ratio: number;
  day: number; timeframe?: string; days_held?: number; notes?: string; screenshot_url?: string;
}
interface SimSession {
  session_id: string; firm: string; account_size: number; balance: number;
  peak_balance: number; trailing_dd_floor: number;
  day: number; trades: SimTrade[];
  day_start_balance: number; daily_pnl: number; daily_trades: number;
  profitable_days: number; consecutive_losses: number; status: string;
  custom_daily_loss_pct?: number; custom_max_drawdown_pct?: number;
  custom_profit_target_pct?: number; custom_min_trading_days?: number;
  custom_max_risk_per_trade_pct?: number;
}
interface Metrics {
  drawdown_pct: number; profit_pct: number; daily_loss_pct: number;
  daily_loss_limit: number; max_drawdown_limit: number; profit_target: number;
  days_traded: number; min_trading_days: number; profitable_days: number;
  count_profitable_days: boolean; total_trades: number; daily_trades: number;
  consecutive_losses: number; trailing_dd: boolean; trailing_dd_floor: number;
  payout_pct: number; win_rate: number;
}
interface PassProb {
  pass_probability: number; confidence_low: number; confidence_high: number;
  status: "on_track" | "caution" | "at_risk" | "critical";
  message: string;
  factors: {
    profit_trajectory: number; drawdown_safety: number;
    daily_discipline: number; win_rate: number; days_compliance: number;
  };
  context: {
    profit_pct: number; target_pct: number; remaining_pct: number;
    daily_rate_needed: number; drawdown_pct: number; dd_headroom_pct: number;
    days_traded: number; min_days: number; total_trades: number;
    consecutive_losses: number;
  };
}

// â”€â”€ Psychological scenarios library â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface PsychScenario {
  id: string;
  trigger: (s: SimSession, rules: any) => boolean;
  title: string;
  body: string;
  choices: { label: string; tip: string; correct: boolean }[];
}

const PSYCH_SCENARIOS: PsychScenario[] = [
  {
    id: "near_target",
    trigger: (s, r) => {
      const pct = (s.balance - s.account_size) / s.account_size * 100;
      return pct >= r.profit_target_pct * 0.85 && pct < r.profit_target_pct;
    },
    title: "ðŸŽ¯ Almost There",
    body: `You're just ${String.fromCharCode(8776)}1â€“2% away from passing. The finish line is in sight. What do you do?`,
    choices: [
      { label: "Keep my normal lot size and process", tip: "Correct â€” stay mechanical. Most traders fail here by overtrading.", correct: true },
      { label: "Increase lot size to get there faster", tip: "Dangerous â€” this is how traders blow challenges on the final day.", correct: false },
      { label: "Avoid trading until tomorrow's session", tip: "Reasonable but unnecessary â€” your edge still works today.", correct: false },
    ],
  },
  {
    id: "consecutive_losses",
    trigger: (s) => s.consecutive_losses >= 3,
    title: "ðŸ˜¤ 3 Losses in a Row",
    body: "You've just taken your third consecutive loss. Your daily loss is at 40% of the limit. What's your next move?",
    choices: [
      { label: "Stop trading for the day â€” protect the daily limit", tip: "Correct â€” 3 losses often signals the market is not aligned with your strategy today.", correct: true },
      { label: "Increase size to recover the losses faster", tip: "This is textbook revenge trading and the fastest path to a blown account.", correct: false },
      { label: "Take one more trade at normal size", tip: "Risky â€” you're emotionally compromised after 3 losses. Taking a break is better.", correct: false },
    ],
  },
  {
    id: "dd_pressure",
    trigger: (s, r) => {
      const dd = (s.peak_balance - s.balance) / s.peak_balance * 100;
      return dd >= r.max_drawdown_pct * 0.65;
    },
    title: "ðŸ“‰ Drawdown Pressure",
    body: "You're using over 65% of your maximum drawdown allowance. You feel pressure to recover quickly. What do you do?",
    choices: [
      { label: "Reduce lot size significantly until I recover", tip: "Correct â€” smaller size protects your remaining buffer while you find your rhythm.", correct: true },
      { label: "Stop trading for a few days and come back fresh", tip: "Also valid â€” protecting the account is always the priority.", correct: true },
      { label: "Take higher-risk trades to recover faster", tip: "The worst choice â€” trying to recover fast is what turns a salvageable situation into a blown account.", correct: false },
    ],
  },
  {
    id: "big_win",
    trigger: (s) => {
      const lastTrade = s.trades[s.trades.length - 1];
      return !!(lastTrade && lastTrade.pnl > 0 && lastTrade.pnl / s.account_size * 100 > 1.5);
    },
    title: "ðŸ† Big Win â€” Now What?",
    body: "You just had your best trade of the challenge â€” over 1.5% in a single trade. How do you follow up?",
    choices: [
      { label: "Continue with the same process and lot size", tip: "Correct â€” consistency is what separates professionals.", correct: true },
      { label: "Take a break â€” lock in the win mentally", tip: "Also valid â€” stepping away after a big win prevents overconfidence trades.", correct: true },
      { label: "Increase size â€” I'm in the zone", tip: "Overconfidence is as dangerous as fear. The market doesn't care about your previous trade.", correct: false },
    ],
  },
  {
    id: "news_upcoming",
    trigger: (s) => s.day_start_balance > 0 && s.daily_trades === 0 && s.day % 5 === 0,
    title: "ðŸ“° High-Impact News Day",
    body: "There's a major economic release (NFP / CPI / FOMC) in 30 minutes. You have an open setup. What do you do?",
    choices: [
      { label: "Wait for the news to pass before entering", tip: "Correct â€” high-impact news creates unpredictable spreads and gaps.", correct: true },
      { label: "Enter now before the news â€” the move will be huge", tip: "Dangerous â€” news can go either direction and spreads widen dramatically at release.", correct: false },
      { label: "Enter after the first spike settles", tip: "Valid â€” waiting for the initial volatility to absorb reduces slippage risk.", correct: true },
    ],
  },
];

// â”€â”€ Shared style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const card  = () => ({ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"16px" });
const INP: React.CSSProperties = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:"10px", padding:"11px 13px", color:"white", fontSize:"14px", fontFamily:"inherit", outline:"none" };
const SEL: React.CSSProperties = { ...INP, cursor:"pointer", appearance:"none", WebkitAppearance:"none", MozAppearance:"none", background:"#1a1f2e", color:"white", backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center", paddingRight:"34px" };
const LBL  = { fontSize:"11px", fontWeight:800, color:"rgba(255,255,255,0.35)", textTransform:"uppercase" as const, letterSpacing:"0.07em", mb:"6px" };

function ProgressBar({ value, max, color, danger }: { value: number; max: number; color: string; danger?: boolean }) {
  const pct = Math.min((value / max) * 100, 100);
  const c   = danger && pct >= 80 ? "#ef4444" : danger && pct >= 60 ? "#f59e0b" : color;
  return (
    <Box sx={{ position:"relative", height:"10px", borderRadius:"5px", background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
      <Box sx={{ position:"absolute", left:0, top:0, height:"100%", width:`${pct}%`, background:c, borderRadius:"5px", transition:"width 0.5s ease" }} />
    </Box>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const fs = value.length > 11 ? "13px" : value.length > 8 ? "16px" : "22px";
  return (
    <Box sx={{ ...card(), p:"14px 16px", overflow:"hidden" }}>
      <Typography sx={LBL}>{label}</Typography>
      <Typography sx={{ fontSize:fs, fontWeight:900, color:color||"white", fontFamily:'"Roboto Mono",monospace', lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", mt:"3px" }}>{sub}</Typography>}
    </Box>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE 1 â€” PassProbabilityGauge
// Live arc gauge showing 0-100% pass probability with factor breakdown
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function PassProbabilityGauge({ session, onLoad }: { session: SimSession; onLoad?: (p: PassProb) => void }) {
  const [data,    setData]    = useState<PassProb | null>(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const fetch_ = useCallback(async () => {
    if (!session.trades.length) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/simulator/pass-probability`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(session),
      });
      const d = await r.json();
      setData(d);
      onLoad?.(d);
    } catch {}
    finally { setLoading(false); }
  }, [session.trades.length, session.balance]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (!data && !loading) return null;

  const statusColor: Record<string, string> = {
    on_track: "#22c55e",
    caution:  "#f59e0b",
    at_risk:  "#f97316",
    critical: "#ef4444",
  };
  const color = data ? statusColor[data.status] : "#38bdf8";
  const prob  = data?.pass_probability ?? 0;

  // Arc gauge math
  const R = 52, cx = 70, cy = 70;
  const startAngle = -210, endAngle = 30;
  const totalDeg = endAngle - startAngle;
  const filled = (prob / 100) * totalDeg;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcPath = (from: number, to: number) => {
    const x1 = cx + R * Math.cos(toRad(from));
    const y1 = cy + R * Math.sin(toRad(from));
    const x2 = cx + R * Math.cos(toRad(to));
    const y2 = cy + R * Math.sin(toRad(to));
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };

  const factors = data?.factors;

  return (
    <Box sx={{ ...card(), p:"16px 20px", mb:2 }}>
      <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", mb:"12px" }}>
        <Typography sx={{ fontSize:"12px", fontWeight:800, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.07em" }}>
          Pass Probability
        </Typography>
        <Box onClick={() => setOpen(v => !v)} sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", cursor:"pointer", "&:hover":{ color:"white" } }}>
          {open ? "â–² hide factors" : "â–¼ show factors"}
        </Box>
      </Box>

      <Box sx={{ display:"flex", gap:3, alignItems:"center", flexWrap:"wrap" }}>
        {/* Arc gauge SVG */}
        <Box sx={{ flexShrink:0 }}>
          {loading ? (
            <Box sx={{ width:140, height:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <CircularProgress size={24} sx={{ color }} />
            </Box>
          ) : (
            <svg width="140" height="100" viewBox="0 0 140 100">
              {/* Track */}
              <path d={arcPath(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" />
              {/* Filled arc */}
              {prob > 0 && (
                <path d={arcPath(startAngle, startAngle + filled)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                  style={{ transition:"all 0.8s ease" }} />
              )}
              {/* Percentage text */}
              <text x={cx} y={cy + 10} textAnchor="middle" fill={color} fontSize="22" fontWeight="900" fontFamily="'Roboto Mono', monospace">{prob}%</text>
              {/* Band */}
              <text x={cx} y={cy + 26} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="10">
                {data?.confidence_low}â€“{data?.confidence_high}%
              </text>
            </svg>
          )}
        </Box>

        {/* Status + message */}
        <Box sx={{ flex:1, minWidth:0 }}>
          <Box sx={{ px:"10px", py:"4px", borderRadius:"8px", display:"inline-block", mb:"8px",
            background: `${color}18`, border: `1px solid ${color}35` }}>
            <Typography sx={{ fontSize:"12px", fontWeight:800, color }}>
              {data?.status === "on_track" ? "âœ… On Track" : data?.status === "caution" ? "âš ï¸ Caution" : data?.status === "at_risk" ? "ðŸ”¶ At Risk" : "ðŸ”´ Critical"}
            </Typography>
          </Box>
          <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.5)", lineHeight:1.6 }}>{data?.message}</Typography>
          {data?.context && (
            <Box sx={{ mt:"8px", display:"flex", gap:"12px", flexWrap:"wrap" }}>
              <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>
                Need: <span style={{ color:"#22c55e", fontWeight:700 }}>{data.context.remaining_pct.toFixed(2)}%</span> more profit
              </Typography>
              <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>
                Rate needed: <span style={{ color:"#38bdf8", fontWeight:700 }}>{data.context.daily_rate_needed.toFixed(2)}%/day</span>
              </Typography>
              <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>
                DD headroom: <span style={{ color:"#f59e0b", fontWeight:700 }}>{data.context.dd_headroom_pct.toFixed(2)}%</span>
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Factor breakdown â€” collapsible */}
      {open && factors && (
        <Box sx={{ mt:"14px", pt:"12px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <Box sx={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
            {[
              { label:"Profit trajectory", value:factors.profit_trajectory,  weight:"30%" },
              { label:"Drawdown safety",   value:factors.drawdown_safety,    weight:"25%" },
              { label:"Daily discipline",  value:factors.daily_discipline,   weight:"20%" },
              { label:"Win rate",          value:factors.win_rate,           weight:"15%" },
              { label:"Days compliance",   value:factors.days_compliance,    weight:"10%" },
            ].map(f => {
              const fc = f.value >= 70 ? "#22c55e" : f.value >= 45 ? "#f59e0b" : "#ef4444";
              return (
                <Box key={f.label} sx={{ flex:"1 1 140px", p:"10px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", mb:"4px" }}>
                    {f.label} <span style={{ color:"rgba(255,255,255,0.2)", fontWeight:400 }}>({f.weight})</span>
                  </Typography>
                  <Box sx={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <Typography sx={{ fontSize:"16px", fontWeight:900, color:fc, fontFamily:'"Roboto Mono",monospace', minWidth:"38px" }}>
                      {f.value.toFixed(0)}
                    </Typography>
                    <Box sx={{ flex:1, height:"5px", borderRadius:"3px", background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                      <Box sx={{ height:"100%", width:`${f.value}%`, background:fc, borderRadius:"3px", transition:"width 0.6s ease" }} />
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE 2 â€” EquityCurveChart
// P&L% area chart + drawdown area chart from the result equity_curve data
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function EquityCurveChart({ equityCurve, accountSize, target, maxDD }: {
  equityCurve: any[];
  accountSize: number;
  target: number;
  maxDD: number;
}) {
  if (!equityCurve?.length) return null;

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const color = payload.result === "win" ? "#22c55e" : payload.result === "loss" ? "#ef4444" : "#f59e0b";
    return <circle cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <Box sx={{ background:"#1e2533", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"10px", p:"10px 14px", fontSize:"12px" }}>
        <Typography sx={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", mb:"4px" }}>Trade #{d.trade} Â· Day {d.day} Â· {d.symbol}</Typography>
        <Typography sx={{ color: d.pnl_pct >= 0 ? "#22c55e" : "#ef4444", fontWeight:800, fontFamily:'"Roboto Mono",monospace' }}>
          {d.pnl_pct >= 0 ? "+" : ""}{d.pnl_pct.toFixed(3)}%
        </Typography>
        <Typography sx={{ color:"rgba(255,255,255,0.5)", fontFamily:'"Roboto Mono",monospace' }}>
          ${d.balance.toLocaleString("en", { minimumFractionDigits:2 })}
        </Typography>
        {d.drawdown > 0 && (
          <Typography sx={{ color:"#f59e0b", fontSize:"11px", fontFamily:'"Roboto Mono",monospace' }}>
            DD: {d.drawdown.toFixed(2)}%
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ ...card(), p:"20px 22px", mb:3 }}>
      <Typography sx={{ fontSize:"12px", fontWeight:800, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"16px" }}>
        Equity Curve
      </Typography>

      {/* P&L % chart */}
      <Box sx={{ mb:"24px" }}>
        <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.25)", mb:"8px" }}>P&L %</Typography>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={equityCurve} margin={{ top:8, right:8, bottom:0, left:0 }}>
            <defs>
              <linearGradient id="pnlPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pnlNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.02} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="trade" tick={{ fontSize:10, fill:"rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} label={{ value:"Trades", position:"insideBottom", offset:-2, fill:"rgba(255,255,255,0.2)", fontSize:10 }} />
            <YAxis tick={{ fontSize:10, fill:"rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}%`} width={45} />
            <Tooltip content={<CustomTooltip />} />
            {/* Profit target line */}
            <ReferenceLine y={target} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5}
              label={{ value:`Target ${target}%`, fill:"#22c55e", fontSize:10, position:"right" }} />
            {/* Zero line */}
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
            <Area type="monotone" dataKey="pnl_pct" stroke="#22c55e" strokeWidth={2}
              fill="url(#pnlPos)" dot={<CustomDot />} activeDot={{ r:5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      {/* Drawdown chart */}
      <Box>
        <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.25)", mb:"8px" }}>Drawdown %</Typography>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={equityCurve} margin={{ top:4, right:8, bottom:0, left:0 }}>
            <defs>
              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="trade" tick={{ fontSize:10, fill:"rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:"rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v.toFixed(1)}%`} width={45} reversed />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={maxDD} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6}
              label={{ value:`Max DD ${maxDD}%`, fill:"#ef4444", fontSize:10, position:"right" }} />
            <Area type="monotone" dataKey="drawdown" stroke="#f59e0b" strokeWidth={1.5}
              fill="url(#ddGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE 4 â€” PsychologicalScenario modal
// Triggered mid-simulation when certain conditions are met
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function PsychologicalScenario({ scenario, onClose }: {
  scenario: PsychScenario;
  onClose: () => void;
}) {
  const [chosen,   setChosen]   = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const pick = (idx: number) => {
    setChosen(idx);
    setRevealed(true);
  };

  return (
    <Box sx={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", p:2,
    }}>
      <Box sx={{
        maxWidth:"480px", width:"100%", borderRadius:"20px",
        background:"linear-gradient(135deg,#0f172a,#0b1120)",
        border:"1px solid rgba(168,85,247,0.3)",
        boxShadow:"0 32px 80px rgba(0,0,0,0.6)",
        overflow:"hidden",
      }}>
        {/* Top accent */}
        <Box sx={{ height:"2px", background:"linear-gradient(90deg,transparent,#a855f7,#38bdf8,transparent)" }} />
        <Box sx={{ p:"24px 28px" }}>
          {/* Header */}
          <Box sx={{ display:"flex", alignItems:"center", gap:"10px", mb:"16px" }}>
            <Box sx={{ px:"10px", py:"4px", borderRadius:"8px", background:"rgba(168,85,247,0.15)", border:"1px solid rgba(168,85,247,0.3)" }}>
              <Typography sx={{ fontSize:"11px", fontWeight:800, color:"#a855f7", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                ðŸ§  Psychological Challenge
              </Typography>
            </Box>
          </Box>

          <Typography sx={{ fontSize:"18px", fontWeight:800, color:"white", mb:"10px", lineHeight:1.3 }}>
            {scenario.title}
          </Typography>
          <Typography sx={{ fontSize:"14px", color:"rgba(255,255,255,0.65)", mb:"20px", lineHeight:1.7 }}>
            {scenario.body}
          </Typography>

          {/* Choices */}
          <Box sx={{ display:"flex", flexDirection:"column", gap:"8px", mb:"16px" }}>
            {scenario.choices.map((c, i) => {
              const isChosen  = chosen === i;
              const isCorrect = c.correct;
              let bg      = "rgba(255,255,255,0.04)";
              let border  = "rgba(255,255,255,0.1)";
              let color   = "rgba(255,255,255,0.7)";
              if (revealed && isChosen && isCorrect)  { bg = "rgba(34,197,94,0.12)";  border = "rgba(34,197,94,0.4)";  color = "#22c55e"; }
              if (revealed && isChosen && !isCorrect) { bg = "rgba(239,68,68,0.12)";  border = "rgba(239,68,68,0.4)";  color = "#ef4444"; }
              if (revealed && !isChosen && isCorrect) { bg = "rgba(34,197,94,0.06)";  border = "rgba(34,197,94,0.2)";  color = "rgba(34,197,94,0.7)"; }

              return (
                <Box key={i}>
                  <Box
                    onClick={() => !revealed && pick(i)}
                    sx={{
                      p:"12px 16px", borderRadius:"12px", cursor:revealed?"default":"pointer",
                      background:bg, border:`1px solid ${border}`,
                      transition:"all 0.2s",
                      "&:hover": !revealed ? { background:"rgba(255,255,255,0.08)", borderColor:"rgba(255,255,255,0.2)" } : {},
                    }}
                  >
                    <Typography sx={{ fontSize:"13px", fontWeight:600, color }}>
                      {isChosen ? (isCorrect ? "âœ… " : "âŒ ") : ""}
                      {c.label}
                    </Typography>
                  </Box>
                  {revealed && isChosen && (
                    <Box sx={{ mt:"6px", mb:"2px", px:"14px", py:"8px", borderRadius:"8px",
                      background: isCorrect ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      border: `1px solid ${isCorrect ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                      <Typography sx={{ fontSize:"12px", color: isCorrect ? "#86efac" : "#fca5a5", lineHeight:1.6 }}>
                        ðŸ’¡ {c.tip}
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>

          <Box
            onClick={revealed ? onClose : undefined}
            sx={{
              py:"12px", borderRadius:"12px", textAlign:"center", cursor:revealed?"pointer":"not-allowed",
              fontWeight:800, fontSize:"14px",
              background: revealed ? "linear-gradient(135deg,#a855f7,#6366f1)" : "rgba(255,255,255,0.05)",
              color: revealed ? "white" : "rgba(255,255,255,0.2)",
              transition:"all 0.2s",
            }}
          >
            {revealed ? "Continue Challenge â†’" : "Choose an answer above"}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE 3 â€” Session persistence helpers
// Saves/loads session + rules to localStorage on every state change
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function saveSession(session: SimSession | null, rules: any, metrics: Metrics | null) {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      localStorage.setItem(STORAGE_KEY_RULES,   JSON.stringify(rules));
      if (metrics) localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(metrics));
    } else {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem(STORAGE_KEY_RULES);
      localStorage.removeItem(STORAGE_KEY_METRICS);
    }
  } catch {}
}

function loadSession(): { session: SimSession | null; rules: any; metrics: Metrics | null } {
  try {
    const s = localStorage.getItem(STORAGE_KEY_SESSION);
    const r = localStorage.getItem(STORAGE_KEY_RULES);
    const m = localStorage.getItem(STORAGE_KEY_METRICS);
    return {
      session: s ? JSON.parse(s) : null,
      rules:   r ? JSON.parse(r) : null,
      metrics: m ? JSON.parse(m) : null,
    };
  } catch {
    return { session: null, rules: null, metrics: null };
  }
}

// â”€â”€ Dark Calendar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["S","M","T","W","T","F","S"];

function DarkCalendar({ onRange, onClose }: {
  onRange: (open: string, close: string, days: number) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [start, setStart] = useState<Date|null>(null);
  const [end,   setEnd]   = useState<Date|null>(null);
  const [hover, setHover] = useState<Date|null>(null);

  const prevMonth = () => { if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };

  const inRange = (d: Date) => {
    const anchor = start;
    const edge   = end || hover;
    if (!anchor || !edge) return false;
    const lo = anchor < edge ? anchor : edge;
    const hi = anchor < edge ? edge   : anchor;
    return d > lo && d < hi;
  };

  const isStart = (d: Date) => start && fmt(d)===fmt(start);
  const isEnd   = (d: Date) => end   && fmt(d)===fmt(end);

  const clickDay = (d: Date) => {
    if (!start || (start && end)) { setStart(d); setEnd(null); }
    else {
      const s = start < d ? start : d;
      const e = start < d ? d     : start;
      setStart(s); setEnd(e);
    }
  };

  const handleOK = () => {
    if (!start || !end) return;
    const days = Math.round((end.getTime()-start.getTime())/86400000);
    onRange(fmt(start), fmt(end), days);
    onClose();
  };

  const cells: (Date|null)[] = [];
  for(let i=0;i<firstDay;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(new Date(viewYear,viewMonth,d));

  return (
    <Box sx={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.65)" }} onClick={onClose}>
      <Box sx={{ background:"#1e2533", borderRadius:"16px", p:"20px 22px", width:"320px", boxShadow:"0 24px 64px rgba(0,0,0,0.6)", border:"1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()}>
        <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", mb:"16px" }}>
          <Box onClick={prevMonth} sx={{ cursor:"pointer", px:"8px", py:"4px", borderRadius:"8px", "&:hover":{background:"rgba(255,255,255,0.08)"}, fontSize:"16px", color:"rgba(255,255,255,0.6)" }}>â€¹</Box>
          <Typography sx={{ fontWeight:800, fontSize:"14px", color:"white", letterSpacing:"0.05em" }}>
            {MONTHS[viewMonth].toUpperCase()} {viewYear}
          </Typography>
          <Box onClick={nextMonth} sx={{ cursor:"pointer", px:"8px", py:"4px", borderRadius:"8px", "&:hover":{background:"rgba(255,255,255,0.08)"}, fontSize:"16px", color:"rgba(255,255,255,0.6)" }}>â€º</Box>
        </Box>
        <Box sx={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", mb:"6px" }}>
          {DAYS.map((d,i) => <Typography key={i} sx={{ textAlign:"center", fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.3)", py:"4px" }}>{d}</Typography>)}
        </Box>
        <Box sx={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px" }}>
          {cells.map((d, i) => {
            if (!d) return <Box key={i} />;
            const sel   = isStart(d) || isEnd(d);
            const range = inRange(d);
            return (
              <Box key={i} onClick={() => clickDay(d)} onMouseEnter={() => { if(start && !end) setHover(d); }} onMouseLeave={() => setHover(null)}
                sx={{ textAlign:"center", py:"6px", borderRadius:sel?"50%":range?"0":"6px",
                  background:sel?"#2563eb":range?"rgba(37,99,235,0.2)":"transparent", cursor:"pointer",
                  "&:hover":{ background:sel?"#1d4ed8":"rgba(255,255,255,0.1)" }, transition:"background 0.1s" }}>
                <Typography sx={{ fontSize:"13px", fontWeight:sel?800:500, color:sel?"white":range?"#93c5fd":"rgba(255,255,255,0.8)" }}>
                  {d.getDate()}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ mt:"14px", mb:"8px", px:"4px" }}>
          <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.4)", textAlign:"center" }}>
            {start && end ? `${fmt(start)} â†’ ${fmt(end)} (${Math.round((end.getTime()-start.getTime())/86400000)} days)` : start ? "Now pick the close date" : "Pick the open date"}
          </Typography>
        </Box>
        <Box sx={{ display:"flex", justifyContent:"flex-end", gap:"10px", mt:"4px" }}>
          <Box onClick={onClose} sx={{ px:"16px", py:"8px", borderRadius:"8px", cursor:"pointer", fontSize:"13px", fontWeight:700, color:"rgba(255,255,255,0.4)", "&:hover":{color:"white"} }}>CANCEL</Box>
          <Box onClick={handleOK} sx={{ px:"20px", py:"8px", borderRadius:"8px", cursor:"pointer", fontSize:"13px", fontWeight:800, color:(start&&end)?"white":"rgba(255,255,255,0.2)", background:(start&&end)?"#2563eb":"rgba(255,255,255,0.05)", pointerEvents:(start&&end)?"auto":"none" }}>OK</Box>
        </Box>
      </Box>
    </Box>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE 5 â€” NewsCalendar (inline widget for the trade form)
// Fetches upcoming high-impact events from /api/v1/simulator/news
// Shows as compact warning pills above the submit button
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface NewsEvent {
  title:          string;
  currency:       string;
  datetime_utc:   string;
  affected_pairs: string[];
  minutes_away:   number;
  forecast?:      string;
}

const CURRENCY_FLAGS: Record<string, string> = {
  USD:"ðŸ‡ºðŸ‡¸", EUR:"ðŸ‡ªðŸ‡º", GBP:"ðŸ‡¬ðŸ‡§", JPY:"ðŸ‡¯ðŸ‡µ",
  AUD:"ðŸ‡¦ðŸ‡º", CAD:"ðŸ‡¨ðŸ‡¦", CHF:"ðŸ‡¨ðŸ‡­", NZD:"ðŸ‡³ðŸ‡¿",
};

function fmtMins(m: number): string {
  if (m < 0)  return `${Math.abs(m)}m ago`;
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h ${m%60 > 0 ? ` ${m%60}m` : ""}`.trim();
}

function fmtEvtTime(dtStr: string): string {
  try { return new Date(dtStr + "Z").toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }); }
  catch { return dtStr.slice(11,16); }
}

function NewsCalendarInline({ symbol, onImminent }: {
  symbol: string;
  onImminent?: (events: NewsEvent[]) => void;
}) {
  const [events,   setEvents]   = useState<NewsEvent[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sym = symbol ? symbol.toUpperCase().replace(/\s+/g,"").slice(0,10) : "";
    fetch(`${API}/api/v1/simulator/news?hours=48${sym ? `&symbol=${sym}` : ""}`, { headers: hdrs() })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const evts: NewsEvent[] = d.events || [];
        setEvents(evts);
        const imminent = evts.filter(e => e.minutes_away >= -5 && e.minutes_away <= 30);
        if (imminent.length > 0) onImminent?.(imminent);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (!loading && events.length === 0) return null;

  const imminent = events.filter(e => e.minutes_away >= -5 && e.minutes_away <= 30);
  const upcoming = events.filter(e => e.minutes_away > 30);

  return (
    <Box sx={{ mt:"10px", mb:"2px", borderRadius:"10px",
      background: imminent.length > 0 ? "rgba(239,68,68,0.07)" : "rgba(56,189,248,0.05)",
      border: `1px solid ${imminent.length > 0 ? "rgba(239,68,68,0.2)" : "rgba(56,189,248,0.15)"}`,
      p:"10px 14px",
    }}>
      {/* Header row */}
      <Box sx={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }} onClick={() => setExpanded(v => !v)}>
        <Typography sx={{ fontSize:"11px" }}>ðŸ“…</Typography>
        <Typography sx={{ fontSize:"11px", fontWeight:800,
          color: imminent.length > 0 ? "#ef4444" : "#38bdf8",
          textTransform:"uppercase", letterSpacing:"0.07em" }}>
          {imminent.length > 0 ? `âš  ${imminent.length} news imminent` : `${events.length} upcoming events`}
        </Typography>
        {imminent.length > 0 && (
          <Box sx={{ px:"8px", py:"2px", borderRadius:"6px", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)" }}>
            <Typography sx={{ fontSize:"10px", fontWeight:800, color:"#ef4444" }}>
              in {fmtMins(Math.min(...imminent.map(e => e.minutes_away)))}
            </Typography>
          </Box>
        )}
        <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.25)", ml:"auto" }}>
          {expanded ? "â–² hide" : "â–¼ show"}
        </Typography>
      </Box>

      {/* Compact pill list â€” always visible for imminent */}
      {imminent.length > 0 && (
        <Box sx={{ display:"flex", flexWrap:"wrap", gap:"6px", mt:"8px" }}>
          {imminent.map((ev, i) => (
            <Box key={i} sx={{ display:"flex", alignItems:"center", gap:"5px", px:"8px", py:"4px", borderRadius:"7px", background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.25)" }}>
              <Typography sx={{ fontSize:"12px" }}>{CURRENCY_FLAGS[ev.currency] || "ðŸŒ"}</Typography>
              <Typography sx={{ fontSize:"11px", color:"white", fontWeight:700, maxWidth:"160px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {ev.currency} {ev.title.slice(0,22)}{ev.title.length > 22 ? "â€¦" : ""}
              </Typography>
              <Typography sx={{ fontSize:"10px", color:"#fca5a5", fontWeight:700 }}>{fmtMins(ev.minutes_away)}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Expanded list */}
      {expanded && (
        <Box sx={{ mt:"8px", pt:"8px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          {[...imminent, ...upcoming].slice(0, 8).map((ev, i) => (
            <Box key={i} sx={{ display:"flex", alignItems:"center", gap:"8px", py:"5px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <Typography sx={{ fontSize:"14px", flexShrink:0 }}>{CURRENCY_FLAGS[ev.currency] || "ðŸŒ"}</Typography>
              <Box sx={{ flex:1, minWidth:0 }}>
                <Typography sx={{ fontSize:"12px", color:"white", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {ev.title}
                </Typography>
                <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.35)" }}>
                  {ev.currency} Â· {fmtEvtTime(ev.datetime_utc)}
                  {ev.forecast ? ` Â· Fcst: ${ev.forecast}` : ""}
                </Typography>
              </Box>
              <Box sx={{ px:"8px", py:"3px", borderRadius:"7px", flexShrink:0,
                background: ev.minutes_away <= 30 ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${ev.minutes_away <= 30 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
              }}>
                <Typography sx={{ fontSize:"10px", fontWeight:700,
                  color: ev.minutes_away <= 30 ? "#ef4444" : "rgba(255,255,255,0.5)" }}>
                  {fmtMins(ev.minutes_away)}
                </Typography>
              </Box>
            </Box>
          ))}
          {events.length > 8 && (
            <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.2)", mt:"6px", textAlign:"center" }}>
              +{events.length - 8} more events in the next 48h
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE 6 â€” Multi-Session Comparison
// Sessions are saved to localStorage after each completed challenge.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface SavedSimSession {
  id:      string;
  label:   string;
  savedAt: string;
  firm:    string;
  account: number;
  pnlPct:  number;
  passed:  boolean;
  trades:  number;
  session: any;
  rules:   any;
}

function loadSavedSimSessions(): SavedSimSession[] {
  try { const raw = localStorage.getItem(STORAGE_KEY_SAVED); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function persistSavedSimSessions(sessions: SavedSimSession[]) {
  try { localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(sessions.slice(0,10))); } catch {}
}
function saveSimSession(session: any, rules: any): string {
  const id  = `simS_${Date.now()}`;
  const pnl = session.account_size > 0 ? (session.balance - session.account_size) / session.account_size * 100 : 0;
  const entry: SavedSimSession = {
    id,
    label:   `${rules.name || "Challenge"} â€” ${new Date().toLocaleDateString()}`,
    savedAt: new Date().toISOString(),
    firm:    rules.name || "Custom",
    account: session.account_size || 0,
    pnlPct:  +pnl.toFixed(3),
    passed:  session.status === "passed",
    trades:  session.trades?.length || 0,
    session, rules,
  };
  const existing = loadSavedSimSessions();
  persistSavedSimSessions([entry, ...existing]);
  return id;
}

const _SESSION_COLORS = ["#38bdf8","#a855f7","#22c55e","#f59e0b","#ef4444"];

function CompareTab() {
  const [saved,    setSaved]    = useState<SavedSimSession[]>(loadSavedSimSessions);
  const [selected, setSelected] = useState<string[]>([]);
  const [result,   setResult]   = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");

  const toggleSel = (id: string) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 5 ? [...p, id] : p);
    setResult(null);
  };
  const deleteSaved = (id: string) => {
    const updated = saved.filter(s => s.id !== id);
    setSaved(updated); persistSavedSimSessions(updated);
    setSelected(p => p.filter(x => x !== id)); setResult(null);
  };
  const compare = async () => {
    if (selected.length < 2) { setErr("Select at least 2 sessions"); return; }
    setLoading(true); setErr("");
    try {
      const sessions = selected.map(id => { const s = saved.find(x => x.id === id)!; return { ...s.session, rules: s.rules }; });
      const labels   = selected.map(id => saved.find(x => x.id === id)?.label || "Session");
      const r = await fetch(`${API}/api/v1/simulator/compare`, { method:"POST", headers:hdrs(), body:JSON.stringify({ sessions, labels }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Compare failed");
      setResult(data);
    } catch(e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{ maxWidth:"760px", mx:"auto", mt:2 }}>
      <Typography sx={{ fontSize:"18px", fontWeight:800, color:"white", mb:"4px" }}>ðŸ“Š Compare Sessions</Typography>
      <Typography sx={{ fontSize:"13px", color:"rgba(255,255,255,0.4)", mb:"20px" }}>
        Select 2â€“5 completed sessions to compare. Sessions are saved automatically when a challenge ends.
      </Typography>
      {saved.length === 0 ? (
        <Box sx={{ textAlign:"center", py:6, borderRadius:"16px", background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.1)" }}>
          <Typography sx={{ fontSize:"32px", opacity:0.2, mb:"8px" }}>ðŸ“Š</Typography>
          <Typography sx={{ fontSize:"14px", color:"rgba(255,255,255,0.3)" }}>No saved sessions yet</Typography>
          <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.2)", mt:"4px" }}>Complete a challenge and click "ðŸ’¾ Save Session" on the result screen</Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:"12px", mb:"16px" }}>
            {saved.map((s, idx) => {
              const isSel  = selected.includes(s.id);
              const selIdx = selected.indexOf(s.id);
              const color  = isSel ? _SESSION_COLORS[selIdx] : "rgba(255,255,255,0.18)";
              return (
                <Box key={s.id} onClick={() => toggleSel(s.id)} sx={{ p:"14px 16px", borderRadius:"14px", cursor:"pointer", background:isSel?`${color}10`:"rgba(255,255,255,0.03)", border:`2px solid ${isSel?color:"rgba(255,255,255,0.08)"}`, transition:"all 0.15s", position:"relative", "&:hover":{ borderColor:color } }}>
                  {isSel && <Box sx={{ position:"absolute", top:"8px", right:"8px", width:"20px", height:"20px", borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center" }}><Typography sx={{ fontSize:"10px", fontWeight:900, color:"white" }}>{selIdx+1}</Typography></Box>}
                  <Typography sx={{ fontSize:"12px", fontWeight:700, color:"white", pr:"24px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.label}</Typography>
                  <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", mt:"2px" }}>{s.firm} Â· ${s.account.toLocaleString()}</Typography>
                  <Box sx={{ display:"flex", gap:"6px", mt:"8px", alignItems:"center" }}>
                    <Box sx={{ px:"7px", py:"2px", borderRadius:"5px", fontSize:"11px", fontWeight:700, background:s.pnlPct>=0?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)", color:s.pnlPct>=0?"#22c55e":"#ef4444", border:`1px solid ${s.pnlPct>=0?"rgba(34,197,94,0.35)":"rgba(239,68,68,0.35)"}` }}>{s.pnlPct>=0?"+":""}{s.pnlPct}%</Box>
                    <Box sx={{ px:"7px", py:"2px", borderRadius:"5px", fontSize:"11px", fontWeight:700, background:s.passed?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", color:s.passed?"#22c55e":"#ef4444" }}>{s.passed?"âœ… PASSED":"âŒ BLOWN"}</Box>
                    <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.25)", ml:"auto", cursor:"pointer", "&:hover":{ color:"#ef4444" } }} onClick={e=>{e.stopPropagation();deleteSaved(s.id);}}>âœ•</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
          {err && <Typography sx={{ color:"#ef4444", fontSize:"13px", mb:"10px" }}>âš  {err}</Typography>}
          {selected.length >= 2 && (
            <Box onClick={!loading?compare:undefined} sx={{ py:"12px", borderRadius:"12px", textAlign:"center", cursor:loading?"not-allowed":"pointer", fontWeight:800, fontSize:"14px", mb:"20px", background:loading?"rgba(168,85,247,0.2)":"linear-gradient(135deg,#a855f7,#6366f1)", color:"white", opacity:loading?0.7:1 }}>
              {loading?<CircularProgress size={14} sx={{color:"white"}}/>:`Compare ${selected.length} Sessions â†’`}
            </Box>
          )}
          {result && (
            <Box>
              {result.overall_winner && (
                <Box sx={{ p:"16px 20px", mb:"16px", borderRadius:"14px", background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.25)", display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
                  <Typography sx={{ fontSize:"28px" }}>ðŸ†</Typography>
                  <Box><Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", fontWeight:700, textTransform:"uppercase" }}>Overall Winner</Typography><Typography sx={{ fontSize:"20px", fontWeight:900, color:"#fbbf24" }}>{result.overall_winner}</Typography></Box>
                  <Box sx={{ ml:"auto", display:"flex", gap:"8px" }}>
                    {Object.entries(result.score_tally as Record<string,number>).sort((a,b)=>b[1]-a[1]).map(([label,score],i)=>(
                      <Box key={i} sx={{ textAlign:"center", px:"10px", py:"6px", borderRadius:"10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
                        <Typography sx={{ fontSize:"18px", fontWeight:900, color:_SESSION_COLORS[result.sessions.findIndex((s:any)=>s.label===label)]||"white" }}>{score}</Typography>
                        <Typography sx={{ fontSize:"9px", color:"rgba(255,255,255,0.3)" }}>{(label as string).slice(0,14)}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              <Box sx={{ display:"flex", gap:"10px", mb:"16px", flexWrap:"wrap" }}>
                {result.sessions.map((sess:any,i:number)=>(
                  <Box key={i} sx={{ flex:"1 1 140px", p:"12px 14px", borderRadius:"12px", background:sess.passed?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${sess.passed?"rgba(34,197,94,0.25)":"rgba(239,68,68,0.25)"}` }}>
                    <Box sx={{ display:"flex", alignItems:"center", gap:"6px", mb:"4px" }}><Box sx={{ width:"8px", height:"8px", borderRadius:"50%", background:_SESSION_COLORS[i] }}/><Typography sx={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.6)" }}>{sess.label}</Typography></Box>
                    <Typography sx={{ fontSize:"16px", fontWeight:800, color:sess.passed?"#22c55e":"#ef4444" }}>{sess.passed?"âœ… PASSED":"âŒ BLOWN"}</Typography>
                    <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.35)", mt:"2px" }}>{sess.firm} Â· ${sess.account_size?.toLocaleString()}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ ...card(), overflow:"hidden" }}>
                <Box sx={{ display:"grid", gridTemplateColumns:`180px ${result.sessions.map(()=>"1fr").join(" ")}`, background:"rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                  <Box sx={{ p:"10px 14px" }}><Typography sx={{ fontSize:"10px", fontWeight:700, color:"rgba(255,255,255,0.35)", textTransform:"uppercase" }}>Metric</Typography></Box>
                  {result.sessions.map((sess:any,i:number)=>(
                    <Box key={i} sx={{ p:"10px 8px", textAlign:"center", borderLeft:"1px solid rgba(255,255,255,0.06)" }}>
                      <Box sx={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"5px" }}><Box sx={{ width:"6px", height:"6px", borderRadius:"50%", background:_SESSION_COLORS[i] }}/><Typography sx={{ fontSize:"11px", fontWeight:700, color:_SESSION_COLORS[i] }}>{sess.label.slice(0,14)}</Typography></Box>
                    </Box>
                  ))}
                </Box>
                {[
                  { key:"profit_pct",       label:"Net Profit %",    fmt:(v:number)=>`${v>=0?"+":""}${v.toFixed(2)}%`, higher:true  },
                  { key:"win_rate",          label:"Win Rate",        fmt:(v:number)=>`${v}%`,                          higher:true  },
                  { key:"expectancy",        label:"Expectancy",      fmt:(v:number)=>`$${v.toFixed(2)}`,              higher:true  },
                  { key:"max_drawdown_pct",  label:"Max Drawdown",    fmt:(v:number)=>`${v.toFixed(2)}%`,              higher:false },
                  { key:"max_consec_losses", label:"Consec. Losses",  fmt:(v:number)=>`${v}`,                          higher:false },
                  { key:"total_trades",      label:"Total Trades",    fmt:(v:number)=>`${v}`,                          higher:null  },
                ].map((metric,mi)=>{
                  const winner = result.winners[metric.key];
                  return (
                    <Box key={mi} sx={{ display:"grid", gridTemplateColumns:`180px ${result.sessions.map(()=>"1fr").join(" ")}`, borderTop:"1px solid rgba(255,255,255,0.05)", "&:hover":{ background:"rgba(255,255,255,0.015)" } }}>
                      <Box sx={{ p:"10px 14px" }}><Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.6)" }}>{metric.label}</Typography></Box>
                      {result.sessions.map((sess:any,si:number)=>{
                        const val=sess[metric.key] as number;
                        const isWinner=winner?.winner===sess.label&&metric.higher!==null;
                        const col=isWinner?_SESSION_COLORS[si]:metric.higher===true&&val>0?"#22c55e":metric.higher===true&&val<0?"#ef4444":"rgba(255,255,255,0.65)";
                        return (
                          <Box key={si} sx={{ p:"10px 8px", textAlign:"center", borderLeft:"1px solid rgba(255,255,255,0.05)", background:isWinner?`${_SESSION_COLORS[si]}08`:"transparent" }}>
                            <Typography sx={{ fontSize:"13px", fontWeight:isWinner?800:500, color:col, fontFamily:'"Roboto Mono",monospace' }}>{metric.fmt(val??0)}</Typography>
                            {isWinner&&<Typography sx={{ fontSize:"9px", color:_SESSION_COLORS[si], fontWeight:700, textTransform:"uppercase" }}>â˜… BEST</Typography>}
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}


// â”€â”€ Custom firm storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface SavedFirm {
  key: string; name: string; account_sizes: number[];
  daily_loss_limit_pct: number; max_drawdown_pct: number;
  profit_target_pct: number; min_trading_days: number;
  max_risk_per_trade_pct: number; description: string; isCustom: true;
}
async function loadSavedFirms(): Promise<SavedFirm[]> {
  try { const res = await (window as any).storage?.get("simulator:custom_firms"); return res ? JSON.parse(res.value) : []; } catch { return []; }
}
async function saveFirms(firms: SavedFirm[]) {
  try { await (window as any).storage?.set("simulator:custom_firms", JSON.stringify(firms)); } catch {}
}

// â”€â”€ Firm plans data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface FirmPlan {
  planKey: string; planName: string;
  banned_pair_keywords?: string[]; allow_news_trading?: boolean; allow_weekend_holding?: boolean; max_lot_size?: number | null;
  account_sizes: number[];
  daily_loss_limit_pct: number; max_drawdown_pct: number;
  profit_target_pct: number; min_trading_days: number;
  max_risk_per_trade_pct: number; description: string;
}
interface FirmDef { key: string; name: string; plans: FirmPlan[]; }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BUILTIN_FIRMS â€” All rules verified from official firm websites, March 2026
//
// Sources checked:
//   The5ers:    the5ers.com/hyper-growth  /high-stakes  /bootcamp
//   FTMO:       ftmo.com/en/how-it-works  + academy.ftmo.com
//   FundedNext: help.fundednext.com (official help center articles)
//   FundingPips:fundingpips.com/en/challenges
//   E8 Markets: help.e8markets.com (official help center articles)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface FirmPlanExtended extends FirmPlan {
  trailing_dd?: boolean;
  count_profitable_days?: boolean;
  daily_pause_not_breach?: boolean; // true = daily % is a pause, NOT account termination
  payout_pct?: number;
  starting_payout_pct?: number;
  news_window_minutes?: number;
}

const BUILTIN_FIRMS: FirmDef[] = [

  // â”€â”€ THE5ERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Source: the5ers.com/hyper-growth, /high-stakes, /bootcamp (March 2026)
  { key:"The5ers", name:"The5ers", plans:[

    {
      // Source: the5ers.com/hyper-growth
      // "Evaluation Target: 10% | Stop Out Level: 6% | Daily Pause: 3%"
      // "No minimum trades or days requirements"
      // "News trading is allowed (except bracket strategies)"
      // IMPORTANT: 3% daily is a PAUSE (trading stops for the day), NOT a hard account breach
      planKey:"hyper_growth",
      planName:"Hyper Growth (1-Step)",
      account_sizes:[5000,10000,20000],
      profit_target_pct:10,
      daily_loss_limit_pct:3,        // Daily PAUSE at 3% â€” not a termination
      max_drawdown_pct:6,            // Stop Out Level: 6% from initial balance
      min_trading_days:0,            // No minimum days requirement
      max_risk_per_trade_pct:2,
      allow_news_trading:true,       // News trading allowed (no bracket strategies)
      allow_weekend_holding:true,    // "Holding open trades over the weekend is allowed"
      trailing_dd:false,             // Static stop-out at 6%, NOT trailing
      daily_pause_not_breach:true,   // 3% = pause for day, account stays active
      count_profitable_days:false,
      payout_pct:100,
      starting_payout_pct:50,        // Starts 50/50, scales to 100%
      news_window_minutes:0,
      description:"1-Step. 10% target. 6% stop-out. 3% daily PAUSE (not a breach â€” trading stops for the day). No min days. News OK. Account doubles every 10% target. Up to $4M.",
    } as FirmPlanExtended,

    {
      // Source: the5ers.com/high-stakes
      // "Step 1 Profit Target: 10% | Maximum Daily Loss: 5% | Maximum Loss: 10%"
      // "Minimum Profitable Days: 3"
      // "Executing orders 2 min before until 2 min after high-impact news NOT allowed"
      planKey:"high_stakes_p1",
      planName:"High Stakes Â· Phase 1 (2-Step)",
      account_sizes:[2500,5000,10000,25000,50000,100000],
      profit_target_pct:10,
      daily_loss_limit_pct:5,
      max_drawdown_pct:10,
      min_trading_days:3,            // Profitable days (not calendar days)
      max_risk_per_trade_pct:2,
      allow_news_trading:true,       // Holding over news OK; but 2-min window restricted
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:true,    // min_trading_days = PROFITABLE days, not calendar days
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:2,         // Orders within 2 min before/after high-impact news banned
      description:"2-Step Phase 1. 10% target. 5% daily loss. 10% max loss. 3 min PROFITABLE days. 2-min news execution window restriction. 80-100% payout.",
    } as FirmPlanExtended,

    {
      // Source: the5ers.com/high-stakes
      // "Step 2 Profit Target: 5% | Same risk rules as Phase 1"
      planKey:"high_stakes_p2",
      planName:"High Stakes Â· Phase 2 (2-Step)",
      account_sizes:[2500,5000,10000,25000,50000,100000],
      profit_target_pct:5,           // Phase 2 target drops to 5%
      daily_loss_limit_pct:5,
      max_drawdown_pct:10,
      min_trading_days:3,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:true,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:2,
      description:"2-Step Phase 2. 5% target. Same risk rules. 3 min profitable days. Upon passing â†’ funded at entered account size.",
    } as FirmPlanExtended,

    {
      // Source: the5ers.com/bootcamp
      // "Profit Target: 6% | Max Loss: 5% | Daily Pause: â€” (no daily pause in evaluation)"
      // "No minimum trading days"
      // Funded stage: 4% max loss, 3% daily pause
      planKey:"bootcamp",
      planName:"Bootcamp (3-Step)",
      account_sizes:[20000,100000,250000],
      profit_target_pct:6,           // 6% per step across Steps 1-3; 5% at funded
      daily_loss_limit_pct:5,        // 5% max loss per step (no daily pause in eval)
      max_drawdown_pct:5,            // Max Loss: 5% during evaluation steps
      min_trading_days:0,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:100,
      starting_payout_pct:50,        // Starts 50/50, scales to 100% at $2.5M
      news_window_minutes:0,
      description:"3-Step. 6% target per step. 5% max loss (evaluation). No min days. Weekend holding OK. Funded: 4% max loss / 3% daily pause. Scales to $4M at 5% intervals.",
    } as FirmPlanExtended,

  ]},

  // â”€â”€ FTMO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Source: ftmo.com/en/how-it-works + academy.ftmo.com (March 2026)
  { key:"FTMO", name:"FTMO", plans:[

    {
      // Source: ftmo.com/en/how-it-works
      // "10% profit target | 5% maximum daily loss | 10% maximum loss | 4 min trading days"
      // "No time limit (unlimited)"
      // No crypto on FTMO standard accounts
      planKey:"2step_p1",
      planName:"2-Step Challenge Â· Phase 1",
      account_sizes:[10000,25000,50000,100000,200000],
      profit_target_pct:10,
      daily_loss_limit_pct:5,        // "5% of initial balance" â€” resets daily at midnight CET
      max_drawdown_pct:10,           // "10% maximum loss â€” static, NOT trailing"
      min_trading_days:4,            // "Minimum duration: 4 trading days"
      max_risk_per_trade_pct:2,
      allow_news_trading:true,       // Allowed during evaluation; no news ban in challenge
      allow_weekend_holding:true,    // Allowed for standard challenge
      trailing_dd:false,             // STATIC drawdown â€” confirmed NOT trailing
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:90,
      starting_payout_pct:80,
      news_window_minutes:0,
      banned_pair_keywords:["BTC","ETH","LTC","XRP","ADA","SOL","DOGE","CRYPTO"],
      description:"2-Step Phase 1. 10% target. 5% daily loss (resets at midnight CET). 10% static max loss. 4 min trading days. No crypto. No time limit. 80-90% payout.",
    } as FirmPlanExtended,

    {
      // Source: ftmo.com/en/how-it-works
      // "5% profit target in Verification | Same 5% daily / 10% max DD | 4 min trading days"
      planKey:"2step_verification",
      planName:"2-Step Verification Â· Phase 2",
      account_sizes:[10000,25000,50000,100000,200000],
      profit_target_pct:5,           // Verification target drops to 5%
      daily_loss_limit_pct:5,
      max_drawdown_pct:10,
      min_trading_days:4,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:90,
      starting_payout_pct:80,
      news_window_minutes:0,
      banned_pair_keywords:["BTC","ETH","LTC","XRP","ADA","SOL","DOGE","CRYPTO"],
      description:"2-Step Verification Phase 2. 5% target. Same risk rules. 4 min trading days.",
    } as FirmPlanExtended,

    {
      // Source: ftmo.com 1-Step product page + academy.ftmo.com
      // "10% profit target | 3% daily loss (formula: prev balance - 3% initial) | 6% dynamic DD"
      // "Best Day Rule: best day â‰¤ 50% of total positive days profit"
      // 1-Step uses EOD dynamic (trailing-style) drawdown on funded stage
      planKey:"1step",
      planName:"1-Step Challenge",
      account_sizes:[10000,25000,50000,100000,200000],
      profit_target_pct:10,
      daily_loss_limit_pct:3,        // DIFFERENT from 2-Step: 3% of initial balance
      max_drawdown_pct:6,            // Dynamic EOD drawdown â€” moves with balance
      min_trading_days:0,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:true,              // 1-Step uses EOD dynamic drawdown
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:90,
      starting_payout_pct:80,
      news_window_minutes:0,
      banned_pair_keywords:["BTC","ETH","LTC","XRP","ADA","SOL","DOGE","CRYPTO"],
      description:"1-Step. 10% target. 3% daily loss (tighter than 2-Step). 6% EOD dynamic drawdown. 50% Best-Day consistency rule. No crypto.",
    } as FirmPlanExtended,

    {
      // Swing = identical rules to 2-Step but explicitly supports weekend holding
      planKey:"swing",
      planName:"Swing Challenge (2-Step)",
      account_sizes:[10000,25000,50000,100000,200000],
      profit_target_pct:10,
      daily_loss_limit_pct:5,
      max_drawdown_pct:10,
      min_trading_days:4,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:90,
      starting_payout_pct:80,
      news_window_minutes:0,
      banned_pair_keywords:["BTC","ETH","LTC","XRP","ADA","SOL","DOGE","CRYPTO"],
      description:"Swing variant of 2-Step. Same rules, designed for overnight/weekend holding. 10%/5% targets.",
    } as FirmPlanExtended,

  ]},

  // â”€â”€ FUNDEDNEXT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Source: help.fundednext.com (official help center), March 2026
  { key:"FundedNext", name:"FundedNext", plans:[

    {
      // Source: help.fundednext.com/articles/8021076 (Stellar 2-Step rules)
      // "5% daily loss limit | 10% maximum loss limit | At least 5 separate trading days"
      // "No consistency rule" â€” confirmed by FundedNext
      planKey:"stellar_2step_p1",
      planName:"Stellar 2-Step Â· Phase 1",
      account_sizes:[6000,15000,25000,50000,100000,200000],
      profit_target_pct:8,           // Phase 1: 8%
      daily_loss_limit_pct:5,
      max_drawdown_pct:10,           // Static â€” NOT trailing for Stellar 2-Step
      min_trading_days:5,            // "At least 5 separate trading days, min 1 trade/day"
      max_risk_per_trade_pct:3,
      allow_news_trading:true,       // Allowed; profits within 5-min window capped at 40% on funded
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:95,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"Stellar 2-Step Phase 1. 8% target. 5% daily loss. 10% static max loss. 5 min trading days. No consistency rule. Up to 95% payout.",
    } as FirmPlanExtended,

    {
      // Source: help.fundednext.com/articles/8021076 (Stellar 2-Step rules)
      planKey:"stellar_2step_p2",
      planName:"Stellar 2-Step Â· Phase 2",
      account_sizes:[6000,15000,25000,50000,100000,200000],
      profit_target_pct:5,           // Phase 2 drops to 5%
      daily_loss_limit_pct:5,
      max_drawdown_pct:10,
      min_trading_days:5,
      max_risk_per_trade_pct:3,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:95,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"Stellar 2-Step Phase 2. 5% target. Same risk rules.",
    } as FirmPlanExtended,

    {
      // Source: help.fundednext.com/articles/8021061 (Stellar 1-Step rules)
      // "3% daily loss limit | 6% maximum loss limit | At least 2 separate trading days"
      // NOTE: 3% daily is MUCH tighter than the 2-Step â€” key difference
      planKey:"stellar_1step",
      planName:"Stellar 1-Step",
      account_sizes:[6000,15000,25000,50000,100000,200000],
      profit_target_pct:10,          // 1-Step target: 10%
      daily_loss_limit_pct:3,        // TIGHTER: 3% daily (not 5%)
      max_drawdown_pct:6,            // TIGHTER: 6% max (not 10%)
      min_trading_days:2,            // Only 2 minimum trading days
      max_risk_per_trade_pct:3,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:95,
      starting_payout_pct:90,        // Starts at 90% (higher than 2-Step's 80%)
      news_window_minutes:0,
      description:"Stellar 1-Step. 10% target. 3% daily loss (very tight). 6% max loss. 2 min trading days. Starts at 90% payout. Up to 95%.",
    } as FirmPlanExtended,

    {
      // Source: help.fundednext.com/articles/9094072 (Stellar Lite rules)
      // "4% daily loss limit | 8% maximum loss limit | At least 5 separate trading days"
      // Phase 1: 8% target, Phase 2: 4% target
      planKey:"stellar_lite",
      planName:"Stellar Lite (2-Step)",
      account_sizes:[6000,15000,25000,50000,100000,200000],
      profit_target_pct:8,           // Phase 1: 8%; Phase 2: 4%
      daily_loss_limit_pct:4,        // 4% daily (between 1-Step's 3% and 2-Step's 5%)
      max_drawdown_pct:8,            // 8% max loss
      min_trading_days:5,
      max_risk_per_trade_pct:3,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:95,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"Stellar Lite 2-Step. Phase 1: 8% target, Phase 2: 4% target. 4% daily loss. 8% max loss. 5 min trading days.",
    } as FirmPlanExtended,

    {
      // Source: help.fundednext.com/articles/11641163 (Stellar Instant rules)
      // "No daily loss limit | 6% TRAILING maximum loss limit"
      // "The floor rises UP with profit â€” losses do NOT reduce it"
      // This is instant funding â€” no evaluation phase
      planKey:"stellar_instant",
      planName:"Stellar Instant (No Evaluation)",
      account_sizes:[5000,10000,20000],
      profit_target_pct:0,           // No target â€” instant funded
      daily_loss_limit_pct:0,        // NO daily loss limit on Stellar Instant
      max_drawdown_pct:6,            // 6% trailing drawdown (floor rises with profit)
      min_trading_days:0,
      max_risk_per_trade_pct:3,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:true,              // TRAILING: floor rises with profit, never decreases
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"Instant funding â€” no challenge needed. 6% TRAILING drawdown (floor rises with profit, never drops). No daily loss limit. 80% payout.",
    } as FirmPlanExtended,

  ]},

  // â”€â”€ FUNDINGPIPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Source: fundingpips.com/en/challenges (March 2026)
  { key:"FundingPips", name:"FundingPips", plans:[

    {
      // Source: fundingpips.com/en/challenges + proptradingvibes.com/fundingpips (verified)
      // "Phase 1: 8% | Phase 2: 5% | 5% daily | 10% max | 3 min trading days"
      // Static drawdown (NOT trailing) â€” key feature of FundingPips
      planKey:"2step_std_p1",
      planName:"2-Step Standard Â· Phase 1",
      account_sizes:[5000,10000,25000,50000,100000],
      profit_target_pct:8,
      daily_loss_limit_pct:5,        // 5% static daily loss
      max_drawdown_pct:10,           // 10% static max drawdown â€” NOT trailing
      min_trading_days:3,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,       // Allowed in evaluation (5-min restriction only on funded)
      allow_weekend_holding:true,
      trailing_dd:false,             // STATIC â€” this is FundingPips' main selling point
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"2-Step Standard Phase 1. 8% target. 5% daily. 10% max (static DD â€” not trailing). 3 min days. 80% payout. No time limit.",
    } as FirmPlanExtended,

    {
      planKey:"2step_std_p2",
      planName:"2-Step Standard Â· Phase 2",
      account_sizes:[5000,10000,25000,50000,100000],
      profit_target_pct:5,
      daily_loss_limit_pct:5,
      max_drawdown_pct:10,
      min_trading_days:3,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"2-Step Standard Phase 2. 5% target. Same rules.",
    } as FirmPlanExtended,

    {
      // Source: fundingpips.com â€” "2-Step Pro: 6% both phases | 3% daily | 6% max"
      // Cheapest entry ($29 for $5K) but tightest rules â€” only for low-drawdown strategies
      planKey:"2step_pro_p1",
      planName:"2-Step Pro Â· Phase 1 (Budget)",
      account_sizes:[5000,10000,25000,50000,100000],
      profit_target_pct:6,           // Both phases: 6%
      daily_loss_limit_pct:3,        // TIGHT: 3% daily (same as FTMO 1-Step / FundedNext 1-Step)
      max_drawdown_pct:6,            // TIGHT: 6% max drawdown
      min_trading_days:3,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"2-Step Pro Phase 1. 6% target. 3% daily (very tight). 6% max. Cheapest entry ($29). Not for high-drawdown strategies.",
    } as FirmPlanExtended,

    {
      // Source: fundingpips.com â€” "1-Step: 10% target | 5% daily | 6% max | 3 min days"
      // Note: max DD is 6% (tighter than 2-Step Standard's 10%) â€” counterintuitive
      planKey:"1step",
      planName:"1-Step Evaluation",
      account_sizes:[5000,10000,25000,50000,100000],
      profit_target_pct:10,
      daily_loss_limit_pct:5,
      max_drawdown_pct:6,            // TIGHTER than 2-Step: 6% max (not 10%)
      min_trading_days:3,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:100,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"1-Step. 10% target. 5% daily. 6% max DD (tighter than 2-Step). 3 min days. Up to 100% payout.",
    } as FirmPlanExtended,

  ]},

  // â”€â”€ E8 MARKETS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Source: help.e8markets.com (official help center), March 2026
  // Note: previously known as "E8 Funding" â€” same firm, rebranded
  { key:"E8Markets", name:"E8 Markets", plans:[

    {
      // Source: help.e8markets.com/articles/12041696 (E8 Classic)
      // "8% Profit Target | 4% Daily Drawdown | 8% Maximum drawdown | No minimum trading days"
      // "In phase 1 and phase 2, you can trade news without any restrictions"
      // 40% Best Day rule applies at FUNDED stage (not during evaluation)
      planKey:"classic_p1",
      planName:"E8 Classic Â· Phase 1 (2-Step)",
      account_sizes:[5000,10000,25000,50000,100000,200000],
      profit_target_pct:8,
      daily_loss_limit_pct:4,        // 4% daily (from starting balance of the day)
      max_drawdown_pct:8,            // 8% static maximum drawdown
      min_trading_days:0,            // No minimum trading days
      max_risk_per_trade_pct:2,
      allow_news_trading:true,       // "No restrictions in phase 1 and 2"
      allow_weekend_holding:true,
      trailing_dd:false,             // Static for E8 Classic
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"E8 Classic Phase 1 (2-Step). 8% target. 4% daily loss. 8% static max DD. No min days. News free in eval. 40% best-day rule applies at funded stage.",
    } as FirmPlanExtended,

    {
      // Source: help.e8markets.com/articles/12041696 (E8 Classic Phase 2)
      // "Phase 2 Profit Target: 4%"
      planKey:"classic_p2",
      planName:"E8 Classic Â· Phase 2 (2-Step)",
      account_sizes:[5000,10000,25000,50000,100000,200000],
      profit_target_pct:4,           // Phase 2 target: 4%
      daily_loss_limit_pct:4,
      max_drawdown_pct:8,
      min_trading_days:0,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:false,
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"E8 Classic Phase 2. 4% target. Same risk rules.",
    } as FirmPlanExtended,

    {
      // Source: help.e8markets.com/articles/11775980 (E8 One)
      // "6% closed-profit target | 3% Daily Drawdown | 4% Dynamic Drawdown (EOD trailing)"
      // "No minimum trading days | Must trade at least once every 60 days"
      // E8 One uses EOD Dynamic Drawdown = trailing-style based on end-of-day balance peaks
      planKey:"e8_one",
      planName:"E8 One (1-Step)",
      account_sizes:[5000,10000,25000,50000,100000,200000,400000,500000],
      profit_target_pct:6,
      daily_loss_limit_pct:3,        // 3% from starting balance of the day
      max_drawdown_pct:4,            // 4% Dynamic (EOD trailing) â€” adjusts based on daily peaks
      min_trading_days:0,
      max_risk_per_trade_pct:2,
      allow_news_trading:true,
      allow_weekend_holding:true,
      trailing_dd:true,              // EOD Dynamic Drawdown â€” trailing based on daily balance highs
      count_profitable_days:false,
      daily_pause_not_breach:false,
      payout_pct:80,
      starting_payout_pct:80,
      news_window_minutes:0,
      description:"E8 One 1-Step. 6% target. 3% daily loss. 4% EOD dynamic (trailing-style) drawdown. No min days. 40% best-day rule at funded stage.",
    } as FirmPlanExtended,

  ]},

];

// â”€â”€ SetupScreen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SetupScreen({ onStart }: { onStart: (session: SimSession, rules: any) => void }) {
  const [firmKey,     setFirmKey]     = useState("The5ers");
  const [planKey,     setPlanKey]     = useState("hyper_growth");
  const [accountSize, setAccountSize] = useState("10000");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [savedFirms,  setSavedFirms]  = useState<SavedFirm[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [saveMsg,     setSaveMsg]     = useState("");
  const [newFirm, setNewFirm] = useState({ name:"", daily_loss_pct:"5", max_drawdown_pct:"10", profit_target_pct:"10", min_trading_days:"0", max_risk_per_trade_pct:"2", account_sizes:"10000,25000,50000,100000", description:"" });
  const [overrides, setOverrides] = useState<Record<string,string>>({});

  useEffect(() => { loadSavedFirms().then(setSavedFirms); }, []);
  useEffect(() => { const firm = BUILTIN_FIRMS.find(f => f.key === firmKey); if (firm) setPlanKey(firm.plans[0].planKey); setOverrides({}); }, [firmKey]);

  const selectedFirmDef   = BUILTIN_FIRMS.find(f => f.key === firmKey);
  const selectedSavedFirm = savedFirms.find(f => f.key === firmKey);
  const selectedPlan: FirmPlan | SavedFirm | null = selectedFirmDef
    ? (selectedFirmDef.plans.find(p => p.planKey === planKey) || selectedFirmDef.plans[0])
    : selectedSavedFirm || null;

  const effectivePlan = selectedPlan ? {
    ...selectedPlan,
    daily_loss_limit_pct:   overrides.daily_loss_limit_pct   !== undefined ? +overrides.daily_loss_limit_pct   : (selectedPlan as any).daily_loss_limit_pct,
    max_drawdown_pct:       overrides.max_drawdown_pct       !== undefined ? +overrides.max_drawdown_pct       : selectedPlan.max_drawdown_pct,
    profit_target_pct:      overrides.profit_target_pct      !== undefined ? +overrides.profit_target_pct      : selectedPlan.profit_target_pct,
    min_trading_days:       overrides.min_trading_days       !== undefined ? +overrides.min_trading_days       : selectedPlan.min_trading_days,
    max_risk_per_trade_pct: overrides.max_risk_per_trade_pct !== undefined ? +overrides.max_risk_per_trade_pct : selectedPlan.max_risk_per_trade_pct,
  } : null;

  const saveNewFirm = async () => {
    if (!newFirm.name.trim()) { setSaveMsg("Enter a firm name"); return; }
    const key = "custom_" + newFirm.name.trim().replace(/\s+/g,"_").toLowerCase() + "_" + Date.now();
    const sizes = newFirm.account_sizes.split(",").map(s => +s.trim()).filter(s => s > 0);
    const firm: SavedFirm = {
      key, isCustom: true, name: newFirm.name.trim(),
      account_sizes: sizes.length ? sizes : [10000,25000,50000,100000],
      daily_loss_limit_pct: +newFirm.daily_loss_pct || 5, max_drawdown_pct: +newFirm.max_drawdown_pct || 10,
      profit_target_pct: +newFirm.profit_target_pct || 10, min_trading_days: +newFirm.min_trading_days || 0,
      max_risk_per_trade_pct: +newFirm.max_risk_per_trade_pct || 2, description: newFirm.description || `Custom: ${newFirm.name}`,
    };
    const updated = [...savedFirms, firm];
    await saveFirms(updated);
    setSavedFirms(updated);
    setFirmKey(key);
    setShowCreator(false); setSaveMsg("");
    setNewFirm({ name:"", daily_loss_pct:"5", max_drawdown_pct:"10", profit_target_pct:"10", min_trading_days:"0", max_risk_per_trade_pct:"2", account_sizes:"10000,25000,50000,100000", description:"" });
  };

  const deleteFirm = async (key: string) => {
    const updated = savedFirms.filter(f => f.key !== key);
    await saveFirms(updated);
    setSavedFirms(updated);
    if (firmKey === key) setFirmKey("FTMO");
  };

  const start = async () => {
    if (!accountSize || +accountSize <= 0) { setError("Enter a valid account size"); return; }
    if (!effectivePlan) { setError("Select a plan"); return; }
    setLoading(true); setError("");
    try {
      const body: any = {
        firm: selectedFirmDef ? firmKey : "FTMO",
        account_size: +accountSize,
        custom_firm_name: selectedSavedFirm?.name || (effectivePlan as any).planName || firmKey,
        custom_daily_loss_pct:      effectivePlan.daily_loss_limit_pct,
        custom_max_drawdown_pct:    effectivePlan.max_drawdown_pct,
        custom_profit_target_pct:   effectivePlan.profit_target_pct,
        custom_min_trading_days:    effectivePlan.min_trading_days,
        custom_max_risk_per_trade_pct: effectivePlan.max_risk_per_trade_pct,
      };
      const res  = await fetch(`${API}/api/v1/simulator/start`, { method:"POST", headers:hdrs(), body:JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start");
      const rules = {
        name: selectedSavedFirm?.name || (selectedFirmDef?.name || firmKey) + " Â· " + ((effectivePlan as any).planName || ""),
        daily_loss_limit_pct:     effectivePlan.daily_loss_limit_pct,
        max_drawdown_pct:         effectivePlan.max_drawdown_pct,
        profit_target_pct:        effectivePlan.profit_target_pct,
        min_trading_days:         effectivePlan.min_trading_days,
        max_risk_per_trade_pct:   effectivePlan.max_risk_per_trade_pct,
        allow_news_trading:       (effectivePlan as any).allow_news_trading       ?? true,
        allow_weekend_holding:    (effectivePlan as any).allow_weekend_holding    ?? true,
        trailing_dd:              (effectivePlan as any).trailing_dd              ?? false,
        payout_pct:               (effectivePlan as any).payout_pct               ?? 80,
        starting_payout_pct:      (effectivePlan as any).starting_payout_pct      ?? 80,
        banned_pair_keywords:     (effectivePlan as any).banned_pair_keywords      ?? [],
        max_lot_size:             (effectivePlan as any).max_lot_size              ?? null,
        // New verified fields
        count_profitable_days:    (effectivePlan as any).count_profitable_days     ?? false,
        daily_pause_not_breach:   (effectivePlan as any).daily_pause_not_breach    ?? false,
        news_window_minutes:      (effectivePlan as any).news_window_minutes        ?? 0,
      };
      onStart(data.session, rules);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const or    = (k: string) => (overrides[k] !== undefined ? overrides[k] : String((effectivePlan as any)?.[k] ?? ""));
  const setOr = (k: string, v: string) => setOverrides(p => ({...p,[k]:v}));

  return (
    <Box sx={{ maxWidth:"720px", mx:"auto" }}>
      <Box sx={{ textAlign:"center", mb:"28px" }}>
        <Typography sx={{ fontSize:"32px", fontWeight:900, color:"white", lineHeight:1.1 }}>ðŸ† Prop Firm Simulator</Typography>
        <Typography sx={{ fontSize:"14px", color:"rgba(255,255,255,0.4)", mt:"8px" }}>Practice a funded challenge without risking real money</Typography>
      </Box>

      {/* Firm selector */}
      <Box sx={{ mb:2 }}>
        <Typography sx={LBL}>Select Prop Firm</Typography>
        <Box sx={{ display:"flex", flexWrap:"wrap", gap:"8px", mt:"8px" }}>
          {[...BUILTIN_FIRMS, ...savedFirms].map(f => {
            const isS = (f as SavedFirm).isCustom;
            return (
              <Box key={f.key} sx={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
                <Box onClick={() => setFirmKey(f.key)} sx={{ px:"16px", py:"10px", pr:isS?"32px":"16px", borderRadius:"12px", cursor:"pointer", background:firmKey===f.key?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.04)", border:firmKey===f.key?"1px solid rgba(56,189,248,0.45)":"1px solid rgba(255,255,255,0.08)", transition:"all 0.15s" }}>
                  <Typography sx={{ fontSize:"13px", fontWeight:800, color:firmKey===f.key?"#38bdf8":"rgba(255,255,255,0.6)" }}>{isS?"âœï¸ ":""}{f.name}</Typography>
                </Box>
                {isS && <Box onClick={() => deleteFirm(f.key)} sx={{ position:"absolute", right:"8px", top:"50%", transform:"translateY(-50%)", fontSize:"11px", color:"rgba(239,68,68,0.45)", cursor:"pointer", "&:hover":{ color:"#ef4444" } }}>âœ•</Box>}
              </Box>
            );
          })}
          <Box onClick={() => setShowCreator(v => !v)} sx={{ px:"16px", py:"10px", borderRadius:"12px", cursor:"pointer", background:showCreator?"rgba(34,197,94,0.12)":"rgba(255,255,255,0.03)", border:showCreator?"1px solid rgba(34,197,94,0.35)":"1px dashed rgba(255,255,255,0.15)", transition:"all 0.15s" }}>
            <Typography sx={{ fontSize:"13px", fontWeight:800, color:showCreator?"#22c55e":"rgba(255,255,255,0.35)" }}>+ Add Firm</Typography>
          </Box>
        </Box>
      </Box>

      {/* Plan selector */}
      {selectedFirmDef && (
        <Box sx={{ mb:3 }}>
          <Typography sx={LBL}>Select Plan / Phase</Typography>
          <Box sx={{ display:"flex", flexWrap:"wrap", gap:"8px", mt:"8px" }}>
            {selectedFirmDef.plans.map(p => {
              const is1step  = p.planKey.includes("hyper") || p.planName.includes("1-Step");
              const isP1     = p.planKey.includes("_p1")   || p.planName.includes("Phase 1");
              const isP2     = p.planKey.includes("_p2")   || p.planName.includes("Phase 2");
              const dotColor = is1step ? "#22c55e" : isP1 ? "#38bdf8" : isP2 ? "#a855f7" : "#f59e0b";
              const active   = planKey === p.planKey;
              return (
                <Box key={p.planKey} onClick={() => { setPlanKey(p.planKey); setOverrides({}); }} sx={{ px:"14px", py:"8px", borderRadius:"10px", cursor:"pointer", display:"flex", alignItems:"center", gap:"7px", background:active?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.04)", border:active?"1px solid rgba(168,85,247,0.45)":"1px solid rgba(255,255,255,0.08)", transition:"all 0.15s" }}>
                  <Box sx={{ width:"7px", height:"7px", borderRadius:"50%", background:dotColor, flexShrink:0 }} />
                  <Typography sx={{ fontSize:"12px", fontWeight:800, color:active?"#a855f7":"rgba(255,255,255,0.5)" }}>{p.planName}</Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Rules card */}
      {effectivePlan && (
        <Box sx={{ ...card(), p:"18px 22px", mb:3, background:"rgba(56,189,248,0.03)", border:"1px solid rgba(56,189,248,0.12)" }}>
          <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mb:"12px", flexWrap:"wrap", gap:"6px" }}>
            <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.4)" }}>{(effectivePlan as any).description || (effectivePlan as any).planName}</Typography>
            {Object.keys(overrides).length > 0 && (
              <Box onClick={() => setOverrides({})} sx={{ px:"10px", py:"4px", borderRadius:"7px", cursor:"pointer", fontSize:"11px", fontWeight:700, color:"#f59e0b", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)" }}>â†© Reset</Box>
            )}
          </Box>
          <Grid container spacing={1.5}>
            {[
              { k:"profit_target_pct",      label:"Profit Target %",    c:"#22c55e" },
              { k:"daily_loss_limit_pct",   label:"Daily Loss Limit %", c:"#ef4444" },
              { k:"max_drawdown_pct",       label:"Max Drawdown %",     c:"#f59e0b" },
              { k:"min_trading_days",       label:"Min Trading Days",   c:"#a855f7" },
              { k:"max_risk_per_trade_pct", label:"Max Risk/Trade %",   c:"#38bdf8" },
            ].map(({ k, label, c }) => (
              <Grid item xs={6} sm={4} md={2.4} key={k}>
                <Box sx={{ px:"12px", py:"10px", borderRadius:"10px", background:"rgba(255,255,255,0.04)", border:`1px solid ${overrides[k]!==undefined?"rgba(245,158,11,0.35)":"rgba(255,255,255,0.08)"}` }}>
                  <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", mb:"6px" }}>{label}</Typography>
                  <input style={{ background:"transparent", border:"none", outline:"none", color:c, fontWeight:900, fontSize:"17px", fontFamily:'"Roboto Mono",monospace', width:"100%", padding:0 }}
                    inputMode="decimal" value={or(k)} onChange={e => setOr(k, e.target.value)} />
                </Box>
              </Grid>
            ))}
          </Grid>
          <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.2)", mt:"10px" }}>âœï¸ Click any value to override it for this challenge</Typography>
        </Box>
      )}

      {/* Custom firm creator */}
      {showCreator && (
        <Box sx={{ ...card(), p:"20px 22px", mb:3, background:"rgba(34,197,94,0.03)", border:"1px solid rgba(34,197,94,0.15)" }}>
          <Typography sx={{ fontSize:"13px", fontWeight:800, color:"#22c55e", mb:"14px" }}>âž• Add Your Prop Firm</Typography>
          <Grid container spacing={1.5}>
            {[
              { k:"name",                   label:"Firm Name *",           ph:"e.g. Topstep, Apex",       sm:6 },
              { k:"description",            label:"Description",           ph:"e.g. Funded forex",         sm:6 },
              { k:"daily_loss_pct",         label:"Daily Loss Limit %",    ph:"5",  sm:4 },
              { k:"max_drawdown_pct",       label:"Max Drawdown %",        ph:"10", sm:4 },
              { k:"profit_target_pct",      label:"Profit Target %",       ph:"10", sm:4 },
              { k:"min_trading_days",       label:"Min Trading Days",      ph:"0",  sm:4 },
              { k:"max_risk_per_trade_pct", label:"Max Risk/Trade %",      ph:"2",  sm:4 },
              { k:"account_sizes",          label:"Account Sizes (comma)", ph:"10000,25000,50000", sm:4 },
            ].map(({ k, label, ph, sm }) => (
              <Grid item xs={12} sm={sm} key={k}>
                <Typography sx={{ ...LBL, mb:"4px" }}>{label}</Typography>
                <input style={{...INP, fontSize:"13px"}} placeholder={ph} value={(newFirm as any)[k]} onChange={e => setNewFirm(p=>({...p,[k]:e.target.value}))} />
              </Grid>
            ))}
          </Grid>
          {saveMsg && <Typography sx={{ color:"#f59e0b", fontSize:"12px", mt:"10px" }}>{saveMsg}</Typography>}
          <Box sx={{ display:"flex", gap:"10px", mt:"14px" }}>
            <Box onClick={saveNewFirm} sx={{ px:"20px", py:"9px", borderRadius:"10px", cursor:"pointer", fontWeight:800, fontSize:"13px", background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"white" }}>ðŸ’¾ Save Firm</Box>
            <Box onClick={() => setShowCreator(false)} sx={{ px:"20px", py:"9px", borderRadius:"10px", cursor:"pointer", fontWeight:700, fontSize:"13px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)" }}>Cancel</Box>
          </Box>
        </Box>
      )}

      {/* Account size */}
      <Box sx={{ mb:3 }}>
        <Typography sx={LBL}>Account Size ($)</Typography>
        <Box sx={{ display:"flex", gap:"8px", flexWrap:"wrap", mb:"10px" }}>
          {(effectivePlan?.account_sizes || [10000,25000,50000,100000]).map(s => (
            <Box key={s} onClick={() => setAccountSize(String(s))} sx={{ px:"14px", py:"7px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:700, background:accountSize===String(s)?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.04)", border:accountSize===String(s)?"1px solid rgba(34,197,94,0.4)":"1px solid rgba(255,255,255,0.08)", color:accountSize===String(s)?"#22c55e":"rgba(255,255,255,0.4)", transition:"all 0.15s" }}>
              ${s.toLocaleString()}
            </Box>
          ))}
        </Box>
        <input style={INP} inputMode="numeric" placeholder="or enter custom amount" value={accountSize} onChange={e => setAccountSize(e.target.value)} />
      </Box>

      {error && <Typography sx={{ color:"#ef4444", fontSize:"13px", mb:"12px" }}>{error}</Typography>}

      <Box onClick={!loading ? start : undefined} sx={{ py:"15px", borderRadius:"14px", textAlign:"center", cursor:loading?"not-allowed":"pointer", fontWeight:800, fontSize:"16px", background:"linear-gradient(135deg,#0ea5e9,#6366f1)", color:"white", boxShadow:"0 8px 32px rgba(56,189,248,0.25)", transition:"all 0.15s", opacity:loading?0.7:1 }}>
        {loading ? <CircularProgress size={16} sx={{color:"white"}} /> : "ðŸš€ Start Challenge â†’"}
      </Box>
    </Box>
  );
}

// â”€â”€ TradeForm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TradeForm({ session, rules, onTrade, onNextDay }: {
  session: SimSession; rules: any;
  onTrade: (updated: SimSession, metrics: Metrics, violations: string[], alerts: string[]) => void;
  onNextDay: (updated: SimSession) => void;
}) {
  const [form, setForm] = useState({ symbol:"EURUSD", lot_size:"0.01", entry:"", sl:"", tp:"", result:"win", timeframe:"H1", days_held:"0", open_date:"", close_date:"", direction:"buy", notes:"", is_news_trade:false, is_weekend_hold:false });
  const [screenshot, setScreenshot] = useState<string>("");
  const [showCal, setShowCal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const f = (k: string, v: string) => setForm(p => ({...p,[k]:v}));

  const swapAndCommission = (() => {
    const { symbol, lot_size, days_held } = form;
    if (!lot_size || +days_held <= 0) return null;
    const lots = +lot_size; const days = +days_held;
    const s = symbol.toUpperCase();
    let commissionPerLot = 0, swapLongPerLotPerDay = 0, swapShortPerLotPerDay = 0, assetType = "forex";
    if (s.includes("XAUUSD") || s.includes("GOLD")) { commissionPerLot=3.5; swapLongPerLotPerDay=-7.50; swapShortPerLotPerDay=2.20; assetType="metal"; }
    else if (s.includes("US30")||s.includes("SPX")||s.includes("NAS")||s.includes("DAX")||s.includes("UK100")) { commissionPerLot=0; swapLongPerLotPerDay=-8.00; swapShortPerLotPerDay=-2.00; assetType="index"; }
    else if (s.includes("BTC")||s.includes("ETH")||s.includes("CRYPTO")) { commissionPerLot=10; swapLongPerLotPerDay=-25.00; swapShortPerLotPerDay=-25.00; assetType="crypto"; }
    else { const firmRates: Record<string,number>={"The5ers":3.5,FundedNext:4.0,FundingPips:3.5,E8Markets:3.5,FTMO:3.5}; commissionPerLot=firmRates[rules?.firm_group??rules?.name]??4.0; swapLongPerLotPerDay=s.includes("JPY")?-0.80:s.includes("GBP")?-3.20:-2.50; swapShortPerLotPerDay=s.includes("JPY")?0.30:s.includes("GBP")?1.10:0.80; assetType="forex"; }
    const weekends = Math.floor(days / 7); const effectiveDays = days + weekends * 2;
    return { commission:(commissionPerLot*lots).toFixed(2), swapLong:(swapLongPerLotPerDay*lots*effectiveDays).toFixed(2), swapShort:(swapShortPerLotPerDay*lots*effectiveDays).toFixed(2), effectiveDays, assetType };
  })();

  const riskPreview = (() => {
    const { symbol, lot_size, entry, sl, tp } = form;
    if (!lot_size || !entry || !sl || +entry === +sl) return null;

    const dist    = Math.abs(+entry - +sl);
    const tpDist  = (tp && +tp !== 0 && +tp !== +entry) ? Math.abs(+tp - +entry) : null;
    const lots    = +lot_size;
    const sym     = symbol.toUpperCase().replace(/\s+/g, "");
    const entryPx = +entry;

    let riskDollar   = 0;
    let rewardDollar = 0;
    let assetLabel   = "";
    let pipValueUSD  = 0;  // $ per 1 pip per 1 standard lot

    // â”€â”€ Deriv Step Index â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (sym.includes("STEPINDEX") || sym.includes("MULTISTEP") || sym.includes("SKEWSTEP")) {
      // $10 per point per lot (proprietary Deriv product)
      riskDollar   = dist * 10 * lots;
      rewardDollar = tpDist ? tpDist * 10 * lots : 0;
      assetLabel   = "Step Index";
      return { dollar: riskDollar.toFixed(2), reward: rewardDollar.toFixed(2), pct: (riskDollar / session.balance * 100).toFixed(4), rr: tpDist ? Math.round(tpDist / dist * 100) / 100 : null, assetLabel, pipValue: "10.00" };

    // â”€â”€ Other Deriv synthetics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    } else if (
      sym.includes("VOLATILITY") || sym.includes("CRASH") || sym.includes("BOOM") ||
      sym.includes("JUMP")       || sym.includes("RANGEBREAK")
    ) {
      riskDollar   = dist * lots;
      rewardDollar = tpDist ? tpDist * lots : 0;
      assetLabel   = "Synthetic";
      return { dollar: riskDollar.toFixed(2), reward: rewardDollar.toFixed(2), pct: (riskDollar / session.balance * 100).toFixed(4), rr: tpDist ? Math.round(tpDist / dist * 100) / 100 : null, assetLabel, pipValue: "1.00" };

    // â”€â”€ Gold / Silver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // XAUUSD: 1 lot = 100 troy oz. 1 pip = $0.01 move â†’ pip value = $0.01 * 100 = $1.00/pip/lot
    } else if (sym.includes("XAUUSD") || sym === "GOLD") {
      pipValueUSD  = 1.0;   // $1 per pip ($0.01 move) per lot (100 oz)
      const pips   = dist / 0.01;
      riskDollar   = pips * pipValueUSD * lots;
      rewardDollar = tpDist ? (tpDist / 0.01) * pipValueUSD * lots : 0;
      assetLabel   = "Gold Â· $1/pip/lot";

    // â”€â”€ XAGUSD (Silver) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 1 lot = 5000 oz. pip = $0.001 â†’ pip value = $5/pip/lot
    } else if (sym.includes("XAGUSD") || sym === "SILVER") {
      pipValueUSD  = 5.0;
      const pips   = dist / 0.001;
      riskDollar   = pips * pipValueUSD * lots;
      rewardDollar = tpDist ? (tpDist / 0.001) * pipValueUSD * lots : 0;
      assetLabel   = "Silver Â· $5/pip/lot";

    // â”€â”€ Equity indices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // $1 per point per lot (standard CFD, varies by broker but this is the baseline)
    } else if (
      sym.includes("US30")  || sym.includes("US500") || sym.includes("US100") ||
      sym.includes("SPX500")|| sym.includes("NAS100")|| sym.includes("DJ30")  ||
      sym.includes("DAX")   || sym.includes("UK100") || sym.includes("GER40") ||
      sym.includes("FRA40") || sym.includes("AUS200")|| sym.includes("JPN225")||
      sym.includes("STOXX") || sym.includes("SPA35")
    ) {
      riskDollar   = dist * lots;
      rewardDollar = tpDist ? tpDist * lots : 0;
      assetLabel   = "Index Â· $1/pt/lot";

    // â”€â”€ Crypto CFD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    } else if (sym.includes("BTC") || sym.includes("ETH") || sym.includes("XRP") ||
               sym.includes("SOL") || sym.includes("ADA") || sym.includes("DOGE")) {
      riskDollar   = dist * lots;
      rewardDollar = tpDist ? tpDist * lots : 0;
      assetLabel   = "Crypto";

    // â”€â”€ Standard Forex â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    } else {
      // â”€â”€ RULE 1: Quote is USD â†’ always $10/pip/lot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // EUR/USD, GBP/USD, AUD/USD, NZD/USD
      const quoteIsUSD = sym.endsWith("USD") && !sym.startsWith("USD");
      if (quoteIsUSD) {
        pipValueUSD  = 10.0;
        const pips   = dist / 0.0001;
        riskDollar   = pips * pipValueUSD * lots;
        rewardDollar = tpDist ? (tpDist / 0.0001) * pipValueUSD * lots : 0;
        assetLabel   = `${symbol} Â· $10/pip/lot`;

      // â”€â”€ RULE 2: Base is USD, quote is JPY (USD/JPY) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // pip_value_usd = 1000 / entry_price  (entry IS the USDJPY rate)
      } else if (sym.startsWith("USD") && sym.endsWith("JPY")) {
        pipValueUSD  = 1000 / entryPx;
        const pips   = dist / 0.01;
        riskDollar   = pips * pipValueUSD * lots;
        rewardDollar = tpDist ? (tpDist / 0.01) * pipValueUSD * lots : 0;
        assetLabel   = `USDJPY Â· $${pipValueUSD.toFixed(2)}/pip/lot`;

      // â”€â”€ RULE 3: Base is USD, quote NOT JPY (USD/CHF, USD/CAD, USD/SEK...) â”€â”€
      // pip_value_usd = 0.0001 / entry_price * 100,000 = 10 / entry_price
      } else if (sym.startsWith("USD") && !sym.endsWith("JPY")) {
        pipValueUSD  = 10 / entryPx;
        const pips   = dist / 0.0001;
        riskDollar   = pips * pipValueUSD * lots;
        rewardDollar = tpDist ? (tpDist / 0.0001) * pipValueUSD * lots : 0;
        assetLabel   = `${symbol} Â· $${pipValueUSD.toFixed(2)}/pip/lot`;

      // â”€â”€ RULE 4: JPY cross (EUR/JPY, GBP/JPY, CHF/JPY, AUD/JPY etc.) â”€â”€â”€â”€â”€â”€â”€â”€
      // KEY INSIGHT: ALL JPY cross pairs have the same pip value in USD = 1000 / USDJPY
      // We don't have live USDJPY. Best approximation: use a reference rate.
      // Reference USDJPY ~158 (current 2026 rate). This gives ~$6.33/pip/lot.
      // For CHFJPY at USDJPY=159.74 â†’ $6.26 (myfxbook verified).
      // User can see the assetLabel shows the rate used.
      } else if (sym.endsWith("JPY")) {
        // Use a fixed reference USDJPY of 158.5 (mid-range 2026 approximation)
        // For USDJPY-specific accuracy, if trading USDJPY use entry directly (Rule 2 above)
        const REF_USDJPY = 158.5;
        pipValueUSD  = 1000 / REF_USDJPY;  // ~$6.31/pip â€” matches myfxbook $6.26 within rounding
        const pips   = dist / 0.01;
        riskDollar   = pips * pipValueUSD * lots;
        rewardDollar = tpDist ? (tpDist / 0.01) * pipValueUSD * lots : 0;
        assetLabel   = `${symbol} Â· ~$${pipValueUSD.toFixed(2)}/pip/lot`;

      // â”€â”€ RULE 5: Non-JPY crosses (EUR/GBP, EUR/CHF, GBP/CHF, EUR/CAD etc.) â”€â”€
      // Quote currency is NOT USD and NOT JPY.
      // pip value in quote currency = 10 units
      // We need quoteâ†’USD rate. Use static reference rates for common currencies.
      } else {
        // Detect quote currency (last 3 chars)
        const quoteCcy = sym.slice(-3);
        // Reference exchange rates: 1 unit of quote = X USD
        const quoteToUSD: Record<string, number> = {
          GBP: 1.265,   // GBPUSD
          EUR: 1.085,   // EURUSD
          AUD: 0.645,   // AUDUSD
          NZD: 0.595,   // NZDUSD
          CHF: 1.124,   // 1/USDCHF(0.890)
          CAD: 0.727,   // 1/USDCAD(1.376)
          SGD: 0.743,   // approx
          NOK: 0.093,
          SEK: 0.095,
          DKK: 0.145,
          HKD: 0.128,
          ZAR: 0.055,
          MXN: 0.058,
          TRY: 0.032,
          PLN: 0.249,
          CZK: 0.044,
        };
        const conv = quoteToUSD[quoteCcy] ?? 1.0;
        pipValueUSD  = 10 * conv;   // 10 units of quote currency Ã— conversion rate to USD
        const pips   = dist / 0.0001;
        riskDollar   = pips * pipValueUSD * lots;
        rewardDollar = tpDist ? (tpDist / 0.0001) * pipValueUSD * lots : 0;
        assetLabel   = `${symbol} Â· $${pipValueUSD.toFixed(2)}/pip/lot`;
      }
    }

    const pct = session.balance > 0 ? (riskDollar / session.balance * 100) : 0;
    const rr  = (rewardDollar > 0 && riskDollar > 0)
      ? Math.round(rewardDollar / riskDollar * 100) / 100
      : null;

    return {
      dollar:     riskDollar.toFixed(2),
      reward:     rewardDollar.toFixed(2),
      pct:        pct.toFixed(4),
      rr,
      assetLabel,
      pipValue:   pipValueUSD.toFixed(2),
    };
  })();

  const submit = async () => {
    if (!form.entry || !form.sl || !form.lot_size) { setError("Fill in Entry, SL and Lot"); return; }
    setLoading(true); setError("");
    try {
      const commissionNum = swapAndCommission ? +swapAndCommission.commission : 0;
      const body = { session, symbol:form.symbol, lot_size:+form.lot_size, entry:+form.entry, sl:+form.sl, tp:form.tp?+form.tp:+form.entry, result:form.result, direction:form.direction, timeframe:form.timeframe, days_held:+form.days_held, notes:form.notes||null, commission_override:commissionNum, screenshot_url:screenshot||null, is_news_trade:form.is_news_trade, is_weekend_hold:form.is_weekend_hold };
      const res  = await fetch(`${API}/api/v1/simulator/trade`, { method:"POST", headers:hdrs(), body:JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Trade failed");
      onTrade(data.session, data.metrics, data.violations || [], data.alerts || []);
      setForm(p => ({...p, entry:"", sl:"", tp:"", days_held:"0", open_date:"", close_date:"", notes:"", is_news_trade:false, is_weekend_hold:false}));
      setScreenshot("");
    } catch(e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const nextDay = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/v1/simulator/next-day`, { method:"POST", headers:hdrs(), body:JSON.stringify({session}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      onNextDay(data.session);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{ ...card(), p:"20px 22px" }}>
      <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mb:"16px", flexWrap:"wrap", gap:"8px" }}>
        <Typography sx={{ fontSize:"14px", fontWeight:800, color:"rgba(255,255,255,0.85)" }}>ðŸ“… Day {session.day} â€” Submit Trade</Typography>
        <Box onClick={!loading?nextDay:undefined} sx={{ px:"14px", py:"7px", borderRadius:"10px", cursor:"pointer", fontSize:"12px", fontWeight:700, background:"rgba(168,85,247,0.12)", border:"1px solid rgba(168,85,247,0.3)", color:"#a855f7", transition:"all 0.15s" }}>âž¡ End Day {session.day}</Box>
      </Box>

      <Grid container spacing={1.5}>
        <Grid item xs={12}><Typography sx={LBL}>Symbol</Typography><input style={INP} placeholder="e.g. EURUSD, XAUUSD, US30" value={form.symbol} onChange={e => f("symbol", e.target.value)} /></Grid>
        <Grid item xs={6} sm={3}><Typography sx={LBL}>Lot Size</Typography><input style={INP} inputMode="decimal" placeholder="0.01" value={form.lot_size} onChange={e => f("lot_size", e.target.value)} /></Grid>
        <Grid item xs={6} sm={3}><Typography sx={LBL}>Entry Price</Typography><input style={INP} inputMode="decimal" placeholder="1.08500" value={form.entry} onChange={e => f("entry", e.target.value)} /></Grid>
        <Grid item xs={6} sm={3}><Typography sx={LBL}>Stop Loss</Typography><input style={INP} inputMode="decimal" placeholder="1.08200" value={form.sl} onChange={e => f("sl", e.target.value)} /></Grid>
        <Grid item xs={6} sm={3}><Typography sx={LBL}>Take Profit</Typography><input style={INP} inputMode="decimal" placeholder="1.09100" value={form.tp} onChange={e => f("tp", e.target.value)} /></Grid>

        <Grid item xs={12} sm={3}><Typography sx={LBL}>Timeframe</Typography>
          <select style={SEL} value={form.timeframe} onChange={e => f("timeframe", e.target.value)}>
            {["M1","M5","M15","M30","H1","H4","D1","W1"].map(tf => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </Grid>
        <Grid item xs={12} sm={5}><Typography sx={LBL}>Trade Duration</Typography>
          <Box onClick={() => setShowCal(true)} sx={{ ...INP as any, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", userSelect:"none", "&:hover":{ borderColor:"rgba(56,189,248,0.4)" }, transition:"all 0.15s" }}>
            <Typography sx={{ fontSize:"14px", color:form.open_date?"white":"rgba(255,255,255,0.25)" }}>
              {form.open_date && form.close_date ? `${form.open_date} â†’ ${form.close_date}` : "ðŸ“… Pick open & close date"}
            </Typography>
            <Typography sx={{ fontSize:"16px", color:"rgba(255,255,255,0.3)", ml:"8px" }}>ðŸ“…</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4} sx={{ display:"flex", alignItems:"flex-end" }}>
          <Box sx={{ px:"12px", py:"9px", borderRadius:"10px", background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.14)", width:"100%" }}>
            <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.25)", fontWeight:700, textTransform:"uppercase" }}>Duration</Typography>
            <Typography sx={{ fontSize:"14px", fontWeight:800, color:"#38bdf8", mt:"1px", fontFamily:'"Roboto Mono",monospace', whiteSpace:"nowrap" }}>
              {form.timeframe} Â· {+form.days_held > 0 ? `${form.days_held} day${+form.days_held>1?"s":""}` : "intraday"}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {showCal && <DarkCalendar onRange={(o,c,d) => { setForm(p=>({...p,open_date:o,close_date:c,days_held:String(d)})); }} onClose={() => setShowCal(false)} />}

      {/* Risk preview */}
      {riskPreview && (
        <Box sx={{ mt:"10px", p:"10px 14px", borderRadius:"10px", background:"rgba(255,255,255,0.02)", border:`1px solid ${+riskPreview.pct > rules.max_risk_per_trade_pct ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`, display:"flex", gap:"16px", flexWrap:"wrap", alignItems:"center" }}>
          <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            {riskPreview.assetLabel}
          </Typography>
          <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.4)" }}>
            Risk: <span style={{ color:+riskPreview.pct > rules.max_risk_per_trade_pct ? "#ef4444" : "#22c55e", fontWeight:800 }}>
              ${riskPreview.dollar} ({riskPreview.pct}%)
            </span>
          </Typography>
          {+riskPreview.reward > 0 && (
            <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.4)" }}>
              Reward: <span style={{ color:"#22c55e", fontWeight:800 }}>${riskPreview.reward}</span>
            </Typography>
          )}
          {riskPreview.rr !== null && (
            <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.4)" }}>
              RR: <span style={{ color:riskPreview.rr >= 2 ? "#22c55e" : riskPreview.rr >= 1 ? "#f59e0b" : "#ef4444", fontWeight:800 }}>{riskPreview.rr}R</span>
            </Typography>
          )}
          {+riskPreview.pct > rules.max_risk_per_trade_pct && (
            <Typography sx={{ fontSize:"12px", color:"#ef4444", fontWeight:700 }}>âš  Exceeds {rules.max_risk_per_trade_pct}% limit</Typography>
          )}
        </Box>
      )}

      {/* Direction + Result */}
      <Box sx={{ mt:"14px", mb:"14px", display:"flex", gap:"10px", flexWrap:"wrap" }}>
        <Box sx={{ flex:"0 0 auto" }}>
          <Typography sx={{ ...LBL, mb:"8px" }}>Direction</Typography>
          <Box sx={{ display:"flex", gap:"6px" }}>
            {(["buy","sell"] as const).map(d => (
              <Box key={d} onClick={() => f("direction", d)} sx={{ px:"22px", py:"9px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:800, textAlign:"center", background:form.direction===d?(d==="buy"?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"):"rgba(255,255,255,0.04)", border:form.direction===d?(d==="buy"?"1px solid rgba(34,197,94,0.5)":"1px solid rgba(239,68,68,0.5)"):"1px solid rgba(255,255,255,0.08)", color:form.direction===d?(d==="buy"?"#22c55e":"#ef4444"):"rgba(255,255,255,0.4)", transition:"all 0.15s" }}>
                {d==="buy" ? "â–² BUY" : "â–¼ SELL"}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ flex:1, minWidth:"180px" }}>
          <Typography sx={{ ...LBL, mb:"8px" }}>Trade Result</Typography>
          <Box sx={{ display:"flex", gap:"6px" }}>
            {(["win","loss","breakeven"] as const).map(r => {
              const c = r==="win"?"34,197,94":r==="loss"?"239,68,68":"245,158,11";
              return (
                <Box key={r} onClick={() => f("result", r)} sx={{ flex:1, py:"9px", borderRadius:"10px", textAlign:"center", cursor:"pointer", fontSize:"12px", fontWeight:700, background:form.result===r?`rgba(${c},0.15)`:"rgba(255,255,255,0.04)", border:form.result===r?`1px solid rgba(${c},0.45)`:"1px solid rgba(255,255,255,0.08)", color:form.result===r?`rgb(${c})`:"rgba(255,255,255,0.4)", transition:"all 0.15s" }}>
                  {r==="win"?"Win":r==="loss"?"Loss":"B/E"}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Swap panel */}
      {swapAndCommission && (
        <Box sx={{ mb:"14px", p:"14px 16px", borderRadius:"11px", background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.15)" }}>
          <Typography sx={{ fontSize:"11px", fontWeight:800, color:"rgba(245,158,11,0.7)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"10px" }}>
            Swap & Commission â€” {swapAndCommission.effectiveDays} effective days Â· {form.direction.toUpperCase()}
          </Typography>
          <Box sx={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
            {(() => {
              const isBuy = form.direction==="buy";
              const swapVal = isBuy ? swapAndCommission.swapLong : swapAndCommission.swapShort;
              const swapNum = +swapVal; const comm = +swapAndCommission.commission;
              const netCost = (swapNum - comm).toFixed(2);
              return [
                { label:"Commission", val:`-$${swapAndCommission.commission}`, sub:"round turn", color:"#f59e0b" },
                { label:`Swap (${isBuy?"Long":"Short"})`, val:`${swapNum>=0?"+":""}$${swapVal}`, sub:"overnight x days", color:swapNum>=0?"#22c55e":"#ef4444" },
                { label:"Net Trade Cost", val:`${+netCost>=0?"+":""}$${netCost}`, sub:"swap - commission", color:+netCost>=0?"#22c55e":"#ef4444" },
              ].map(({ label, val, sub, color }) => (
                <Box key={label} sx={{ px:"12px", py:"8px", borderRadius:"9px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", flex:1, minWidth:"100px" }}>
                  <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.04em" }}>{label}</Typography>
                  <Typography sx={{ fontSize:"15px", fontWeight:800, color, fontFamily:'"Roboto Mono",monospace' }}>{val}</Typography>
                  <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.2)" }}>{sub}</Typography>
                </Box>
              ));
            })()}
          </Box>
        </Box>
      )}

      {/* News / weekend flags */}
      <Box sx={{ mb:"12px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
        <Box onClick={() => setForm(p => ({...p, is_news_trade:!p.is_news_trade}))} sx={{ px:"12px", py:"7px", borderRadius:"9px", cursor:"pointer", fontSize:"12px", fontWeight:700, background:form.is_news_trade?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.04)", border:form.is_news_trade?"1px solid rgba(239,68,68,0.4)":"1px solid rgba(255,255,255,0.08)", color:form.is_news_trade?"#fca5a5":"rgba(255,255,255,0.35)", transition:"all 0.15s" }}>
          ðŸ“° News trade {form.is_news_trade?"(flagged)":"(none)"}
        </Box>
        <Box onClick={() => setForm(p => ({...p, is_weekend_hold:!p.is_weekend_hold}))} sx={{ px:"12px", py:"7px", borderRadius:"9px", cursor:"pointer", fontSize:"12px", fontWeight:700, background:form.is_weekend_hold?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.04)", border:form.is_weekend_hold?"1px solid rgba(245,158,11,0.4)":"1px solid rgba(255,255,255,0.08)", color:form.is_weekend_hold?"#fcd34d":"rgba(255,255,255,0.35)", transition:"all 0.15s" }}>
          ðŸ“… Weekend hold {form.is_weekend_hold?"(flagged)":"(none)"}
        </Box>
      </Box>

      {/* Screenshot */}
      <Box sx={{ mb:"12px" }}>
        <Typography sx={{ ...LBL, mb:"6px" }}>Screenshot (optional)</Typography>
        {screenshot ? (
          <Box sx={{ position:"relative" }}>
            <img src={screenshot} alt="trade screenshot" style={{ width:"100%", maxHeight:"160px", objectFit:"cover", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.1)" }} />
            <Box onClick={() => setScreenshot("")} sx={{ position:"absolute", top:"6px", right:"6px", px:"8px", py:"3px", borderRadius:"6px", background:"rgba(0,0,0,0.7)", color:"#ef4444", fontSize:"11px", fontWeight:700, cursor:"pointer" }}>âœ• Remove</Box>
          </Box>
        ) : (
          <label style={{ display:"block", cursor:"pointer" }}>
            <Box sx={{ p:"12px", borderRadius:"10px", border:"1px dashed rgba(255,255,255,0.12)", textAlign:"center", background:"rgba(255,255,255,0.02)", "&:hover":{ borderColor:"rgba(56,189,248,0.3)" }, transition:"all 0.15s" }}>
              <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.25)" }}>ðŸ“· Click to attach chart screenshot</Typography>
            </Box>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=ev=>setScreenshot(ev.target?.result as string??""); reader.readAsDataURL(file); e.target.value=""; }} />
          </label>
        )}
      </Box>

      {/* Notes */}
      <Box sx={{ mb:"12px" }}>
        <Typography sx={{ ...LBL, mb:"6px" }}>Notes (optional)</Typography>
        <textarea value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="Entry reason, mistakes, lessons learned..." rows={2} style={{ ...INP, resize:"vertical", minHeight:"52px", lineHeight:"1.5" }} />
      </Box>

      {/* FEATURE 5 â€” News calendar widget: shows upcoming ForexFactory events */}
      <NewsCalendarInline
        symbol={form.symbol}
        onImminent={(evts) => {
          // If firm bans news trading, flag it automatically
          if (!rules?.allow_news_trading && evts.length > 0 && !form.is_news_trade) {
            setForm(p => ({ ...p, is_news_trade: true }));
          }
        }}
      />

      {error && <Typography sx={{ color:"#ef4444", fontSize:"12px", mb:"10px", mt:"8px" }}>{error}</Typography>}

      <Box onClick={!loading?submit:undefined} sx={{ py:"12px", borderRadius:"12px", textAlign:"center", cursor:loading?"not-allowed":"pointer", fontWeight:800, fontSize:"14px", background:loading?"rgba(56,189,248,0.2)":"linear-gradient(135deg,#0ea5e9,#6366f1)", color:"white", display:"flex", alignItems:"center", justifyContent:"center", gap:1, opacity:loading?0.7:1, boxShadow:loading?"none":"0 6px 20px rgba(56,189,248,0.2)", transition:"all 0.15s", mt:"12px" }}>
        {loading ? <CircularProgress size={14} sx={{color:"white"}}/> : "ðŸ“ˆ Record Trade â†’"}
      </Box>
    </Box>
  );
}

// â”€â”€ ChallengeDashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ChallengeDashboard({ session, metrics, rules, violations, alerts, onReset }: {
  session: SimSession; metrics: Metrics; rules: any;
  violations: string[]; alerts: string[]; onReset: () => void;
}) {
  const profit_pct   = (session.balance - session.account_size) / session.account_size * 100;
  const drawdown_pct = (session.peak_balance - session.balance) / session.peak_balance * 100;
  const daily_loss   = session.daily_pnl < 0 ? -session.daily_pnl / session.day_start_balance * 100 : 0;
  const pnl_color    = profit_pct >= 0 ? "#22c55e" : "#ef4444";

  return (
    <Box sx={{ maxWidth:"760px", mx:"auto" }}>
      {violations.length > 0 && (
        <Box sx={{ mb:"8px", p:"12px 14px", borderRadius:"10px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)" }}>
          {violations.map((v,i) => <Typography key={i} sx={{ fontSize:"13px", color:"#fca5a5" }}>ðŸš« {v}</Typography>)}
        </Box>
      )}
      {alerts.length > 0 && (
        <Box sx={{ mb:"8px", p:"10px 14px", borderRadius:"10px", background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.2)" }}>
          {alerts.map((a,i) => <Typography key={i} sx={{ fontSize:"12px", color:"#fcd34d" }}>âš ï¸ {a}</Typography>)}
        </Box>
      )}

      {/* Status chips */}
      <Box sx={{ display:"flex", gap:"7px", flexWrap:"wrap", mb:"12px" }}>
        {metrics.trailing_dd && <Box sx={{ px:"10px", py:"3px", borderRadius:"20px", background:"rgba(139,92,246,0.12)", border:"1px solid rgba(139,92,246,0.3)", fontSize:"11px", fontWeight:700, color:"#a78bfa" }}>Trailing DD Â· floor ${(metrics.trailing_dd_floor||0).toLocaleString("en",{minimumFractionDigits:2})}</Box>}
        <Box sx={{ px:"10px", py:"3px", borderRadius:"20px", background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", fontSize:"11px", fontWeight:700, color:"#38bdf8" }}>{metrics.count_profitable_days ? `${metrics.profitable_days} profitable days / ${metrics.min_trading_days} min` : `Day ${session.day} / ${rules.min_trading_days > 0 ? rules.min_trading_days + " min" : "no min"}`}</Box>
        <Box sx={{ px:"10px", py:"3px", borderRadius:"20px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.4)" }}>{metrics.daily_trades} trades today</Box>
        {metrics.consecutive_losses >= 2 && <Box sx={{ px:"10px", py:"3px", borderRadius:"20px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", fontSize:"11px", fontWeight:700, color:"#fca5a5" }}>{metrics.consecutive_losses}x losses in a row</Box>}
        <Box sx={{ px:"10px", py:"3px", borderRadius:"20px", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", fontSize:"11px", fontWeight:700, color:"#86efac" }}>{rules.starting_payout_pct ?? rules.payout_pct}% â†’ {rules.payout_pct}% payout</Box>
        {rules.daily_pause_not_breach && <Box sx={{ px:"10px", py:"3px", borderRadius:"20px", background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", fontSize:"11px", fontWeight:700, color:"#fcd34d" }}>âš ï¸ {rules.daily_loss_limit_pct}% = daily PAUSE (not breach)</Box>}
        {rules.news_window_minutes > 0 && <Box sx={{ px:"10px", py:"3px", borderRadius:"20px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:"11px", fontWeight:700, color:"rgba(239,68,68,0.7)" }}>ðŸ“° {rules.news_window_minutes}-min news window</Box>}
      </Box>

      {/* Stat cards */}
      <Grid container spacing={1.5} sx={{ mb:2 }}>
        <Grid item xs={6} sm={3}><StatCard label="Balance" value={`$${session.balance.toLocaleString("en",{minimumFractionDigits:2})}`} sub={`Started $${session.account_size.toLocaleString()}`} color={pnl_color} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="P&L" value={`${profit_pct>=0?"+":""}${profit_pct.toFixed(3)}%`} sub={`$${(session.balance-session.account_size).toFixed(2)}`} color={pnl_color} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Win Rate" value={`${metrics.win_rate}%`} sub={`${metrics.total_trades} trades`} color="#38bdf8" /></Grid>
        <Grid item xs={6} sm={3}><StatCard label={metrics.count_profitable_days?"Profitable Days":"Day"} value={metrics.count_profitable_days?`${metrics.profitable_days}`:`${session.day}`} sub={`${rules.min_trading_days} min required`} color="#a855f7" /></Grid>
      </Grid>

      {/* FEATURE 1 â€” Pass probability gauge */}
      {session.trades.length > 0 && <PassProbabilityGauge session={session} />}

      {/* Progress bars */}
      <Box sx={{ ...card(), p:"20px 22px", mb:2 }}>
        <Typography sx={{ fontSize:"12px", fontWeight:800, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"16px" }}>
          Challenge Progress â€” {rules.name}{metrics.trailing_dd ? " Â· Trailing DD" : ""}
        </Typography>
        <Box sx={{ mb:"16px" }}>
          <Box sx={{ display:"flex", justifyContent:"space-between", mb:"6px" }}>
            <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.5)" }}>Profit Target</Typography>
            <Typography sx={{ fontSize:"12px", fontWeight:800, color:"#22c55e", fontFamily:'"Roboto Mono",monospace' }}>{profit_pct.toFixed(3)}% / {rules.profit_target_pct}%</Typography>
          </Box>
          <ProgressBar value={Math.max(0, profit_pct)} max={rules.profit_target_pct} color="#22c55e" />
        </Box>
        <Box sx={{ mb:"16px" }}>
          <Box sx={{ display:"flex", justifyContent:"space-between", mb:"6px" }}>
            <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.5)" }}>Max Drawdown Used</Typography>
            <Typography sx={{ fontSize:"12px", fontWeight:800, color:drawdown_pct>rules.max_drawdown_pct*0.7?"#ef4444":"#f59e0b", fontFamily:'"Roboto Mono",monospace' }}>{drawdown_pct.toFixed(3)}% / {rules.max_drawdown_pct}%</Typography>
          </Box>
          <ProgressBar value={drawdown_pct} max={rules.max_drawdown_pct} color="#f59e0b" danger />
        </Box>
        <Box>
          <Box sx={{ display:"flex", justifyContent:"space-between", mb:"6px" }}>
            <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.5)" }}>Daily Loss Today</Typography>
            <Typography sx={{ fontSize:"12px", fontWeight:800, color:daily_loss>rules.daily_loss_limit_pct*0.7?"#ef4444":"#38bdf8", fontFamily:'"Roboto Mono",monospace' }}>{daily_loss.toFixed(3)}% / {rules.daily_loss_limit_pct}%</Typography>
          </Box>
          <ProgressBar value={daily_loss} max={rules.daily_loss_limit_pct} color="#38bdf8" danger />
        </Box>
      </Box>

      {/* Trade history */}
      {session.trades.length > 0 && (
        <Box sx={{ ...card(), p:"16px 18px", mb:2 }}>
          <Typography sx={{ fontSize:"11px", fontWeight:800, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"12px" }}>Trade History</Typography>
          <Box sx={{ maxHeight:"240px", overflowY:"auto", "&::-webkit-scrollbar":{ width:"3px" }, "&::-webkit-scrollbar-thumb":{ background:"rgba(255,255,255,0.1)", borderRadius:"2px" } }}>
            {[...session.trades].reverse().map((t, i) => (
              <Box key={i} sx={{ py:"8px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"4px" }}>
                  <Box sx={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap" }}>
                    <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.25)" }}>D{t.day}</Typography>
                    <Typography sx={{ fontSize:"10px", fontWeight:800, px:"6px", py:"1px", borderRadius:"4px", background:t.direction==="buy"?"rgba(34,197,94,0.12)":"rgba(239,68,68,0.12)", color:t.direction==="buy"?"#22c55e":"#ef4444", border:t.direction==="buy"?"1px solid rgba(34,197,94,0.2)":"1px solid rgba(239,68,68,0.2)" }}>{(t.direction||"buy").toUpperCase()}</Typography>
                    <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.6)", fontWeight:700 }}>{t.symbol}</Typography>
                    <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>x{t.lot_size} Â· {t.rr_ratio}R</Typography>
                    {t.timeframe && <Typography sx={{ fontSize:"10px", color:"rgba(56,189,248,0.6)", fontWeight:700, px:"5px", borderRadius:"4px", background:"rgba(56,189,248,0.08)" }}>{t.timeframe}</Typography>}
                  </Box>
                  <Typography sx={{ fontSize:"13px", fontWeight:800, color:t.pnl>0?"#22c55e":t.pnl<0?"#ef4444":"#f59e0b", fontFamily:'"Roboto Mono",monospace' }}>{t.pnl>0?"+":""}{t.pnl.toFixed(2)}</Typography>
                </Box>
                {t.notes && <Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.25)", mt:"3px", fontStyle:"italic" }}>{t.notes}</Typography>}
                {t.screenshot_url && <Box sx={{ mt:"6px" }}><img src={t.screenshot_url} alt="chart" style={{ maxWidth:"100%", maxHeight:"120px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.08)", objectFit:"cover", cursor:"pointer" }} onClick={() => window.open(t.screenshot_url!, "_blank")} /></Box>}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Box onClick={onReset} sx={{ py:"9px", borderRadius:"10px", textAlign:"center", cursor:"pointer", fontSize:"12px", fontWeight:700, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.3)", transition:"all 0.15s", "&:hover":{ color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)" } }}>
        Abandon Challenge & Reset
      </Box>
    </Box>
  );
}

// â”€â”€ ResultScreen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ResultScreen({ session, rules, onReset }: { session: SimSession; rules: any; onReset: () => void }) {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/simulator/result`, { method:"POST", headers:hdrs(), body:JSON.stringify(session) })
      .then(r => r.json()).then(setReport).catch(() => {});
  }, []);

  const statusConfig: Record<string, { label:string; color:string; bg:string; icon:string }> = {
    passed:          { label:"Challenge Passed! ðŸŽ‰", color:"#22c55e", bg:"rgba(34,197,94,0.1)",  icon:"ðŸ†" },
    blown:           { label:"Account Blown ðŸ’€",     color:"#ef4444", bg:"rgba(239,68,68,0.1)",  icon:"ðŸ’€" },
    daily_limit_hit: { label:"Daily Limit Hit â›”",   color:"#f59e0b", bg:"rgba(245,158,11,0.1)", icon:"â›”" },
  };
  const cfg = statusConfig[session.status] || statusConfig.blown;
  const pnl = session.balance - session.account_size;
  const profit_pct = pnl / session.account_size * 100;

  return (
    <Box sx={{ maxWidth:"680px", mx:"auto" }}>
      {/* Hero */}
      <Box sx={{ ...card(), p:"28px", mb:3, background:cfg.bg, border:`1px solid ${cfg.color}33`, textAlign:"center" }}>
        <Typography sx={{ fontSize:"40px", mb:"8px" }}>{cfg.icon}</Typography>
        <Typography sx={{ fontSize:"24px", fontWeight:900, color:cfg.color }}>{cfg.label}</Typography>
        <Typography sx={{ fontSize:"14px", color:"rgba(255,255,255,0.5)", mt:"6px" }}>{rules.name} Â· ${session.account_size.toLocaleString()} account Â· Day {session.day}</Typography>
      </Box>

      {/* Summary stats */}
      <Grid container spacing={1.5} sx={{ mb:3 }}>
        {[
          { label:"Final Balance", val:`$${session.balance.toLocaleString("en",{minimumFractionDigits:2})}`, color:pnl>=0?"#22c55e":"#ef4444" },
          { label:"Total P&L",    val:`${profit_pct>=0?"+":""}${profit_pct.toFixed(2)}%`,                    color:pnl>=0?"#22c55e":"#ef4444" },
          { label:"Total Trades", val:`${session.trades.length}`,                                             color:"#38bdf8" },
          { label:"Days Traded",  val:`${session.day}`,                                                       color:"#a855f7" },
        ].map(({ label, val, color }) => (
          <Grid item xs={6} sm={3} key={label}><StatCard label={label} value={val} color={color} /></Grid>
        ))}
      </Grid>

      {/* FEATURE 2 â€” Equity curve chart */}
      {report?.equity_curve?.length > 1 && (
        <EquityCurveChart
          equityCurve={report.equity_curve}
          accountSize={session.account_size}
          target={rules.profit_target_pct}
          maxDD={rules.max_drawdown_pct}
        />
      )}

      {/* Detailed report */}
      {report && (
        <Box sx={{ ...card(), p:"20px 22px", mb:3 }}>
          <Typography sx={{ fontSize:"12px", fontWeight:800, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"16px" }}>Challenge Report</Typography>
          <Grid container spacing={1.5}>
            {[
              { label:"Win Rate",       val:`${report.win_rate}%`,                          pass:report.win_rate>=50 },
              { label:"Avg Win",        val:`$${report.avg_win?.toFixed(2)}`,               pass:report.avg_win>report.avg_loss },
              { label:"Avg Loss",       val:`$${report.avg_loss?.toFixed(2)}`,              pass:report.avg_loss<=report.avg_win },
              { label:"Expectancy",     val:`$${report.expectancy?.toFixed(2)}/trade`,      pass:report.expectancy>0 },
              { label:"Profit Target",  val:report.profit_target_met?"Met":"Not met",       pass:report.profit_target_met },
              { label:"Drawdown",       val:report.drawdown_safe?"Safe":"Exceeded",         pass:report.drawdown_safe },
              { label:"Min Days",       val:report.min_days_met?"Met":"Not met",            pass:report.min_days_met },
              { label:"Consistency",    val:report.consistency_met?"Met":`${report.max_day_pct}% day`, pass:report.consistency_met },
              { label:"Max Intra DD",   val:`${report.max_intra_drawdown?.toFixed(2)}%`,   pass:(report.max_intra_drawdown||0)<rules.max_drawdown_pct },
              { label:"Commission",     val:`$${report.total_commission?.toFixed(2)||"0.00"}`, pass:true },
              { label:"Direction Split",val:`${report.buy_trades||0}B / ${report.sell_trades||0}S`, pass:true },
              ...(report.weekend_violations>0?[{ label:"Weekend Violations", val:`${report.weekend_violations}`, pass:false }]:[]),
              ...(report.pair_violations?.length>0?[{ label:"Banned Pairs", val:report.pair_violations.join(", "), pass:false }]:[]),
            ].map(({ label, val, pass }) => (
              <Grid item xs={6} sm={4} key={label}>
                <Box sx={{ p:"12px 14px", borderRadius:"10px", background:"rgba(255,255,255,0.03)", border:`1px solid ${pass?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"}` }}>
                  <Typography sx={{ ...LBL, mb:"4px" }}>{label}</Typography>
                  <Typography sx={{ fontSize:"13px", fontWeight:800, color:pass?"#22c55e":"#ef4444" }}>{val}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Payout estimate */}
      {report && session.status==="passed" && (
        <Box sx={{ ...card(), p:"20px 22px", mb:3, background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.2)" }}>
          <Typography sx={{ fontSize:"12px", fontWeight:800, color:"rgba(34,197,94,0.6)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"10px" }}>Estimated Payout</Typography>
          <Box sx={{ display:"flex", gap:"24px", flexWrap:"wrap", alignItems:"baseline" }}>
            <Box><Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>Total Profit</Typography><Typography sx={{ fontSize:"22px", fontWeight:900, color:"#22c55e", fontFamily:'"Roboto Mono",monospace' }}>${report.total_pnl?.toFixed(2)}</Typography></Box>
            <Box><Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>Profit Split</Typography><Typography sx={{ fontSize:"22px", fontWeight:900, color:"#86efac", fontFamily:'"Roboto Mono",monospace' }}>{report.payout_pct}%</Typography></Box>
            <Box><Typography sx={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>Your Payout</Typography><Typography sx={{ fontSize:"28px", fontWeight:900, color:"#22c55e", fontFamily:'"Roboto Mono",monospace' }}>${report.payout_dollar?.toFixed(2)}</Typography></Box>
          </Box>
        </Box>
      )}

      {/* Day breakdown */}
      {report?.days_breakdown?.length > 0 && (
        <Box sx={{ ...card(), p:"16px 20px", mb:3 }}>
          <Typography sx={{ fontSize:"11px", fontWeight:800, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"12px" }}>Day-by-Day Breakdown</Typography>
          {report.days_breakdown.map((d: any) => (
            <Box key={d.day} sx={{ display:"flex", justifyContent:"space-between", py:"7px", borderBottom:"1px solid rgba(255,255,255,0.04)", flexWrap:"wrap", gap:"6px" }}>
              <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.5)", fontWeight:700 }}>Day {d.day}</Typography>
              <Box sx={{ display:"flex", gap:"16px" }}>
                <Typography sx={{ fontSize:"12px", color:"rgba(255,255,255,0.35)" }}>{d.trades} trades Â· {d.wins}W {d.losses}L</Typography>
                <Typography sx={{ fontSize:"12px", fontWeight:800, color:d.pnl>=0?"#22c55e":"#ef4444", fontFamily:'"Roboto Mono",monospace' }}>{d.pnl>=0?"+":""}{d.pnl.toFixed(2)}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* FEATURE 6 â€” Save session for comparison */}
      <SaveSessionButton session={session} rules={rules} />

      <Box onClick={onReset} sx={{ py:"13px", borderRadius:"13px", textAlign:"center", cursor:"pointer", fontWeight:800, fontSize:"14px", background:"linear-gradient(135deg,#0ea5e9,#6366f1)", color:"white", boxShadow:"0 6px 20px rgba(56,189,248,0.2)", transition:"all 0.15s" }}>
        ðŸ”„ Start New Challenge
      </Box>
    </Box>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE 6 â€” SaveSessionButton (used in ResultScreen)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SaveSessionButton({ session, rules }: { session: any; rules: any }) {
  const [saved,   setSaved]   = useState(false);
  const [label,   setLabel]   = useState("");
  const [editing, setEditing] = useState(false);

  const doSave = () => {
    const finalLabel = label.trim() || `${rules?.name || "Challenge"} â€” ${new Date().toLocaleDateString()}`;
    const id  = `simS_${Date.now()}`;
    const pnl = session.account_size > 0 ? (session.balance - session.account_size) / session.account_size * 100 : 0;
    const entry: SavedSimSession = {
      id, label: finalLabel, savedAt: new Date().toISOString(),
      firm:    rules?.name || "Custom",
      account: session.account_size || 0,
      pnlPct:  +pnl.toFixed(3),
      passed:  session.status === "passed",
      trades:  session.trades?.length || 0,
      session, rules,
    };
    const existing = loadSavedSimSessions();
    persistSavedSimSessions([entry, ...existing]);
    setSaved(true); setEditing(false);
  };

  if (saved) {
    return (
      <Box sx={{ py:"11px", borderRadius:"12px", textAlign:"center", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", mb:"12px" }}>
        <Typography sx={{ fontSize:"13px", fontWeight:700, color:"#22c55e" }}>âœ… Session saved â€” view in Compare tab</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb:"12px" }}>
      {editing ? (
        <Box sx={{ p:"14px 16px", borderRadius:"12px", background:"rgba(168,85,247,0.07)", border:"1px solid rgba(168,85,247,0.25)" }}>
          <Typography sx={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.07em", mb:"8px" }}>Session Label</Typography>
          <input
            style={{ ...INP, marginBottom:"10px" }}
            placeholder={`${rules?.name || "Challenge"} â€” ${new Date().toLocaleDateString()}`}
            value={label}
            onChange={e => setLabel(e.target.value)}
            autoFocus
          />
          <Box sx={{ display:"flex", gap:"8px" }}>
            <Box onClick={doSave} sx={{ flex:1, py:"9px", borderRadius:"10px", textAlign:"center", cursor:"pointer", fontWeight:800, fontSize:"13px", background:"linear-gradient(135deg,#a855f7,#6366f1)", color:"white" }}>
              ðŸ’¾ Save
            </Box>
            <Box onClick={() => setEditing(false)} sx={{ px:"16px", py:"9px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:700, color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)" }}>
              Cancel
            </Box>
          </Box>
        </Box>
      ) : (
        <Box onClick={() => setEditing(true)} sx={{ py:"11px", borderRadius:"12px", textAlign:"center", cursor:"pointer", fontWeight:700, fontSize:"13px", background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.25)", color:"#a855f7", mb:"0px", transition:"all 0.15s", "&:hover":{ background:"rgba(168,85,247,0.14)" } }}>
          ðŸ’¾ Save Session for Comparison
        </Box>
      )}
    </Box>
  );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PAGE ROOT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function Simulator() {
  // FEATURE 3 â€” Load persisted session on mount
  const persisted = loadSession();
  const [session,    setSession]    = useState<SimSession | null>(persisted.session);
  const [rules,      setRules]      = useState<any>(persisted.rules);
  const [metrics,    setMetrics]    = useState<Metrics | null>(persisted.metrics);
  const [violations, setViolations] = useState<string[]>([]);
  const [alerts,     setAlerts]     = useState<string[]>([]);

  // FEATURE 4 â€” Psychological scenario state
  const [activeScenario,   setActiveScenario]   = useState<PsychScenario | null>(null);
  const [seenScenarioIds,  setSeenScenarioIds]  = useState<Set<string>>(new Set());

  // FEATURE 6 â€” Active tab: "challenge" | "compare"
  const [activeTab, setActiveTab] = useState<"challenge" | "compare">("challenge");

  // FEATURE 3 â€” Persist on every state change
  useEffect(() => {
    saveSession(session, rules, metrics);
  }, [session, rules, metrics]);

  // FEATURE 4 â€” Check for scenario triggers after each trade
  const checkScenarios = useCallback((s: SimSession, r: any) => {
    for (const scenario of PSYCH_SCENARIOS) {
      if (!seenScenarioIds.has(scenario.id) && scenario.trigger(s, r)) {
        setActiveScenario(scenario);
        setSeenScenarioIds(prev => new Set([...prev, scenario.id]));
        break;
      }
    }
  }, [seenScenarioIds]);

  const handleStart = (s: SimSession, r: any) => {
    setSession(s); setRules(r); setMetrics(null);
    setViolations([]); setAlerts([]);
    setSeenScenarioIds(new Set());
    setActiveTab("challenge");
  };

  const handleTrade = (s: SimSession, m: Metrics, v: string[], a: string[]) => {
    setSession(s); setMetrics(m); setViolations(v); setAlerts(a);
    checkScenarios(s, rules);  // Feature 4
  };

  const handleNextDay = (s: SimSession) => { setSession(s); setViolations([]); setAlerts([]); };

  const handleReset = () => {
    setSession(null); setRules(null); setMetrics(null);
    setViolations([]); setAlerts([]);
    setSeenScenarioIds(new Set());
    saveSession(null, null, null);
    setActiveTab("challenge");
  };

  return (
    <Box sx={{ minHeight:"100vh", p:{xs:2,md:"28px 32px"}, color:"white", background:"radial-gradient(ellipse at 10% 0%,rgba(99,102,241,0.06),transparent 50%),radial-gradient(ellipse at 90% 100%,rgba(34,197,94,0.04),transparent 50%),#08101e" }}>

      {/* Header */}
      <Box sx={{ mb:"20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:1 }}>
        <Box>
          <Typography sx={{ fontSize:{xs:"20px",md:"26px"}, fontWeight:900, color:"white" }}>ðŸ† Prop Firm Survival Simulator</Typography>
          <Typography sx={{ fontSize:"13px", color:"rgba(255,255,255,0.35)", mt:"4px" }}>Practice your funded challenge â€” no real money, full rule enforcement</Typography>
        </Box>
        {/* FEATURE 3 â€” Show resume badge if session was restored */}
        {session && persisted.session && activeTab === "challenge" && (
          <Box sx={{ px:"12px", py:"6px", borderRadius:"10px", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)" }}>
            <Typography sx={{ fontSize:"12px", fontWeight:700, color:"#22c55e" }}>âœ… Session restored â€” Day {session.day}</Typography>
          </Box>
        )}
      </Box>

      {/* FEATURE 6 â€” Tab switcher */}
      <Box sx={{ display:"flex", gap:"8px", mb:"24px" }}>
        {[
          { id:"challenge", label:"ðŸ† Challenge", desc:"Active simulation" },
          { id:"compare",   label:"ðŸ“Š Compare",   desc:"Side-by-side sessions" },
        ].map(tab => (
          <Box key={tab.id} onClick={() => setActiveTab(tab.id as any)} sx={{
            px:"18px", py:"9px", borderRadius:"12px", cursor:"pointer",
            background: activeTab===tab.id ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.03)",
            border:     activeTab===tab.id ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(255,255,255,0.08)",
            transition:"all 0.15s",
          }}>
            <Typography sx={{ fontSize:"13px", fontWeight:800, color:activeTab===tab.id?"#38bdf8":"rgba(255,255,255,0.45)" }}>{tab.label}</Typography>
            <Typography sx={{ fontSize:"10px", color:"rgba(255,255,255,0.25)" }}>{tab.desc}</Typography>
          </Box>
        ))}
      </Box>

      {/* FEATURE 4 â€” Psychological scenario overlay */}
      {activeScenario && (
        <PsychologicalScenario
          scenario={activeScenario}
          onClose={() => setActiveScenario(null)}
        />
      )}

      {/* â”€â”€ Challenge tab â”€â”€ */}
      {activeTab === "challenge" && (
        <>
          {/* Setup screen */}
          {!session && <SetupScreen onStart={handleStart} />}

          {/* Active session */}
          {session && session.status === "active" && rules && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <TradeForm session={session} rules={rules} onTrade={handleTrade} onNextDay={handleNextDay} />
              </Grid>
              <Grid item xs={12} md={7}>
                <ChallengeDashboard
                  session={session}
                  metrics={metrics || {
                    drawdown_pct:0, profit_pct:0, daily_loss_pct:0,
                    daily_loss_limit:       rules.daily_loss_limit_pct,
                    max_drawdown_limit:     rules.max_drawdown_pct,
                    profit_target:          rules.profit_target_pct,
                    days_traded:            1,
                    min_trading_days:       rules.min_trading_days,
                    profitable_days:        0,
                    count_profitable_days:  false,
                    total_trades:           0,
                    daily_trades:           0,
                    consecutive_losses:     0,
                    trailing_dd:            rules.trailing_dd || false,
                    trailing_dd_floor:      session.trailing_dd_floor || 0,
                    payout_pct:             rules.payout_pct || 80,
                    win_rate:               0,
                  }}
                  rules={rules}
                  violations={violations}
                  alerts={alerts}
                  onReset={handleReset}
                />
              </Grid>
            </Grid>
          )}

          {/* Result screen */}
          {session && session.status !== "active" && rules && (
            <ResultScreen session={session} rules={rules} onReset={handleReset} />
          )}
        </>
      )}

      {/* â”€â”€ Compare tab â”€â”€ */}
      {activeTab === "compare" && <CompareTab />}

    </Box>
  );
}

