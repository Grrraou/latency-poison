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
  Link,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import BusinessIcon from '@mui/icons-material/Business';
import { getCurrentUser, updateCurrentUser, resendVerificationMe } from '../services/api';

const COUNTRY_OPTIONS = [
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'LU', label: 'Luxembourg' },
  { value: 'AT', label: 'Austria' },
  { value: 'PT', label: 'Portugal' },
  { value: 'IE', label: 'Ireland' },
  { value: 'PL', label: 'Poland' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
];

function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    email: '',
  });
  const [billing, setBilling] = useState({
    billing_first_name: '',
    billing_last_name: '',
    billing_company: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_postal_code: '',
    billing_city: '',
    billing_country: '',
  });
  const [password, setPassword] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [pendingEmail, setPendingEmail] = useState(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationLink, setVerificationLink] = useState(null);

  const loadUser = async () => {
    const user = await getCurrentUser();
    setProfile({
      email: user.email || '',
    });
    setPendingEmail(user.pending_email || null);
    setBilling({
      billing_first_name: user.billing_first_name || '',
      billing_last_name: user.billing_last_name || '',
      billing_company: user.billing_company || '',
      billing_address_line1: user.billing_address_line1 || '',
      billing_address_line2: user.billing_address_line2 || '',
      billing_postal_code: user.billing_postal_code || '',
      billing_city: user.billing_city || '',
      billing_country: user.billing_country || '',
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadUser();
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

  const handleResendVerification = async () => {
    setResendLoading(true);
    setVerificationLink(null);
    try {
      const data = await resendVerificationMe();
      setSnackbar({ open: true, message: data.message || 'Verification email sent.', severity: 'success' });
      if (data.verification_link) setVerificationLink(data.verification_link);
      await loadUser();
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.detail || e.message || 'Failed to resend', severity: 'error' });
    } finally {
      setResendLoading(false);
    }
  };

  const handleProfileChange = (field) => (e) => {
    setProfile((p) => ({ ...p, [field]: e.target.value }));
  };

  const handleBillingChange = (field) => (e) => {
    setBilling((b) => ({ ...b, [field]: e.target.value }));
  };

  const handlePasswordChange = (field) => (e) => {
    setPassword((p) => ({ ...p, [field]: e.target.value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setVerificationLink(null);
    try {
      const payload = {
        email: profile.email.trim() || undefined,
      };
      const data = await updateCurrentUser(payload);
      setSnackbar({ open: true, message: payload.email ? 'If you changed your email, check the new inbox to verify.' : 'Profile updated', severity: 'success' });
      if (data.verification_link) setVerificationLink(data.verification_link);
      await loadUser();
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.detail || e.message || 'Update failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBilling = async () => {
    setSaving(true);
    try {
      const payload = {
        billing_first_name: billing.billing_first_name.trim() || undefined,
        billing_last_name: billing.billing_last_name.trim() || undefined,
        billing_company: billing.billing_company.trim() || undefined,
        billing_address_line1: billing.billing_address_line1.trim() || undefined,
        billing_address_line2: billing.billing_address_line2.trim() || undefined,
        billing_postal_code: billing.billing_postal_code.trim() || undefined,
        billing_city: billing.billing_city.trim() || undefined,
        billing_country: billing.billing_country.trim() || undefined,
      };
      await updateCurrentUser(payload);
      setSnackbar({ open: true, message: 'Invoicing address updated', severity: 'success' });
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
        {pendingEmail && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Verification link sent to <strong>{pendingEmail}</strong>. Click it to confirm.
            <Button size="small" onClick={handleResendVerification} disabled={resendLoading} sx={{ ml: 1 }}>Resend</Button>
          </Alert>
        )}
        {verificationLink && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No email server configured. Use this link to verify: <Link href={verificationLink} target="_blank" rel="noopener noreferrer">Verify my email</Link>
          </Alert>
        )}
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={profile.email}
          onChange={handleProfileChange('email')}
          margin="normal"
          required
          helperText="Current email. Change it here and save to request a verification link to the new address."
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
          <BusinessIcon color="action" />
          <Typography variant="subtitle1">Invoicing address</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Required for invoices under French law. Used on your subscription invoices.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="First name"
            value={billing.billing_first_name}
            onChange={handleBillingChange('billing_first_name')}
            margin="normal"
            required
            sx={{ minWidth: 140, flex: 1 }}
          />
          <TextField
            label="Last name"
            value={billing.billing_last_name}
            onChange={handleBillingChange('billing_last_name')}
            margin="normal"
            required
            sx={{ minWidth: 140, flex: 1 }}
          />
        </Box>
        <TextField
          fullWidth
          label="Company (optional)"
          value={billing.billing_company}
          onChange={handleBillingChange('billing_company')}
          margin="normal"
        />
        <TextField
          fullWidth
          label="Address line 1"
          value={billing.billing_address_line1}
          onChange={handleBillingChange('billing_address_line1')}
          margin="normal"
          required
        />
        <TextField
          fullWidth
          label="Address line 2 (optional)"
          value={billing.billing_address_line2}
          onChange={handleBillingChange('billing_address_line2')}
          margin="normal"
        />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Postal code"
            value={billing.billing_postal_code}
            onChange={handleBillingChange('billing_postal_code')}
            margin="normal"
            required
            sx={{ minWidth: 120 }}
          />
          <TextField
            label="City"
            value={billing.billing_city}
            onChange={handleBillingChange('billing_city')}
            margin="normal"
            required
            sx={{ flex: 1, minWidth: 160 }}
          />
        </Box>
        <FormControl fullWidth margin="normal" required>
          <InputLabel>Country</InputLabel>
          <Select
            value={billing.billing_country}
            label="Country"
            onChange={(e) => setBilling((b) => ({ ...b, billing_country: e.target.value }))}
          >
            <MenuItem value="">—</MenuItem>
            {COUNTRY_OPTIONS.map((c) => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          onClick={handleSaveBilling}
          disabled={saving}
          sx={{ mt: 2 }}
        >
          {saving ? 'Saving…' : 'Save invoicing address'}
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
