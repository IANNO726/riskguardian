import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Avatar, Chip, LinearProgress, Button } from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Refresh,
  Notifications,
  AccountBalance,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface DashboardData {
  balance: number;
  equity: number;
  dailyPnl: number;
  dailyPnlPct: number;
  positions: number;
  riskLevel: number;
}

interface Alert {
  id: number;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  time: Date;
}

const MobileDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    balance: 9963.29,
    equity: 10194.70,
    dailyPnl: 231.41,
    dailyPnlPct: 2.32,
    positions: 1,
    riskLevel: 42,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: 1, type: 'success', message: 'MT5 Connected - Account 6009324', time: new Date() },
    { id: 2, type: 'success', message: 'Daily profit: +$228.08 USD', time: new Date() },
    { id: 3, type: 'info', message: 'Position open: Jump 75 Index BUY 0.15 lot, P&L: $11.02', time: new Date() },
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAlerts(prev => [{ 
        id: Date.now(), 
        type: 'info', 
        message: 'Data refreshed successfully', 
        time: new Date() 
      }, ...prev]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCloseAll = () => {
    if (window.confirm('⚠️ Are you sure you want to close ALL positions?')) {
      setAlerts(prev => [{ 
        id: Date.now(), 
        type: 'warning', 
        message: 'Close All feature coming soon', 
        time: new Date() 
      }, ...prev]);
    }
  };

  const handlePauseTrading = () => {
    setAlerts(prev => [{ 
      id: Date.now(), 
      type: 'info', 
      message: 'Pause Trading feature coming soon', 
      time: new Date() 
    }, ...prev]);
  };

  const handleExportReport = () => {
    setAlerts(prev => [{ 
      id: Date.now(), 
      type: 'info', 
      message: 'Export Report feature coming soon', 
      time: new Date() 
    }, ...prev]);
  };

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
      {/* Main Balance Card - Hero Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        <Box sx={{
          m: 2,
          mt: 1,
          p: 3,
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(102,126,234,0.2)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)',
          }
        }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography sx={{ 
              fontSize: '12px', 
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 600,
              mb: 1,
            }}>
              TOTAL BALANCE
            </Typography>
            <Typography sx={{ 
              fontSize: '42px', 
              fontWeight: 900,
              color: 'white',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              mb: 3,
            }}>
              ${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Typography>

            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                  Equity
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
                  ${data.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
                  Today's P&L
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {data.dailyPnl >= 0 ? <TrendingUp sx={{ fontSize: 16, color: '#22c55e' }} /> : <TrendingDown sx={{ fontSize: 16, color: '#ef4444' }} />}
                  <Typography sx={{ 
                    fontSize: '18px', 
                    fontWeight: 700, 
                    color: data.dailyPnl >= 0 ? '#22c55e' : '#ef4444',
                    fontFamily: 'monospace',
                  }}>
                    ${Math.abs(data.dailyPnl).toFixed(2)}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: data.dailyPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    ({data.dailyPnlPct >= 0 ? '+' : ''}{data.dailyPnlPct}%)
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </motion.div>

      {/* Quick Stats Grid */}
      <Box sx={{ px: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
        {[
          { label: 'Positions', value: data.positions, color: '#3b82f6', icon: '📊' },
          { label: 'Risk Level', value: `${data.riskLevel}%`, color: '#f59e0b', icon: '⚡' },
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
              <Typography sx={{ fontSize: '28px', mb: 0.5 }}>{stat.icon}</Typography>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', mb: 1 }}>
                {stat.label}
              </Typography>
              <Typography sx={{ fontSize: '24px', fontWeight: 800, color: stat.color }}>
                {stat.value}
              </Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Risk Monitor - With 3 metrics */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
        <Box sx={{
          mx: 2,
          mb: 3,
          p: 3,
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
              Risk Monitor
            </Typography>
            <Chip 
              label="MEDIUM"
              size="small"
              sx={{
                background: 'rgba(245,158,11,0.2)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.5)',
                fontSize: '10px',
                fontWeight: 700,
              }}
            />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Daily Loss
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                2.3 / 5%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={46} sx={{
              height: 6, borderRadius: 10, background: 'rgba(34,197,94,0.1)',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: 10 }
            }} />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Max Drawdown
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                2.3 / 10%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={23} sx={{
              height: 6, borderRadius: 10, background: 'rgba(34,197,94,0.1)',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: 10 }
            }} />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Risk per Trade
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
                2.3 / 1%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={230} sx={{
              height: 6, borderRadius: 10, background: 'rgba(239,68,68,0.1)',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: 10 }
            }} />
          </Box>
        </Box>
      </motion.div>

      {/* Live Alerts - Full Display */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}>
        <Box sx={{
          mx: 2,
          mb: 3,
          p: 3,
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
              Live Alerts ({alerts.length})
            </Typography>
            <Chip 
              label="REAL-TIME"
              size="small"
              sx={{
                background: 'rgba(100,181,246,0.2)',
                color: '#64b5f6',
                border: '1px solid rgba(100,181,246,0.5)',
                fontSize: '10px',
                fontWeight: 700,
              }}
            />
          </Box>

          <Box sx={{ maxHeight: 250, overflowY: 'auto' }}>
            {alerts.map(alert => (
              <Box key={alert.id} sx={{
                mb: 2,
                p: 2,
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${
                  alert.type === 'success' ? 'rgba(34,197,94,0.2)' :
                  alert.type === 'warning' ? 'rgba(245,158,11,0.2)' :
                  alert.type === 'error' ? 'rgba(239,68,68,0.2)' :
                  'rgba(100,181,246,0.2)'
                }`,
                borderLeft: `4px solid ${
                  alert.type === 'success' ? '#22c55e' :
                  alert.type === 'warning' ? '#f59e0b' :
                  alert.type === 'error' ? '#ef4444' :
                  '#64b5f6'
                }`,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '18px' }}>
                    {alert.type === 'success' ? '🟢' :
                     alert.type === 'warning' ? '🟡' :
                     alert.type === 'error' ? '🔴' : '🔵'}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '12px', color: '#fff', mb: 0.5 }}>
                      {alert.message}
                    </Typography>
                    <Typography sx={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: 'monospace',
                    }}>
                      {alert.time.toLocaleTimeString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </motion.div>

      {/* Quick Actions */}
      <Box sx={{
        mx: 2,
        mb: 2,
        p: 2,
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 2,
      }}>
        <Button onClick={handleCloseAll} sx={{
          py: 1.5,
          borderRadius: '12px',
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'none',
        }}>
          🛑 Close All
        </Button>

        <Button onClick={handlePauseTrading} sx={{
          py: 1.5,
          borderRadius: '12px',
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.3)',
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'none',
        }}>
          ⏸ Pause
        </Button>

        <Button onClick={handleExportReport} sx={{
          py: 1.5,
          borderRadius: '12px',
          background: 'rgba(100,181,246,0.15)',
          border: '1px solid rgba(100,181,246,0.3)',
          color: '#64b5f6',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'none',
        }}>
          📊 Export
        </Button>

        <Button onClick={handleRefresh} sx={{
          py: 1.5,
          borderRadius: '12px',
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.3)',
          color: '#22c55e',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'none',
        }}>
          🔄 Refresh
        </Button>
      </Box>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
};

export default MobileDashboard;
