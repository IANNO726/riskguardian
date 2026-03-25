import React, { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()

  // Read token synchronously — localStorage is always available on refresh
  // We use a tiny loading state only to let React finish hydrating
  const [checking, setChecking] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    // This runs after the first render — localStorage is fully available
    try {
      const t = localStorage.getItem('access_token')
      setToken(t)
    } catch {
      setToken(null)
    }
    setChecking(false)
  }, [])

  // Show a brief spinner while we check (prevents flash redirect on refresh)
  if (checking) {
    return (
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08101e'
      }}>
        <CircularProgress size={32} sx={{ color: '#38bdf8' }} />
      </Box>
    )
  }

  if (!token) {
    // Save the page they were trying to reach so we can redirect back after login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
