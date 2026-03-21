import React from 'react'
import { Box, Typography } from '@mui/material'

const KillSwitch: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null

  return (
    <Box sx={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ff5252',
      textAlign: 'center'
    }}>
      <Typography variant="h3">
        🔒 TRADING LOCKED
        <br />
        Risk violation detected
      </Typography>
    </Box>
  )
}

export default KillSwitch

