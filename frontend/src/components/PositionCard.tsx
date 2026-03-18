import React, { useState } from 'react';
import { Box, Typography, IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Close, Edit } from '@mui/icons-material';
import { modifyPosition } from '../services/api';

interface Position {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  sl: number;
  tp: number;
}

interface PositionCardProps {
  position: Position;
  onClose?: (ticket: number) => void;
  onModified?: () => void;
}

const PositionCard: React.FC<PositionCardProps> = ({ position, onClose, onModified }) => {
  const isProfit = position.profit >= 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [newSL, setNewSL] = useState<string>(position.sl > 0 ? position.sl.toString() : '');
  const [newTP, setNewTP] = useState<string>(position.tp > 0 ? position.tp.toString() : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleOpenModal = () => {
    setNewSL(position.sl > 0 ? position.sl.toString() : '');
    setNewTP(position.tp > 0 ? position.tp.toString() : '');
    setError(null);
    setSuccess(false);
    setModalOpen(true);
  };

  const handleModify = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const sl = newSL !== '' ? parseFloat(newSL) : undefined;
      const tp = newTP !== '' ? parseFloat(newTP) : undefined;

      await modifyPosition(position.ticket, sl, tp);

      setSuccess(true);
      setTimeout(() => {
        setModalOpen(false);
        onModified?.();
      }, 1000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Failed to modify position. Please check your backend API endpoints.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.2}
        whileTap={{ scale: 0.98 }}
      >
        <Box sx={{
          p: 2.5,
          mb: 2,
          borderRadius: '20px',
          background: isProfit
            ? 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.08) 100%)'
            : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${isProfit ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: '4px',
            background: isProfit ? '#22c55e' : '#ef4444',
            boxShadow: `0 0 20px ${isProfit ? '#22c55e' : '#ef4444'}`,
          }
        }}>

          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40, height: 40,
                borderRadius: '12px',
                background: isProfit
                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px ${isProfit ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {isProfit ? <TrendingUp sx={{ color: 'white' }} /> : <TrendingDown sx={{ color: 'white' }} />}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: 'white', letterSpacing: '0.02em' }}>
                  {position.symbol}
                </Typography>
                <Chip
                  label={position.type}
                  size="small"
                  sx={{
                    height: '20px', fontSize: '10px', fontWeight: 700,
                    background: position.type === 'BUY' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    color: position.type === 'BUY' ? '#22c55e' : '#ef4444',
                    border: position.type === 'BUY' ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(239,68,68,0.5)',
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {/* âœ… EDIT BUTTON */}
              <IconButton
                onClick={handleOpenModal}
                sx={{
                  color: '#facc15',
                  background: 'rgba(250,204,21,0.1)',
                  width: 32, height: 32,
                  '&:active': { transform: 'scale(0.9)' }
                }}
              >
                <Edit sx={{ fontSize: 16 }} />
              </IconButton>

              {/* CLOSE BUTTON */}
              <IconButton
                onClick={() => onClose?.(position.ticket)}
                sx={{
                  color: '#ef4444',
                  background: 'rgba(239,68,68,0.1)',
                  width: 32, height: 32,
                  '&:active': { transform: 'scale(0.9)' }
                }}
              >
                <Close sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Stats Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>Entry Price</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
                {position.price_open.toFixed(5)}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>Current Price</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
                {position.price_current.toFixed(5)}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>Volume</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                {position.volume} lots
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>Profit/Loss</Typography>
              <Typography sx={{ fontSize: '16px', fontWeight: 800, color: isProfit ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
                {isProfit ? '+' : ''}{position.profit.toFixed(2)} USD
              </Typography>
            </Box>
          </Box>

          {/* SL/TP Bar */}
          {(position.sl > 0 || position.tp > 0) && (
            <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {position.sl > 0 && (
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', mb: 0.5 }}>Stop Loss</Typography>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', fontFamily: 'monospace' }}>
                    {position.sl.toFixed(5)}
                  </Typography>
                </Box>
              )}
              {position.tp > 0 && (
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', mb: 0.5 }}>Take Profit</Typography>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#22c55e', fontFamily: 'monospace' }}>
                    {position.tp.toFixed(5)}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </motion.div>

      {/* âœ… MODIFY POSITION MODAL */}
      <Dialog
        open={modalOpen}
        onClose={() => !loading && setModalOpen(false)}
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            minWidth: '320px',
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', fontWeight: 800, pb: 1 }}>
          Modify Position
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>
            {position.symbol} â€¢ Ticket #{position.ticket}
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{
              flex: 1, p: 1.5, borderRadius: '10px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              textAlign: 'center'
            }}>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Current SL</Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>
                {position.sl > 0 ? position.sl.toFixed(5) : 'â€”'}
              </Typography>
            </Box>
            <Box sx={{
              flex: 1, p: 1.5, borderRadius: '10px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              textAlign: 'center'
            }}>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Current TP</Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
                {position.tp > 0 ? position.tp.toFixed(5) : 'â€”'}
              </Typography>
            </Box>
          </Box>

          <TextField
            fullWidth
            label="New Stop Loss"
            value={newSL}
            onChange={(e) => setNewSL(e.target.value)}
            placeholder="Leave empty to keep current"
            type="number"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(239,68,68,0.4)' },
                '&:hover fieldset': { borderColor: '#ef4444' },
                '&.Mui-focused fieldset': { borderColor: '#ef4444' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#ef4444' },
            }}
          />

          <TextField
            fullWidth
            label="New Take Profit"
            value={newTP}
            onChange={(e) => setNewTP(e.target.value)}
            placeholder="Leave empty to keep current"
            type="number"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(34,197,94,0.4)' },
                '&:hover fieldset': { borderColor: '#22c55e' },
                '&.Mui-focused fieldset': { borderColor: '#22c55e' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#22c55e' },
            }}
          />

          {error && (
            <Typography sx={{ mt: 2, fontSize: '12px', color: '#ef4444', textAlign: 'center' }}>
              âŒ {error}
            </Typography>
          )}

          {success && (
            <Typography sx={{ mt: 2, fontSize: '12px', color: '#22c55e', textAlign: 'center' }}>
              âœ… Position modified successfully!
            </Typography>
          )}

          <Typography sx={{ mt: 2, fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            ðŸ’¡ You can modify SL only, TP only, or both. Empty fields keep current values.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setModalOpen(false)}
            disabled={loading}
            sx={{
              flex: 1, color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleModify}
            disabled={loading}
            variant="contained"
            sx={{
              flex: 2,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              borderRadius: '12px',
              fontWeight: 700,
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Update Position'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PositionCard;

