import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface LoginFormProps {
  onSubmit: (credentials: { code: string }) => Promise<void>;
  loading?: boolean;
  error?: string;
  title?: string;
  subtitle?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  loading = false,
  error,
  title = 'Staff Login',
  subtitle = 'Enter your access code to continue',
}) => {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ code });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
      }}
    >
      <Container maxWidth="sm">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                background: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
                color: '#fff',
                py: 4,
                textAlign: 'center',
              }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                <Box
                  sx={{
                    fontSize: '3rem',
                    fontWeight: 700,
                    mb: 1,
                    letterSpacing: '-1px',
                  }}
                >
                  F
                </Box>
              </motion.div>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                FuelPulse
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Fuel Station Management System
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#757575', mb: 3 }}>
                {subtitle}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Access Code"
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={loading}
                  placeholder="Enter your staff code"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCode(!showCode)}
                          edge="end"
                          disabled={loading}
                        >
                          {showCode ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 3 }}
                />

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    type="submit"
                    disabled={!code || loading}
                    sx={{
                      background: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
                      fontWeight: 700,
                      py: 1.5,
                      fontSize: '1rem',
                      textTransform: 'none',
                      borderRadius: 2,
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={24} sx={{ mr: 1 }} />
                        Logging in...
                      </>
                    ) : (
                      'Login'
                    )}
                  </Button>
                </motion.div>
              </form>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#757575' }}>
                  Need help? Contact your station manager
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Container>
    </motion.div>
  );
};

export default LoginForm;