import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Chip, Box
} from '@mui/material';
import { getPositions } from '../services/api';
import PositionCard from './PositionCard';

interface Position {
  id: number;
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  stop_loss: number;
  take_profit: number;
  sl: number;
  tp: number;
  risk_reward_ratio: number;
}

const PositionsList: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      const response = await getPositions();
      setPositions(response.positions);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching positions:', error);
      setLoading(false);
    }
  };

  if (loading) return <Typography>Loading positions...</Typography>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Open Positions</Typography>

      {positions.length === 0 ? (
        <Typography color="textSecondary">No open positions</Typography>
      ) : (
        <>
          {/* Mobile Cards */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            {positions.map((position) => (
              <PositionCard
                key={position.ticket}
                position={{
                  ticket: position.ticket,
                  symbol: position.symbol,
                  type: position.type,
                  volume: position.volume,
                  price_open: position.price_open,
                  price_current: position.price_current,
                  profit: position.profit,
                  sl: position.sl ?? position.stop_loss,
                  tp: position.tp ?? position.take_profit,
                }}
                onModified={fetchPositions}
              />
            ))}
          </Box>

          {/* Desktop Table */}
          <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Ticket</TableCell>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Volume</TableCell>
                  <TableCell>Open Price</TableCell>
                  <TableCell>Current Price</TableCell>
                  <TableCell>Profit/Loss</TableCell>
                  <TableCell>SL</TableCell>
                  <TableCell>TP</TableCell>
                  <TableCell>R:R</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>{position.ticket}</TableCell>
                    <TableCell><strong>{position.symbol}</strong></TableCell>
                    <TableCell>
                      <Chip
                        label={position.type}
                        color={position.type === 'BUY' ? 'primary' : 'secondary'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{position.volume}</TableCell>
                    <TableCell>{position.price_open?.toFixed(5)}</TableCell>
                    <TableCell>{position.price_current?.toFixed(5)}</TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" color={position.profit >= 0 ? 'success.main' : 'error.main'}>
                        ${position.profit.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>{(position.sl ?? position.stop_loss)?.toFixed(5)}</TableCell>
                    <TableCell>{(position.tp ?? position.take_profit)?.toFixed(5)}</TableCell>
                    <TableCell>{position.risk_reward_ratio?.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default PositionsList;
