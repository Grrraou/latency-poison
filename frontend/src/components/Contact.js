import React, { useState, useEffect } from 'react';
import { Container, Paper, Typography, TextField, Button, Box, Alert, MenuItem, FormControl, InputLabel, Select, Chip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { submitContactRequest, fetchMyContactRequests, closeContactRequest } from '../services/api';

const CATEGORIES = [
  { value: 'support', label: 'Support' },
  { value: 'invoicing', label: 'Invoicing / Billing problem' },
  { value: 'billing', label: 'Billing question' },
  { value: 'other', label: 'Other' },
];

function Contact() {
  const [form, setForm] = useState({ category: 'support', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [closingId, setClosingId] = useState(null);

  const loadRequests = async () => {
    try {
      const data = await fetchMyContactRequests();
      setRequests(data.requests || []);
    } catch (_) {}
  };

  useEffect(() => { loadRequests(); }, []);

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    if (!form.message.trim()) {
      setError('Message is required.');
      return;
    }
    setSending(true);
    try {
      await submitContactRequest({
        category: form.category,
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      setSuccess('Your request has been sent. We will get back to you.');
      setForm({ category: 'support', subject: '', message: '' });
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to send.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = async (id) => {
    setClosingId(id);
    try {
      await closeContactRequest(id);
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to close.');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Contact</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Send a request to the team (support, invoicing problems, billing questions, etc.).
        </Typography>
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Category</InputLabel>
            <Select value={form.category} label="Category" onChange={handleChange('category')}>
              {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Subject (optional)" value={form.subject} onChange={handleChange('subject')} margin="normal" />
          <TextField fullWidth label="Message" value={form.message} onChange={handleChange('message')} margin="normal" required multiline rows={5} />
          <Button type="submit" variant="contained" startIcon={<SendIcon />} disabled={sending} sx={{ mt: 2 }}>{sending ? 'Sending…' : 'Send request'}</Button>
        </form>
      </Paper>

      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>My requests</Typography>
      {requests.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No contact requests yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {requests.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={r.category} />
                <Chip size="small" color={r.closed_at ? 'default' : 'primary'} label={r.closed_at ? 'Closed' : 'Open'} />
                <Typography variant="body2" color="text.secondary">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                </Typography>
                {!r.closed_at && (
                  <Button size="small" startIcon={<CloseIcon />} onClick={() => handleClose(r.id)} disabled={closingId === r.id} sx={{ ml: 'auto' }}>
                    Close
                  </Button>
                )}
              </Box>
              {r.subject && <Typography variant="subtitle2" gutterBottom>{r.subject}</Typography>}
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.message}</Typography>
              {r.admin_reply && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">Admin reply</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.admin_reply}</Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}
    </Container>
  );
}

export default Contact;
