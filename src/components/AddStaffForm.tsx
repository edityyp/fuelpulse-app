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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { PersonAdd } from '@mui/icons-material';

interface AddStaffFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  loading?: boolean;
  error?: string;
}

const AddStaffForm: React.FC<AddStaffFormProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  error,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    active: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    try {
      await onSubmit(formData);
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'EMPLOYEE',
        active: true,
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
            background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <PersonAdd /> Add New Staff
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              fullWidth
              placeholder="John Doe"
            />
            <TextField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
              type="email"
              placeholder="john@example.com"
            />
            <TextField
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              fullWidth
              placeholder="+91 9876543210"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                name="role"
                value={formData.role}
                onChange={handleChange as any}
                label="Role"
              >
                <MenuItem value="EMPLOYEE">Employee</MenuItem>
                <MenuItem value="MANAGER">Manager</MenuItem>
                <MenuItem value="OWNER">Owner</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                />
              }
              label="Active"
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
            disabled={loading || !formData.name || !formData.email}
            sx={{
              background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Add Staff'}
          </Button>
        </DialogActions>
      </motion.div>
    </Dialog>
  );
};

export default AddStaffForm;