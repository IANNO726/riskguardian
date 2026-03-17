import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  Avatar,
  Divider,
} from '@mui/material';
import {
  KeyboardArrowDown as ArrowDownIcon,
  CheckCircle as CheckIcon,
  Add as AddIcon,
  AccountBalance,
} from '@mui/icons-material';

const AccountSwitcher: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Temporary mock account (until authentication is added)
  const currentAccount = {
    id: 1,
    account_name: 'MT5 Demo Account',
    platform: 'MT5',
    account_number: '6009324',
    broker_name: 'Deriv',
    last_balance: 9963.29,
    last_equity: 10280.67,
    currency: 'USD',
  };

  const mockAccounts = [currentAccount];

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 1.5,
          borderRadius: '14px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          transition: 'all 0.2s ease',
          width: '100%',
          '&:hover': {
            background: 'rgba(255,255,255,0.08)',
            transform: 'translateY(-2px)',
          }
        }}
      >
        <Avatar sx={{
          width: 36,
          height: 36,
          background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
        }}>
          <AccountBalance />
        </Avatar>
        
        <Box sx={{ textAlign: 'left', flex: 1 }}>
          <Typography sx={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1,
            mb: 0.5,
          }}>
            {currentAccount.account_name}
          </Typography>
          <Typography sx={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1,
          }}>
            {currentAccount.platform} • {currentAccount.account_number}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#22c55e',
            fontFamily: '"DM Mono", monospace',
            lineHeight: 1,
            mb: 0.5,
          }}>
            ${currentAccount.last_balance.toFixed(2)}
          </Typography>
          <Typography sx={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
            lineHeight: 1,
          }}>
            Balance
          </Typography>
        </Box>

        <ArrowDownIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 350,
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)',
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Switch Account ({mockAccounts.length})
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 1 }} />

        {mockAccounts.map((account) => (
          <MenuItem
            key={account.id}
            onClick={handleClose}
            selected={true}
            sx={{
              mx: 1,
              mb: 0.5,
              borderRadius: '12px',
              py: 1.5,
              px: 2,
              background: 'rgba(56,189,248,0.1)',
              border: '1px solid rgba(56,189,248,0.3)',
              '&:hover': {
                background: 'rgba(255,255,255,0.05)',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Avatar sx={{
                width: 40,
                height: 40,
                background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
              }}>
                <AccountBalance />
              </Avatar>

              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'white',
                  }}>
                    {account.account_name}
                  </Typography>
                  <CheckIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                </Box>
                <Typography sx={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                }}>
                  {account.platform} • {account.broker_name}
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#22c55e',
                  fontFamily: '"DM Mono", monospace',
                }}>
                  ${account.last_balance.toFixed(2)}
                </Typography>
                <Typography sx={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  {account.currency}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        ))}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

        <MenuItem
          onClick={handleClose}
          sx={{
            mx: 1,
            mb: 1,
            borderRadius: '12px',
            py: 1.5,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            '&:hover': {
              background: 'rgba(34,197,94,0.15)',
            }
          }}
        >
          <AddIcon sx={{ mr: 1, color: '#22c55e' }} />
          <Typography sx={{ color: '#22c55e', fontWeight: 600 }}>
            Add New Account
          </Typography>
        </MenuItem>
      </Menu>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      `}</style>
    </>
  );
};

export default AccountSwitcher;
