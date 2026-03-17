import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Grid, Card, CardContent, Chip,
  LinearProgress, Button, useMediaQuery, useTheme, Dialog, DialogContent,
} from "@mui/material";
import { useLiveTrades } from "../hooks/useLiveTrades";
import MobileDashboard from './MobileDashboard';
import CooldownWidget from './CooldownWidget';
import PropFirmWidget from './PropFirmWidget';
import OnboardingChecklist from './OnboardingChecklist';

interface Alert { id: number; type: 'success' | 'warning' | 'error' | 'info'; message: string; time: Date; }

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const PRESETS      = [{ label:'15m',minutes:15},{label:'30m',minutes:30},{label:'1h',minutes:60},{label:'2h',minutes:120},{label:'4h',minutes:240}];
const REASONS_OVERLAY = [{ key:'revenge',label:'😤 Revenge trade',emoji:'😤'},{key:'loss',label:'📉 Loss limit hit',emoji:'📉'},{key:'manual',label:'🧘 Clear my head',emoji:'🧘'}];
const EXTEND_OPTIONS = [15, 30, 60];
const overlayCard: React.CSSProperties = { borderRadius:'28px', overflow:'hidden', position:'relative' };

// ── safe number helper — kills NaN everywhere ─────────────────────────────
const n = (v: any, fallback = 0): number => { const x = parseFloat(v); return isFinite(x) ? x : fallback; };
const pct = (numerator: any, denominator: any, fallback = 0): number => {
  const d = n(denominator); return d === 0 ? fallback : n(numerator) / d * 100;
};

