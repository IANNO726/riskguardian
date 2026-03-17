import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Drawer,
  useMediaQuery,
  useTheme,
  Tooltip,
  Avatar,
  Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Terminal as TerminalIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Book as BookIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  TrendingUp,
  AccountBalance,
} from '@mui/icons-material';
import AccountSwitcher from './AccountSwitcher';

const menuItems = [
  { path: '/app', label: 'Dashboard', icon: <DashboardIcon />, color: '#22c55e' },
  { path: '/app/terminal', label: 'Terminal', icon: <TerminalIcon />, color: '#3b82f6' },
  { path: '/app/analytics', label: 'Analytics', icon: <AnalyticsIcon />, color: '#a855f7' },
  { path: '/app/history', label: 'History', icon: <HistoryIcon />, color: '#f59e0b' },
  { path: '/app/journal', label: 'Journal', icon: <BookIcon />, color: '#ec4899' },
  { path: '/app/settings', label: 'Settings', icon: <SettingsIcon />, color: '#64b5f6' },
];

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 80;

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const drawerContent = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        right: 0,
        width: '1px',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(56,189,248,0.5) 0%, rgba(168,85,247,0.5) 100%)',
        opacity: 0.3,
      }
    }}>
      {/* Header */}
      <Box sx={{
        p: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          transition: 'opacity 0.3s ease',
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 'auto',
          overflow: 'hidden',
        }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(34,197,94,0.3)',
            flexShrink: 0,
          }}>
            <TrendingUp sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          {!collapsed && (
            <Box sx={{ flexShrink: 0 }}>
              <Typography sx={{
                fontSize: '18px',
                fontWeight: 800,
                background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}>
                RiskGuardian
              </Typography>
              <Typography sx={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}>
                AI Trading Agent
              </Typography>
            </Box>
          )}
        </Box>

        {!isMobile && (
          <IconButton
            onClick={() => setCollapsed(!collapsed)}
            sx={{
              color: 'rgba(255,255,255,0.6)',
              flexShrink: 0,
              '&:hover': {
                background: 'rgba(255,255,255,0.05)',
                color: '#38bdf8',
              }
            }}
          >
            {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
          </IconButton>
        )}
      </Box>

      {/* Account Switcher */}
      <Box sx={{
        p: 2,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {!collapsed ? (
          <AccountSwitcher />
        ) : (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            '&:hover': {
              background: 'rgba(255,255,255,0.05)',
              transform: 'translateY(-2px)',
            }
          }}>
            <Avatar sx={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
              border: '2px solid rgba(59,130,246,0.3)',
            }}>
              <AccountBalance />
            </Avatar>
          </Box>
        )}
      </Box>

      {/* Navigation Menu */}
      <List sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Tooltip
              key={item.path}
              title={collapsed ? item.label : ''}
              placement="right"
              arrow
            >
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  onClick={() => handleNavigate(item.path)}
                  sx={{
                    borderRadius: '12px',
                    py: 1.5,
                    px: 2,
                    transition: 'all 0.3s ease',
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                    position: 'relative',
                    overflow: 'hidden',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    minHeight: '48px',
                    '&::before': active ? {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '3px',
                      background: item.color,
                      boxShadow: `0 0 12px ${item.color}`,
                    } : {},
                    '&:hover': {
                      background: 'rgba(255,255,255,0.05)',
                      transform: 'translateX(4px)',
                    }
                  }}
                >
                  <ListItemIcon sx={{
                    minWidth: collapsed ? 'auto' : 40,
                    color: active ? item.color : 'rgba(255,255,255,0.6)',
                    transition: 'all 0.3s ease',
                    justifyContent: 'center',
                    '& svg': {
                      fontSize: 24,
                      filter: active ? `drop-shadow(0 0 8px ${item.color}40)` : 'none',
                    }
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        sx: {
                          fontSize: '14px',
                          fontWeight: active ? 700 : 500,
                          color: active ? 'white' : 'rgba(255,255,255,0.7)',
                          letterSpacing: '0.02em',
                        }
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>
          );
        })}
      </List>

      {/* Footer */}
      <Box sx={{
        p: 2,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Box sx={{
          p: 2,
          borderRadius: '12px',
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.2)',
          textAlign: collapsed ? 'center' : 'left',
        }}>
          {!collapsed ? (
            <>
              <Typography sx={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
                mb: 0.5,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Version
              </Typography>
              <Typography sx={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#38bdf8',
              }}>
                v1.0.0 Beta
              </Typography>
            </>
          ) : (
            <Typography sx={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#38bdf8',
            }}>
              v1.0
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop Drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
              boxSizing: 'border-box',
              border: 'none',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
              overflow: 'hidden',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              border: 'none',
              background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
};

export default Sidebar;








