import React from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  LocalGasStation,
  PointOfSale,
  PeopleAlt,
} from '@mui/icons-material';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  trend?: number;
  progress?: number;
  index?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
  trend,
  progress,
  index = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
          border: `2px solid ${color}30`,
          position: 'relative',
          overflow: 'hidden',
          '&:before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: 100,
            height: 100,
            backgroundColor: `${color}10`,
            borderRadius: '50%',
            transform: 'translate(30%, -30%)',
          },
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="body2" sx={{ color: '#757575', fontWeight: 500, mb: 1 }}>
                {title}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {value}
              </Typography>
              {subtitle && (
                <Typography variant="caption" sx={{ color: '#757575' }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            <Box
              sx={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: `${color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color,
              }}
            >
              {icon}
            </Box>
          </Box>

          {trend !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <TrendingUp
                sx={{
                  fontSize: '1rem',
                  color: trend >= 0 ? '#4CAF50' : '#F44336',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: trend >= 0 ? '#4CAF50' : '#F44336',
                  fontWeight: 600,
                }}
              >
                {trend >= 0 ? '+' : ''}{trend}%
              </Typography>
            </Box>
          )}

          {progress !== undefined && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Progress
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                  {progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: `${color}20`,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: color,
                  },
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface DashboardMetricsProps {
  metrics: {
    transactions: number;
    revenue: string;
    volume: string;
    cash: string;
    upi: string;
    points: string;
    fraud: number;
    today: number;
  };
}

const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ metrics }) => {
  const statCards = [
    {
      title: 'Total Revenue',
      value: metrics.revenue,
      icon: <PointOfSale sx={{ fontSize: '2rem' }} />,
      color: '#1F7A1F',
      subtitle: `${metrics.transactions} transactions`,
      trend: 12,
    },
    {
      title: 'Total Volume',
      value: metrics.volume,
      icon: <LocalGasStation sx={{ fontSize: '2rem' }} />,
      color: '#FF6B35',
      subtitle: 'Liters dispensed',
      trend: 8,
    },
    {
      title: 'Today Sales',
      value: metrics.today,
      icon: <TrendingUp sx={{ fontSize: '2rem' }} />,
      color: '#2196F3',
      subtitle: 'Current day',
      progress: 65,
    },
    {
      title: 'Points Earned',
      value: metrics.points,
      icon: <PeopleAlt sx={{ fontSize: '2rem' }} />,
      color: '#FFC107',
      subtitle: 'Customer loyalty',
      trend: 5,
    },
  ];

  return (
    <Box sx={{ mb: 4 }}>
      <Grid container spacing={2}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <StatCard {...card} index={index} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default DashboardMetrics;