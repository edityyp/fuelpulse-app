import React from 'react';
import { motion } from 'framer-motion';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  LogoutOutlined,
  SettingsOutlined,
} from '@mui/icons-material';

interface TopAppBarProps {
  title: string;
  onMenuClick: () => void;
  notificationCount?: number;
  userName?: string;
  userRole?: string;
  onLogout: () => void;
  onSettings: () => void;
}

const TopAppBar: React.FC<TopAppBarProps> = ({
  title,
  onMenuClick,
  notificationCount = 0,
  userName = 'User',
  userRole = 'Employee',
  onLogout,
  onSettings,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <AppBar
        position="sticky"
        sx={{
          background: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
          boxShadow: '0 4px 12px rgba(31, 122, 31, 0.3)',
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 16px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={onMenuClick}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                fontSize: '1.3rem',
                letterSpacing: '-0.5px',
              }}
            >
              {title}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              color="inherit"
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <Badge badgeContent={notificationCount} color="error">
                <Notifications />
              </Badge>
            </IconButton>

            <IconButton
              onClick={handleMenuOpen}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem disabled>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {userName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#757575' }}>
                  {userRole}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                onSettings();
                handleMenuClose();
              }}
            >
              <SettingsOutlined sx={{ mr: 2 }} />
              Settings
            </MenuItem>
            <MenuItem
              onClick={() => {
                onLogout();
                handleMenuClose();
              }}
            >
              <LogoutOutlined sx={{ mr: 2 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
    </motion.div>
  );
};

export default TopAppBar;