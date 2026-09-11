import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

interface NewTransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  loading?: boolean;
  error?: string;
}

const NewTransactionForm: React.FC<NewTransactionFormProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  error,
}) => {
  const [formData, setFormData] = useState({
    plate: '',
    pump: '',
    volume: '',
    paymentMode: 'CASH',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      await onSubmit(formData);
      setFormData({
        plate: '',
        pump: '',
        volume: '',
        paymentMode: 'CASH',
        notes: '',
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.2rem',
          }}
        >
          New Transaction
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Vehicle Plate Number"
              name="plate"
              value={formData.plate}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., ABC1234"
              InputProps={{
                style: { borderRadius: 8 },
              }}
            />
            <FormControl fullWidth>
              <InputLabel>Pump Number</InputLabel>
              <Select
                name="pump"
                value={formData.pump}
                onChange={handleChange as any}
                label="Pump Number"
              >
                <MenuItem value="1">Pump 1</MenuItem>
                <MenuItem value="2">Pump 2</MenuItem>
                <MenuItem value="3">Pump 3</MenuItem>
                <MenuItem value="4">Pump 4</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Volume (Liters)"
              name="volume"
              value={formData.volume}
              onChange={handleChange}
              fullWidth
              type="number"
              placeholder="0.00"
            />
            <FormControl fullWidth>
              <InputLabel>Payment Mode</InputLabel>
              <Select
                name="paymentMode"
                value={formData.paymentMode}
                onChange={handleChange as any}
                label="Payment Mode"
              >
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="CARD">Card</MenuItem>
                <MenuItem value="WALLET">Wallet</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              fullWidth
              multiline
              rows={2}
              placeholder="Optional notes..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={onClose}
            sx={{
              color: '#757575',
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !formData.plate || !formData.volume}
            sx={{
              background: 'linear-gradient(135deg, #1F7A1F 0%, #4CAF50 100%)',
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Transaction'}
          </Button>
        </DialogActions>
      </motion.div>
    </Dialog>
  );
};

export default NewTransactionForm;