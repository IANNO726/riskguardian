import React from 'react';
import { Box } from '@mui/material';

interface Props {
  events: string[];
}

const TradeTape: React.FC<Props> = ({ events }) => {
  return (
    <Box sx={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 40,
      background: '#000',
      color: '#0f0',
      fontFamily: 'monospace',
      overflow: 'hidden',
      whiteSpace: 'nowrap'
    }}>
      <div style={{
        display: 'inline-block',
        paddingLeft: '100%',
        animation: 'scroll 20s linear infinite'
      }}>
        {events.join('   â€¢   ')}
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </Box>
  );
};

export default TradeTape;

