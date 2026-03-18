import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, Button, IconButton, Fab, Badge, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import { usePlan, startCheckout } from '../hooks/usePlan';

interface Message {
  id: number;
  role: 'user' | 'support' | 'system';
  text: string;
  time: Date;
}

const SUPPORT_RESPONSES: Record<string, string> = {
  default: "Thanks for reaching out! A support agent will respond within 2 hours. For urgent issues, please include your account details.",
  billing: "For billing questions, I can see your account is on the Pro plan. Invoices are sent automatically to your email. Need anything specific?",
  mt5: "For MT5 connection issues: 1) Check your server name matches exactly 2) Ensure MT5 is running 3) Verify your credentials in Settings. Still stuck? Let me escalate this.",
  journal: "The AI Journal syncs every 60 seconds from MT5. If trades aren't showing, try clicking 'Sync MT5 Trades' manually. Need more help?",
  stripe: "For payment issues, your test transactions show in Stripe Dashboard â†’ Payments. Production payments require going live in Stripe settings.",
};

const getAutoResponse = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('bill') || lower.includes('payment') || lower.includes('invoice')) return SUPPORT_RESPONSES.billing;
  if (lower.includes('mt5') || lower.includes('connect') || lower.includes('login')) return SUPPORT_RESPONSES.mt5;
  if (lower.includes('journal') || lower.includes('trade') || lower.includes('sync')) return SUPPORT_RESPONSES.journal;
  if (lower.includes('stripe') || lower.includes('card') || lower.includes('subscription')) return SUPPORT_RESPONSES.stripe;
  return SUPPORT_RESPONSES.default;
};

const SupportWidget: React.FC = () => {
  const { plan, features } = usePlan();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'system',
      text: plan === 'pro' || plan === 'enterprise'
        ? 'ðŸ‘‹ Hi! You have priority support. Average response time: < 2 hours.'
        : 'ðŸ‘‹ Hi! Upgrade to Pro for priority support with < 2hr response times.',
      time: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), role: 'user', text: input, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    const response = getAutoResponse(input);
    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'support', text: response, time: new Date() }]);
    setTyping(false);
    if (!open) setUnread(u => u + 1);
  };

  const handleOpen = () => { setOpen(true); setUnread(0); };

  return (
    <>
      {/* FAB button */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300 }}>
        {!open && (
          <Badge badgeContent={unread} color="error">
            <Fab onClick={handleOpen} sx={{
              background: 'linear-gradient(135deg, #2563eb, #a855f7)',
              color: 'white', boxShadow: '0 8px 32px rgba(37,99,235,0.4)',
              '&:hover': { transform: 'scale(1.1)', boxShadow: '0 12px 40px rgba(37,99,235,0.5)' },
              transition: 'all 0.2s',
            }}>
              <HeadsetMicIcon />
            </Fab>
          </Badge>
        )}
      </Box>

      {/* Chat window */}
      {open && (
        <Box sx={{
          position: 'fixed', bottom: 24, right: 24, width: 360, zIndex: 1300,
          borderRadius: '20px', overflow: 'hidden',
          background: 'linear-gradient(180deg, #0f172a, #0a0e1a)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}>
          {/* Header */}
          <Box sx={{
            p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
            background: 'linear-gradient(135deg, #2563eb22, #a855f722)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HeadsetMicIcon sx={{ fontSize: 20, color: 'white' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>RiskGuardian Support</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                <Typography sx={{ fontSize: '11px', color: '#22c55e' }}>
                  {plan === 'pro' || plan === 'enterprise' ? 'Priority Support' : 'Online'}
                </Typography>
              </Box>
            </Box>
            {plan === 'pro' || plan === 'enterprise' ? (
              <Box sx={{ fontSize: '10px', fontWeight: 700, color: '#a855f7', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', px: 1, py: 0.3 }}>
                PRIORITY
              </Box>
            ) : null}
            <IconButton onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5 }}><CloseIcon fontSize="small" /></IconButton>
          </Box>

          {/* Upgrade prompt for free users */}
          {plan === 'free' || plan === 'starter' ? (
            <Box sx={{ mx: 2, mt: 2, p: 1.5, borderRadius: '12px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)' }}>
              <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                ðŸš€ Get priority support with <strong>Pro</strong> â€” responses in under 2 hours.
              </Typography>
              <Box onClick={() => startCheckout('pro')} sx={{ fontSize: '12px', fontWeight: 700, color: '#a855f7', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                Upgrade to Pro â†’
              </Box>
            </Box>
          ) : null}

          {/* Messages */}
          <Box sx={{ height: 280, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5,
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }
          }}>
            {messages.map(msg => (
              <Box key={msg.id} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <Box sx={{
                  maxWidth: '80%', p: 1.5, borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : msg.role === 'system'
                    ? 'rgba(168,85,247,0.15)'
                    : 'rgba(255,255,255,0.07)',
                  border: msg.role === 'system' ? '1px solid rgba(168,85,247,0.3)' : 'none',
                }}>
                  <Typography sx={{ fontSize: '13px', color: 'white', lineHeight: 1.5 }}>{msg.text}</Typography>
                  <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', mt: 0.5 }}>{msg.time.toLocaleTimeString()}</Typography>
                </Box>
              </Box>
            ))}
            {typing && (
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', pl: 1 }}>
                {[0,1,2].map(i => (
                  <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', animation: 'bounce 1.2s infinite', animationDelay: `${i*0.2}s`,
                    '@keyframes bounce': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } } }} />
                ))}
              </Box>
            )}
            <div ref={bottomRef} />
          </Box>

          {/* Input */}
          <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 1 }}>
            <TextField
              fullWidth size="small" placeholder="Type your message..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              sx={{
                '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'white', fontSize: '13px',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset': { borderColor: '#38bdf8' } },
                '& input::placeholder': { color: 'rgba(255,255,255,0.3)', fontSize: '13px' }
              }}
            />
            <IconButton onClick={sendMessage} sx={{ background: 'linear-gradient(135deg, #2563eb, #a855f7)', color: 'white', borderRadius: '12px', width: 40, height: 40, '&:hover': { transform: 'scale(1.1)' } }}>
              <SendIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
      )}
    </>
  );
};

export default SupportWidget;

