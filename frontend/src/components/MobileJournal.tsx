import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Avatar, Fab, TextField, Button, IconButton, Dialog, DialogContent, DialogTitle, CircularProgress, Select, MenuItem, FormControl, InputLabel, Grid } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Add, Edit, Delete, Close, EmojiEvents, SentimentVeryDissatisfied, OpenInNew, AutoAwesome, Refresh } from '@mui/icons-material';
import axios from 'axios';

const NOTION_TEMPLATE = "https://notion.so/2017d61000d5808cb316f29e507ed863";
const API = 'https://riskguardian.onrender.com/api/v1';

const EMOTION_OPTIONS = ['Calm', 'Confident', 'Anxious', 'Fearful', 'Greedy', 'Disciplined', 'Frustrated', 'Excited', 'Neutral'];
const STRATEGY_OPTIONS = ['Trend Following', 'Breakout', 'Scalping', 'Swing Trading', 'News Trading', 'Support/Resistance', 'Price Action', 'Other'];

interface JournalEntry {
  id: number; trade_id?: number; symbol?: string; entry_date: string;
  trade_outcome?: string; profit_loss?: number; notes: string;
  lessons_learned?: string; emotional_state?: string;
  strategy_used?: string; notion_link?: string;
}

// same feedback logic as desktop
const generateAIFeedback = (entry: JournalEntry): string => {
  const pnl = entry.profit_loss ?? 0;
  const isWin = pnl > 0;
  const emotion = entry.emotional_state?.toLowerCase() || '';
  const lessons = entry.lessons_learned?.toLowerCase() || '';
  let feedback = '';
  const neg = ['anxious', 'fearful', 'greedy', 'frustrated', 'excited'];
  const pos = ['calm', 'confident', 'disciplined', 'neutral'];
  const hasNeg = neg.some(e => emotion.includes(e));
  const hasPos = pos.some(e => emotion.includes(e));
  if (isWin && hasNeg) feedback += `âš ï¸ **Emotional Warning:** Profit while feeling ${entry.emotional_state} can reinforce bad habits.\n\n`;
  else if (!isWin && hasNeg) feedback += `ðŸ”´ **Emotional Risk:** ${entry.emotional_state} state likely contributed to this loss.\n\n`;
  else if (hasPos) feedback += `âœ… **Emotional Discipline:** ${entry.emotional_state} mindset â€” keep this up.\n\n`;
  if (pnl > 0) feedback += `ðŸ’° **Result:** +$${pnl.toFixed(2)} â€” document what you did right.\n\n`;
  else if (pnl < 0) feedback += `ðŸ“‰ **Loss:** -$${Math.abs(pnl).toFixed(2)} â€” review your entry criteria.\n\n`;
  if (lessons && lessons.length > 10) feedback += `ðŸ“š **Learning:** Great job documenting lessons. Review these weekly.\n\n`;
  else if (!lessons) feedback += `ðŸ’¡ **Tip:** Add lessons learned for every trade â€” even winners.\n\n`;
  let score = 50;
  if (isWin) score += 20; if (hasPos) score += 15; if (lessons.length > 10) score += 10;
  if (entry.strategy_used) score += 5; if ((entry.notes?.length ?? 0) > 30) score += 5; if (hasNeg) score -= 10;
  score = Math.min(100, Math.max(0, score));
  feedback += `${score >= 70 ? 'ðŸŸ¢' : score >= 50 ? 'ðŸŸ¡' : 'ðŸ”´'} **Score: ${score}/100**`;
  return feedback;
};

