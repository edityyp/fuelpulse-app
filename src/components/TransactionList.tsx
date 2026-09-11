import React from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  Typography,
  Avatar,
  Stack,
} from '@mui/material';
import { CheckCircle, PendingActionsOutlined, ErrorOutline } from '@mui/icons-material';

interface Transaction {
  id: string;
  plate: string;
  volume: string;
  amount: string;
  payment: string;
  points: string;
  status: 'completed' | 'pending' | 'fraud';
  time?: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  title?: string;
  onTransactionClick?: (transaction: Transaction) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return { bg: '#E8F5E9', text: '#2E7D32', icon: CheckCircle };
    case 'pending':
      return { bg: '#FFF3E0', text: '#E65100', icon: PendingActionsOutlined };
    case 'fraud':
      return { bg: '#FFEBEE', text: '#C62828', icon: ErrorOutline };
    default:
      return { bg: '#F5F5F5', text: '#757575', icon: CheckCircle };
  }
};

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  title = 'Recent Transactions',
  onTransactionClick,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card sx={{ mb: 3, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
        <CardHeader
          title={title}
          titleTypographyProps={{
            variant: 'h6',
            fontWeight: 700,
          }}
          sx={{
            borderBottom: '1px solid #E0E0E0',
            pb: 2,
          }}
        />
        <CardContent sx={{ p: 0 }}>
          {transactions.length > 0 ? (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Volume
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Amount
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Points
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((row, index) => {
                    const status = getStatusColor(row.status);
                    const StatusIcon = status.icon;
                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => onTransactionClick?.(row)}
                        style={{
                          cursor: 'pointer',
                          transition: 'background-color 0.3s',
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 36, height: 36, fontSize: '0.9rem' }}>
                              {row.plate.charAt(0)}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {row.plate}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.volume}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F7A1F' }}>
                            {row.amount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.payment}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: '#E0E0E0',
                              backgroundColor: '#F9F9F9',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.points}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<StatusIcon sx={{ fontSize: '1rem !important' }} />}
                            label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                            size="small"
                            sx={{
                              backgroundColor: status.bg,
                              color: status.text,
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#757575' }}>
                No transactions found
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TransactionList;