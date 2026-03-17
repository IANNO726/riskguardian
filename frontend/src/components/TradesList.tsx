import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Chip, Box, Card, CardContent, Grid, alpha, useTheme
} from '@mui/material';
import { TrendingUp, TrendingDown, EmojiEvents, ShowChart } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { motion } from 'framer-motion';
import { getTrades, getTradeStats } from '../services/api';

interface Trade {
  id: number;
  ticket: string;
  symbol: string;
  type: string;
  volume: number;
  open_price: number;
  close_price: number;
  profit: number;
  status: string;
  open_time: string;
  close_time: string;
}

// Animated Counter Component (inline)
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ 
  value, 
  duration = 1.5, 
  decimals = 0,
  prefix = '', 
  suffix = '' 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      if (progress < 1) {
        setCount(value * progress);
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  const formatNumber = (num: number) => {
    return num.toFixed(decimals);
  };

  return (
    <motion.span
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}{formatNumber(count)}{suffix}
    </motion.span>
  );
};

const TradesList: React.FC = () => {
  const theme = useTheme();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tradesData, statsData] = await Promise.all([
        getTrades(),
        getTradeStats()
      ]);
      console.log('Trades:', tradesData);
      console.log('Stats:', statsData);
      
      // FIX: Ensure trades is always an array
      const tradesArray = Array.isArray(tradesData) ? tradesData : [];
      setTrades(tradesArray);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setTrades([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Calculate cumulative profit for chart
  const getChartData = () => {
    // FIX: Add safety check
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return [];
    }
    
    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime()
    );

    return sortedTrades.reduce((acc: any[], trade, index) => {
      const cumulativeProfit = index === 0 
        ? trade.profit 
        : acc[index - 1].cumulativeProfit + trade.profit;
      
      return [...acc, {
        date: new Date(trade.close_time).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        profit: trade.profit,
        cumulativeProfit: Number(cumulativeProfit.toFixed(2)),
      }];
    }, []);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Typography variant="h6" color="textSecondary">Loading...</Typography>
      </Box>
    );
  }

  const chartData = getChartData();

  return (
    <Box sx={{ p: 3 }}>
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Total Profit
                    </Typography>
                    <Typography variant="h4" sx={{ color: (stats.total_profit || 0) >= 0 ? 'success.main' : 'error.main' }}>
                      {(stats.total_profit || 0) >= 0 ? '$' : '-$'}
                      <AnimatedCounter 
                        value={Math.abs(stats.total_profit || 0)} 
                        decimals={2} 
                        duration={2}
                      />
                    </Typography>
                  </Box>
                  <ShowChart sx={{ fontSize: 40, color: 'primary.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Win Rate
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      <AnimatedCounter 
                        value={stats.win_rate || 0} 
                        decimals={1} 
                        suffix="%" 
                        duration={1.8}
                      />
                    </Typography>
                  </Box>
                  <EmojiEvents sx={{ fontSize: 40, color: 'success.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Total Trades
                    </Typography>
                    <Typography variant="h4" color="info.main">
                      <AnimatedCounter 
                        value={stats.total_trades || 0} 
                        duration={1.2}
                      />
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: 'info.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Avg Trade
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {(stats.average_trade || 0) >= 0 ? '$' : '-$'}
                      <AnimatedCounter 
                        value={Math.abs(stats.average_trade || 0)} 
                        decimals={2} 
                        duration={1.6}
                      />
                    </Typography>
                  </Box>
                  <TrendingDown sx={{ fontSize: 40, color: 'warning.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Profit Chart */}
      {chartData.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              📈 Cumulative Profit Trend
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.2)} />
                <XAxis 
                  dataKey="date" 
                  stroke={theme.palette.text.secondary}
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke={theme.palette.text.secondary}
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: any) => [`$${value.toFixed(2)}`, 'Cumulative Profit']}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulativeProfit" 
                  stroke={theme.palette.primary.main}
                  strokeWidth={3}
                  fill="url(#colorProfit)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Trades Table */}
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
            📊 Recent Trades
          </Typography>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableCell sx={{ fontWeight: 600 }}>Ticket</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Symbol</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Volume</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Open Price</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Close Price</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Profit</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Open Time</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Close Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!trades || trades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography color="textSecondary" sx={{ py: 4 }}>
                        No trades available
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  trades.map((trade) => (
                    <TableRow 
                      key={trade.id}
                      sx={{ 
                        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.02) },
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <TableCell>{trade.ticket}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{trade.symbol}</TableCell>
                      <TableCell>
                        <Chip 
                          label={trade.type.toUpperCase()}
                          size="small"
                          color={trade.type === 'buy' ? 'success' : 'error'}
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>{trade.volume || 0}</TableCell>
                      <TableCell>{(trade.open_price || 0).toFixed(5)}</TableCell>
                      <TableCell>{(trade.close_price || 0).toFixed(5)}</TableCell>
                      <TableCell sx={{ 
                        color: (trade.profit || 0) >= 0 ? 'success.main' : 'error.main',
                        fontWeight: 600
                      }}>
                        {formatCurrency(trade.profit || 0)}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={trade.status.toUpperCase()}
                          size="small"
                          color={trade.status === 'closed' ? 'default' : 'primary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDate(trade.open_time)}</TableCell>
                      <TableCell>{formatDate(trade.close_time)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TradesList;