const MobileFeedback: React.FC<{ entry: JournalEntry }> = ({ entry }) => {
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const get = () => { setLoading(true); setTimeout(() => { setText(generateAIFeedback(entry)); setLoading(false); setShown(true); }, 1000); };
  if (!shown) return (
    <Button onClick={get} disabled={loading} size="small" startIcon={loading ? <CircularProgress size={12} /> : <AutoAwesome sx={{ fontSize: 12 }} />}
      sx={{ mt: 1, borderRadius: '8px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc', fontSize: '11px', fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.6 }}>
      {loading ? 'Analyzing...' : 'âœ¨ AI Feedback'}
    </Button>
  );
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '10px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
      <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#a855f7', mb: 1, textTransform: 'uppercase', letterSpacing: '0.08em' }}>âœ¨ AI Analysis</Typography>
      {text.split('\n\n').filter(Boolean).map((p, i) => (
        <Typography key={i} sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, mb: 0.8 }}>
          {p.split('**').map((part, j) => j % 2 === 1 ? <strong key={j} style={{ color: 'white' }}>{part}</strong> : part)}
        </Typography>
      ))}
    </Box>
  );
};

const MobileJournal: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [historyDays, setHistoryDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [notionMode, setNotionMode] = useState<'template' | 'custom'>('template');
  const [formData, setFormData] = useState({ symbol: '', notes: '', lessons_learned: '', emotional_state: '', strategy_used: '', notion_link: '' });

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    try { const res = await axios.get(`${API}/journal/`); setEntries(res.data || []); }
    catch {} finally { setLoading(false); }
  };

  const syncMT5 = async () => {
    setSyncing(true);
    try { await axios.post(`${API}/journal/sync-mt5`); await fetchEntries(); }
    catch {} finally { setSyncing(false); }
  };

  const handleOpenDialog = (entry?: JournalEntry) => {
    if (entry) { setEditingEntry(entry); setFormData({ symbol: entry.symbol || '', notes: entry.notes || '', lessons_learned: entry.lessons_learned || '', emotional_state: entry.emotional_state || '', strategy_used: entry.strategy_used || '', notion_link: entry.notion_link || '' }); }
    else { setEditingEntry(null); setFormData({ symbol: '', notes: '', lessons_learned: '', emotional_state: '', strategy_used: '', notion_link: '' }); }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingEntry) await axios.put(`${API}/journal/${editingEntry.id}`, formData);
      else await axios.post(`${API}/journal/`, formData);
      fetchEntries(); setDialogOpen(false);
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this entry?')) { await axios.delete(`${API}/journal/${id}`); fetchEntries(); }
  };

  const formatDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return 'â€”'; } };

  // apply filters
  let displayed = [...entries];
  if (filter === 'wins') displayed = displayed.filter(e => (e.profit_loss ?? 0) > 0);
  if (filter === 'losses') displayed = displayed.filter(e => (e.profit_loss ?? 0) < 0);
  if (historyDays) { const cut = new Date(); cut.setDate(cut.getDate() - historyDays); displayed = displayed.filter(e => new Date(e.entry_date) >= cut); }
  displayed.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  const wins = displayed.filter(e => (e.profit_loss ?? 0) > 0).length;
  const losses = displayed.filter(e => (e.profit_loss ?? 0) < 0).length;
  const totalPnl = displayed.reduce((s, e) => s + (e.profit_loss ?? 0), 0);

  const inputSx = { '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#a855f7' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' } };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)', pb: 10, pt: 2 }}>
      {/* Header */}
      <Box sx={{ px: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: '26px', fontWeight: 800, background: 'linear-gradient(90deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Journal</Typography>
          <Button onClick={syncMT5} disabled={syncing} size="small" startIcon={syncing ? <CircularProgress size={14} /> : <Refresh sx={{ fontSize: 14 }} />}
            sx={{ borderRadius: '10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', fontSize: '11px', fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            {syncing ? 'Syncing...' : 'Sync MT5'}
          </Button>
        </Box>

        {/* Stats */}
        <Grid container spacing={1} sx={{ mb: 2 }}>
          {[
            { l: 'Total', v: displayed.length.toString(), c: '#38bdf8' },
            { l: 'Wins', v: wins.toString(), c: '#22c55e' },
            { l: 'Losses', v: losses.toString(), c: '#ef4444' },
            { l: 'P&L', v: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, c: totalPnl >= 0 ? '#22c55e' : '#ef4444' },
          ].map(s => (
            <Grid item xs={3} key={s.l}>
              <Box sx={{ p: 1.2, borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 800, color: s.c, fontFamily: 'monospace' }}>{s.v}</Typography>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{s.l}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 0.8, mb: 1.5, flexWrap: 'wrap' }}>
          {[{ v: 'all', l: 'All' }, { v: 'wins', l: 'âœ… Wins' }, { v: 'losses', l: 'âŒ Losses' }].map(f => (
            <Chip key={f.v} label={f.l} onClick={() => setFilter(f.v as any)} size="small"
              sx={{ height: 28, fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: filter === f.v ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'rgba(255,255,255,0.05)', color: filter === f.v ? 'white' : 'rgba(255,255,255,0.6)', border: filter === f.v ? 'none' : '1px solid rgba(255,255,255,0.1)' }} />
          ))}
        </Box>

        {/* 90-day filter */}
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          {[{ v: null, l: 'All Time' }, { v: 7, l: '7D' }, { v: 30, l: '30D' }, { v: 90, l: '90D' }].map(d => (
            <Chip key={String(d.v)} label={d.l} onClick={() => setHistoryDays(d.v)} size="small"
              sx={{ height: 26, fontSize: '10px', fontWeight: 600, cursor: 'pointer', background: historyDays === d.v ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)', color: historyDays === d.v ? '#38bdf8' : 'rgba(255,255,255,0.4)', border: historyDays === d.v ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)' }} />
          ))}
        </Box>
      </Box>

      {/* Entries */}
      <Box sx={{ px: 2 }}>
        <AnimatePresence mode="popLayout">
          {displayed.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '40px', opacity: 0.15, mb: 1 }}>ðŸ““</Typography>
              <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>No entries yet</Typography>
            </Box>
          ) : displayed.map((entry, i) => {
            const pnl = entry.profit_loss ?? 0;
            const isWin = pnl > 0;
            const hasPnl = entry.profit_loss !== null && entry.profit_loss !== undefined;
            return (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0 }} layout>
                <Box sx={{ p: 2.5, mb: 2, borderRadius: '18px', background: hasPnl ? (isWin ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)') : 'rgba(255,255,255,0.03)', border: `1px solid ${hasPnl ? (isWin ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.07)'}`, position: 'relative', overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: hasPnl ? (isWin ? 'linear-gradient(90deg,transparent,#22c55e,transparent)' : 'linear-gradient(90deg,transparent,#ef4444,transparent)') : 'linear-gradient(90deg,transparent,#a855f7,transparent)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, background: hasPnl ? (isWin ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#dc2626)') : 'linear-gradient(135deg,#a855f7,#ec4899)', fontSize: '16px' }}>
                        {hasPnl ? (isWin ? 'ðŸ†' : 'ðŸ“‰') : 'ðŸ““'}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>{entry.symbol || 'General'}</Typography>
                        <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatDate(entry.entry_date)}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => handleOpenDialog(entry)} sx={{ color: '#38bdf8', background: 'rgba(56,189,248,0.1)', width: 28, height: 28 }}><Edit sx={{ fontSize: 14 }} /></IconButton>
                      <IconButton size="small" onClick={() => handleDelete(entry.id)} sx={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', width: 28, height: 28 }}><Delete sx={{ fontSize: 14 }} /></IconButton>
                    </Box>
                  </Box>

                  {hasPnl && <Chip label={`${isWin ? '+' : ''}$${pnl.toFixed(2)}`} size="small" sx={{ height: 22, fontSize: '11px', fontWeight: 700, mb: 1.5, background: isWin ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: isWin ? '#22c55e' : '#ef4444', border: `1px solid ${isWin ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }} />}

                  {entry.notes && <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, mb: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.notes}</Typography>}

                  {entry.lessons_learned && <Box sx={{ p: 1.2, borderRadius: '8px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', mb: 1.5 }}>
                    <Typography sx={{ fontSize: '10px', color: '#fbbf24', fontWeight: 600, mb: 0.3 }}>ðŸ’¡ LESSONS</Typography>
                    <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{entry.lessons_learned}</Typography>
                  </Box>}

                  <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 0.5 }}>
                    {entry.strategy_used && <Chip label={`ðŸ“Š ${entry.strategy_used}`} size="small" sx={{ height: 20, fontSize: '10px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }} />}
                    {entry.emotional_state && <Chip label={`ðŸ˜¶ ${entry.emotional_state}`} size="small" sx={{ height: 20, fontSize: '10px', background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }} />}
                    {entry.notion_link && <Chip icon={<OpenInNew sx={{ fontSize: '10px !important' }} />} label="Notion" size="small" onClick={() => window.open(entry.notion_link, '_blank')} sx={{ height: 20, fontSize: '10px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', cursor: 'pointer' }} />}
                  </Box>

                  <MobileFeedback entry={entry} />
                </Box>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </Box>

      {/* FAB */}
      <Fab onClick={() => handleOpenDialog()} sx={{ position: 'fixed', bottom: 90, right: 20, background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', boxShadow: '0 8px 24px rgba(168,85,247,0.4)', '&:hover': { transform: 'scale(1.1)' } }}>
        <Add />
      </Fab>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullScreen PaperProps={{ sx: { background: 'linear-gradient(180deg, #0f1828 0%, #0a0e1a 100%)', color: 'white' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 700 }}>{editingEntry ? 'Edit Entry' : 'New Entry'}</Typography>
          <IconButton onClick={() => setDialogOpen(false)} sx={{ color: 'white' }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Symbol (Optional)" value={formData.symbol} onChange={e => setFormData({ ...formData, symbol: e.target.value })} fullWidth sx={inputSx} />
            <TextField label="Notes" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} multiline rows={4} fullWidth sx={inputSx} />
            <TextField label="Lessons Learned" value={formData.lessons_learned} onChange={e => setFormData({ ...formData, lessons_learned: e.target.value })} multiline rows={3} fullWidth sx={inputSx} />
            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Emotional State</InputLabel>
              <Select value={formData.emotional_state} label="Emotional State" onChange={e => setFormData({ ...formData, emotional_state: e.target.value })} sx={{ color: 'white' }}>
                {EMOTION_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ background: '#0f172a', color: 'white' }}>{o}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={inputSx}>
              <InputLabel>Strategy</InputLabel>
              <Select value={formData.strategy_used} label="Strategy" onChange={e => setFormData({ ...formData, strategy_used: e.target.value })} sx={{ color: 'white' }}>
                {STRATEGY_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ background: '#0f172a', color: 'white' }}>{o}</MenuItem>)}
              </Select>
            </FormControl>
            <Box>
              <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', mb: 1.5 }}>ðŸ““ Notion (Optional)</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                {['template', 'custom'].map(m => <Button key={m} onClick={() => setNotionMode(m as any)} size="small" sx={{ flex: 1, borderRadius: '10px', textTransform: 'none', fontSize: '12px', ...(notionMode === m ? { background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white' } : { border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }) }}>{m === 'template' ? 'ðŸ“‹ Template' : 'ðŸ”— Custom'}</Button>)}
              </Box>
              {notionMode === 'template'
                ? <Button href={NOTION_TEMPLATE} target="_blank" fullWidth startIcon={<OpenInNew />} onClick={() => setFormData({ ...formData, notion_link: NOTION_TEMPLATE })} sx={{ py: 1.5, borderRadius: '10px', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontWeight: 600, textTransform: 'none' }}>Open Template</Button>
                : <TextField placeholder="https://notion.so/..." value={formData.notion_link} onChange={e => setFormData({ ...formData, notion_link: e.target.value })} fullWidth sx={inputSx} />}
            </Box>
            <Button onClick={handleSave} fullWidth sx={{ py: 1.5, background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: 'white', fontWeight: 700, fontSize: '14px', borderRadius: '12px', textTransform: 'none' }}>
              {editingEntry ? 'Update Entry' : 'Save Entry'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MobileJournal;

