import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card, CardContent, Typography, useTheme, alpha } from '@mui/material';

interface ProfitChartProps {
  trades: any[];
}

const ProfitChart: React.FC<ProfitChartProps> = ({ trades }) => {
  const theme = useTheme();
  
  // Calculate cumulative profit
  const chartData = trades
    .sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
    .reduce((acc: any[], trade, index) => {
      const cumulativeProfit = index === 0 
        ? trade.profit 
        : acc[index - 1].cumulativeProfit + trade.profit;
      
      return [...acc, {
        date: new Date(trade.close_time).toLocaleDateString(),
        profit: trade.profit,
        cumulativeProfit: cumulativeProfit,
      }];
    }, []);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Profit Trend
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
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '8px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="cumulativeProfit" 
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              fill="url(#colorProfit)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ProfitChart;