// ══════════════════════════════════════════════════════════
// RISK LOCK OVERLAY (unchanged from original)
// ══════════════════════════════════════════════════════════
const RiskLockOverlay: React.FC<{
  open:boolean; locked:boolean; timeDisplay:string; progress:number;
  selectedMinutes:number; selectedReason:string;
  onSelectMinutes:(m:number)=>void; onSelectReason:(r:string)=>void;
  onConfirmLock:()=>void; onExtend:(m:number)=>void; onLift:()=>void; onClose:()=>void;
}> = ({ open,locked,timeDisplay,progress,selectedMinutes,selectedReason,onSelectMinutes,onSelectReason,onConfirmLock,onExtend,onLift,onClose }) => (
  <Dialog open={open} maxWidth={false} fullWidth onClose={locked ? undefined : onClose}
    PaperProps={{ sx:{ background:'transparent', boxShadow:'none', maxWidth:'460px', mx:'auto' } }}
    BackdropProps={{ sx:{ background:'rgba(0,0,0,0.88)', backdropFilter:'blur(10px)' } }}>
    <DialogContent sx={{ p:0 }}>
      <Box sx={{ ...overlayCard, background:locked?'linear-gradient(145deg,#0f1729,#1a0a0a)':'linear-gradient(145deg,#0f1729,#0a1a14)', border:`1px solid ${locked?'rgba(239,68,68,0.35)':'rgba(56,189,248,0.25)'}`, boxShadow:locked?'0 0 60px rgba(239,68,68,0.18),0 0 120px rgba(239,68,68,0.07)':'0 0 60px rgba(56,189,248,0.12)', '&::before':{ content:'""',position:'absolute',top:0,left:0,right:0,height:'3px', background:locked?'linear-gradient(90deg,transparent,#ef4444,#f97316,transparent)':'linear-gradient(90deg,transparent,#38bdf8,#22c55e,transparent)' } }}>

        {locked && (
          <Box sx={{ position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none' }}>
            {[1,2,3].map(i=>(
              <Box key={i} sx={{ position:'absolute',top:'50%',left:'50%', width:`${i*200}px`,height:`${i*200}px`, borderRadius:'50%',border:'1px solid rgba(239,68,68,0.05)', transform:'translate(-50%,-50%)', animation:`ring${i} ${2+i*0.5}s ease-in-out infinite alternate`, [`@keyframes ring${i}`]:{ from:{opacity:0.3,transform:'translate(-50%,-50%) scale(0.95)'}, to:{opacity:0.8,transform:'translate(-50%,-50%) scale(1.05)'} } }} />
            ))}
          </Box>
        )}

        <Box sx={{ position:'relative',p:{xs:3,sm:4},textAlign:'center' }}>
          {!locked && (
            <>
              <Box sx={{ width:72,height:72,borderRadius:'20px',mx:'auto',mb:2.5,background:'rgba(56,189,248,0.12)',border:'1px solid rgba(56,189,248,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'36px' }}>🔒</Box>
              <Typography sx={{ fontSize:'20px',fontWeight:800,color:'white',mb:0.5 }}>Set Risk Lock</Typography>
              <Typography sx={{ fontSize:'13px',color:'rgba(255,255,255,0.4)',mb:3 }}>Choose duration and reason before locking</Typography>
              <Typography sx={{ fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.12em',textTransform:'uppercase',mb:1.5,textAlign:'left' }}>Duration</Typography>
              <Box sx={{ display:'flex',gap:1,mb:3,flexWrap:'wrap' }}>
                {PRESETS.map(p=>(
                  <Box key={p.minutes} onClick={()=>onSelectMinutes(p.minutes)} sx={{ flex:1,minWidth:'52px',py:1.2,borderRadius:'12px',cursor:'pointer',fontWeight:800,fontSize:'14px',textAlign:'center', background:selectedMinutes===p.minutes?'rgba(239,68,68,0.18)':'rgba(255,255,255,0.05)', border:`1px solid ${selectedMinutes===p.minutes?'rgba(239,68,68,0.55)':'rgba(255,255,255,0.1)'}`, color:selectedMinutes===p.minutes?'#ef4444':'rgba(255,255,255,0.55)', transition:'all 0.15s','&:hover':{background:'rgba(239,68,68,0.12)',borderColor:'rgba(239,68,68,0.3)',color:'#ef4444'} }}>{p.label}</Box>
                ))}
              </Box>
              <Box sx={{ display:'flex',alignItems:'center',gap:1.5,mb:3 }}>
                <Box sx={{ flex:1,height:'1px',background:'rgba(255,255,255,0.08)' }} />
                <Typography sx={{ fontSize:'11px',color:'rgba(255,255,255,0.25)',whiteSpace:'nowrap' }}>or enter custom</Typography>
                <Box sx={{ flex:1,height:'1px',background:'rgba(255,255,255,0.08)' }} />
              </Box>
              <Box sx={{ display:'flex',alignItems:'center',gap:1,mb:3 }}>
                <Box component="input" type="number" min={1} max={480} placeholder="e.g. 45" onChange={(e:React.ChangeEvent<HTMLInputElement>)=>{ const v=parseInt(e.target.value); if(v>0&&v<=480) onSelectMinutes(v); }} sx={{ flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'12px',color:'white',fontSize:'14px',fontWeight:600,px:2,py:1.2,outline:'none',fontFamily:'"DM Mono",monospace','&:focus':{borderColor:'rgba(239,68,68,0.5)'},'&::placeholder':{color:'rgba(255,255,255,0.2)'} }} />
                <Typography sx={{ fontSize:'13px',color:'rgba(255,255,255,0.4)',minWidth:'55px',textAlign:'left' }}>minutes</Typography>
              </Box>
              <Typography sx={{ fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.12em',textTransform:'uppercase',mb:1.5,textAlign:'left' }}>Reason</Typography>
              <Box sx={{ display:'flex',gap:1,mb:3.5 }}>
                {REASONS_OVERLAY.map(r=>(
                  <Box key={r.key} onClick={()=>onSelectReason(r.key)} sx={{ flex:1,py:1.2,px:1,borderRadius:'12px',cursor:'pointer',textAlign:'center', background:selectedReason===r.key?'rgba(56,189,248,0.12)':'rgba(255,255,255,0.04)', border:`1px solid ${selectedReason===r.key?'rgba(56,189,248,0.4)':'rgba(255,255,255,0.08)'}`, transition:'all 0.15s','&:hover':{borderColor:'rgba(56,189,248,0.3)'} }}>
                    <Typography sx={{ fontSize:'18px',mb:0.3 }}>{r.emoji}</Typography>
                    <Typography sx={{ fontSize:'10px',fontWeight:600,color:selectedReason===r.key?'#38bdf8':'rgba(255,255,255,0.4)',lineHeight:1.2 }}>{r.label.replace(r.emoji+' ','')}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ mb:3,p:2,borderRadius:'14px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.18)' }}>
                <Typography sx={{ fontSize:'13px',color:'rgba(255,255,255,0.6)',fontWeight:600 }}>🔒 Lock for <span style={{color:'#ef4444'}}>{selectedMinutes>=60?`${selectedMinutes/60}h`:`${selectedMinutes}m`}</span> · New trades will be auto-closed within 3s</Typography>
              </Box>
              <Box sx={{ display:'flex',gap:1.5 }}>
                <Button onClick={onClose} sx={{ flex:1,py:1.5,borderRadius:'14px',textTransform:'none',fontWeight:700,border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.4)','&:hover':{background:'rgba(255,255,255,0.06)',color:'white'} }}>Cancel</Button>
                <Button onClick={onConfirmLock} sx={{ flex:2,py:1.5,borderRadius:'14px',textTransform:'none',fontWeight:800,fontSize:'14px',background:'linear-gradient(135deg,#ef4444,#f97316)',color:'white','&:hover':{transform:'translateY(-1px)',boxShadow:'0 6px 20px rgba(239,68,68,0.4)'} }}>🛑 Activate Lock</Button>
              </Box>
            </>
          )}

          {locked && (
            <>
              <Box sx={{ width:76,height:76,borderRadius:'22px',mx:'auto',mb:2.5,background:'linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.07))',border:'1px solid rgba(239,68,68,0.35)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'38px',animation:'lockPulse 2s ease-in-out infinite','@keyframes lockPulse':{'0%,100%':{boxShadow:'0 0 18px rgba(239,68,68,0.2)'},'50%':{boxShadow:'0 0 38px rgba(239,68,68,0.5)'}} }}>🔒</Box>
              <Typography sx={{ fontSize:'21px',fontWeight:800,color:'white',mb:0.4 }}>Risk Lock Active</Typography>
              <Typography sx={{ fontSize:'13px',color:'rgba(255,255,255,0.38)',mb:3 }}>New positions will be auto-closed instantly</Typography>
              <Box sx={{ mb:2.5,p:3,borderRadius:'20px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.15)' }}>
                <Typography sx={{ fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',letterSpacing:'0.15em',textTransform:'uppercase',mb:1 }}>Time Remaining</Typography>
                <Typography sx={{ fontSize:'50px',fontWeight:800,fontFamily:'"DM Mono",monospace',color:'#ef4444',lineHeight:1,mb:0.5,textShadow:'0 0 28px rgba(239,68,68,0.5)',animation:'countPulse 1s ease-in-out infinite','@keyframes countPulse':{'0%,100%':{opacity:1},'50%':{opacity:0.7}} }}>{timeDisplay||'…'}</Typography>
                <Box sx={{ mt:2,height:6,borderRadius:3,background:'rgba(255,255,255,0.06)',overflow:'hidden' }}>
                  <Box sx={{ height:'100%',borderRadius:3,width:`${progress}%`,background:'linear-gradient(90deg,#ef4444,#f97316)',boxShadow:'0 0 10px rgba(239,68,68,0.6)',transition:'width 1s linear' }} />
                </Box>
              </Box>
              <Typography sx={{ fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.3)',letterSpacing:'0.12em',textTransform:'uppercase',mb:1.2 }}>+ Extend Time</Typography>
              <Box sx={{ display:'flex',gap:1,mb:2.5 }}>
                {EXTEND_OPTIONS.map(m=>(
                  <Box key={m} onClick={()=>onExtend(m)} sx={{ flex:1,py:1,borderRadius:'10px',cursor:'pointer',textAlign:'center',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',color:'#f59e0b',fontSize:'13px',fontWeight:700,transition:'all 0.15s','&:hover':{background:'rgba(245,158,11,0.18)',borderColor:'rgba(245,158,11,0.4)'} }}>+{m>=60?`${m/60}h`:`${m}m`}</Box>
                ))}
              </Box>
              <Box sx={{ mb:2.5,p:2,borderRadius:'12px',background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.18)' }}>
                <Typography sx={{ fontSize:'12px',color:'rgba(245,158,11,0.85)',fontWeight:600 }}>⚠️ Any new MT5 position opened right now will be closed automatically within 3 seconds</Typography>
              </Box>
              <Button onClick={onLift} fullWidth sx={{ py:1.6,borderRadius:'14px',textTransform:'none',fontWeight:700,fontSize:'14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.14)',color:'rgba(255,255,255,0.6)','&:hover':{background:'rgba(255,255,255,0.1)',color:'white',borderColor:'rgba(255,255,255,0.28)'} }}>🔓 Lift Risk Lock Early</Button>
            </>
          )}
        </Box>
      </Box>
    </DialogContent>
  </Dialog>
);

// ══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════
const RiskDashboardClean: React.FC = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ── Live data from default account (Deriv WS or MT5) ──
  const live = useLiveTrades();
  const balance         = n(live.balance);
  const equity          = n(live.equity, balance);
  const dailyPnl        = n(live.dailyPnl);
  const dailyPnlPct     = n(live.dailyPnlPct);
  const activePositions = n(live.activePositions);
  const connected       = live.connected;
  const currency        = live.currency || "USD";

  const [settings,      setSettings]      = useState<any>(null);
  const [lastUpdate,    setLastUpdate]     = useState(new Date());
  const [alerts,        setAlerts]         = useState<Alert[]>([]);
  const [actionLoading, setActionLoading]  = useState('');

  const [lockEndsAt,    setLockEndsAt]    = useState<number>(0);
  const [lockDuration,  setLockDuration]  = useState<number>(60);
  const [timeDisplay,   setTimeDisplay]   = useState('');
  const [progress,      setProgress]      = useState(100);
  const [showOverlay,   setShowOverlay]   = useState(false);
  const [overlayLocked, setOverlayLocked] = useState(false);
  const [pickerMinutes, setPickerMinutes] = useState(60);
  const [pickerReason,  setPickerReason]  = useState('manual');

  const lockActive = lockEndsAt > Date.now();

  // ── Lock countdown ──────────────────────────────────────
  const fiveMinWarnedRef = React.useRef(false);
  useEffect(() => { fiveMinWarnedRef.current = false; }, [lockEndsAt]);

  useEffect(() => {
    if (!lockEndsAt) return;
    const totalMs = lockDuration * 60 * 1000;
    const tick = () => {
      const diff = lockEndsAt - Date.now();
      if (diff <= 0) { setLockEndsAt(0); setShowOverlay(false); setTimeDisplay(''); setProgress(0); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeDisplay(h > 0 ? `${h}h ${m}m ${String(s).padStart(2,'0')}s` : `${m}m ${String(s).padStart(2,'0')}s`);
      setProgress(Math.max(0, Math.min(100, (diff / totalMs) * 100)));
      if (diff <= 5*60*1000 && diff > 4.9*60*1000 && !fiveMinWarnedRef.current) {
        fiveMinWarnedRef.current = true;
        playAlertSound('warning');
        addAlert('warning','⏰ Risk Lock expires in 5 minutes');
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lockEndsAt, lockDuration]);

  // ── Cooldown status, alerts, settings ──────────────────
  const fetchCooldownStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(`${API}/api/v1/cooldown/status`, { headers:{ Authorization:`Bearer ${token}` } });
      const data  = await res.json();
      if (data.active && data.ends_at) {
        const ms = new Date(data.ends_at).getTime();
        if (ms > Date.now()) { setLockEndsAt(ms); setLockDuration(data.minutes_remaining||60); setOverlayLocked(true); setShowOverlay(true); }
      } else { setLockEndsAt(0); setShowOverlay(false); setOverlayLocked(false); }
    } catch {}
  }, []);

  useEffect(() => {
    fetch(`${API}/api/v1/settings/`).then(r=>r.json()).then(setSettings).catch(()=>{});
    fetchCooldownStatus();
    const fetchAlerts = async () => {
      try {
        const res  = await fetch(`${API}/api/v1/alerts-live/recent`);
        const data = await res.json();
        if (data.alerts) setAlerts(data.alerts.map((a:any)=>({ id:a.id, type:a.type, message:a.message, time:new Date(a.time) })));
      } catch {}
    };
    fetchAlerts();
    const iv1 = setInterval(fetchAlerts,      5_000);
    const iv2 = setInterval(fetchCooldownStatus, 30_000);
    const iv3 = setInterval(()=>setLastUpdate(new Date()), 1_000);
    return () => { clearInterval(iv1); clearInterval(iv2); clearInterval(iv3); };
  }, [fetchCooldownStatus]);

  // ── Sounds ──────────────────────────────────────────────
  const playAlertSound = (type:'warning'|'unlock'='warning') => {
    try {
      const ctx  = new (window.AudioContext||(window as any).webkitAudioContext)();
      const gain = ctx.createGain(); gain.connect(ctx.destination);
      if (type==='warning') {
        [0,0.18,0.36].forEach((delay,i)=>{
          const osc=ctx.createOscillator(); const g=ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.frequency.value=880-i*110; osc.type='sine';
          g.gain.setValueAtTime(0,ctx.currentTime+delay);
          g.gain.linearRampToValueAtTime(0.25,ctx.currentTime+delay+0.01);
          g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.35);
          osc.start(ctx.currentTime+delay); osc.stop(ctx.currentTime+delay+0.4);
        });
      } else {
        const osc=ctx.createOscillator(); osc.connect(gain);
        osc.frequency.setValueAtTime(440,ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(880,ctx.currentTime+0.3);
        osc.type='sine'; gain.gain.setValueAtTime(0.2,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.6);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.65);
      }
    } catch {}
  };

  const addAlert = (type:Alert['type'],message:string) =>
    setAlerts(prev=>[{ id:Date.now(),type,message,time:new Date() },...prev]);

  const logLockToJournal = (reason:string,minutes:number,triggeredBy='button') => {
    const token=localStorage.getItem('access_token');
    fetch(`${API}/api/v1/journal/lock-event`,{ method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token??''}`}, body:JSON.stringify({ reason,duration_minutes:minutes,triggered_by:triggeredBy,daily_loss_at_trigger:dailyPnl }) }).catch(()=>{});
  };

  // ── Lock handlers ────────────────────────────────────────
  const handleRiskLock = () => {
    if (lockActive) { setOverlayLocked(true); setShowOverlay(true); return; }
    setPickerMinutes(60); setPickerReason('manual'); setOverlayLocked(false); setShowOverlay(true);
  };

  const handleConfirmLock = () => {
    const MINUTES=pickerMinutes; const endsAtMs=Date.now()+MINUTES*60*1000;
    setLockEndsAt(endsAtMs); setLockDuration(MINUTES); setOverlayLocked(true);
    addAlert('warning',`🔒 Risk Lock ON — ${MINUTES>=60?`${MINUTES/60}h`:`${MINUTES}m`} cooldown.`);
    localStorage.setItem('rg_lock_activated','true');
    const token=localStorage.getItem('access_token');
    Promise.all([
      fetch(`${API}/api/v1/cooldown/start`,{ method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({ minutes:MINUTES,reason:pickerReason,notes:'Activated via Risk Lock button' }) })
        .then(r=>r.json()).then(data=>{ if(data.ends_at){ const ms=new Date(data.ends_at).getTime(); if(ms>Date.now()) setLockEndsAt(ms); } }).catch(()=>{}),
      fetch(`${API}/api/v1/trading/lock/with-duration?minutes=${MINUTES}`,{ method:'POST',headers:{'Content-Type':'application/json'} })
        .then(r=>r.json()).then(data=>{ if(!data.success) addAlert('error','⚠️ MT5 watcher failed to start'); }).catch(()=>{ addAlert('error','⚠️ Could not start MT5 auto-close watcher'); }),
    ]);
    logLockToJournal(pickerReason,MINUTES,'button');
  };

  const handleExtend = (extraMinutes:number) => {
    const newEndsAt=Math.max(lockEndsAt,Date.now())+extraMinutes*60*1000;
    setLockEndsAt(newEndsAt); setLockDuration(lockDuration+extraMinutes);
    addAlert('info',`⏱ Lock extended by ${extraMinutes}m`);
    const token=localStorage.getItem('access_token');
    const rem=Math.ceil((newEndsAt-Date.now())/60000);
    fetch(`${API}/api/v1/cooldown/start`,{ method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({ minutes:rem,reason:pickerReason,notes:`Extended by ${extraMinutes}m` }) }).catch(()=>{});
  };

  const handleLiftLock = async () => {
    const token=localStorage.getItem('access_token');
    try {
      await fetch(`${API}/api/v1/cooldown/stop`,{ method:'POST',headers:{ Authorization:`Bearer ${token}` } });
      await fetch(`${API}/api/v1/trading/unlock`,{ method:'POST',headers:{'Content-Type':'application/json'} }).catch(()=>{});
      setLockEndsAt(0); setTimeDisplay(''); setShowOverlay(false); setOverlayLocked(false);
      playAlertSound('unlock'); addAlert('success','🔓 Risk Lock lifted — trading is now normal');
    } catch { addAlert('error','❌ Could not lift lock'); }
  };

  const handleCooldownStarted = (endsAtMs:number,minutes:number) => {
    setLockEndsAt(endsAtMs); setLockDuration(minutes); setOverlayLocked(true); setShowOverlay(true);
    addAlert('warning',`🔒 Risk Lock ON — ${minutes>=60?`${minutes/60}h`:`${minutes}m`} cooldown.`);
    fetch(`${API}/api/v1/trading/lock/with-duration?minutes=${minutes}`,{ method:'POST',headers:{'Content-Type':'application/json'} })
      .then(r=>r.json()).then(data=>{ if(!data.success) addAlert('error','⚠️ MT5 watcher failed to start'); }).catch(()=>{ addAlert('error','⚠️ Could not reach MT5 watcher'); });
  };

  const handleCooldownStopped = () => {
    setLockEndsAt(0); setShowOverlay(false);
    addAlert('success','🔓 Cooldown cancelled');
    fetch(`${API}/api/v1/trading/unlock`,{ method:'POST',headers:{'Content-Type':'application/json'} }).catch(()=>{});
  };

  const handleCloseAll = async () => {
    if (!window.confirm('⚠️ Close ALL open positions?')) return;
    setActionLoading('close');
    try {
      const res=await fetch(`${API}/api/v1/positions/close-all`,{ method:'POST',headers:{'Content-Type':'application/json'} });
      const data=await res.json();
      if (res.ok&&data.success) addAlert('success',`✅ ${data.message}`);
      else { addAlert('error',`❌ ${data.detail||data.message}`); data.errors?.forEach((e:string)=>addAlert('error',e)); }
    } catch { addAlert('error','❌ Could not reach backend'); }
    finally  { setActionLoading(''); }
  };

  const handleExportReport = async () => {
    setActionLoading('export');
    try {
      const res=await fetch(`${API}/api/v1/reports/export`);
      if (res.ok) {
        const blob=await res.blob(); const url=window.URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download=`report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
        addAlert('success','📊 Report exported!');
      } else addAlert('info','Export coming soon');
    } catch { addAlert('info','Export coming soon'); }
    finally  { setActionLoading(''); }
  };

  const handleRefreshData = () => { addAlert('info','🔄 Refreshing...'); setTimeout(()=>window.location.reload(),500); };

  if (isMobile) return <MobileDashboard />;

  // ── Risk calculations — all NaN-safe ────────────────────
  const maxDrawdown  = balance > 0 ? Math.abs((balance - equity) / balance * 100) : 0;
  const riskPerTrade = activePositions > 0 && balance > 0 ? Math.abs(dailyPnl / activePositions / balance * 100) : 0;
  const equityPct    = balance > 0 ? (equity / balance * 100) : 100;  // 100% when no data yet

  const calculateRiskScore = () => {
    let score = 0;
    score += Math.min(Math.abs(dailyPnlPct) / (n(settings?.dailyLoss,2)),    1) * 40;
    score += Math.min(maxDrawdown           / (n(settings?.maxDD,5)),         1) * 35;
    score += Math.min(activePositions       / 5,                              1) * 25;
    return Math.round(score);
  };
  const riskScore = calculateRiskScore();
  const riskColor = riskScore < 40 ? '#22c55e' : riskScore < 70 ? '#f59e0b' : '#ef4444';

  const cardStyle = {
    background:'rgba(255,255,255,0.04)', backdropFilter:'blur(20px)',
    border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px',
    position:'relative' as const, overflow:'hidden', transition:'all 0.3s ease',
    '&:hover':{ transform:'translateY(-8px)', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' },
  };

  const buttons = [
    { key:'close',  label:'🚫 Close All',    color:'#ef4444', fn:handleCloseAll },
    { key:'lock',   label:lockActive?`🔒 LOCKED · ${timeDisplay}`:'🔒 Risk Lock', color:lockActive?'#ef4444':'#f59e0b', fn:handleRiskLock },
    { key:'export', label:'📊 Export Report', color:'#64b5f6', fn:handleExportReport },
    { key:'refresh',label:'🔄 Refresh Data',  color:'#22c55e', fn:handleRefreshData },
  ];

  // ── Connection badge label ──────────────────────────────
  const connLabel = connected ? (live.accountName?.startsWith('CR') || live.accountName?.startsWith('VR') ? 'DERIV LIVE' : 'MT5 LIVE') : 'DISCONNECTED';

  return (
    <Box sx={{ minHeight:'100vh', p:{xs:2,md:4}, background:'radial-gradient(circle at 20% 20%,rgba(34,197,94,0.08),transparent 40%),radial-gradient(circle at 80% 0%,rgba(59,130,246,0.08),transparent 40%),#0b1120', color:'white', fontFamily:'"DM Sans",sans-serif' }}>

      <RiskLockOverlay open={showOverlay} locked={overlayLocked} timeDisplay={timeDisplay} progress={progress} selectedMinutes={pickerMinutes} selectedReason={pickerReason} onSelectMinutes={setPickerMinutes} onSelectReason={setPickerReason} onConfirmLock={handleConfirmLock} onExtend={handleExtend} onLift={handleLiftLock} onClose={()=>setShowOverlay(false)} />

      {/* ── Header ── */}
      <Box sx={{ display:'flex',justifyContent:'space-between',alignItems:'center',mb:4 }}>
        <Box>
          <Typography sx={{ fontSize:{xs:'28px',md:'36px'},fontWeight:800,mb:0.5,background:'linear-gradient(90deg,#38bdf8,#22c55e)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',letterSpacing:'-0.02em' }}>Risk Guardian</Typography>
          <Typography sx={{ color:'rgba(255,255,255,0.4)',fontSize:'13px' }}>Professional Trading Dashboard</Typography>
        </Box>
        <Box sx={{ display:'flex',alignItems:'center',gap:2 }}>
          {lockActive && (
            <Box onClick={()=>setShowOverlay(true)} sx={{ px:2.5,py:1,borderRadius:'12px',cursor:'pointer',background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.35)','&:hover':{background:'rgba(239,68,68,0.2)'} }}>
              <Typography sx={{ fontSize:'12px',fontWeight:800,color:'#ef4444',letterSpacing:'0.06em' }}>🔒 RISK LOCK · {timeDisplay}</Typography>
            </Box>
          )}
          {/* Connection badge */}
          <Box sx={{ display:'flex',alignItems:'center',gap:1.5,px:2.5,py:1.2,borderRadius:'14px', background:connected?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${connected?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}` }}>
            <Box sx={{ width:10,height:10,borderRadius:'50%', background:connected?'#22c55e':'#ef4444', boxShadow:connected?'0 0 10px #22c55e':'0 0 10px #ef4444', animation:connected?'livePulse 2s ease-in-out infinite':'none', '@keyframes livePulse':{'0%,100%':{opacity:1},'50%':{opacity:0.4}} }} />
            <Box>
              <Typography sx={{ fontSize:'13px',fontWeight:700,color:connected?'#22c55e':'#ef4444' }}>{connLabel}</Typography>
              <Typography sx={{ fontSize:'10px',color:'rgba(255,255,255,0.3)',fontFamily:'monospace' }}>
                {connected ? (live.lastUpdated?.toLocaleTimeString() ?? lastUpdate.toLocaleTimeString()) : lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <OnboardingChecklist connected={connected} settings={settings} />

      {/* ── Stats cards — all NaN-safe ── */}
      <Grid container spacing={3} sx={{ mb:3 }}>
        {[
          {
            label:'Account Balance',
            value:`$${balance.toFixed(2)}`,
            subValue: currency,
            color:'#64b5f6', icon:'💰',
          },
          {
            label:'Current Equity',
            value:`$${equity.toFixed(2)}`,
            subValue:`${equityPct.toFixed(1)}%`,
            color:'#81c784', icon:'📊',
          },
          {
            label:'Daily P&L',
            value:`${dailyPnl>=0?'+':''}$${dailyPnl.toFixed(2)}`,
            subValue:`${dailyPnlPct>=0?'+':''}${dailyPnlPct.toFixed(2)}%`,
            color:dailyPnl>=0?'#22c55e':'#ef4444', icon:dailyPnl>=0?'📈':'📉',
          },
          {
            label:'Active Positions',
            value:activePositions.toString(),
            subValue:activePositions>0?'Open':'None',
            color:'#ce93d8', icon:'📋',
          },
        ].map((stat,idx)=>(
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Card sx={{ ...cardStyle,'&::before':{ content:'""',position:'absolute',top:0,left:0,right:0,height:'3px',background:`linear-gradient(90deg,transparent,${stat.color},transparent)` } }}>
              <CardContent sx={{ p:3 }}>
                <Box sx={{ position:'absolute',top:16,right:16,fontSize:'32px',opacity:0.15 }}>{stat.icon}</Box>
                <Typography sx={{ fontSize:'11px',fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.5)',mb:1.5 }}>{stat.label}</Typography>
                <Typography sx={{ fontSize:'28px',fontWeight:700,color:stat.label==='Daily P&L'?stat.color:'#fff',lineHeight:1,fontFamily:'"DM Mono",monospace',mb:0.5 }}>{stat.value}</Typography>
                <Typography sx={{ fontSize:'12px',color:'rgba(255,255,255,0.4)',fontFamily:'"DM Mono",monospace' }}>{stat.subValue}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Middle ── */}
      <Grid container spacing={3} sx={{ mb:3 }}>
        <Grid item xs={12} md={5}>
          <Card sx={{ ...cardStyle,p:4,'&::before':{ content:'""',position:'absolute',top:0,left:0,right:0,height:'3px',background:`linear-gradient(90deg,transparent,${riskColor},transparent)` } }}>
            <Typography sx={{ fontSize:'11px',fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.5)',mb:3 }}>Risk Level Monitor</Typography>
            <Box sx={{ display:'flex',justifyContent:'center',mb:3 }}>
              <Box sx={{ width:180,height:180,borderRadius:'50%', background:`conic-gradient(${riskColor} ${riskScore}%,rgba(255,255,255,0.1) ${riskScore}%)`, display:'flex',alignItems:'center',justifyContent:'center',position:'relative', '&::before':{ content:'""',position:'absolute',width:144,height:144,borderRadius:'50%',background:'rgba(11,17,32,0.95)' } }}>
                <Box sx={{ position:'relative',textAlign:'center' }}>
                  <Typography sx={{ fontSize:'42px',fontWeight:800,color:riskColor,fontFamily:'"DM Mono",monospace' }}>{riskScore}</Typography>
                  <Typography sx={{ fontSize:'12px',color:'rgba(255,255,255,0.5)',fontWeight:600 }}>{riskScore<40?'LOW RISK':riskScore<70?'MEDIUM':'HIGH RISK'}</Typography>
                </Box>
              </Box>
            </Box>
            {[
              { label:'Daily Loss',     value:Math.abs(dailyPnlPct), limit:n(settings?.dailyLoss,2) },
              { label:'Max Drawdown',   value:maxDrawdown,            limit:n(settings?.maxDD,5)     },
              { label:'Risk per Trade', value:riskPerTrade,           limit:n(settings?.riskPerTrade,1) },
            ].map((rule,idx)=>(
              <Box key={idx} sx={{ mb:2 }}>
                <Box sx={{ display:'flex',justifyContent:'space-between',mb:0.8 }}>
                  <Typography sx={{ fontSize:'11px',letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.5)' }}>{rule.label}</Typography>
                  <Typography sx={{ fontSize:'12px',fontFamily:'"DM Mono",monospace',color:riskColor }}>{rule.value.toFixed(1)} / {rule.limit}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={Math.min((rule.value/rule.limit)*100,100)} sx={{ height:6,borderRadius:3,background:'rgba(255,255,255,0.06)','& .MuiLinearProgress-bar':{ borderRadius:3,background:`linear-gradient(90deg,${riskColor}88,${riskColor})` } }} />
              </Box>
            ))}
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Box sx={{ display:'flex',flexDirection:'column',gap:2,height:'100%' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><CooldownWidget externalLockEndsAt={lockActive?lockEndsAt:undefined} onCooldownStarted={handleCooldownStarted} onCooldownStopped={handleCooldownStopped} /></Grid>
              <Grid item xs={12} sm={6}><PropFirmWidget /></Grid>
            </Grid>
            <Card sx={{ ...cardStyle,flex:1,p:3,'&::before':{ content:'""',position:'absolute',top:0,left:0,right:0,height:'3px',background:'linear-gradient(90deg,transparent,#64b5f6,transparent)' } }}>
              <Box sx={{ display:'flex',justifyContent:'space-between',alignItems:'center',mb:2 }}>
                <Typography sx={{ fontSize:'11px',fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.5)' }}>Live Alerts ({alerts.length})</Typography>
                <Chip label="REAL-TIME" size="small" sx={{ height:'22px',fontSize:'10px',fontWeight:600,background:'rgba(100,181,246,0.15)',color:'#64b5f6',border:'1px solid rgba(100,181,246,0.3)' }} />
              </Box>
              <Box sx={{ maxHeight:200,overflowY:'auto' }}>
                {alerts.length===0 ? (
                  <Box sx={{ py:4,textAlign:'center' }}>
                    <Typography sx={{ fontSize:'36px',opacity:0.2,mb:1 }}>🔔</Typography>
                    <Typography sx={{ fontSize:'14px',color:'rgba(255,255,255,0.3)' }}>No recent activity</Typography>
                  </Box>
                ) : alerts.map(alert=>(
                  <Box key={alert.id} sx={{ mb:1.5,p:1.5,borderRadius:'10px',background:'rgba(255,255,255,0.03)', border:`1px solid ${alert.type==='success'?'rgba(34,197,94,0.2)':alert.type==='warning'?'rgba(245,158,11,0.2)':alert.type==='error'?'rgba(239,68,68,0.2)':'rgba(100,181,246,0.2)'}`, borderLeft:`4px solid ${alert.type==='success'?'#22c55e':alert.type==='warning'?'#f59e0b':alert.type==='error'?'#ef4444':'#64b5f6'}` }}>
                    <Typography sx={{ fontSize:'12px',color:'#fff',mb:0.3 }}>{alert.message}</Typography>
                    <Typography sx={{ fontSize:'10px',color:'rgba(255,255,255,0.3)',fontFamily:'monospace' }}>{alert.time.toLocaleTimeString()}</Typography>
                  </Box>
                ))}
              </Box>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* ── Quick Actions ── */}
      <Box sx={{ background:'rgba(255,255,255,0.04)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'20px',p:3,display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center' }}>
        {buttons.map(btn=>(
          <Button id={btn.key==='lock'?'rg-risk-lock-btn':undefined} key={btn.key} onClick={btn.fn} disabled={actionLoading===btn.key} sx={{ px:3,py:1.5,borderRadius:'12px', background:actionLoading===btn.key?'rgba(255,255,255,0.05)':btn.key==='lock'&&lockActive?`${btn.color}25`:`${btn.color}15`, border:`1px solid ${btn.color}${btn.key==='lock'&&lockActive?'60':'30'}`, color:actionLoading===btn.key?'rgba(255,255,255,0.3)':btn.color, fontSize:'13px',fontWeight:600,transition:'all 0.2s', boxShadow:btn.key==='lock'&&lockActive?`0 0 20px ${btn.color}30`:'none', '&:hover':{ background:`${btn.color}25`,transform:'translateY(-2px)',boxShadow:`0 8px 20px ${btn.color}30` }, '&:disabled':{ cursor:'not-allowed' } }}>
            {actionLoading===btn.key?'⏳ Working...':btn.label}
          </Button>
        ))}
      </Box>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
    </Box>
  );
};

export default RiskDashboardClean;



