import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import { getCurrentUser, updateCurrentUser } from '../services/api';

function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    full_name: '',
  });
  const [password, setPassword] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!cancelled) {
          setProfile({
            username: user.username || '',
            email: user.email || '',
            full_name: user.full_name || '',
          });
        }
      } catch (e) {
        if (!cancelled) {
          setSnackbar({ open: true, message: e.message || 'Failed to load profile', severity: 'error' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleProfileChange = (field) => (e) => {
    setProfile((p) => ({ ...p, [field]: e.target.value }));
  };

  const handlePasswordChange = (field) => (e) => {
    setPassword((p) => ({ ...p, [field]: e.target.value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        username: profile.username.trim() || undefined,
        email: profile.email.trim() || undefined,
        full_name: profile.full_name.trim() || undefined,
      };
      await updateCurrentUser(payload);
      setSnackbar({ open: true, message: 'Profile updated', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.detail || e.message || 'Update failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (password.new_password !== password.confirm_password) {
      setSnackbar({ open: true, message: 'New passwords do not match', severity: 'error' });
      return;
    }
    if (password.new_password.length < 8) {
      setSnackbar({ open: true, message: 'New password must be at least 8 characters', severity: 'error' });
      return;
    }
    setSaving(true);
    try {
      await updateCurrentUser({
        current_password: password.current_password,
        new_password: password.new_password,
      });
      setPassword({ current_password: '', new_password: '', confirm_password: '' });
      setSnackbar({ open: true, message: 'Password updated', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.detail || e.message || 'Password update failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography>Loading profile…</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Account settings
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PersonIcon color="action" />
          <Typography variant="subtitle1">Profile</Typography>
        </Box>
        <TextField
          fullWidth
          label="Username"
          value={profile.username}
          onChange={handleProfileChange('username')}
          margin="normal"
          required
        />
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={profile.email}
          onChange={handleProfileChange('email')}
          margin="normal"
          required
        />
        <TextField
          fullWidth
          label="Full name"
          value={profile.full_name}
          onChange={handleProfileChange('full_name')}
          margin="normal"
        />
        <Button
          variant="contained"
          onClick={handleSaveProfile}
          disabled={saving}
          sx={{ mt: 2 }}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LockIcon color="action" />
          <Typography variant="subtitle1">Change password</Typography>
        </Box>
        <TextField
          fullWidth
          label="Current password"
          type="password"
          value={password.current_password}
          onChange={handlePasswordChange('current_password')}
          margin="normal"
          autoComplete="current-password"
        />
        <TextField
          fullWidth
          label="New password"
          type="password"
          value={password.new_password}
          onChange={handlePasswordChange('new_password')}
          margin="normal"
          autoComplete="new-password"
          helperText="At least 8 characters"
        />
        <TextField
          fullWidth
          label="Confirm new password"
          type="password"
          value={password.confirm_password}
          onChange={handlePasswordChange('confirm_password')}
          margin="normal"
          autoComplete="new-password"
        />
        <Button
          variant="outlined"
          onClick={handleChangePassword}
          disabled={saving || !password.current_password || !password.new_password}
          sx={{ mt: 2 }}
        >
          {saving ? 'Updating…' : 'Update password'}
        </Button>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default Profile;
