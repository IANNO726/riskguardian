import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Grid, Typography, CircularProgress, LinearProgress, Modal,
} from "@mui/material";

const API = process.env.REACT_APP_API_URL || "https://riskguardian.onrender.com";
const tok  = () => localStorage.getItem("access_token") || "";
const hdrs = () => ({ Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" });

const HEALTH = {
  green:  { bg:"rgba(34,197,94,0.07)",  border:"rgba(34,197,94,0.22)",  dot:"#22c55e", label:"Healthy",  glow:"rgba(34,197,94,0.15)"  },
  yellow: { bg:"rgba(245,158,11,0.07)", border:"rgba(245,158,11,0.22)", dot:"#f59e0b", label:"Warning",  glow:"rgba(245,158,11,0.15)" },
  red:    { bg:"rgba(239,68,68,0.07)",  border:"rgba(239,68,68,0.22)",  dot:"#ef4444", label:"At Risk",  glow:"rgba(239,68,68,0.15)"  },
  locked: { bg:"rgba(168,85,247,0.07)", border:"rgba(168,85,247,0.22)", dot:"#a855f7", label:"Locked",   glow:"rgba(168,85,247,0.15)" },
};

const card = {
  background: "#0d1625",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "18px",
  color: "white",
};

const DERIV_PATTERNS = [
  "deriv-demo","deriv-server","deriv-real",
  "derivsvg-server","derivsvg-demo",
  "derivmx-server","derivmx-demo","deriv.com",
];
const isDerivAccount = (broker: string, server: string) =>
  broker.toLowerCase().includes("deriv") ||
  DERIV_PATTERNS.some(p => server.toLowerCase().includes(p));

const DERIV_STEPS = [
  { icon:"ðŸŒ", title:"Open Deriv", desc:'Go to app.deriv.com and make sure you\'re logged in', action:{ label:"Open Deriv â†’", url:"https://app.deriv.com/account/api-token" } },
  { icon:"ðŸ‘¤", title:"Go to API Token", desc:'Click your profile icon â†’ Settings â†’ "Security & privacy" â†’ API Token' },
  { icon:"âœï¸", title:"Create a token", desc:'Name it "RiskGuardian", enable Read + Trading information scopes, click Create' },
  { icon:"ðŸ“‹", title:"Copy & paste here", desc:"Copy the token and paste it in the field below â€” not your MT5 password" },
];

function accountHealth(acc: any) {
  if (acc.risk_locked)                return "locked";
  if ((acc.drawdown_pct || 0) >= 7)   return "red";
  if ((acc.drawdown_pct || 0) >= 4)   return "yellow";
  if ((acc.daily_pnl    || 0) < -200) return "yellow";
  return "green";
}
function fmt(n: number) {
  return `${n < 0 ? "-" : "+"}$${Math.abs(n).toFixed(2)}`;
}
function platformIcon(p: string) {
  const pl = (p || "").toLowerCase();
  if (pl.includes("mt5"))     return "â‘¤";
  if (pl.includes("mt4"))     return "â‘£";
  if (pl.includes("ctrader")) return "Â©";
  return "â—ˆ";
}

// â”€â”€ Demo/Real detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isDemo(acc: any): boolean {
  const server  = (acc.server         || "").toLowerCase();
  const accNum  = (acc.account_number || "").toString().toUpperCase();
  const broker  = (acc.broker_name    || "").toLowerCase();
  return (
    server.includes("demo") ||
    accNum.startsWith("MTD") ||
    broker.includes("demo")
  );
}

async function fetchLiveForAccounts(accounts: any[]): Promise<any[]> {
  const result: any[] = [];
  for (const a of accounts) {
    try {
      const res = await fetch(`${API}/api/v1/accounts-multi/${a.id}/live-data`, { headers: hdrs() });
      if (res.ok) {
        const live = await res.json();
        if (live.account_info) {
          result.push({
            ...a,
            last_balance:  live.account_info.balance  ?? a.last_balance,
            last_equity:   live.account_info.equity   ?? a.last_equity,
            currency:      live.account_info.currency ?? a.currency,
            open_trades:   live.positions_count       ?? 0,
            daily_pnl:     live.account_info.profit   ?? a.daily_pnl ?? 0,
            leverage:      live.account_info.leverage ?? a.leverage,
            mt5_connected: true,
          });
          continue;
        }
      }
    } catch {}
    result.push({ ...a, mt5_connected: false });
  }
  return result;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADD ACCOUNT MODAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function AddAccountModal({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: () => void;
}) {
  const EMPTY = { platform:"MT5", account_number:"", broker_name:"", server:"", password:"", account_name:"" };
  const [form,         setForm]         = useState(EMPTY);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [step,         setStep]         = useState<"form"|"verifying"|"success">("form");
  const [guideStep,    setGuideStep]    = useState(0);
  const [guidePulsing, setGuidePulsing] = useState(false);
  const intervalRef  = useRef<any>(null);
  const prevDerivRef = useRef(false);

  const isDerivMode = isDerivAccount(form.broker_name, form.server);

  useEffect(() => {
    if (isDerivMode && !prevDerivRef.current) {
      setGuidePulsing(true);
      setTimeout(() => setGuidePulsing(false), 1200);
    }
    prevDerivRef.current = isDerivMode;
  }, [isDerivMode]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (isDerivMode) {
      intervalRef.current = setInterval(() => {
        setGuideStep(s => (s + 1) % DERIV_STEPS.length);
      }, 3500);
    }
    return () => clearInterval(intervalRef.current);
  }, [isDerivMode]);

  const handleClose = () => {
    setForm(EMPTY); setError(""); setStep("form");
    setShowPwd(false); setGuideStep(0); onClose();
  };

  const validate = () => {
    if (!form.account_number.trim()) return "Account number is required.";
    if (!form.password.trim())       return isDerivMode ? "Deriv API token is required." : "Password is required.";
    if (!form.server.trim())         return "Server is required.";
    if (!form.broker_name.trim())    return "Broker name is required.";
    return null;
  };

  const friendlyError = (detail: string) => {
    const d = (detail || "").toLowerCase();
    if (d.includes("invalid account") || d.includes("authorization failed") || d.includes("no connection"))
      return "âŒ Connection failed â€” check your account number, password and server name.";
    if (d.includes("token") || d.includes("api"))
      return "âŒ Invalid API token â€” make sure it has Read + Trading information scopes enabled.";
    if (d.includes("password"))  return "âŒ Incorrect password â€” please double-check.";
    if (d.includes("server"))    return "âŒ Server not found. Example: Deriv-Demo or Deriv-Server.";
    if (d.includes("limit reached") || d.includes("403"))
      return "âš¡ Account limit reached for your plan â€” upgrade to add more.";
    if (d.includes("already exists")) return "âš ï¸ This account is already connected.";
    return `âŒ ${detail || "Failed to connect. Please check your details and try again."}`;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError(""); setStep("verifying");
    try {
      const res  = await fetch(`${API}/api/v1/accounts-multi/`, {
        method: "POST", headers: hdrs(), body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setStep("form"); setError(friendlyError(data.detail)); return; }
      setStep("success");
      try { await fetch(`${API}/api/v1/accounts-multi/${data.id}/live-data`, { headers: hdrs() }); } catch {}
      setTimeout(() => { onAdded(); handleClose(); }, 1400);
    } catch {
      setStep("form");
      setError("âŒ Network error â€” make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const inp = (hasError = false) => ({
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${hasError ? "rgba(239,68,68,0.5)" : isDerivMode ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.09)"}`,
    borderRadius: "12px", padding: "11px 15px",
    color: "white", fontSize: "13.5px", outline: "none",
    marginBottom: "12px", boxSizing: "border-box" as const,
    fontFamily: "inherit", transition: "border-color 0.2s",
  });

  const gs = DERIV_STEPS[guideStep];

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={{
        position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        width:{xs:"92%",sm:450}, ...card, p:"30px",
        boxShadow:"0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.08)",
        maxHeight:"92vh", overflowY:"auto",
        "&::-webkit-scrollbar":{width:"4px"},
        "&::-webkit-scrollbar-thumb":{background:"rgba(255,255,255,0.1)",borderRadius:"4px"},
      }}>
        {step === "success" ? (
          <Box sx={{ textAlign:"center", py:3 }}>
            <Box sx={{ width:72,height:72,borderRadius:"50%",mx:"auto",mb:2,background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px" }}>âœ…</Box>
            <Typography sx={{ fontSize:"17px",fontWeight:800,mb:1 }}>Account Connected!</Typography>
            <Typography sx={{ fontSize:"12.5px",color:"rgba(255,255,255,0.4)" }}>Credentials verified. Your account is now being monitored.</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mb:"18px" }}>
              <Box sx={{ display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap",mb:"4px" }}>
                <Typography sx={{ fontSize:"17px",fontWeight:800,letterSpacing:"-0.02em" }}>Connect Trading Account</Typography>
                {isDerivMode && (
                  <Box sx={{ display:"inline-flex",alignItems:"center",gap:"5px",px:"9px",py:"3px",borderRadius:"20px",background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.28)",fontSize:"10px",fontWeight:800,color:"#fbbf24",animation:"aam-pop 0.3s cubic-bezier(.16,1,.3,1)","@keyframes aam-pop":{from:{opacity:0,transform:"scale(0.8)"},to:{opacity:1,transform:"scale(1)"}} }}>
                    <Box sx={{ width:6,height:6,borderRadius:"50%",background:"#fbbf24",animation:"aam-blink 1.2s ease-in-out infinite","@keyframes aam-blink":{"0%,100%":{opacity:1},"50%":{opacity:0.2}} }} />
                    DERIV DETECTED
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontSize:"12.5px",color:"rgba(255,255,255,0.38)",lineHeight:1.6 }}>
                {isDerivMode ? "Connects via Deriv's secure WebSocket API â€” no MT5 terminal interference" : "We verify the connection live before saving. Credentials are encrypted."}
              </Typography>
            </Box>

            <Box sx={{ display:"flex",gap:1,mb:"18px" }}>
              {["MT5","MT4"].map(p=>(
                <Box key={p} onClick={()=>setForm(f=>({...f,platform:p}))} sx={{ flex:1,py:"9px",borderRadius:"10px",textAlign:"center",fontSize:"13px",fontWeight:700,cursor:"pointer",background:form.platform===p?"rgba(56,189,248,0.12)":"rgba(255,255,255,0.03)",border:form.platform===p?"1px solid rgba(56,189,248,0.35)":"1px solid rgba(255,255,255,0.07)",color:form.platform===p?"#38bdf8":"rgba(255,255,255,0.35)",transition:"all 0.15s" }}>{platformIcon(p)} {p}</Box>
              ))}
            </Box>

            {isDerivMode && (
              <Box sx={{ borderRadius:"16px",overflow:"hidden",mb:"18px",border:"1px solid rgba(251,191,36,0.2)",background:"linear-gradient(135deg,rgba(251,191,36,0.06),rgba(245,158,11,0.03))",animation:guidePulsing?"aam-guide-in 0.4s cubic-bezier(.16,1,.3,1), aam-guide-pulse 0.6s ease 0.4s":"aam-guide-in 0.4s cubic-bezier(.16,1,.3,1)","@keyframes aam-guide-in":{from:{opacity:0,transform:"translateY(-8px) scale(0.98)"},to:{opacity:1,transform:"translateY(0) scale(1)"}},"@keyframes aam-guide-pulse":{"0%,100%":{boxShadow:"0 0 0 0 rgba(251,191,36,0)"},"50%":{boxShadow:"0 0 0 6px rgba(251,191,36,0.15)"}} }}>
                <Box sx={{ px:"16px",py:"10px",background:"rgba(251,191,36,0.09)",borderBottom:"1px solid rgba(251,191,36,0.12)",display:"flex",alignItems:"center",gap:"10px" }}>
                  <Box sx={{ background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#000",fontSize:"9px",fontWeight:800,letterSpacing:"1px",px:"8px",py:"2px",borderRadius:"20px",whiteSpace:"nowrap" }}>API TOKEN REQUIRED</Box>
                  <Typography sx={{ fontSize:"11.5px",color:"rgba(251,191,36,0.85)",fontWeight:500 }}>Deriv uses an API token â€” not your MT5 password</Typography>
                </Box>
                <Box sx={{ p:"16px" }}>
                  <Box key={guideStep} sx={{ display:"flex",gap:"14px",alignItems:"flex-start",animation:"aam-step-in 0.35s cubic-bezier(.16,1,.3,1)","@keyframes aam-step-in":{from:{opacity:0,transform:"translateX(8px)"},to:{opacity:1,transform:"translateX(0)"}} }}>
                    <Box sx={{ width:42,height:42,borderRadius:"12px",background:"rgba(251,191,36,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0 }}>{gs.icon}</Box>
                    <Box>
                      <Typography sx={{ fontSize:"9px",fontWeight:800,color:"rgba(251,191,36,0.45)",letterSpacing:"1px",mb:"2px" }}>STEP {guideStep+1} OF {DERIV_STEPS.length}</Typography>
                      <Typography sx={{ fontSize:"14px",fontWeight:700,color:"white",mb:"3px" }}>{gs.title}</Typography>
                      <Typography sx={{ fontSize:"12px",color:"rgba(255,255,255,0.45)",lineHeight:1.6 }}>{gs.desc}</Typography>
                      {gs.action && (
                        <Box component="a" href={gs.action.url} target="_blank" rel="noreferrer" sx={{ display:"inline-flex",alignItems:"center",mt:"8px",px:"12px",py:"5px",background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.28)",borderRadius:"20px",color:"#fbbf24",fontSize:"12px",fontWeight:600,textDecoration:"none","&:hover":{background:"rgba(251,191,36,0.22)"},transition:"all 0.2s" }}>{gs.action.label}</Box>
                      )}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display:"flex",justifyContent:"center",gap:"6px",py:"10px",borderTop:"1px solid rgba(255,255,255,0.04)" }}>
                  {DERIV_STEPS.map((_,i)=>(
                    <Box key={i} onClick={()=>{setGuideStep(i);clearInterval(intervalRef.current);}} sx={{ height:6,borderRadius:"3px",cursor:"pointer",width:i===guideStep?"18px":"6px",background:i===guideStep?"#fbbf24":"rgba(255,255,255,0.15)",transition:"all 0.3s" }} />
                  ))}
                </Box>
              </Box>
            )}

            <Box sx={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px" }}>
              {[
                {label:"Account Number",field:"account_number",placeholder:"e.g. 40979584"},
                {label:"Broker Server", field:"server",        placeholder:"e.g. Deriv-Demo"},
                {label:"Broker Name",   field:"broker_name",   placeholder:"e.g. Deriv, FTMO, Exness"},
                {label:"Nickname",      field:"account_name",  placeholder:"e.g. Deriv Demo (optional)"},
              ].map(({label,field,placeholder})=>(
                <Box key={field}>
                  <Typography sx={{ fontSize:"11px",color:"rgba(255,255,255,0.38)",mb:"6px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase" }}>{label}</Typography>
                  <input style={inp()} placeholder={placeholder} value={(form as any)[field]} onChange={e=>{setForm(f=>({...f,[field]:e.target.value}));setError("");}} />
                </Box>
              ))}
            </Box>

            <Box>
              <Box sx={{ display:"flex",alignItems:"center",gap:"8px",mb:"6px",flexWrap:"wrap" }}>
                <Typography sx={{ fontSize:"11px",color:"rgba(255,255,255,0.38)",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase" }}>{isDerivMode?"Deriv API Token":"Password"}</Typography>
                {isDerivMode && <Box sx={{ fontSize:"9px",fontWeight:800,px:"7px",py:"2px",borderRadius:"5px",color:"#fbbf24",background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.2)",letterSpacing:"0.5px" }}>âš¡ NOT YOUR MT5 PASSWORD</Box>}
              </Box>
              <Box sx={{ position:"relative",mb:"8px" }}>
                <input style={{...inp(),marginBottom:0,paddingRight:"44px"}} placeholder={isDerivMode?"Paste your Deriv API token hereâ€¦":"Your MT5 main or investor password"} type={showPwd?"text":"password"} value={form.password} onChange={e=>{setForm(f=>({...f,password:e.target.value}));setError("");}} />
                <Box onClick={()=>setShowPwd(v=>!v)} sx={{ position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:"15px",color:showPwd?"#38bdf8":"rgba(255,255,255,0.28)","&:hover":{color:"rgba(255,255,255,0.7)"},transition:"color 0.15s" }}>{showPwd?"ðŸ™ˆ":"ðŸ‘"}</Box>
              </Box>
              {isDerivMode && (
                <Box sx={{ display:"flex",alignItems:"flex-start",gap:"8px",p:"10px 12px",mb:"12px",background:"rgba(251,191,36,0.05)",border:"1px dashed rgba(251,191,36,0.2)",borderRadius:"10px" }}>
                  <Typography sx={{ fontSize:"16px",lineHeight:1 }}>ðŸ”‘</Typography>
                  <Typography sx={{ fontSize:"12px",color:"rgba(251,191,36,0.75)",lineHeight:1.6 }}>
                    Get your token at{" "}
                    <Box component="a" href="https://app.deriv.com/account/api-token" target="_blank" rel="noreferrer" sx={{ color:"#fbbf24",fontWeight:700,textDecoration:"none","&:hover":{textDecoration:"underline"} }}>app.deriv.com â†’ API Token</Box>
                    {" "}â€” enable <strong style={{color:"#fde68a"}}>Read</strong> + <strong style={{color:"#fde68a"}}>Trading information</strong> scopes
                  </Typography>
                </Box>
              )}
            </Box>

            {error && <Box sx={{ p:"12px 14px",borderRadius:"11px",mb:"14px",background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.22)" }}><Typography sx={{ fontSize:"12.5px",color:"#fca5a5",lineHeight:1.6 }}>{error}</Typography></Box>}

            {step==="verifying" && (
              <Box sx={{ display:"flex",alignItems:"center",gap:"10px",p:"11px 14px",borderRadius:"11px",mb:"14px",background:isDerivMode?"rgba(251,191,36,0.06)":"rgba(56,189,248,0.07)",border:isDerivMode?"1px solid rgba(251,191,36,0.18)":"1px solid rgba(56,189,248,0.18)" }}>
                <CircularProgress size={13} sx={{ color:isDerivMode?"#fbbf24":"#38bdf8",flexShrink:0 }} />
                <Typography sx={{ fontSize:"12.5px",color:isDerivMode?"#fde68a":"#7dd3fc" }}>{isDerivMode?"Connecting to Deriv via WebSocketâ€¦":`Connecting to ${form.platform} server and verifying credentialsâ€¦`}</Typography>
              </Box>
            )}

            <Box sx={{ display:"flex",gap:"10px",mt:"4px" }}>
              <Box onClick={handleClose} sx={{ flex:1,py:"11px",borderRadius:"12px",textAlign:"center",cursor:"pointer",fontSize:"13.5px",fontWeight:700,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.4)","&:hover":{background:"rgba(255,255,255,0.07)"},transition:"all 0.15s" }}>Cancel</Box>
              <Box onClick={!loading?submit:undefined} sx={{ flex:2,py:"11px",borderRadius:"12px",textAlign:"center",cursor:loading?"not-allowed":"pointer",fontSize:"13.5px",fontWeight:700,background:loading?(isDerivMode?"rgba(251,191,36,0.25)":"rgba(56,189,248,0.25)"):isDerivMode?"linear-gradient(135deg,#d97706,#f59e0b,#fbbf24)":"linear-gradient(135deg,#0ea5e9,#6366f1)",color:isDerivMode?"#000":"white",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",opacity:loading?0.7:1,boxShadow:loading?"none":isDerivMode?"0 4px 20px rgba(251,191,36,0.3)":"0 4px 20px rgba(56,189,248,0.25)","&:hover":!loading?{transform:"translateY(-1px)",boxShadow:isDerivMode?"0 6px 24px rgba(251,191,36,0.4)":"0 6px 24px rgba(56,189,248,0.35)"}:{},transition:"all 0.15s" }}>
                {loading?<><CircularProgress size={13} sx={{color:isDerivMode?"#000":"white"}}/>{isDerivMode?"Connecting via WebSocketâ€¦":"Verifyingâ€¦"}</>:isDerivMode?"âš¡ Connect Deriv Account â†’":"ðŸ”’ Connect & Verify â†’"}
              </Box>
            </Box>
            <Typography sx={{ textAlign:"center",mt:"14px",fontSize:"11px",color:"rgba(255,255,255,0.2)" }}>ðŸ” Encrypted end-to-end Â· Never stored in plain text Â· Read-only access</Typography>
          </>
        )}
      </Box>
    </Modal>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ACCOUNT CARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function AccountCard({ acc, onLock, onView, onDelete, refreshing }: {
  acc: any; onLock: (id: number) => void; onView: (id: number) => void;
  onDelete: (id: number) => void; refreshing?: boolean;
}) {
  const health      = accountHealth(acc);
  const colors      = HEALTH[health as keyof typeof HEALTH];
  const ddPct       = Math.min(acc.drawdown_pct || 0, 10);
  const pnlPos      = (acc.daily_pnl || 0) >= 0;
  const platformStr = acc.platform?.value || acc.platform || "MT5";
  const demo        = isDemo(acc);

  return (
    <Box sx={{
      ...card, background: colors.bg, border: `1px solid ${colors.border}`,
      p: "22px", position: "relative", overflow: "hidden",
      transition: "transform 0.2s, box-shadow 0.2s",
      "&:hover": { transform: "translateY(-3px)", boxShadow: `0 16px 40px ${colors.glow}` },
    }}>
      <Box sx={{ position:"absolute",top:0,left:"20%",right:"20%",height:"1px",background:`linear-gradient(90deg,transparent,${colors.dot}60,transparent)` }} />
      {refreshing && (
        <Box sx={{ position:"absolute",top:"10px",right:"10px",width:"6px",height:"6px",borderRadius:"50%",background:"#38bdf8",animation:"pulse 1.2s ease-in-out infinite","@keyframes pulse":{"0%,100%":{opacity:1},"50%":{opacity:0.2}} }} />
      )}

      {/* Header */}
      <Box sx={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",mb:"14px" }}>
        <Box sx={{ flex:1,minWidth:0 }}>
          {/* Account name + DEFAULT badge */}
          <Box sx={{ display:"flex",alignItems:"center",gap:"8px",mb:"4px",flexWrap:"wrap" }}>
            <Box sx={{ width:7,height:7,borderRadius:"50%",flexShrink:0,background:colors.dot,boxShadow:`0 0 8px ${colors.dot}` }} />
            <Typography sx={{ fontSize:"13.5px",fontWeight:800,color:"white",letterSpacing:"-0.01em" }} noWrap>
              {acc.account_name || `${acc.broker_name} #${acc.account_number}`}
            </Typography>
            {acc.is_default && (
              <Box sx={{ fontSize:"9px",fontWeight:800,px:"7px",py:"2px",borderRadius:"5px",color:"#38bdf8",background:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.22)",flexShrink:0 }}>DEFAULT</Box>
            )}
          </Box>

          {/* Line 1: Platform Â· Broker Â· Login */}
          <Typography sx={{ fontSize:"11px",color:"rgba(255,255,255,0.3)",letterSpacing:"0.02em",mb:"6px" }}>
            {platformIcon(platformStr)} {platformStr} Â· {acc.broker_name} Â· #{acc.account_number}
          </Typography>

          {/* Line 2: Server chip Â· Demo/Real badge Â· Leverage badge */}
          <Box sx={{ display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap" }}>

            {/* Server name */}
            {acc.server && (
              <Box sx={{ display:"inline-flex",alignItems:"center",gap:"4px",px:"7px",py:"2px",borderRadius:"6px",background:"rgba(56,189,248,0.07)",border:"1px solid rgba(56,189,248,0.16)" }}>
                <Box sx={{ width:4,height:4,borderRadius:"50%",background:"#38bdf8",flexShrink:0 }} />
                <Typography sx={{ fontSize:"10px",fontWeight:700,color:"#38bdf8",letterSpacing:"0.02em",fontFamily:'"Roboto Mono",monospace' }}>
                  {acc.server}
                </Typography>
              </Box>
            )}

            {/* Demo / Real */}
            <Box sx={{
              px:"7px",py:"2px",borderRadius:"6px",fontSize:"10px",fontWeight:800,letterSpacing:"0.04em",
              background: demo ? "rgba(251,191,36,0.09)"  : "rgba(34,197,94,0.09)",
              border:     demo ? "1px solid rgba(251,191,36,0.22)" : "1px solid rgba(34,197,94,0.22)",
              color:      demo ? "#fbbf24" : "#22c55e",
            }}>
              {demo ? "DEMO" : "REAL"}
            </Box>

            {/* Leverage â€” shown if available */}
            {acc.leverage && (
              <Box sx={{ px:"7px",py:"2px",borderRadius:"6px",fontSize:"10px",fontWeight:800,letterSpacing:"0.04em",background:"rgba(168,85,247,0.09)",border:"1px solid rgba(168,85,247,0.2)",color:"#a855f7" }}>
                1:{acc.leverage}
              </Box>
            )}

          </Box>
        </Box>

        {/* Health badge + offline indicator */}
        <Box sx={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"5px",ml:1 }}>
          <Box sx={{ fontSize:"10px",fontWeight:800,px:"10px",py:"3px",borderRadius:"7px",color:colors.dot,background:`${colors.dot}14`,border:`1px solid ${colors.dot}28`,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap" }}>{colors.label}</Box>
          {acc.mt5_connected===false && (
            <Box sx={{ fontSize:"9px",fontWeight:700,px:"7px",py:"2px",borderRadius:"6px",color:"#f59e0b",background:"rgba(245,158,11,0.09)",border:"1px solid rgba(245,158,11,0.25)",whiteSpace:"nowrap" }}>âš  Offline</Box>
          )}
        </Box>
      </Box>

      {/* Balance & P&L */}
      <Grid container spacing={1.5} mb="14px">
        {[
          { label:"Balance",   value:`$${(acc.last_balance||0).toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}`, sub:`Equity: $${(acc.last_equity||0).toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}`, color:"white" },
          { label:"Float P&L", value:fmt(acc.daily_pnl||0), sub:`${acc.open_trades||0} open trade${(acc.open_trades||0)!==1?"s":""}`, color:pnlPos?"#22c55e":"#ef4444" },
        ].map(s=>(
          <Grid item xs={6} key={s.label}>
            <Box sx={{ background:"rgba(0,0,0,0.22)",borderRadius:"12px",p:"13px 14px" }}>
              <Typography sx={{ fontSize:"10px",color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",mb:"5px" }}>{s.label}</Typography>
              <Typography sx={{ fontSize:"20px",fontWeight:800,color:s.color,letterSpacing:"-0.02em" }}>{s.value}</Typography>
              <Typography sx={{ fontSize:"10px",color:"rgba(255,255,255,0.2)",mt:"2px" }}>{s.sub}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Drawdown bar */}
      <Box mb="14px">
        <Box sx={{ display:"flex",justifyContent:"space-between",mb:"7px" }}>
          <Typography sx={{ fontSize:"11px",color:"rgba(255,255,255,0.35)",fontWeight:600 }}>Drawdown</Typography>
          <Typography sx={{ fontSize:"11px",fontWeight:800,color:colors.dot }}>{ddPct.toFixed(1)}% / 10%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={(ddPct/10)*100} sx={{ height:5,borderRadius:3,background:"rgba(255,255,255,0.06)","& .MuiLinearProgress-bar":{borderRadius:3,background:health==="green"?"linear-gradient(90deg,#22c55e,#38bdf8)":health==="yellow"?"linear-gradient(90deg,#f59e0b,#fcd34d)":"linear-gradient(90deg,#ef4444,#f87171)"} }} />
      </Box>

      {/* Info chips */}
      <Box sx={{ display:"flex",gap:"7px",mb:"14px" }}>
        <Box sx={{ flex:1,textAlign:"center",background:"rgba(0,0,0,0.18)",borderRadius:"9px",py:"8px" }}>
          <Typography sx={{ fontSize:"13px",fontWeight:800,color:"white" }}>{acc.currency||"USD"}</Typography>
          <Typography sx={{ fontSize:"10px",color:"rgba(255,255,255,0.28)" }}>Currency</Typography>
        </Box>
        <Box sx={{ flex:1,textAlign:"center",borderRadius:"9px",py:"8px",background:acc.risk_locked?"rgba(168,85,247,0.12)":"rgba(0,0,0,0.18)" }}>
          <Typography sx={{ fontSize:"12px",fontWeight:800,color:acc.risk_locked?"#a855f7":"#22c55e" }}>{acc.risk_locked?"ðŸ”’ ON":"âœ“ OFF"}</Typography>
          <Typography sx={{ fontSize:"10px",color:"rgba(255,255,255,0.28)" }}>Risk Lock</Typography>
        </Box>
        {acc.last_connected && (
          <Box sx={{ flex:1.5,textAlign:"center",background:"rgba(0,0,0,0.18)",borderRadius:"9px",py:"8px" }}>
            <Typography sx={{ fontSize:"10px",fontWeight:700,color:"#38bdf8" }}>
              {new Date(acc.last_connected).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
            </Typography>
            <Typography sx={{ fontSize:"10px",color:"rgba(255,255,255,0.28)" }}>Last Sync</Typography>
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display:"flex",gap:"7px" }}>
        <Box onClick={()=>onView(acc.id)} sx={{ flex:2,py:"9px",borderRadius:"10px",textAlign:"center",fontSize:"12px",fontWeight:700,cursor:"pointer",background:"rgba(56,189,248,0.09)",border:"1px solid rgba(56,189,248,0.22)",color:"#38bdf8","&:hover":{background:"rgba(56,189,248,0.16)",borderColor:"rgba(56,189,248,0.4)"},transition:"all 0.15s" }}>View & Switch â†’</Box>
        <Box onClick={()=>onLock(acc.id)} sx={{ flex:1,py:"9px",borderRadius:"10px",textAlign:"center",fontSize:"12px",fontWeight:700,cursor:"pointer",background:acc.risk_locked?"rgba(168,85,247,0.1)":"rgba(239,68,68,0.08)",border:acc.risk_locked?"1px solid rgba(168,85,247,0.28)":"1px solid rgba(239,68,68,0.2)",color:acc.risk_locked?"#a855f7":"#ef4444","&:hover":{opacity:0.82},transition:"all 0.15s" }}>{acc.risk_locked?"Unlock":"Lock"}</Box>
        <Box onClick={()=>onDelete(acc.id)} sx={{ width:34,py:"9px",borderRadius:"10px",textAlign:"center",fontSize:"13px",cursor:"pointer",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.25)","&:hover":{background:"rgba(239,68,68,0.12)",color:"#ef4444",borderColor:"rgba(239,68,68,0.3)"},transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center" }}>ðŸ—‘</Box>
      </Box>
    </Box>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN DASHBOARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function MultiAccountDashboard() {
  const [accounts,      setAccounts]      = useState<any[]>([]);
  const [planInfo,      setPlanInfo]      = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [alerts,        setAlerts]        = useState<any[]>([]);
  const liveLoadedRef = useRef(false);

  const buildAlerts = (list: any[]) => {
    const a: any[] = [];
    list.forEach(acc => {
      if ((acc.drawdown_pct||0) >= 7)    a.push({ type:"red",    msg:`${acc.account_name||acc.account_number} â€” Daily loss limit hit (${(acc.drawdown_pct||0).toFixed(1)}%)` });
      else if ((acc.drawdown_pct||0)>=4) a.push({ type:"yellow", msg:`${acc.account_name||acc.account_number} â€” Approaching drawdown limit (${(acc.drawdown_pct||0).toFixed(1)}%)` });
      if (acc.risk_locked)               a.push({ type:"purple", msg:`${acc.account_name||acc.account_number} â€” Risk Lock is active` });
    });
    setAlerts(a);
  };

  const loadAccounts = useCallback(async (withLive = false) => {
    try {
      const [accRes, planRes] = await Promise.all([
        fetch(`${API}/api/v1/accounts-multi/`,           { headers: hdrs() }),
        fetch(`${API}/api/v1/accounts-multi/plan-limit`, { headers: hdrs() }),
      ]);
      const accs = await accRes.json();
      const plan = await planRes.json();
      const list: any[] = Array.isArray(accs) ? accs : [];
      setPlanInfo(plan);
      if (withLive && list.length > 0) {
        const enriched = await fetchLiveForAccounts(list);
        setAccounts(enriched); buildAlerts(enriched);
        liveLoadedRef.current = true;
      } else {
        setAccounts(list); buildAlerts(list);
      }
    } catch (e) { console.error("MultiAccount load error:", e); }
    finally { setLoading(false); }
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const enriched = await fetchLiveForAccounts(accounts);
    setAccounts(enriched); buildAlerts(enriched);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAccounts(true);
    const iv = setInterval(() => { if (!document.hidden) loadAccounts(false); }, 60_000);
    const onVisible = () => { if (!document.hidden) loadAccounts(false); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, [loadAccounts]);

  const handleAdded  = () => loadAccounts(true);
  const handleLock   = async (id: number) => { await fetch(`${API}/api/v1/cooldown/toggle`,{method:"POST",headers:hdrs(),body:JSON.stringify({account_id:id})}).catch(()=>{}); loadAccounts(false); };
  const handleView   = async (id: number) => { try { await fetch(`${API}/api/v1/accounts-multi/${id}/set-default`,{method:"POST",headers:hdrs()}); } catch {} window.location.href=window.location.origin+window.location.pathname+"#/app"; window.location.reload(); };
  const handleDelete = async (id: number) => { try { await fetch(`${API}/api/v1/accounts-multi/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${tok()}`}}); } catch(e){ console.error(e); } setDeleteConfirm(null); loadAccounts(false); };

  const totalBalance = accounts.reduce((s,a)=>s+(a.last_balance||0),0);
  const totalPnL     = accounts.reduce((s,a)=>s+(a.daily_pnl||0),0);
  const avgDrawdown  = accounts.length ? accounts.reduce((s,a)=>s+(a.drawdown_pct||0),0)/accounts.length : 0;
  const atRiskCount  = accounts.filter(a=>accountHealth(a)!=="green").length;
  const lockedCount  = accounts.filter(a=>a.risk_locked).length;
  const onlineCount  = accounts.filter(a=>a.mt5_connected!==false).length;

  if (loading) return (
    <Box sx={{ display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",minHeight:"60vh",gap:2 }}>
      <CircularProgress sx={{ color:"#38bdf8" }} size={36} />
      <Typography sx={{ fontSize:"13px",color:"rgba(255,255,255,0.3)" }}>Connecting to trading accountsâ€¦</Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight:"100vh",p:{xs:2,md:"28px 32px"},color:"white",background:"radial-gradient(ellipse at 10% 0%,rgba(56,189,248,0.04),transparent 55%),radial-gradient(ellipse at 90% 100%,rgba(168,85,247,0.04),transparent 55%),#08101e" }}>

      <Box sx={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",mb:"28px",flexWrap:"wrap",gap:2 }}>
        <Box>
          <Typography sx={{ fontSize:{xs:"22px",md:"26px"},fontWeight:900,letterSpacing:"-0.03em",background:"linear-gradient(90deg,#e2e8f0 30%,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>My Accounts</Typography>
          <Box sx={{ display:"flex",alignItems:"center",gap:"10px",mt:"5px",flexWrap:"wrap" }}>
            <Typography sx={{ fontSize:"12.5px",color:"rgba(255,255,255,0.35)" }}>{accounts.length} account{accounts.length!==1?"s":""}</Typography>
            {onlineCount>0 && <Typography sx={{ fontSize:"12px",color:"#22c55e",fontWeight:600 }}>â— {onlineCount} online</Typography>}
            {atRiskCount>0 && <Typography sx={{ fontSize:"12px",color:"#f59e0b",fontWeight:600 }}>âš  {atRiskCount} at risk</Typography>}
            {lockedCount>0 && <Typography sx={{ fontSize:"12px",color:"#a855f7",fontWeight:600 }}>ðŸ”’ {lockedCount} locked</Typography>}
          </Box>
        </Box>
        <Box sx={{ display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap" }}>
          {planInfo && (
            <Box sx={{ px:"14px",py:"8px",borderRadius:"10px",fontSize:"12px",fontWeight:700,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.45)" }}>
              {planInfo.used}/{planInfo.max===999?"âˆž":planInfo.max} Â· {(planInfo.plan||"free").toUpperCase()}
            </Box>
          )}
          <Box onClick={handleRefresh} sx={{ px:"14px",py:"8px",borderRadius:"10px",cursor:refreshing?"default":"pointer",fontSize:"12.5px",fontWeight:700,display:"flex",alignItems:"center",gap:"6px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:refreshing?"#38bdf8":"rgba(255,255,255,0.4)","&:hover":!refreshing?{background:"rgba(255,255,255,0.07)",color:"white"}:{},transition:"all 0.15s" }}>
            {refreshing?<><CircularProgress size={11} sx={{color:"#38bdf8"}}/> Syncingâ€¦</>:"âŸ³ Refresh"}
          </Box>
          {planInfo?.can_add ? (
            <Box onClick={()=>setShowModal(true)} sx={{ px:"16px",py:"8px",borderRadius:"10px",cursor:"pointer",fontSize:"13px",fontWeight:700,background:"linear-gradient(135deg,rgba(14,165,233,0.18),rgba(99,102,241,0.18))",border:"1px solid rgba(56,189,248,0.3)",color:"#38bdf8","&:hover":{background:"linear-gradient(135deg,rgba(14,165,233,0.28),rgba(99,102,241,0.28))"},transition:"all 0.15s" }}>+ Add Account</Box>
          ) : (
            <Box onClick={()=>(window.location.hash="/app/settings")} sx={{ px:"16px",py:"8px",borderRadius:"10px",cursor:"pointer",fontSize:"13px",fontWeight:700,background:"rgba(168,85,247,0.09)",border:"1px solid rgba(168,85,247,0.25)",color:"#a855f7","&:hover":{background:"rgba(168,85,247,0.15)"},transition:"all 0.15s" }}>âš¡ Upgrade</Box>
          )}
        </Box>
      </Box>

      {accounts.length>0 && (
        <Grid container spacing={2} mb="24px">
          {[
            {label:"Total Balance",value:`$${totalBalance.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}`,color:"#e2e8f0",sub:`across ${accounts.length} account${accounts.length!==1?"s":""}`},
            {label:"Float P&L",value:fmt(totalPnL),color:totalPnL>=0?"#22c55e":"#ef4444",sub:"open positions"},
            {label:"Avg Drawdown",value:`${avgDrawdown.toFixed(1)}%`,color:avgDrawdown>=5?"#ef4444":avgDrawdown>=3?"#f59e0b":"#22c55e",sub:"across all accounts"},
            {label:"At Risk",value:`${atRiskCount} / ${accounts.length}`,color:atRiskCount>0?"#f59e0b":"#22c55e",sub:"accounts need attention"},
          ].map((s,i)=>(
            <Grid item xs={6} md={3} key={i}>
              <Box sx={{ ...card,p:"18px 20px",position:"relative",overflow:"hidden","&::after":{content:'""',position:"absolute",top:0,left:0,right:0,height:"2px",background:`linear-gradient(90deg,transparent,${s.color}50,transparent)`} }}>
                <Typography sx={{ fontSize:"10.5px",color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",mb:"7px" }}>{s.label}</Typography>
                <Typography sx={{ fontSize:"21px",fontWeight:800,color:s.color,letterSpacing:"-0.02em",lineHeight:1 }}>{s.value}</Typography>
                <Typography sx={{ fontSize:"11px",color:"rgba(255,255,255,0.22)",mt:"5px" }}>{s.sub}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {accounts.length===0 ? (
        <Box sx={{ ...card,p:"52px 40px",textAlign:"center",border:"1px dashed rgba(56,189,248,0.15)",background:"rgba(56,189,248,0.02)" }}>
          <Typography sx={{ fontSize:"40px",mb:"14px" }}>ðŸ–¥ï¸</Typography>
          <Typography sx={{ fontSize:"17px",fontWeight:700,mb:"8px",letterSpacing:"-0.02em" }}>No accounts connected</Typography>
          <Typography sx={{ fontSize:"13px",color:"rgba(255,255,255,0.35)",mb:"24px",maxWidth:"340px",mx:"auto",lineHeight:1.7 }}>Add your first trading account to start monitoring positions, drawdown and risk in real time.</Typography>
          {planInfo?.can_add ? (
            <Box onClick={()=>setShowModal(true)} sx={{ display:"inline-flex",px:"28px",py:"12px",borderRadius:"12px",cursor:"pointer",fontSize:"13.5px",fontWeight:700,background:"linear-gradient(135deg,#0ea5e9,#6366f1)",color:"white",boxShadow:"0 6px 24px rgba(56,189,248,0.25)","&:hover":{transform:"translateY(-1px)"},transition:"all 0.15s" }}>+ Connect First Account</Box>
          ) : (
            <Box onClick={()=>(window.location.hash="/app/settings")} sx={{ display:"inline-flex",px:"28px",py:"12px",borderRadius:"12px",cursor:"pointer",fontSize:"13.5px",fontWeight:700,background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.3)",color:"#a855f7" }}>âš¡ Upgrade to add accounts</Box>
          )}
        </Box>
      ) : (
        <Grid container spacing="18px" mb="24px">
          {accounts.map(acc=>(
            <Grid item xs={12} sm={6} lg={4} key={acc.id}>
              <AccountCard acc={acc} onLock={handleLock} onView={handleView}
                onDelete={id=>{ const a=accounts.find((x:any)=>x.id===id); setDeleteConfirm({id,name:a?.account_name||`Account #${a?.account_number}`||String(id)}); }}
                refreshing={refreshing} />
            </Grid>
          ))}
        </Grid>
      )}

      {alerts.length>0 && (
        <Box sx={{ ...card,p:"20px 24px",mb:"20px" }}>
          <Typography sx={{ fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em",mb:"14px" }}>ðŸ”” Active Alerts</Typography>
          {alerts.map((a,i)=>(
            <Box key={i} sx={{ display:"flex",alignItems:"center",gap:"12px",py:"10px",borderBottom:i<alerts.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}>
              <Box sx={{ width:6,height:6,borderRadius:"50%",flexShrink:0,background:a.type==="red"?"#ef4444":a.type==="yellow"?"#f59e0b":"#a855f7",boxShadow:`0 0 8px ${a.type==="red"?"#ef4444":a.type==="yellow"?"#f59e0b":"#a855f7"}` }} />
              <Typography sx={{ fontSize:"13px",color:"rgba(255,255,255,0.65)",lineHeight:1.5 }}>{a.msg}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {accounts.length>1 && (
        <Box sx={{ ...card,p:"20px 24px" }}>
          <Box sx={{ display:"flex",justifyContent:"space-between",alignItems:"center",mb:"12px" }}>
            <Typography sx={{ fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em" }}>Combined Risk Exposure</Typography>
            <Typography sx={{ fontSize:"13px",fontWeight:800,color:avgDrawdown>=5?"#ef4444":avgDrawdown>=3?"#f59e0b":"#22c55e" }}>{avgDrawdown.toFixed(1)}% avg drawdown</Typography>
          </Box>
          <LinearProgress variant="determinate" value={Math.min((avgDrawdown/10)*100,100)} sx={{ height:8,borderRadius:4,background:"rgba(255,255,255,0.06)","& .MuiLinearProgress-bar":{borderRadius:4,background:avgDrawdown>=5?"linear-gradient(90deg,#ef4444,#f87171)":avgDrawdown>=3?"linear-gradient(90deg,#f59e0b,#fcd34d)":"linear-gradient(90deg,#22c55e,#38bdf8)"} }} />
          <Box sx={{ display:"flex",justifyContent:"space-between",mt:"6px" }}>
            <Typography sx={{ fontSize:"10px",color:"rgba(255,255,255,0.2)" }}>0% Safe</Typography>
            <Typography sx={{ fontSize:"10px",color:"rgba(255,255,255,0.2)" }}>10% Max</Typography>
          </Box>
        </Box>
      )}

      <AddAccountModal open={showModal} onClose={()=>setShowModal(false)} onAdded={handleAdded} />

      <Modal open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)}>
        <Box sx={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:{xs:"88%",sm:390},background:"#0d1625",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"18px",p:"28px",boxShadow:"0 30px 80px rgba(0,0,0,0.7)" }}>
          <Typography sx={{ fontSize:"22px",mb:"10px" }}>ðŸ—‘ï¸</Typography>
          <Typography sx={{ fontSize:"16px",fontWeight:800,mb:"8px",letterSpacing:"-0.02em" }}>Remove Account</Typography>
          <Typography sx={{ fontSize:"13px",color:"rgba(255,255,255,0.45)",mb:"24px",lineHeight:1.7 }}>
            Remove <span style={{color:"white",fontWeight:700}}>{deleteConfirm?.name}</span>? This cannot be undone and will stop monitoring this account.
          </Typography>
          <Box sx={{ display:"flex",gap:"10px" }}>
            <Box onClick={()=>setDeleteConfirm(null)} sx={{ flex:1,py:"11px",borderRadius:"11px",textAlign:"center",cursor:"pointer",fontSize:"13.5px",fontWeight:700,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.45)","&:hover":{background:"rgba(255,255,255,0.07)"},transition:"all 0.15s" }}>Cancel</Box>
            <Box onClick={()=>{ if(deleteConfirm?.id) handleDelete(deleteConfirm.id); }} sx={{ flex:1,py:"11px",borderRadius:"11px",textAlign:"center",cursor:"pointer",fontSize:"13.5px",fontWeight:700,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.35)",color:"#ef4444","&:hover":{background:"rgba(239,68,68,0.2)",borderColor:"rgba(239,68,68,0.55)"},transition:"all 0.15s" }}>Remove</Box>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}

