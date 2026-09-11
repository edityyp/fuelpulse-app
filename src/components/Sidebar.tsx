import React from 'react';
import { motion } from 'framer-motion';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Home,
  AddCircleOutline,
  History,
  People,
  DirectionsCar,
  LocalOffer,
  Settings,
  ReceiptLong,
  VerifiedOutlined,
} from '@mui/icons-material';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
  onNavigate: (view: string) => void;
  menuItems: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  userName = 'User',
  userRole = 'Employee',
  onNavigate,
  menuItems,
}) => {
  const handleNavigate = (item: string) => {
    onNavigate(item);
    onClose();
  };

  const getIcon = (label: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      Overview: <Home />,
      'New transaction': <AddCircleOutline />,
      Transactions: <History />,
      Staff: <People />,
      Customers: <DirectionsCar />,
      'Pumps & fuel': <LocalOffer />,
      Points: <VerifiedOutlined />,
      Coupons: <LocalOffer />,
      Settings: <Settings />,
      'Audit log': <ReceiptLong />,
    };
    return iconMap[label] || <Home />;
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          backgroundColor: '#F5F5F5',
        },
      }}
    >
      <motion.div
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        exit={{ x: -280 }}
        transition={{ duration: 0.3 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '16px',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              marginBottom: 2,
              padding: '16px 8px',
              backgroundColor: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
              borderRadius: 2,
              color: '#fff',
            }}
          >
            <Avatar
              sx={{
                width: 48,
                height: 48,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                fontSize: '1.2rem',
                fontWeight: 700,
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {userName}
              </Typography>
              <Chip
                label={userRole}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            </Box>
          </Box>

          <Divider sx={{ marginBottom: 2 }} />

          {/* Menu Items */}
          <List sx={{ flex: 1, overflow: 'auto' }}>
            {menuItems.map((item, index) => (
              <motion.div
                key={item}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <ListItem disablePadding sx={{ marginBottom: 1 }}>
                  <ListItemButton
                    onClick={() => handleNavigate(item)}
                    sx={{
                      borderRadius: 2,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        backgroundColor: 'rgba(31, 122, 31, 0.1)',
                        transform: 'translateX(4px)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(31, 122, 31, 0.2)',
                        color: '#1F7A1F',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: 'inherit',
                        minWidth: 40,
                      }}
                    >
                      {getIcon(item)}
                    </ListItemIcon>
                    <ListItemText
                      primary={item}
                      primaryTypographyProps={{
                        fontWeight: 500,
                        fontSize: '0.95rem',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              </motion.div>
            ))}
          </List>

          <Divider sx={{ marginTop: 2, marginBottom: 2 }} />

          {/* Footer Info */}
          <Box sx={{ padding: '8px', textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#757575' }}>
              FuelPulse v1.0
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </Drawer>
  );
};

export default Sidebar;