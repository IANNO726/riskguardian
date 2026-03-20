import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Avatar, TextField, Button, IconButton, Dialog, DialogContent, DialogTitle, MenuItem, Select, FormControl, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Close, Add, Remove, Edit } from '@mui/icons-material';
import axios from 'axios';

interface Position {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  sl?: number;
  tp?: number;
}

interface OrderForm {
  symbol: string;
  order_type: 'BUY' | 'SELL';
  volume: number;
  sl?: number;
  tp?: number;
}

const API = process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com';

// �”€�”€ Safe parser: handles any shape the API returns �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
function parsePositions(data: any): Position[] {
  if (!data) return [];
  // { positions: [...] }
  if (Array.isArray(data.positions)) return data.positions;
  // { data: [...] }
  if (Array.isArray(data.data)) return data.data;
  // bare array
  if (Array.isArray(data)) return data;
  return [];
}

const MobileTerminal: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [symbols, setSymbols]     = useState<string[]>([]);
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const [orderForm, setOrderForm] = useState<OrderForm>({
    symbol: '', order_type: 'BUY', volume: 0.01,
  });
  const [modifyForm, setModifyForm] = useState({ sl: '', tp: '' });

  useEffect(() => {
    fetchPositions();
    fetchSymbols();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/api/v1/positions/`, { headers });
      setPositions(parsePositions(response.data));
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSymbols = async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/api/v1/symbols/`, { headers });
      const fetched: string[] = Array.isArray(response.data?.symbols)
        ? response.data.symbols
        : Array.isArray(response.data) ? response.data : [];
      setSymbols(fetched);
      if (fetched.length > 0) setOrderForm(prev => ({ ...prev, symbol: prev.symbol || fetched[0] }));
    } catch {
      const fallback = [
        'Volatility 10 Index','Volatility 25 Index','Volatility 50 Index',
        'Volatility 75 Index','Volatility 100 Index',
        'Jump 10 Index','Jump 25 Index','Jump 50 Index','Jump 75 Index','Jump 100 Index',
        'Crash 300 Index','Crash 500 Index','Crash 1000 Index',
        'Boom 300 Index','Boom 500 Index','Boom 1000 Index',
        'EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSD',
      ];
      setSymbols(fallback);
      setOrderForm(prev => ({ ...prev, symbol: prev.symbol || fallback[0] }));
    }
  };

  const handlePlaceOrder = async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      await axios.post(`${API}/api/v1/trades/open`, {
        symbol: orderForm.symbol,
        order_type: orderForm.order_type,
        volume: parseFloat(orderForm.volume.toFixed(2)),
        sl: orderForm.sl,
        tp: orderForm.tp,
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('�œ… Order placed successfully!');
      setDialogOpen(false);
      fetchPositions();
    } catch (error: any) {
      alert(`�Œ Failed: ${error.response?.data?.detail || 'Please try again.'}`);
    }
  };

  const handleClosePosition = async (ticket: number) => {
    if (!window.confirm('�š�️ Close this position?')) return;
    try {
      const token = localStorage.getItem('access_token') || '';
      await axios.post(`${API}/api/v1/trades/close`, { ticket },
        { headers: { Authorization: `Bearer ${token}` } });
      alert('�œ… Position closed!');
      fetchPositions();
    } catch (error: any) {
      alert(`�Œ Failed: ${error.response?.data?.detail || 'Please try again.'}`);
    }
  };

  const handleOpenModifyDialog = (position: Position) => {
    setSelectedPosition(position);
    setModifyForm({
      sl: position.sl && position.sl > 0.00001 ? position.sl.toString() : '',
      tp: position.tp && position.tp > 0.00001 ? position.tp.toString() : '',
    });
    setModifyDialogOpen(true);
  };

  const handleModifyPosition = async () => {
    if (!selectedPosition) return;
    const newSl = modifyForm.sl ? parseFloat(modifyForm.sl) : undefined;
    const newTp = modifyForm.tp ? parseFloat(modifyForm.tp) : undefined;
    if (!newSl && !newTp) { alert('�š�️ Enter at least SL or TP.'); return; }
    try {
      const token = localStorage.getItem('access_token') || '';
      await axios.put(
        `${API}/api/v1/positions/${selectedPosition.ticket}/modify`,
        { stop_loss: newSl ?? null, take_profit: newTp ?? null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('�œ… Position modified!');
      setModifyDialogOpen(false);
      fetchPositions();
    } catch (error: any) {
      alert(`�Œ Failed: ${error?.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleVolumeChange = (v: number) =>
    setOrderForm(prev => ({ ...prev, volume: Math.max(0.01, Math.round(v * 100) / 100) }));

  const cardVariants = {
    hidden:  { opacity: 0, x: -20 },
    visible: (i: number) => ({ opacity: 1, x: 0, transition: { delay: i * 0.05, type: 'spring', stiffness: 100 } }),
    exit:    { opacity: 0, x: 20 },
  };

  // �”€�”€ These are now SAFE: positions is always [] or a real array �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
  const safePositions   = Array.isArray(positions) ? positions : [];
  const totalPositions  = safePositions.length;
  const totalProfit     = safePositions.reduce((sum, p) => sum + (p.profit || 0), 0);
  const winningPositions= safePositions.filter(p => (p.profit || 0) > 0).length;
  const losingPositions = safePositions.filter(p => (p.profit || 0) < 0).length;

  if (loading) {
    return (
      <Box sx={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)' }}>
        <CircularProgress sx={{ color:'#38bdf8' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight:'100vh', background:'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)', pb:2, pt:2 }}>

      {/* Header */}
      <Box sx={{ px:2, mb:3 }}>
        <Typography sx={{ fontSize:'28px', fontWeight:800,
          background:'linear-gradient(90deg, #38bdf8, #22c55e)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', mb:2 }}>
          Trading Terminal
        </Typography>

        {/* Summary Card */}
        <Box sx={{
          p:2.5, borderRadius:'20px', mb:2,
          background: totalProfit >= 0
            ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.15) 100%)'
            : 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)',
          backdropFilter:'blur(40px)',
          border:`1px solid ${totalProfit >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:2 }}>
            <Box>
              <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', mb:0.5 }}>Open Positions</Typography>
              <Typography sx={{ fontSize:'20px', fontWeight:800, color:'white' }}>{totalPositions}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', mb:0.5 }}>
                {winningPositions >= losingPositions ? 'Winning' : 'Losing'}
              </Typography>
              <Typography sx={{ fontSize:'20px', fontWeight:800,
                color: winningPositions >= losingPositions ? '#22c55e' : '#ef4444' }}>
                {winningPositions >= losingPositions ? winningPositions : losingPositions}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', mb:0.5 }}>Total P&L</Typography>
              <Typography sx={{ fontSize:'20px', fontWeight:800, fontFamily:'monospace',
                color: totalProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Quick Trade Buttons */}
        <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, mb:2 }}>
          {(['BUY','SELL'] as const).map(side => (
            <Button key={side}
              onClick={() => { setOrderForm(p => ({...p, order_type: side})); setDialogOpen(true); }}
              sx={{
                py:1.5, borderRadius:'12px', color:'white',
                fontSize:'14px', fontWeight:700, textTransform:'none',
                background: side==='BUY'
                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: side==='BUY'
                  ? '0 8px 24px rgba(34,197,94,0.4)'
                  : '0 8px 24px rgba(239,68,68,0.4)',
              }}>
              {side==='BUY' ? <TrendingUp sx={{ mr:1 }}/> : <TrendingDown sx={{ mr:1 }}/>} {side}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Positions List */}
      <Box sx={{ px:2 }}>
        <Typography sx={{ fontSize:'16px', fontWeight:700, color:'white', mb:2 }}>
          Open Positions ({totalPositions})
        </Typography>

        <AnimatePresence mode="popLayout">
          {safePositions.length === 0 ? (
            <Box sx={{ py:8, textAlign:'center' }}>
              <Typography sx={{ fontSize:'48px', opacity:0.2, mb:2 }}>�Ÿ“Š</Typography>
              <Typography sx={{ fontSize:'14px', color:'rgba(255,255,255,0.4)', mb:1 }}>No open positions</Typography>
              <Typography sx={{ fontSize:'12px', color:'rgba(255,255,255,0.3)' }}>Tap BUY or SELL to open a trade</Typography>
            </Box>
          ) : (
            safePositions.map((position, i) => {
              const isProfit = (position.profit || 0) >= 0;
              const priceChange = (position.price_current || 0) - (position.price_open || 0);
              const priceChangePct = position.price_open ? (priceChange / position.price_open) * 100 : 0;
              const hasSL = position.sl && position.sl > 0.00001;
              const hasTP = position.tp && position.tp > 0.00001;
              const isBuy = (position.type || '').toLowerCase().includes('buy');

              return (
                <motion.div key={position.ticket} custom={i}
                  initial="hidden" animate="visible" exit="exit" variants={cardVariants} layout>
                  <Box sx={{
                    p:2.5, mb:2, borderRadius:'20px', backdropFilter:'blur(20px)',
                    background: isProfit
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)',
                    border:`1px solid ${isProfit ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    position:'relative', overflow:'hidden',
                    '&::before': {
                      content:'""', position:'absolute', left:0, top:0, bottom:0, width:'4px',
                      background: isProfit ? '#22c55e' : '#ef4444',
                      boxShadow:`0 0 20px ${isProfit ? '#22c55e' : '#ef4444'}`,
                    }
                  }}>
                    {/* Row 1: Symbol + P&L */}
                    <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:2 }}>
                      <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
                        <Avatar sx={{ width:40, height:40,
                          background: isBuy
                            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                          {isBuy ? <TrendingUp /> : <TrendingDown />}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize:'16px', fontWeight:800, color:'white', mb:0.3 }}>
                            {position.symbol || 'UNKNOWN'}
                          </Typography>
                          <Box sx={{ display:'flex', gap:1, alignItems:'center' }}>
                            <Chip label={position.type || 'N/A'} size="small" sx={{
                              height:'20px', fontSize:'10px', fontWeight:700,
                              background: isBuy ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                              color: isBuy ? '#22c55e' : '#ef4444',
                              border:`1px solid ${isBuy ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                            }}/>
                            <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.5)' }}>
                              {position.volume} lots
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign:'right' }}>
                        <Typography sx={{ fontSize:'18px', fontWeight:800, fontFamily:'monospace', mb:0.3,
                          color: isProfit ? '#22c55e' : '#ef4444' }}>
                          {isProfit ? '+' : ''}${(position.profit || 0).toFixed(2)}
                        </Typography>
                        <Typography sx={{ fontSize:'10px', color: isProfit ? '#22c55e' : '#ef4444' }}>
                          {priceChangePct > 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                        </Typography>
                      </Box>
                    </Box>

                    {/* Row 2: Price details */}
                    <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:2,
                      pt:2, borderTop:'1px solid rgba(255,255,255,0.05)', mb:2 }}>
                      {[
                        { label:'Open',    val:(position.price_open    || 0).toFixed(5) },
                        { label:'Current', val:(position.price_current || 0).toFixed(5) },
                        { label:'Ticket',  val:`#${position.ticket}` },
                      ].map(item => (
                        <Box key={item.label}>
                          <Typography sx={{ fontSize:'9px', color:'rgba(255,255,255,0.4)', mb:0.3 }}>{item.label}</Typography>
                          <Typography sx={{ fontSize:'12px', fontWeight:600, color:'white', fontFamily:'monospace' }}>{item.val}</Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Row 3: SL/TP */}
                    <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2,
                      pt:2, borderTop:'1px solid rgba(255,255,255,0.05)', mb:2 }}>
                      <Box>
                        <Typography sx={{ fontSize:'9px', color:'rgba(255,255,255,0.4)', mb:0.3 }}>SL</Typography>
                        <Typography sx={{ fontSize:'12px', fontWeight:600, fontFamily:'monospace',
                          color: hasSL ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
                          {hasSL ? position.sl!.toFixed(5) : 'Not Set'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize:'9px', color:'rgba(255,255,255,0.4)', mb:0.3 }}>TP</Typography>
                        <Typography sx={{ fontSize:'12px', fontWeight:600, fontFamily:'monospace',
                          color: hasTP ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                          {hasTP ? position.tp!.toFixed(5) : 'Not Set'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Row 4: Actions */}
                    <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1 }}>
                      <Button onClick={() => handleClosePosition(position.ticket)} size="small" sx={{
                        py:1, borderRadius:'10px', fontSize:'11px', fontWeight:600, textTransform:'none',
                        background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444',
                      }}>
                        <Close sx={{ fontSize:14, mr:0.5 }}/> Close
                      </Button>
                      <Button onClick={() => handleOpenModifyDialog(position)} size="small" sx={{
                        py:1, borderRadius:'10px', fontSize:'11px', fontWeight:600, textTransform:'none',
                        background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', color:'#38bdf8',
                      }}>
                        <Edit sx={{ fontSize:14, mr:0.5 }}/> Modify
                      </Button>
                    </Box>
                  </Box>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </Box>

      {/* �”€�”€ Place Order Dialog �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullScreen
        PaperProps={{ sx: { background:'linear-gradient(180deg, #0f1828 0%, #0a0e1a 100%)', color:'white' } }}>
        <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <Typography sx={{ fontSize:'20px', fontWeight:700 }}>Place {orderForm.order_type} Order</Typography>
          <IconButton onClick={() => setDialogOpen(false)} sx={{ color:'white' }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt:3 }}>
          <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
            {/* Symbol */}
            <Box>
              <Typography sx={{ fontSize:'14px', color:'rgba(255,255,255,0.8)', mb:1, fontWeight:600 }}>Symbol</Typography>
              <FormControl fullWidth>
                <Select value={orderForm.symbol}
                  onChange={e => setOrderForm(p => ({...p, symbol: e.target.value}))}
                  sx={{ color:'white',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor:'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor:'rgba(255,255,255,0.4)' },
                  }}>
                  {symbols.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            {/* Volume */}
            <Box>
              <Typography sx={{ fontSize:'14px', color:'rgba(255,255,255,0.8)', mb:1, fontWeight:600 }}>Volume (lots)</Typography>
              <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
                <IconButton onClick={() => handleVolumeChange(orderForm.volume - 0.01)}
                  sx={{ background:'rgba(255,255,255,0.05)', color:'white' }}><Remove /></IconButton>
                <TextField type="number" value={orderForm.volume.toFixed(2)}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  inputProps={{ step:0.01, min:0.01 }}
                  sx={{ flex:1,
                    '& .MuiOutlinedInput-root': { color:'white',
                      '& fieldset': { borderColor:'rgba(255,255,255,0.2)' } },
                    '& input': { textAlign:'center', fontSize:'16px', fontWeight:600 },
                  }}/>
                <IconButton onClick={() => handleVolumeChange(orderForm.volume + 0.01)}
                  sx={{ background:'rgba(255,255,255,0.05)', color:'white' }}><Add /></IconButton>
              </Box>
            </Box>

            {/* SL / TP */}
            {(['sl','tp'] as const).map(field => (
              <TextField key={field}
                label={field === 'sl' ? 'Stop Loss (Optional)' : 'Take Profit (Optional)'}
                type="number" value={orderForm[field] || ''}
                onChange={e => setOrderForm(p => ({...p, [field]: e.target.value ? parseFloat(e.target.value) : undefined}))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { color:'white',
                    '& fieldset':{ borderColor:'rgba(255,255,255,0.2)' } },
                  '& .MuiInputLabel-root': { color:'rgba(255,255,255,0.6)' } }}/>
            ))}

            <Button onClick={handlePlaceOrder} fullWidth sx={{
              mt:2, py:1.5, borderRadius:'12px', color:'white', fontWeight:700,
              fontSize:'14px', textTransform:'none',
              background: orderForm.order_type==='BUY'
                ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            }}>
              Place {orderForm.order_type} Order
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* �”€�”€ Modify Dialog �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€ */}
      <Dialog open={modifyDialogOpen} onClose={() => setModifyDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { background:'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)',
          borderRadius:'24px', border:'1px solid rgba(56,189,248,0.2)', m:2 } }}>
        <DialogTitle sx={{ pt:3, px:3, pb:2, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Box>
              <Typography sx={{ fontSize:'20px', fontWeight:700, color:'white', mb:0.5 }}>Modify Position</Typography>
              {selectedPosition && (
                <Typography sx={{ fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>
                  {selectedPosition.symbol} �€� Ticket #{selectedPosition.ticket}
                </Typography>
              )}
            </Box>
            <IconButton onClick={() => setModifyDialogOpen(false)} sx={{ color:'rgba(255,255,255,0.6)' }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p:3 }}>
          <Box sx={{ display:'flex', flexDirection:'column', gap:3, pt:1 }}>
            {selectedPosition && (
              <Box sx={{ p:2.5, borderRadius:'16px', background:'rgba(56,189,248,0.08)',
                border:'1px solid rgba(56,189,248,0.2)' }}>
                <Typography sx={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', mb:1 }}>Current Values</Typography>
                <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2 }}>
                  {[
                    { label:'Stop Loss', val: selectedPosition.sl && selectedPosition.sl > 0.00001 ? selectedPosition.sl.toFixed(5) : 'Not Set', color:'#ef4444' },
                    { label:'Take Profit', val: selectedPosition.tp && selectedPosition.tp > 0.00001 ? selectedPosition.tp.toFixed(5) : 'Not Set', color:'#22c55e' },
                  ].map(item => (
                    <Box key={item.label}>
                      <Typography sx={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', mb:0.3 }}>{item.label}</Typography>
                      <Typography sx={{ fontSize:'14px', fontWeight:600, fontFamily:'monospace', color:item.color }}>{item.val}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {[
              { field:'sl' as const, label:'New Stop Loss', color:'#ef4444', bg:'rgba(239,68,68,0.05)', border:'rgba(239,68,68,0.3)' },
              { field:'tp' as const, label:'New Take Profit', color:'#22c55e', bg:'rgba(34,197,94,0.05)', border:'rgba(34,197,94,0.3)' },
            ].map(({ field, label, color, bg, border }) => (
              <Box key={field}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1 }}>
                  <Box sx={{ width:6, height:6, borderRadius:'50%', background:color, boxShadow:`0 0 10px ${color}66` }}/>
                  <Typography sx={{ fontSize:'14px', color:'rgba(255,255,255,0.8)', fontWeight:600 }}>{label}</Typography>
                </Box>
                <TextField type="number" placeholder="Leave empty to keep current"
                  value={modifyForm[field]}
                  onChange={e => setModifyForm(p => ({...p, [field]: e.target.value}))}
                  fullWidth inputProps={{ step:0.00001 }}
                  sx={{ '& .MuiOutlinedInput-root': { color:'white', background:bg, borderRadius:'12px',
                      '& fieldset':{ borderColor:border },
                      '&.Mui-focused fieldset':{ borderColor:color, borderWidth:'2px' } },
                    '& input':{ fontSize:'16px', fontWeight:500, fontFamily:'monospace' } }}/>
              </Box>
            ))}

            <Box sx={{ p:2, borderRadius:'12px', background:'rgba(100,181,246,0.05)',
              border:'1px solid rgba(100,181,246,0.2)' }}>
              <Typography sx={{ fontSize:'11px', color:'rgba(100,181,246,0.8)', lineHeight:1.6 }}>
                �Ÿ’� <strong>Tip:</strong> Modify SL only, TP only, or both. Empty fields keep current values.
              </Typography>
            </Box>

            <Box sx={{ display:'flex', gap:1.5, mt:1 }}>
              <Button onClick={() => setModifyDialogOpen(false)} sx={{
                flex:1, py:1.2, borderRadius:'10px', fontSize:'13px', fontWeight:600,
                textTransform:'none', border:'1px solid rgba(255,255,255,0.15)',
                color:'rgba(255,255,255,0.7)', background:'rgba(255,255,255,0.03)',
              }}>Cancel</Button>
              <Button onClick={handleModifyPosition} sx={{
                flex:1, py:1.2, borderRadius:'10px', fontSize:'13px', fontWeight:700,
                textTransform:'none', color:'white',
                background:'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
                boxShadow:'0 4px 12px rgba(56,189,248,0.3)',
              }}>Update Position</Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MobileTerminal;

