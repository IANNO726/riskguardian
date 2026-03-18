import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Grid, Typography, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Tooltip, LinearProgress,
} from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

const API = process.env.REACT_APP_API_URL || "https://riskguardian.onrender.com";
const token = () => localStorage.getItem("access_token") || "";

const headers = () => ({ Authorization: `Bearer ${token()}` });

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const card = {
  background:   "#0f172a",
  border:       "1px solid rgba(255,255,255,0.07)",
  borderRadius: "20px",
  padding:      "24px",
  color:        "white",
};

const PLAN_COLORS: Record<string, string> = {
  free:       "#64748b",
  starter:    "#38bdf8",
  pro:        "#a855f7",
  enterprise: "#f59e0b",
};


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STAT CARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function StatCard({
  title, value, sub, color, icon,
}: { title: string; value: any; sub?: string; color: string; icon: string }) {
  return (
    <Box sx={{
      ...card,
      position: "relative", overflow: "hidden",
      "&::before": {
        content: '""', position: "absolute",
        top: 0, left: 0, right: 0, height: "2px",
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      },
    }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography sx={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", mb: 1 }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: "32px", fontWeight: 800, color, lineHeight: 1 }}>
            {value ?? <CircularProgress size={24} sx={{ color }} />}
          </Typography>
          {sub && (
            <Typography sx={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", mt: 0.8 }}>
              {sub}
            </Typography>
          )}
        </Box>
        <Box sx={{
          width: 48, height: 48, borderRadius: "14px", fontSize: "22px",
          background: `${color}18`, border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </Box>
      </Box>
    </Box>
  );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PLAN BADGE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function PlanBadge({ plan }: { plan: string }) {
  const color = PLAN_COLORS[plan] || "#64748b";
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", gap: 0.5,
      px: 1.5, py: 0.4, borderRadius: "8px", fontSize: "11px", fontWeight: 700,
      color, background: `${color}18`, border: `1px solid ${color}35`,
      textTransform: "uppercase",
    }}>
      {plan}
    </Box>
  );
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN DASHBOARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NOTE: OnboardingChecklist.tsx change needed â€” add this inside the allDone useEffect:
// if (allDone) {
//   fetch(`${API}/api/v1/admin/onboarding/complete`, {
//     method: "POST",
//     headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
//   }).catch(() => {});   // fire and forget
// }

export default function AdminDashboard() {
  const [stats,        setStats]        = useState<any>(null);
  const [users,        setUsers]        = useState<any[]>([]);
  const [trialUsers,   setTrialUsers]   = useState<any[]>([]);
  const [signupChart,  setSignupChart]  = useState<any[]>([]);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [onboarding,   setOnboarding]   = useState<any>(null);
  const [referrals,    setReferrals]    = useState<any>(null);
  const [activeTab,    setActiveTab]    = useState<"overview"|"trials"|"users"|"onboarding"|"referrals">("overview");
  const [liveTrades,   setLiveTrades]   = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [ov, u, tu, sc, rc, ob, rf] = await Promise.all([
        fetch(`${API}/api/v1/admin/overview`,         { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/v1/admin/users`,            { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/v1/admin/trial-users`,      { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/v1/admin/signups-chart`,    { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/v1/admin/revenue-chart`,    { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/v1/admin/onboarding/stats`, { headers: headers() }).then(r => r.json()),
        fetch(`${API}/api/v1/admin/referral/stats`,   { headers: headers() }).then(r => r.json()),
      ]);
      setStats(ov);
      setUsers(Array.isArray(u) ? u : []);
      setTrialUsers(Array.isArray(tu) ? tu : []);
      setSignupChart(Array.isArray(sc) ? sc : []);
      setRevenueChart(Array.isArray(rc) ? rc : []);
      setOnboarding(ob);
      setReferrals(rf);
    } catch (e) {
      console.error("Admin load error:", e);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  // Live trades websocket
  useEffect(() => {
    const ws = new WebSocket(`${API.replace("http", "ws")}/ws/admin/live-trades`);
    ws.onmessage = e => setLiveTrades(JSON.parse(e.data));
    return () => ws.close();
  }, []);

  const tabs = [
    { key: "overview",   label: "ðŸ“Š Overview"   },
    { key: "trials",     label: "â° Trials"      },
    { key: "users",      label: "ðŸ‘¥ Users"       },
    { key: "onboarding", label: "âœ… Onboarding"  },
    { key: "referrals",  label: "ðŸ”— Referrals"   },
  ];

  return (
    <Box sx={{
      minHeight: "100vh", p: { xs: 2, md: 4 }, color: "white",
      background: "radial-gradient(ellipse at 10% 0%,rgba(56,189,248,0.05),transparent 45%),#0b1120",
    }}>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: { xs: "24px", md: "32px" }, fontWeight: 800, background: "linear-gradient(90deg,#38bdf8,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Admin Control Center
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.4)", mt: 0.5 }}>
          Real-time platform intelligence
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ display: "flex", gap: 1, mb: 4, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <Box
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            sx={{
              px: 3, py: 1.2, borderRadius: "12px", cursor: "pointer",
              fontSize: "13px", fontWeight: 700, transition: "all 0.2s",
              background: activeTab === t.key ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
              border: activeTab === t.key ? "1px solid rgba(56,189,248,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: activeTab === t.key ? "#38bdf8" : "rgba(255,255,255,0.5)",
              "&:hover": { background: "rgba(56,189,248,0.1)" },
            }}
          >
            {t.label}
          </Box>
        ))}
      </Box>


      {/* â”€â”€ OVERVIEW TAB â”€â”€ */}
      {activeTab === "overview" && (
        <Box>
          {/* Top stat cards */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={6} md={3}>
              <StatCard title="Total Users"      value={stats?.total_users}       color="#38bdf8" icon="ðŸ‘¥" sub={`+${stats?.new_this_week || 0} this week`} />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Active Trials"    value={stats?.active_trials}     color="#a855f7" icon="â°" sub={`${stats?.expiring_24h || 0} expiring in 24h`} />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Paid Users"       value={stats?.paid_users}        color="#22c55e" icon="ðŸ’³" sub={`${stats?.conversion_rate || 0}% trialâ†’paid`} />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Risk Alerts"      value={stats?.risk_alerts}       color="#ef4444" icon="ðŸš¨" sub="all time" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Telegram Connected" value={stats?.telegram_connected} color="#38bdf8" icon="âœˆï¸" sub="users with alerts live" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Expiring 48h"     value={stats?.expiring_48h}      color="#f59e0b" icon="âš ï¸" sub="need upgrade nudge" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Referral Signups" value={stats?.total_referrals}   color="#ec4899" icon="ðŸ”—" sub="via referral codes" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Onboarding Done"  value={stats?.onboarding_complete} color="#22c55e" icon="âœ…" sub="completed all steps" />
            </Grid>
          </Grid>

          {/* Plan breakdown */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} md={4}>
              <Box sx={card}>
                <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Plan Breakdown
                </Typography>
                {stats?.plans && Object.entries(stats.plans).map(([plan, count]: any) => (
                  <Box key={plan} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.2, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <PlanBadge plan={plan} />
                    <Typography sx={{ fontWeight: 800, color: PLAN_COLORS[plan] || "white" }}>
                      {count} users
                    </Typography>
                  </Box>
                ))}

                {/* Conversion funnel */}
                <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <Typography sx={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", mb: 1.5, fontWeight: 700, textTransform: "uppercase" }}>
                    Trial â†’ Paid Conversion
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
                    <Typography sx={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>Expired trials</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{stats?.expired_trials || 0}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography sx={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>Converted to paid</Typography>
                    <Typography sx={{ fontWeight: 700, color: "#22c55e" }}>{stats?.trial_to_paid || 0}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(stats?.conversion_rate || 0, 100)}
                    sx={{
                      height: 8, borderRadius: 4,
                      background: "rgba(255,255,255,0.08)",
                      "& .MuiLinearProgress-bar": { background: "linear-gradient(90deg,#22c55e,#38bdf8)", borderRadius: 4 },
                    }}
                  />
                  <Typography sx={{ fontSize: "13px", color: "#22c55e", fontWeight: 800, mt: 1 }}>
                    {stats?.conversion_rate || 0}% conversion rate
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Signup chart */}
            <Grid item xs={12} md={8}>
              <Box sx={card}>
                <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  New Signups â€” Last 30 Days
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={signupChart}>
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                    <RTooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    <Bar dataKey="signups" radius={[4,4,0,0]}>
                      {signupChart.map((_, i) => <Cell key={i} fill="#38bdf8" fillOpacity={0.7 + (i / signupChart.length) * 0.3} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
          </Grid>

          {/* Revenue chart */}
          <Box sx={{ ...card, mb: 4 }}>
            <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Revenue â€” Last 30 Days (USD)
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueChart}>
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <RTooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(v: any) => [`$${v}`, "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Live trades */}
          <Box sx={card}>
            <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              ðŸ”´ Live Trades Stream
            </Typography>
            {liveTrades.length === 0 ? (
              <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No active trades</Typography>
            ) : liveTrades.map((t, i) => (
              <Box key={i} sx={{ display: "flex", gap: 3, py: 1, borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "13px" }}>
                <Typography sx={{ color: "#38bdf8", fontWeight: 700, width: 80 }}>{t.symbol}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>{t.volume} lots</Typography>
                <Typography sx={{ color: t.profit >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                  {t.profit >= 0 ? "+" : ""}{t.profit?.toFixed(2)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}


      {/* â”€â”€ TRIALS TAB â”€â”€ */}
      {activeTab === "trials" && (
        <Box>
          <Grid container spacing={3} mb={4}>
            <Grid item xs={6} md={3}>
              <StatCard title="Active Trials"  value={stats?.active_trials}  color="#a855f7" icon="â°" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Expiring 24h"   value={stats?.expiring_24h}   color="#ef4444" icon="ðŸ”¥" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Expiring 48h"   value={stats?.expiring_48h}   color="#f59e0b" icon="âš ï¸" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Converted"      value={stats?.trial_to_paid}  color="#22c55e" icon="ðŸ’³" sub={`${stats?.conversion_rate}% rate`} />
            </Grid>
          </Grid>

          <Box sx={card}>
            <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Active Trial Users â€” Sorted by Expiry
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  {["User", "Email", "Hours Left", "Telegram", "Joined"].map(h => (
                    <TableCell key={h} sx={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {trialUsers.map((u, i) => (
                  <TableRow key={i} sx={{ "&:hover": { background: "rgba(255,255,255,0.02)" } }}>
                    <TableCell sx={{ color: "white", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{u.username}</TableCell>
                    <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{u.email}</TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <Box sx={{
                        display: "inline-flex", px: 1.5, py: 0.4, borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                        color: u.hours_left <= 24 ? "#ef4444" : u.hours_left <= 48 ? "#f59e0b" : "#22c55e",
                        background: u.hours_left <= 24 ? "rgba(239,68,68,0.12)" : u.hours_left <= 48 ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)",
                      }}>
                        {u.hours_left}h left
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {u.telegram
                        ? <Box sx={{ color: "#22c55e", fontSize: "13px", fontWeight: 600 }}>âœ… Connected</Box>
                        : <Box sx={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Not connected</Box>
                      }
                    </TableCell>
                    <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {u.joined ? new Date(u.joined).toLocaleDateString() : "â€”"}
                    </TableCell>
                  </TableRow>
                ))}
                {trialUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: "rgba(255,255,255,0.3)", textAlign: "center", py: 4, borderBottom: "none" }}>
                      No active trials
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}


      {/* â”€â”€ USERS TAB â”€â”€ */}
      {activeTab === "users" && (
        <Box sx={card}>
          <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            All Users
          </Typography>
          <Table>
            <TableHead>
              <TableRow>
                {["User", "Email", "Plan", "Status", "Telegram", "Joined"].map(h => (
                  <TableCell key={h} sx={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u, i) => (
                <TableRow key={i} sx={{ "&:hover": { background: "rgba(255,255,255,0.02)" } }}>
                  <TableCell sx={{ color: "white", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{u.username}</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{u.email}</TableCell>
                  <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <PlanBadge plan={u.plan} />
                    {u.trial_active && (
                      <Box sx={{ display: "inline-flex", ml: 1, px: 1, py: 0.2, borderRadius: "6px", fontSize: "10px", fontWeight: 700, color: "#a855f7", background: "rgba(168,85,247,0.12)" }}>
                        TRIAL {u.hours_left}h
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: u.active ? "#22c55e" : "#ef4444", display: "inline-block", mr: 1 }} />
                    <Typography sx={{ display: "inline", fontSize: "12px", color: u.active ? "#22c55e" : "#ef4444" }}>
                      {u.active ? "Active" : "Inactive"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "13px", color: u.telegram ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                    {u.telegram ? "âœ…" : "â€”"}
                  </TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {u.joined ? new Date(u.joined).toLocaleDateString() : "â€”"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}


      {/* â”€â”€ ONBOARDING TAB â”€â”€ */}
      {activeTab === "onboarding" && (
        <Box>
          <Grid container spacing={3} mb={4}>
            <Grid item xs={6} md={3}>
              <StatCard title="Total Users"       value={onboarding?.total_users}   color="#38bdf8" icon="ðŸ‘¥" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard title="Fully Completed"   value={stats?.onboarding_complete} color="#22c55e" icon="âœ…" />
            </Grid>
          </Grid>

          <Box sx={card}>
            <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Checklist Step Completion Rates
            </Typography>
            {onboarding?.steps?.map((step: any, i: number) => (
              <Box key={i} sx={{ mb: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography sx={{ fontSize: "14px", color: "white", fontWeight: 600 }}>{step.step}</Typography>
                  <Typography sx={{ fontSize: "14px", fontWeight: 800, color: step.pct >= 60 ? "#22c55e" : step.pct >= 30 ? "#f59e0b" : "#ef4444" }}>
                    {step.done} users ({step.pct}%)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={step.pct}
                  sx={{
                    height: 10, borderRadius: 5,
                    background: "rgba(255,255,255,0.07)",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 5,
                      background: step.pct >= 60 ? "linear-gradient(90deg,#22c55e,#38bdf8)"
                        : step.pct >= 30 ? "linear-gradient(90deg,#f59e0b,#fcd34d)"
                        : "linear-gradient(90deg,#ef4444,#f87171)",
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}


      {/* â”€â”€ REFERRALS TAB â”€â”€ */}
      {activeTab === "referrals" && (
        <Box>
          <Grid container spacing={3} mb={4}>
            <Grid item xs={6} md={3}>
              <StatCard title="Total Referral Signups" value={referrals?.total_referrals} color="#ec4899" icon="ðŸ”—" />
            </Grid>
          </Grid>

          <Box sx={card}>
            <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Top Referrers
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  {["User", "Referral Code", "Signups", "Plan"].map(h => (
                    <TableCell key={h} sx={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {referrals?.top_referrers?.map((r: any, i: number) => (
                  <TableRow key={i} sx={{ "&:hover": { background: "rgba(255,255,255,0.02)" } }}>
                    <TableCell sx={{ color: "white", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{r.username}</TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <Box sx={{ fontFamily: "monospace", fontSize: "13px", color: "#ec4899", background: "rgba(236,72,153,0.1)", px: 1.5, py: 0.4, borderRadius: "8px", display: "inline-block" }}>
                        {r.code}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: "#22c55e", fontWeight: 800, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{r.count}</TableCell>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}><PlanBadge plan={r.plan} /></TableCell>
                  </TableRow>
                ))}
                {(!referrals?.top_referrers || referrals.top_referrers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ color: "rgba(255,255,255,0.3)", textAlign: "center", py: 4, borderBottom: "none" }}>
                      No referrals yet â€” run the migration first
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

    </Box>
  );
}

