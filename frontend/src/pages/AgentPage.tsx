import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Card, CardContent,
  CircularProgress, Chip, Divider, IconButton, Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon     from "@mui/icons-material/Refresh";
import DownloadIcon    from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon       from "@mui/icons-material/Error";

const API = process.env.REACT_APP_API_URL || "https://riskguardian.onrender.com";
const tok = () => localStorage.getItem("access_token") || "";
const hdrs = () => ({ Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" });

const AGENT_DOWNLOAD_URL = "https://github.com/IANNO726/riskguardian/releases/download/v1.0.0/RiskGuardianAgent.exe";

interface AgentStatus {
  connected:   boolean;
  age_seconds: number | null;
  last_push:   string | null;
}

interface AgentData {
  balance:         number;
  equity:          number;
  profit:          number;
  today_pnl:       number;
  positions_count: number;
  login:           string;
  currency:        string;
  last_updated:    string;
}

const AgentPage: React.FC = () => {
  const [status,       setStatus]       = useState<AgentStatus | null>(null);
  const [agentData,    setAgentData]    = useState<AgentData | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [hasToken,     setHasToken]     = useState(false);
  const [fullToken,    setFullToken]    = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [polling,      setPolling]      = useState(false);

  const fetchStatus = async () => {
    try {
      const [statusRes, latestRes, tokenRes] = await Promise.all([
        fetch(`${API}/api/v1/agent/status`,  { headers: hdrs() }),
        fetch(`${API}/api/v1/agent/latest`,  { headers: hdrs() }),
        fetch(`${API}/api/v1/agent/token`,   { headers: hdrs() }),
      ]);
      const s = await statusRes.json();
      const l = await latestRes.json();
      const t = await tokenRes.json();
      setStatus(s);
      if (l.data) setAgentData(l.data);
      setHasToken(t.has_token);
      setTokenPreview(t.token_preview);
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 5000);
    return () => clearInterval(iv);
  }, []);

  const generateToken = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/v1/agent/token/generate`, {
        method: "POST", headers: hdrs(),
      });
      const data = await res.json();
      setFullToken(data.token);
      setHasToken(true);
      setTokenPreview(data.token.slice(0, 8) + "..." + data.token.slice(-4));
    } catch {
      alert("Failed to generate token");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (fullToken) {
      navigator.clipboard.writeText(fullToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const card = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
  };

  const connected = status?.connected ?? false;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, color: "white", minHeight: "100vh",
      background: "radial-gradient(circle at 20% 20%,rgba(56,189,248,0.06),transparent 40%),#0b1120",
      fontFamily: '"DM Sans",sans-serif',
    }}>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, mb: 0.5,
          background: "linear-gradient(90deg,#38bdf8,#22c55e)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Windows MT5 Agent
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          Install on your Windows PC to get live equity, positions and P&L on your dashboard
        </Typography>
      </Box>

      {/* Connection Status Banner */}
      <Box sx={{ mb: 3, p: 2.5, borderRadius: "16px",
        background: connected ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
        border: `1px solid ${connected ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
        display: "flex", alignItems: "center", gap: 2,
      }}>
        {connected
          ? <CheckCircleIcon sx={{ color: "#22c55e", fontSize: 28 }} />
          : <ErrorIcon       sx={{ color: "#f59e0b", fontSize: 28 }} />
        }
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, color: connected ? "#22c55e" : "#f59e0b", fontSize: 15 }}>
            {connected ? "✅ Agent Connected — Live Data Active" : "⚠️ Agent Not Connected"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)", mt: 0.3 }}>
            {connected
              ? `Last push: ${status?.age_seconds}s ago — equity, positions and P&L are live`
              : "Install and run the agent on your Windows PC to unlock full live data"
            }
          </Typography>
        </Box>
        {connected && agentData && (
          <Box sx={{ textAlign: "right" }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#22c55e" }}>
              ${agentData.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Live Equity</Typography>
          </Box>
        )}
      </Box>

      {/* Live Data Cards — only show when connected */}
      {connected && agentData && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, mb: 3 }}>
          {[
            { label: "Balance",    value: `$${agentData.balance.toFixed(2)}`,   color: "#64b5f6" },
            { label: "Equity",     value: `$${agentData.equity.toFixed(2)}`,    color: "#81c784" },
            { label: "Open P&L",   value: `$${agentData.profit.toFixed(2)}`,    color: agentData.profit >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Positions",  value: agentData.positions_count.toString(), color: "#ce93d8" },
          ].map((item, i) => (
            <Box key={i} sx={{ ...card, p: 2.5,
              "&::before": { content: '""', position: "absolute", top: 0, left: 0, right: 0, height: "3px",
                background: `linear-gradient(90deg,transparent,${item.color},transparent)` },
              position: "relative", overflow: "hidden",
            }}>
              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", mb: 1 }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: item.color, fontFamily: '"DM Mono",monospace' }}>
                {item.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>

        {/* Step 1 — Download */}
        <Card sx={{ ...card }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "#38bdf820",
                border: "1px solid #38bdf840", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>1</Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Download the Agent</Typography>
            </Box>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 13, mb: 2.5, lineHeight: 1.6 }}>
              A small Windows app (~5MB) that runs alongside your MT5 terminal.
              It reads your account data locally and sends it securely to your dashboard.
            </Typography>
            <Box sx={{ mb: 2.5, p: 2, borderRadius: "12px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)" }}>
              {["Runs silently in background", "Reads MT5 data locally (no screen sharing)", "Encrypted HTTPS connection", "Works with any Deriv MT5 account"].map((f, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: i < 3 ? 1 : 0 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{f}</Typography>
                </Box>
              ))}
            </Box>
            <Button
              component="a" href={AGENT_DOWNLOAD_URL} target="_blank"
              startIcon={<DownloadIcon />} fullWidth
              sx={{ py: 1.5, borderRadius: "12px", textTransform: "none", fontWeight: 700, fontSize: 14,
                background: "linear-gradient(135deg,#38bdf8,#0ea5e9)",
                color: "white", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(56,189,248,0.4)" },
              }}>
              Download RiskGuardian Agent (.exe)
            </Button>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", mt: 1 }}>
              Windows 10/11 · ~5MB · No installation required
            </Typography>
          </CardContent>
        </Card>

        {/* Step 2 — Token */}
        <Card sx={{ ...card }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "#22c55e20",
                border: "1px solid #22c55e40", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#22c55e" }}>2</Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Generate Your Agent Token</Typography>
            </Box>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 13, mb: 2.5, lineHeight: 1.6 }}>
              Generate a secure token, then paste it into the agent app.
              This connects your Windows PC to your dashboard.
            </Typography>

            {!hasToken ? (
              <Button onClick={generateToken} disabled={loading} fullWidth
                sx={{ py: 1.5, borderRadius: "12px", textTransform: "none", fontWeight: 700, fontSize: 14,
                  background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white",
                  "&:hover": { transform: "translateY(-2px)" },
                }}>
                {loading ? <CircularProgress size={20} sx={{ color: "white" }} /> : "🔑 Generate Agent Token"}
              </Button>
            ) : (
              <>
                <Box sx={{ mb: 2, p: 2, borderRadius: "12px", background: "#111827",
                  border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography sx={{ fontFamily: '"DM Mono",monospace', fontSize: 13, color: "#22c55e" }}>
                    {fullToken || tokenPreview}
                  </Typography>
                  {fullToken && (
                    <Tooltip title={copied ? "Copied!" : "Copy token"}>
                      <IconButton onClick={copyToken} size="small" sx={{ color: copied ? "#22c55e" : "rgba(255,255,255,0.4)" }}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                {!fullToken && (
                  <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.3)", mb: 2, textAlign: "center" }}>
                    Token hidden for security. Regenerate to get a new one.
                  </Typography>
                )}
                <Button onClick={generateToken} disabled={loading} fullWidth variant="outlined"
                  startIcon={<RefreshIcon />}
                  sx={{ py: 1.2, borderRadius: "12px", textTransform: "none", fontWeight: 600,
                    borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)",
                    "&:hover": { borderColor: "rgba(255,255,255,0.3)", color: "white" },
                  }}>
                  Regenerate Token
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 3 — Instructions */}
        <Card sx={{ ...card, gridColumn: { md: "1 / -1" } }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "#a855f720",
                border: "1px solid #a855f740", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#a855f7" }}>3</Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Run the Agent</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }}>
              {[
                { step: "1", icon: "📥", title: "Download", desc: "Download RiskGuardianAgent.exe and save it anywhere on your PC" },
                { step: "2", icon: "🔑", title: "Get Token", desc: "Generate your token above and copy it" },
                { step: "3", icon: "▶️", title: "Run Agent", desc: "Double-click the .exe, paste your token, click Start Agent" },
                { step: "4", icon: "📊", title: "Live Data", desc: "Your dashboard instantly shows live equity, positions and P&L" },
              ].map((item, i) => (
                <Box key={i} sx={{ p: 2, borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Typography sx={{ fontSize: 28, mb: 1 }}>{item.icon}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>{item.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{item.desc}</Typography>
                </Box>
              ))}
            </Box>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", my: 2.5 }} />
            <Box sx={{ p: 2, borderRadius: "12px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                💡 <strong style={{ color: "#f59e0b" }}>Tip:</strong> Add the agent to Windows Startup so it runs automatically.
                Right-click the .exe → Create shortcut → Move shortcut to{" "}
                <code style={{ color: "#f59e0b", fontSize: 12 }}>
                  C:\Users\YourName\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
                </code>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
    </Box>
  );
};

export default AgentPage;