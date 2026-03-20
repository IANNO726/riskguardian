import React, { useEffect, useState } from "react";
import { Box, Typography, Grid } from "@mui/material";
import { useLiveTrades } from "../hooks/useLiveTrades";
import { TrendingUp, TrendingDown } from "@mui/icons-material";

const Terminal: React.FC = () => {
  const { balance, equity, dailyPnl, dailyPnlPct, connected, activePositions, positions: rawPositions } = useLiveTrades();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [tick, setTick] = useState(0);

  // �”€�”€ Always a safe array �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
  const positions = Array.isArray(rawPositions) ? rawPositions : [];

  useEffect(() => {
    if (balance !== null) setLastUpdate(new Date());
  }, [balance, equity]);

  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  const liveBalance    = balance     ?? 10000;
  const liveEquity     = equity      ?? 10218;
  const liveProfit     = dailyPnl    ?? 0;
  const liveProfitPct  = dailyPnlPct ?? 0;

  // These are now SAFE �€” positions is always []
  const floatingPnl         = positions.reduce((s, p) => s + (p.profit ?? 0), 0);
  const totalPositionProfit = positions.reduce((s, p) => s + Math.max(p.profit ?? 0, 0), 0);
  const totalPositionLoss   = positions.reduce((s, p) => s + Math.min(p.profit ?? 0, 0), 0);

  return (
    <Box sx={{
      minHeight: '100vh',
      p: { xs: 2, sm: 3, md: 4 },
      background: 'radial-gradient(ellipse at 10% 0%,rgba(56,189,248,0.07),transparent 45%), radial-gradient(ellipse at 90% 10%,rgba(168,85,247,0.05),transparent 45%), radial-gradient(ellipse at 50% 100%,rgba(34,197,94,0.04),transparent 50%), #0b1120',
      color: 'white',
    }}>

      {/* Header */}
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:{ xs:3, md:4 }, flexWrap:'wrap', gap:2 }}>
        <Box>
          <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:0.5 }}>
            <Box sx={{ width:4, height:36, borderRadius:2, background:'linear-gradient(180deg,#38bdf8,#a855f7)' }} />
            <Typography sx={{ fontSize:{ xs:'22px', md:'30px' }, fontWeight:800, background:'linear-gradient(90deg,#38bdf8,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'-0.02em' }}>
              Live Terminal
            </Typography>
          </Box>
          <Typography sx={{ color:'rgba(255,255,255,0.35)', fontSize:'14px', ml:'20px' }}>
            Real-time MT5 position monitor
          </Typography>
        </Box>
        <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
          <Typography sx={{ fontSize:'13px', color:'rgba(255,255,255,0.25)', fontFamily:'"Roboto Mono",monospace' }}>
            {lastUpdate.toLocaleTimeString()}
          </Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:1, px:2.5, py:1, borderRadius:'12px',
            background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border:`1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <Box sx={{ width:7, height:7, borderRadius:'50%',
              background: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 8px #22c55e' : 'none',
              animation: connected ? 'livePulse 2s infinite' : 'none',
              '@keyframes livePulse': { '0%,100%':{ opacity:1 }, '50%':{ opacity:0.3 } } }} />
            <Typography sx={{ fontSize:'12px', fontWeight:800, color: connected ? '#22c55e' : '#ef4444', letterSpacing:'0.08em' }}>
              {connected ? 'MT5 LIVE' : 'DISCONNECTED'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={{ xs:1.5, md:2.5 }} sx={{ mb:{ xs:3, md:4 } }}>

        {/* Balance */}
        <Grid item xs={6} md={3}>
          <Box sx={{ p:{ xs:2, md:3 }, borderRadius:'20px', background:'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(56,189,248,0.03))', border:'1px solid rgba(56,189,248,0.2)', position:'relative', overflow:'hidden', transition:'all 0.3s', '&:hover':{ transform:'translateY(-4px)', boxShadow:'0 16px 40px rgba(56,189,248,0.12)' }, '&::before':{ content:'""', position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,transparent,#38bdf8,transparent)' } }}>
            <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <Box>
                <Typography sx={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', mb:1 }}>Balance</Typography>
                <Typography sx={{ fontSize:{ xs:'20px', md:'26px' }, fontWeight:800, color:'#fff', fontFamily:'"Roboto Mono",monospace', lineHeight:1 }}>
                  ${liveBalance.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ width:38, height:38, borderRadius:'11px', background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>�Ÿ’�</Box>
            </Box>
          </Box>
        </Grid>

        {/* Equity */}
        <Grid item xs={6} md={3}>
          <Box sx={{ p:{ xs:2, md:3 }, borderRadius:'20px', background:'linear-gradient(135deg,rgba(168,85,247,0.1),rgba(168,85,247,0.03))', border:'1px solid rgba(168,85,247,0.2)', position:'relative', overflow:'hidden', transition:'all 0.3s', '&:hover':{ transform:'translateY(-4px)', boxShadow:'0 16px 40px rgba(168,85,247,0.12)' }, '&::before':{ content:'""', position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,transparent,#a855f7,transparent)' } }}>
            <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <Box>
                <Typography sx={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', mb:1 }}>Equity</Typography>
                <Typography sx={{ fontSize:{ xs:'20px', md:'26px' }, fontWeight:800, color:'#fff', fontFamily:'"Roboto Mono",monospace', lineHeight:1 }}>
                  ${liveEquity.toFixed(2)}
                </Typography>
                <Typography sx={{ fontSize:'12px', color: liveEquity >= liveBalance ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace', mt:0.8 }}>
                  {liveEquity >= liveBalance ? '+' : ''}{(liveEquity - liveBalance).toFixed(2)} floating
                </Typography>
              </Box>
              <Box sx={{ width:38, height:38, borderRadius:'11px', background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>�Ÿ“Š</Box>
            </Box>
          </Box>
        </Grid>

        {/* Daily P&L */}
        <Grid item xs={6} md={3}>
          <Box sx={{ p:{ xs:2, md:3 }, borderRadius:'20px',
            background: liveProfit >= 0 ? 'linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.03))' : 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.03))',
            border:`1px solid ${liveProfit >= 0 ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`,
            position:'relative', overflow:'hidden', transition:'all 0.3s',
            '&:hover':{ transform:'translateY(-4px)', boxShadow:`0 16px 40px ${liveProfit >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` },
            '&::before':{ content:'""', position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${liveProfit >= 0 ? '#22c55e' : '#ef4444'},transparent)` } }}>
            <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <Box>
                <Typography sx={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', mb:1 }}>Daily P&L</Typography>
                <Typography sx={{ fontSize:{ xs:'20px', md:'26px' }, fontWeight:800, color: liveProfit >= 0 ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace', lineHeight:1 }}>
                  {liveProfit >= 0 ? '+' : ''}${liveProfit.toFixed(2)}
                </Typography>
                <Box sx={{ display:'flex', alignItems:'center', gap:0.5, mt:0.8 }}>
                  {liveProfit >= 0 ? <TrendingUp sx={{ fontSize:13, color:'#22c55e' }}/> : <TrendingDown sx={{ fontSize:13, color:'#ef4444' }}/>}
                  <Typography sx={{ fontSize:'12px', color: liveProfit >= 0 ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace' }}>
                    {liveProfitPct >= 0 ? '+' : ''}{liveProfitPct.toFixed(2)}%
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ width:38, height:38, borderRadius:'11px',
                background: liveProfit >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                border:`1px solid ${liveProfit >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                {liveProfit >= 0 ? '�Ÿš€' : '�š�️'}
              </Box>
            </Box>
          </Box>
        </Grid>

        {/* Open Positions count */}
        <Grid item xs={6} md={3}>
          <Box sx={{ p:{ xs:2, md:3 }, borderRadius:'20px', background:'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,191,36,0.02))', border:'1px solid rgba(251,191,36,0.18)', position:'relative', overflow:'hidden', transition:'all 0.3s', '&:hover':{ transform:'translateY(-4px)', boxShadow:'0 16px 40px rgba(251,191,36,0.1)' }, '&::before':{ content:'""', position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,transparent,#fbbf24,transparent)' } }}>
            <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <Box>
                <Typography sx={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', mb:1 }}>Open Positions</Typography>
                <Typography sx={{ fontSize:{ xs:'20px', md:'26px' }, fontWeight:800, color:'#fbbf24', fontFamily:'"Roboto Mono",monospace', lineHeight:1 }}>
                  {activePositions ?? 0}
                </Typography>
                {positions.length > 0 && (
                  <Typography sx={{ fontSize:'12px', color: floatingPnl >= 0 ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace', mt:0.8 }}>
                    Float: {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toFixed(2)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ width:38, height:38, borderRadius:'11px', background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.28)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>�Ÿ“‹</Box>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Positions Table */}
      <Box sx={{ borderRadius:'24px', background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', overflow:'hidden' }}>

        {/* Table header */}
        <Box sx={{ px:{ xs:2, md:4 }, pt:3, pb:2.5, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:2, borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(56,189,248,0.03)' }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
            <Box sx={{ width:36, height:36, borderRadius:'10px', background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'17px' }}>�ŸŽ�</Box>
            <Box>
              <Typography sx={{ fontSize:'16px', fontWeight:700 }}>Open Positions</Typography>
              <Typography sx={{ fontSize:'12px', color:'rgba(255,255,255,0.35)' }}>{positions.length} active trade{positions.length !== 1 ? 's' : ''}</Typography>
            </Box>
          </Box>
          {positions.length > 0 && (
            <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
              <Box sx={{ px:2, py:0.8, borderRadius:'10px', background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)', display:'flex', alignItems:'center', gap:0.8 }}>
                <Box sx={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e' }}/>
                <Typography sx={{ fontSize:'12px', fontWeight:700, color:'#22c55e', fontFamily:'"Roboto Mono",monospace' }}>+${totalPositionProfit.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ px:2, py:0.8, borderRadius:'10px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', display:'flex', alignItems:'center', gap:0.8 }}>
                <Box sx={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 6px #ef4444' }}/>
                <Typography sx={{ fontSize:'12px', fontWeight:700, color:'#ef4444', fontFamily:'"Roboto Mono",monospace' }}>${totalPositionLoss.toFixed(2)}</Typography>
              </Box>
            </Box>
          )}
        </Box>

        {positions.length === 0 ? (
          <Box sx={{ py:12, textAlign:'center' }}>
            <Typography sx={{ fontSize:'56px', opacity:0.1, mb:2 }}>�Ÿ“ˆ</Typography>
            <Typography sx={{ fontSize:'16px', color:'rgba(255,255,255,0.35)', mb:0.5 }}>No open positions</Typography>
            <Typography sx={{ fontSize:'13px', color:'rgba(255,255,255,0.2)' }}>Open trades in MT5 to see them here</Typography>
          </Box>
        ) : (
          <Box sx={{ p:{ xs:2, md:3 } }}>
            {/* Column headers */}
            <Grid container sx={{ px:2, mb:1.5, pb:1.5, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label:'#Ticket', xs:2 },
                { label:'Symbol',  xs:2.5 },
                { label:'Type',    xs:1.5 },
                { label:'Volume',  xs:1.5 },
                { label:'Price',   xs:2.5 },
                { label:'Profit',  xs:2, align:'right' as const },
              ].map(col => (
                <Grid item xs={col.xs} key={col.label}>
                  <Typography sx={{ fontSize:'10px', fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', textAlign: col.align || 'left' }}>
                    {col.label}
                  </Typography>
                </Grid>
              ))}
            </Grid>

            {/* Rows */}
            {positions.map((position) => {
              const isBuy    = (position.type || '') === 'BUY';
              const profit   = position.profit ?? 0;
              const isProfit = profit >= 0;
              const pct      = liveBalance > 0 ? ((profit / liveBalance) * 100).toFixed(2) : '0.00';
              return (
                <Box key={position.ticket} sx={{
                  display:'flex', alignItems:'center', px:2, py:2.5, borderRadius:'16px', mb:1.5,
                  background: isProfit ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
                  border:`1px solid ${isProfit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}`,
                  transition:'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  '&:hover':{ background: isProfit ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${isProfit ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, transform:'translateX(6px) scale(1.005)' }
                }}>
                  <Grid container alignItems="center">
                    <Grid item xs={2}>
                      <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                        <Box sx={{ width:6, height:6, borderRadius:'50%', background: isProfit ? '#22c55e' : '#ef4444', boxShadow:`0 0 6px ${isProfit ? '#22c55e' : '#ef4444'}`, flexShrink:0 }}/>
                        <Typography sx={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', fontFamily:'"Roboto Mono",monospace' }}>#{position.ticket}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={2.5}>
                      <Typography sx={{ fontSize:'15px', fontWeight:700, color:'white', letterSpacing:'0.02em' }}>{position.symbol}</Typography>
                    </Grid>
                    <Grid item xs={1.5}>
                      <Box sx={{ display:'inline-flex', alignItems:'center', gap:0.5, px:1.5, py:0.5, borderRadius:'8px',
                        background: isBuy ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        border:`1px solid ${isBuy ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}` }}>
                        <Typography sx={{ fontSize:'11px', fontWeight:800, color: isBuy ? '#22c55e' : '#ef4444', letterSpacing:'0.04em' }}>
                          {isBuy ? '�–�' : '�–�'} {position.type}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={1.5}>
                      <Typography sx={{ fontSize:'14px', fontWeight:600, color:'rgba(255,255,255,0.65)', fontFamily:'"Roboto Mono",monospace' }}>{position.volume}</Typography>
                      <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.25)' }}>lots</Typography>
                    </Grid>
                    <Grid item xs={2.5}>
                      <Typography sx={{ fontSize:'14px', fontWeight:600, color:'rgba(255,255,255,0.8)', fontFamily:'"Roboto Mono",monospace' }}>{position.price_current}</Typography>
                      <Typography sx={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', fontFamily:'"Roboto Mono",monospace' }}>Open: {position.price_open}</Typography>
                    </Grid>
                    <Grid item xs={2} sx={{ textAlign:'right' }}>
                      <Typography sx={{ fontSize:'18px', fontWeight:800, color: isProfit ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace', lineHeight:1 }}>
                        {isProfit ? '+' : ''}{profit.toFixed(2)}
                      </Typography>
                      <Box sx={{ display:'inline-flex', alignItems:'center', gap:0.4, mt:0.5, px:1.2, py:0.3, borderRadius:'6px', background: isProfit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                        <Typography sx={{ fontSize:'10px', fontWeight:700, color: isProfit ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace' }}>
                          {isProfit ? '�–�' : '�–�'} {pct}%
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              );
            })}

            {/* Footer */}
            {positions.length > 0 && (
              <Box sx={{ mt:2, pt:2, borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:2, px:2 }}>
                <Typography sx={{ fontSize:'13px', color:'rgba(255,255,255,0.3)' }}>
                  {positions.length} position{positions.length !== 1 ? 's' : ''} open
                </Typography>
                <Box sx={{ display:'flex', gap:3 }}>
                  <Box>
                    <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Floating P&L</Typography>
                    <Typography sx={{ fontSize:'16px', fontWeight:800, color: floatingPnl >= 0 ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace' }}>
                      {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Daily P&L</Typography>
                    <Typography sx={{ fontSize:'16px', fontWeight:800, color: liveProfit >= 0 ? '#22c55e' : '#ef4444', fontFamily:'"Roboto Mono",monospace' }}>
                      {liveProfit >= 0 ? '+' : ''}${liveProfit.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap');
      `}</style>
    </Box>
  );
};

export default Terminal;

