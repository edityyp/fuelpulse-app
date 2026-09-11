import React from 'react';
import { motion } from 'framer-motion';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import {
  Home,
  AddCircleOutline,
  History,
  Settings,
  MoreHoriz,
} from '@mui/icons-material';

interface BottomNavProps {
  value: string;
  onChange: (newValue: string) => void;
  showMore?: boolean;
  onMoreClick?: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({
  value,
  onChange,
  showMore = false,
  onMoreClick,
}) => {
  const navItems = [
    { label: 'Overview', value: 'Overview', icon: Home },
    { label: 'New', value: 'New transaction', icon: AddCircleOutline },
    { label: 'History', value: 'Transactions', icon: History },
    { label: 'Settings', value: 'Settings', icon: Settings },
  ];

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}
    >
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <BottomNavigation
          value={value}
          onChange={(event, newValue) => onChange(newValue)}
          sx={{
            backgroundColor: '#fff',
            '& .MuiBottomNavigationAction-root': {
              color: '#757575',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-selected': {
                color: '#1F7A1F',
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1.5rem',
              },
            },
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.value}
              label={item.label}
              value={item.value}
              icon={<item.icon />}
            />
          ))}
          {showMore && (
            <BottomNavigationAction
              label="More"
              icon={<MoreHoriz />}
              onClick={onMoreClick}
            />
          )}
        </BottomNavigation>
      </Paper>
    </motion.div>
  );
};

export default BottomNav;