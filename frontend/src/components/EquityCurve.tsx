import React from 'react';
import { Box } from '@mui/material';

interface Props {
  data?: number[]; // �†� optional now
}

const EquityCurve: React.FC<Props> = ({ data }) => {

  // �œ… Safety guard �€” always fallback to empty array
  const safeData = Array.isArray(data) ? data : [];

  if (safeData.length < 2) {
    return (
      <Box sx={{
        height: 120,
        borderRadius: 2,
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
        fontSize: 12
      }}>
        Waiting for equity data�€�
      </Box>
    );
  }

  const max = Math.max(...safeData);
  const min = Math.min(...safeData);
  const range = max - min || 1;

  const points = safeData
    .map((v, i) => {
      const x = (i / (safeData.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Box sx={{ height: 120, background: '#111', borderRadius: 2, p: 1 }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <polyline
          fill="none"
          stroke="#00e676"
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    </Box>
  );
};

export default EquityCurve;


