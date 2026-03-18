import React from 'react';
import { Box, Typography } from '@mui/material';

interface Props {
  profit: number;
  connected: boolean;
}

const TerminalHUD: React.FC<Props> = ({ profit, connected }) => {
  return (
    <Box sx={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      px: 3,
      py: 2,
      borderRadius: '14px',
      backdropFilter: 'blur(20px)',
      background: 'rgba(0,0,0,0.55)',
      border: `1px solid ${connected ? '#00e676' : '#ff5252'}`,
      boxShadow: connected
        ? '0 0 25px rgba(0,230,118,0.6)'
        : '0 0 25px rgba(255,82,82,0.6)',
      minWidth: 160
    }}>
      <Typography sx={{ fontSize: 11, opacity: 0.6 }}>
        LIVE PROFIT
      </Typography>

      <Typography sx={{
        fontSize: 22,
        fontWeight: 700,
        color: profit >= 0 ? '#00e676' : '#ff5252',
        fontFamily: 'monospace'
      }}>
        ${profit.toFixed(2)}
      </Typography>
    </Box>
  );
};

export default TerminalHUD;

