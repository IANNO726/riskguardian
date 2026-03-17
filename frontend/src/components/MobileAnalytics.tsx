import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, LinearProgress, Avatar } from '@mui/material';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  AccountBalance,
  EmojiEvents,
  Cancel,
} from '@mui/icons-material';

interface AnalyticsData {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  winningTrades: number;
  losingTrades: number;
  avgRR: number;
  expectancy: number;
}

const MobileAnalytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({
    totalTrades: 127,
    winRate: 68.5,
    profitFactor: 2.4,
    avgWin: 245.30,
    avgLoss: 112.50,
    largestWin: 1250.00,
    largestLoss: 450.00,
    totalProfit: 21345.50,
    totalLoss: 8890.25,
    netProfit: 12455.25,
    winningTrades: 87,
    losingTrades: 40,
    avgRR: 2.2,
    expectancy: 98.07,
  });

  const [timeframe, setTimeframe] = useState('30D');

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, type: 'spring', stiffness: 100 }
    })
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)',
      pb: 2,
      pt: 2,
    }}>
      {/* Header with Timeframe Selector */}
      <Box sx={{ px: 2, mb: 3 }}>
        <Typography sx={{
          fontSize: '28px',
          fontWeight: 800,
          background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2,
        }}>
          Analytics
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
          {['7D', '30D', '90D', '1Y', 'ALL'].map((tf) => (
            <Chip
              key={tf}
              label={tf}
              onClick={() => setTimeframe(tf)}
              sx={{
                background: timeframe === tf ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.05)',
                color: timeframe === tf ? 'white' : 'rgba(255,255,255,0.6)',
                border: timeframe === tf ? '1px solid rgba(102,126,234,0.5)' : '1px solid rgba(255,255,255,0.1)',
                fontWeight: 700,
                fontSize: '12px',
                minWidth: '60px',
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Performance Overview - Hero Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        <Box sx={{
          m: 2,
          p: 3,
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.15) 100%)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(34,197,94,0.2)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(34,197,94,0.2)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #22c55e, #10b981, #14b8a6)',
          }
        }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography sx={{ 
              fontSize: '11px', 
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 600,
              mb: 1,
            }}>
              NET PROFIT
            </Typography>
            <Typography sx={{ 
              fontSize: '38px', 
              fontWeight: 900,
              color: '#22c55e',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              mb: 3,
            }}>
              +${data.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                  Total Profit
                </Typography>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>
                  ${data.totalProfit.toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                  Total Loss
                </Typography>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>
                  ${data.totalLoss.toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                  Trades
                </Typography>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                  {data.totalTrades}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </motion.div>

      {/* Key Metrics Grid */}
      <Box sx={{ px: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
        {[
          { label: 'Win Rate', value: `${data.winRate}%`, color: '#22c55e', icon: <EmojiEvents />, trend: 'up' },
          { label: 'Profit Factor', value: data.profitFactor.toFixed(1), color: '#3b82f6', icon: <ShowChart />, trend: 'up' },
          { label: 'Avg Win', value: `$${data.avgWin.toFixed(0)}`, color: '#22c55e', icon: <TrendingUp />, trend: 'up' },
          { label: 'Avg Loss', value: `$${data.avgLoss.toFixed(0)}`, color: '#ef4444', icon: <TrendingDown />, trend: 'down' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <Box sx={{
              p: 2.5,
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{
                  width: 36,
                  height: 36,
                  background: `linear-gradient(135deg, ${stat.color}33, ${stat.color}66)`,
                  color: stat.color,
                }}>
                  {stat.icon}
                </Avatar>
              </Box>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                {stat.label}
              </Typography>
              <Typography sx={{ fontSize: '24px', fontWeight: 800, color: stat.color }}>
                {stat.value}
              </Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Win/Loss Distribution */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants}>
        <Box sx={{
          mx: 2,
          mb: 3,
          p: 3,
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', mb: 3 }}>
            Win/Loss Distribution
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  Winning Trades
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '12px', color: '#22c55e', fontWeight: 700 }}>
                {data.winningTrades} ({data.winRate.toFixed(1)}%)
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={data.winRate}
              sx={{
                height: 8,
                borderRadius: 10,
                background: 'rgba(34,197,94,0.1)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #22c55e, #10b981)',
                  borderRadius: 10,
                }
              }}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  Losing Trades
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>
                {data.losingTrades} ({(100 - data.winRate).toFixed(1)}%)
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={100 - data.winRate}
              sx={{
                height: 8,
                borderRadius: 10,
                background: 'rgba(239,68,68,0.1)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                  borderRadius: 10,
                }
              }}
            />
          </Box>
        </Box>
      </motion.div>

      {/* Advanced Metrics */}
      <motion.div custom={5} initial="hidden" animate="visible" variants={cardVariants}>
        <Box sx={{
          mx: 2,
          mb: 3,
          p: 3,
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white', mb: 3 }}>
            Advanced Metrics
          </Typography>

          <Box sx={{ display: 'grid', gap: 2 }}>
            {[
              { label: 'Average R:R', value: `1:${data.avgRR.toFixed(1)}`, color: '#3b82f6' },
              { label: 'Expectancy', value: `$${data.expectancy.toFixed(2)}`, color: '#22c55e' },
              { label: 'Largest Win', value: `$${data.largestWin.toLocaleString()}`, color: '#22c55e' },
              { label: 'Largest Loss', value: `$${data.largestLoss.toLocaleString()}`, color: '#ef4444' },
            ].map((metric, i) => (
              <Box 
                key={metric.label}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  {metric.label}
                </Typography>
                <Typography sx={{ 
                  fontSize: '16px', 
                  fontWeight: 800, 
                  color: metric.color,
                  fontFamily: 'monospace',
                }}>
                  {metric.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </motion.div>

      {/* Performance Badge */}
      <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariants}>
        <Box sx={{
          mx: 2,
          mb: 2,
          p: 3,
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(102,126,234,0.2)',
          textAlign: 'center',
        }}>
          <EmojiEvents sx={{ fontSize: 48, color: '#f59e0b', mb: 1 }} />
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'white', mb: 0.5 }}>
            Profitable Trader
          </Typography>
          <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            You're in the top 15% of traders
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
};

export default MobileAnalytics;
