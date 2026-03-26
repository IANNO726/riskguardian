import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { usePWA } from '../hooks/usePWA';

/**
 * PWAInstallBanner
 * Shows an "Add to Home Screen" banner on mobile browsers.
 * Add this to App.tsx inside the Router so it appears on all pages.
 */
const PWAInstallBanner: React.FC = () => {
  const { canInstall, isInstalled, isStandalone, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [visible,   setVisible]   = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('pwa_banner_dismissed');
    if (!wasDismissed && canInstall && !isInstalled && !isStandalone) {
      // Delay slightly so it doesn't pop up immediately on load
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }
  }, [canInstall, isInstalled, isStandalone]);

  const handleInstall = async () => {
    await promptInstall();
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!visible || dismissed) return null;

  return (
    <Box sx={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9999,
      p: 2, borderRadius: '18px',
      background: 'linear-gradient(135deg,#0d1f35,#0a1a14)',
      border: '1px solid rgba(56,189,248,0.3)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.1)',
      display: 'flex', alignItems: 'center', gap: 2,
      animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      '@keyframes slideUp': {
        '0%':   { transform: 'translateY(100px)', opacity: 0 },
        '100%': { transform: 'translateY(0)',      opacity: 1 },
      },
    }}>
      {/* Icon */}
      <Box sx={{
        width: 48, height: 48, borderRadius: '14px', flexShrink: 0,
        background: 'linear-gradient(135deg,rgba(56,189,248,0.3),rgba(34,197,94,0.2))',
        border: '1px solid rgba(56,189,248,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>
        🛡️
      </Box>

      {/* Text */}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
          Install RiskGuardian
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.3 }}>
          Add to home screen for instant access
        </Typography>
      </Box>

      {/* Buttons */}
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button
          onClick={handleDismiss}
          size="small"
          sx={{
            minWidth: 0, px: 1.5, py: 0.8, borderRadius: '10px',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12, textTransform: 'none',
            '&:hover': { color: 'rgba(255,255,255,0.6)' },
          }}>
          Later
        </Button>
        <Button
          onClick={handleInstall}
          size="small"
          sx={{
            px: 2, py: 0.8, borderRadius: '10px',
            background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
            color: 'white', fontSize: 12, fontWeight: 700,
            textTransform: 'none',
            '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(56,189,248,0.4)' },
          }}>
          Install
        </Button>
      </Box>
    </Box>
  );
};

export default PWAInstallBanner;