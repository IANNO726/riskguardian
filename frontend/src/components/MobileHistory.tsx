import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Avatar, Tabs, Tab, IconButton, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  SwapVert,
} from '@mui/icons-material';
import axios from 'axios';

interface Trade {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  price: number;
  price_open?: number;
  price_close?: number;
  profit: number;
  time: string;
  open_time?: string;
  close_time?: string;
  commission?: number;
  swap?: number;
}

const MobileHistory: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrades();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trades, filter, timeFilter, sortOrder]);

  const fetchTrades = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/trades/history');
      console.log('API Response:', response.data);
      setTrades(response.data.trades || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch trades:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...trades];

    // Apply time filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (timeFilter === 'today') {
      filtered = filtered.filter(t => {
        const tradeDate = new Date(t.close_time || t.time);
        return tradeDate >= today;
      });
    } else if (timeFilter === 'week') {
      filtered = filtered.filter(t => {
        const tradeDate = new Date(t.close_time || t.time);
        return tradeDate >= weekAgo;
      });
    } else if (timeFilter === 'month') {
      filtered = filtered.filter(t => {
        const tradeDate = new Date(t.close_time || t.time);
        return tradeDate >= monthAgo;
      });
    }

    // Apply win/loss filter
    if (filter === 'wins') {
      filtered = filtered.filter(t => (t.profit || 0) > 0);
    } else if (filter === 'losses') {
      filtered = filtered.filter(t => (t.profit || 0) < 0);
    }

    // Apply sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.close_time || a.time).getTime();
      const dateB = new Date(b.close_time || b.time).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    setFilteredTrades(filtered);
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const cardVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.05, type: 'spring', stiffness: 100 }
    }),
    exit: { opacity: 0, x: 20 }
  };

  // Calculate stats
  const totalTrades = filteredTrades.length;
  const totalProfit = filteredTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
  const winningTrades = filteredTrades.filter(t => (t.profit || 0) > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  if (loading) {
    return (
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)',
      }}>
        <CircularProgress sx={{ color: '#38bdf8' }} />
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)',
      pb: 2,
      pt: 2,
    }}>
      {/* Header */}
      <Box sx={{ px: 2, mb: 3 }}>
        <Typography sx={{
          fontSize: '28px',
          fontWeight: 800,
          background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2,
        }}>
          Trade History
        </Typography>

        {/* Summary Card */}
        <Box sx={{
          p: 2.5,
          borderRadius: '20px',
          background: totalProfit >= 0 
            ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.15) 100%)'
            : 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)',
          backdropFilter: 'blur(40px)',
          border: `1px solid ${totalProfit >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          mb: 2,
        }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                Total Trades
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>
                {totalTrades}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                Win Rate
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#22c55e' }}>
                {winRate.toFixed(0)}%
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                Total P&L
              </Typography>
              <Typography sx={{ 
                fontSize: '20px', 
                fontWeight: 800, 
                color: totalProfit >= 0 ? '#22c55e' : '#ef4444',
                fontFamily: 'monospace',
              }}>
                {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Filter Chips & Tabs */}
        <Box sx={{ mb: 2 }}>
          {/* Time Filter Chips */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, overflowX: 'auto', pb: 1 }}>
            {[
              { value: 'all', label: 'All' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ].map((tf) => (
              <Chip
                key={tf.value}
                label={tf.label}
                onClick={() => setTimeFilter(tf.value as any)}
                sx={{
                  height: '32px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: timeFilter === tf.value ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.05)',
                  color: timeFilter === tf.value ? 'white' : 'rgba(255,255,255,0.6)',
                  border: timeFilter === tf.value ? '1px solid rgba(102,126,234,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  minWidth: '70px',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </Box>

          {/* Win/Loss Filter Tabs & Sort */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs
              value={filter}
              onChange={(e, val) => setFilter(val)}
              sx={{
                minHeight: 'auto',
                '& .MuiTab-root': {
                  minHeight: 'auto',
                  minWidth: 'auto',
                  px: 2,
                  py: 1,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'none',
                  '&.Mui-selected': {
                    color: '#38bdf8',
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#38bdf8',
                  height: '3px',
                  borderRadius: '3px',
                }
              }}
            >
              <Tab label="All" value="all" />
              <Tab label="Wins" value="wins" />
              <Tab label="Losses" value="losses" />
            </Tabs>

            <IconButton 
              onClick={toggleSort}
              sx={{ 
                color: '#38bdf8',
                background: 'rgba(56,189,248,0.1)',
              }}
            >
              <SwapVert />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Trade List */}
      <Box sx={{ px: 2 }}>
        <AnimatePresence mode="popLayout">
          {filteredTrades.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '48px', opacity: 0.2, mb: 2 }}>📊</Typography>
              <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
                No trades found
              </Typography>
            </Box>
          ) : (
            filteredTrades.map((trade, i) => {
              const isProfit = (trade.profit || 0) >= 0;
              const entryPrice = trade.price_open || trade.price || 0;
              const exitPrice = trade.price_close || trade.price || 0;
              const tradeTime = trade.close_time || trade.time;
              const openTime = trade.open_time || trade.time;

              return (
                <motion.div
                  key={trade.ticket}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={cardVariants}
                  layout
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
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      background: isProfit ? '#22c55e' : '#ef4444',
                      boxShadow: `0 0 20px ${isProfit ? '#22c55e' : '#ef4444'}`,
                    }
                  }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{
                          width: 40,
                          height: 40,
                          background: isProfit 
                            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        }}>
                          {isProfit ? <TrendingUp /> : <TrendingDown />}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: '16px', fontWeight: 800, color: 'white', mb: 0.3 }}>
                            {trade.symbol}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip 
                              label={trade.type}
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: trade.type.toLowerCase().includes('buy') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                                color: trade.type.toLowerCase().includes('buy') ? '#22c55e' : '#ef4444',
                                border: `1px solid ${trade.type.toLowerCase().includes('buy') ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                              }}
                            />
                            <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                              #{trade.ticket}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ 
                          fontSize: '18px', 
                          fontWeight: 800, 
                          color: isProfit ? '#22c55e' : '#ef4444',
                          fontFamily: 'monospace',
                          mb: 0.3,
                        }}>
                          {isProfit ? '+' : ''}${(trade.profit || 0).toFixed(2)}
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                          {formatDate(tradeTime)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Trade Details Grid */}
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 1fr', 
                      gap: 2,
                      pt: 2,
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <Box>
                        <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>
                          Volume
                        </Typography>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>
                          {trade.volume} lots
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>
                          Entry
                        </Typography>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>
                          {entryPrice.toFixed(5)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>
                          Exit
                        </Typography>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>
                          {exitPrice.toFixed(5)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Time Info */}
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      pt: 1.5,
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      mt: 1.5,
                    }}>
                      <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                        Open: {formatTime(openTime)}
                      </Typography>
                      <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                        Close: {formatTime(tradeTime)}
                      </Typography>
                    </Box>
                  </Box>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

export default MobileHistory;
