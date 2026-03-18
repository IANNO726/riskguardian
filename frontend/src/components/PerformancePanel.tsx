import React from 'react'
import { Box, Typography } from '@mui/material'

const PerformancePanel: React.FC<{
  winRate: number
  profitFactor: number
  expectancy: number
}> = ({ winRate, profitFactor, expectancy }) => (
  <Box sx={{ p: 2, background: '#151522', borderRadius: 2 }}>
    <Typography>Win Rate: {winRate}%</Typography>
    <Typography>Profit Factor: {profitFactor}</Typography>
    <Typography>Expectancy: {expectancy}</Typography>
  </Box>
)

export default PerformancePanel

