import React, { useState } from 'react';
import { Box, Avatar, Typography, Button, Menu, MenuItem, Divider } from '@mui/material';
import { NavLink } from 'react-router-dom';
import {
  KeyboardArrowDown as ArrowDownIcon,
  CheckCircle as CheckIcon,
  Add as AddIcon,
  AccountBalance,
} from '@mui/icons-material';

const linkStyle = {
  padding: '12px 16px',
  borderRadius: 8,
  marginBottom: 6,
  textDecoration: 'none',
  color: '#9aa4b2',
  fontFamily: 'monospace',
  fontSize: 14,
  transition: 'all 0.2s ease'
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Mock account data
  const currentAccount = {
    id: 1,
    account_name: 'MT5 Demo',
    platform: 'MT5',
    account_number: '6009324',
    broker_name: 'Deriv',
    last_balance: 9963.29,
    currency: 'USD',
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#0b0b11' }}>
      {/* Sidebar */}
      <Box sx={{
        width: 230,
        background: 'linear-gradient(180deg,#05050a,#0b0b11)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        p: 2,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo */}
        <Box sx={{
          fontSize: 18,
          fontWeight: 700,
          mb: 3,
          color: '#60a5fa',
          fontFamily: 'monospace'
        }}>
          RiskGuardian
        </Box>

        {/* Account Switcher */}
        <Box sx={{ mb: 3 }}>
          <Button
            onClick={handleClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              borderRadius: '12px',
              background: 'rgba(96,165,250,0.1)',
              border: '1px solid rgba(96,165,250,0.2)',
              transition: 'all 0.2s ease',
              width: '100%',
              '&:hover': {
                background: 'rgba(96,165,250,0.15)',
                transform: 'translateY(-2px)',
              }
            }}
          >
            <Avatar sx={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
            }}>
              <AccountBalance sx={{ fontSize: 18 }} />
            </Avatar>
            
            <Box sx={{ textAlign: 'left', flex: 1 }}>
              <Typography sx={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'white',
                lineHeight: 1,
                mb: 0.3,
              }}>
                {currentAccount.account_name}
              </Typography>
              <Typography sx={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                lineHeight: 1,
              }}>
                ${currentAccount.last_balance.toFixed(2)}
              </Typography>
            </Box>

            <ArrowDownIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }} />
          </Button>

          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 300,
                background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography sx={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Current Account
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 1 }} />

            <MenuItem
              onClick={handleClose}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: '8px',
                py: 1.5,
                px: 2,
                background: 'rgba(56,189,248,0.1)',
                border: '1px solid rgba(56,189,248,0.3)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Avatar sx={{
                  width: 36,
                  height: 36,
                  background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
                }}>
                  <AccountBalance sx={{ fontSize: 20 }} />
                </Avatar>

                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                    <Typography sx={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'white',
                    }}>
                      {currentAccount.account_name}
                    </Typography>
                    <CheckIcon sx={{ fontSize: 14, color: '#22c55e' }} />
                  </Box>
                  <Typography sx={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.5)',
                  }}>
                    {currentAccount.platform} â€¢ {currentAccount.broker_name}
                  </Typography>
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#22c55e',
                    fontFamily: 'monospace',
                  }}>
                    ${currentAccount.last_balance.toFixed(2)}
                  </Typography>
                  <Typography sx={{
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.4)',
                  }}>
                    {currentAccount.currency}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

            <MenuItem
              onClick={handleClose}
              sx={{
                mx: 1,
                mb: 1,
                borderRadius: '8px',
                py: 1.2,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                '&:hover': {
                  background: 'rgba(34,197,94,0.15)',
                }
              }}
            >
              <AddIcon sx={{ mr: 1, color: '#22c55e', fontSize: 18 }} />
              <Typography sx={{ color: '#22c55e', fontWeight: 600, fontSize: '13px' }}>
                Add New Account
              </Typography>
            </MenuItem>
          </Menu>
        </Box>

        {/* Navigation Links */}
        <NavLink to="/" style={linkStyle} end
        className={({ isActive }) => isActive ? 'active' : ''}>
          Dashboard
        </NavLink>
        <NavLink to="/terminal" style={linkStyle}
        className={({ isActive }) => isActive ? 'active' : ''}>
          Terminal
        </NavLink>
        <NavLink to="/analytics" style={linkStyle}
        className={({ isActive }) => isActive ? 'active' : ''}>
          Analytics
        </NavLink>
        <NavLink to="/history" style={linkStyle}
        className={({ isActive }) => isActive ? 'active' : ''}>
          History
        </NavLink>
        <NavLink to="/journal" style={linkStyle}
        className={({ isActive }) => isActive ? 'active' : ''}>
          Journal
        </NavLink>
        <NavLink to="/settings" style={linkStyle}
        className={({ isActive }) => isActive ? 'active' : ''}>
          Settings
        </NavLink>

        {/* Version */}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Box sx={{
            p: 1.5,
            borderRadius: '8px',
            background: 'rgba(96,165,250,0.08)',
            border: '1px solid rgba(96,165,250,0.2)',
            textAlign: 'center'
          }}>
            <Typography sx={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.4)',
              mb: 0.3,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Version
            </Typography>
            <Typography sx={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#60a5fa',
            }}>
              v1.0.0 Beta
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{
        flex: 1,
        p: 4,
        color: '#fff'
      }}>
        {children}
      </Box>

      <style>{`
        .active {
          background: rgba(96,165,250,0.15);
          color: #60a5fa !important;
        }
        a:hover {
          background: rgba(255,255,255,0.05);
          color: #ffffff !important;
        }
      `}</style>
    </Box>
  );
};

export default AppShell;




