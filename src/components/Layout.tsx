import React from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Fab,
  Snackbar,
  Alert,
  CircularProgress,
  Backdrop,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import TopAppBar from './TopAppBar';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import DashboardMetrics from './DashboardMetrics';
import TransactionList from './TransactionList';
import NewTransactionForm from './NewTransactionForm';
import AddStaffForm from './AddStaffForm';

interface LayoutProps {
  user: { name?: string; role?: string; code?: string } | null;
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  onSettings: () => void;
  metrics?: Record<string, unknown>;
  transactions?: unknown[];
  loading?: boolean;
  notice?: string;
  onNoticeClose?: () => void;
  onNewTransaction?: (data: Record<string, unknown>) => Promise<void>;
  onAddStaff?: (data: Record<string, unknown>) => Promise<void>;
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  user,
  currentView,
  onViewChange,
  onLogout,
  onSettings,
  metrics,
  transactions = [],
  loading = false,
  notice = '',
  onNoticeClose,
  onNewTransaction,
  onAddStaff,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [transactionFormOpen, setTransactionFormOpen] = React.useState(false);
  const [staffFormOpen, setStaffFormOpen] = React.useState(false);

  const menuItems = [
    'Overview',
    'New transaction',
    'Transactions',
    ...(user?.role !== 'EMPLOYEE' ? ['Staff', 'Customers', 'Pumps & fuel', 'Points', 'Coupons'] : []),
    ...(user?.role === 'OWNER' ? ['Settings', 'Audit log'] : []),
  ];

  const handleNewTransaction = async (data: Record<string, unknown>) => {
    if (onNewTransaction) {
      await onNewTransaction(data);
      setTransactionFormOpen(false);
    }
  };

  const handleAddStaff = async (data: Record<string, unknown>) => {
    if (onAddStaff) {
      await onAddStaff(data);
      setStaffFormOpen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ minHeight: '100vh', backgroundColor: '#F5F5F5' }}
    >
      <TopAppBar
        title={currentView}
        onMenuClick={() => setSidebarOpen(true)}
        notificationCount={0}
        userName={user?.name || 'User'}
        userRole={user?.role || 'Employee'}
        onLogout={onLogout}
        onSettings={onSettings}
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={user?.name || 'User'}
        userRole={user?.role || 'Employee'}
        onNavigate={onViewChange}
        menuItems={menuItems}
      />

      <Box
        component="main"
        sx={{
          pb: 10,
          pt: 2,
          px: 2,
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
        {/* Overview Section */}
        {currentView === 'Overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {metrics && <DashboardMetrics metrics={metrics} />}
            <TransactionList transactions={transactions.slice(0, 10)} />
          </motion.div>
        )}

        {/* New Transaction Section */}
        {currentView === 'New transaction' && (
          <motion.div
            key="new-transaction"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                textAlign: 'center',
                py: 4,
              }}
            >
              <Fab
                color="primary"
                size="large"
                onClick={() => setTransactionFormOpen(true)}
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '2rem',
                  mb: 2,
                  background: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
                }}
              >
                <Add />
              </Fab>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                Click the button or tap to create a new transaction
              </motion.div>
            </Box>
          </motion.div>
        )}

        {/* Transactions Section */}
        {currentView === 'Transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TransactionList transactions={transactions} title="All Transactions" />
          </motion.div>
        )}

        {/* Staff Section */}
        {currentView === 'Staff' && (
          <motion.div
            key="staff"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Fab
                color="primary"
                size="large"
                onClick={() => setStaffFormOpen(true)}
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '2rem',
                  mb: 2,
                  background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                }}
              >
                <Add />
              </Fab>
              <div>Add Staff Member</div>
            </Box>
          </motion.div>
        )}

        {children}
      </Box>

      {/* Floating Action Button for Quick Add */}
      {currentView === 'Overview' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Fab
            color="primary"
            aria-label="add"
            onClick={() => setTransactionFormOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 80,
              right: 16,
              background: 'linear-gradient(135deg, #FF6B35 0%, #FFB74D 100%)',
              boxShadow: '0 8px 24px rgba(255, 107, 53, 0.4)',
              width: 64,
              height: 64,
              '&:hover': {
                transform: 'scale(1.1)',
                boxShadow: '0 12px 32px rgba(255, 107, 53, 0.6)',
              },
            }}
          >
            <Add sx={{ fontSize: '1.8rem' }} />
          </Fab>
        </motion.div>
      )}

      <BottomNav value={currentView} onChange={onViewChange} />

      {/* Forms */}
      <NewTransactionForm
        open={transactionFormOpen}
        onClose={() => setTransactionFormOpen(false)}
        onSubmit={handleNewTransaction}
        loading={loading}
      />

      <AddStaffForm
        open={staffFormOpen}
        onClose={() => setStaffFormOpen(false)}
        onSubmit={handleAddStaff}
        loading={loading}
      />

      {/* Notifications */}
      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={onNoticeClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={onNoticeClose}
          severity="success"
          sx={{
            width: '100%',
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {notice}
        </Alert>
      </Snackbar>

      {/* Loading Backdrop */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </motion.div>
  );
};

export default Layout;