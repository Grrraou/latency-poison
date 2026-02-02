import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  Chip,
  TextField,
  Button,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { fetchAdminUsers, fetchAdminContactRequests, adminUpdateContactRequest } from '../services/api';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function Admin() {
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [usersData, requestsData] = await Promise.all([
          fetchAdminUsers(),
          fetchAdminContactRequests(),
        ]);
        if (!cancelled) {
          setUsers(usersData.users || []);
          setRequests(requestsData.requests || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || e.message || 'Failed to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadRequests = async () => {
    try {
      const data = await fetchAdminContactRequests();
      setRequests(data.requests || []);
    } catch (_) {}
  };

  const handleReply = async (requestId) => {
    const text = (replyText[requestId] || '').trim();
    if (!text) return;
    setActionLoading(`reply-${requestId}`);
    try {
      await adminUpdateContactRequest(requestId, { admin_reply: text });
      setReplyText((prev) => ({ ...prev, [requestId]: '' }));
      await loadRequests();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to send reply.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (requestId) => {
    setActionLoading(`close-${requestId}`);
    try {
      await adminUpdateContactRequest(requestId, { close: true });
      await loadRequests();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to close.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Loading…</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Admin
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Accounts" />
          <Tab label="Contact requests" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          <TabPanel value={tab} index={0}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              All user accounts (user #1 is admin)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Verified</TableCell>
                  <TableCell>Disabled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.id}</TableCell>
                    <TableCell>{u.email ?? '—'}</TableCell>
                    <TableCell>{u.username ?? '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={u.plan || 'free'} />
                    </TableCell>
                    <TableCell>{u.email_verified ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{u.disabled ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {users.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No users.
              </Typography>
            )}
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Requests from users (support, invoicing, etc.)
            </Typography>
            {requests.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No contact requests yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {requests.map((r) => (
                  <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" label={r.category} />
                      <Chip size="small" color={r.closed_at ? 'default' : 'primary'} label={r.closed_at ? 'Closed' : 'Open'} />
                      <Typography variant="body2" color="text.secondary">
                        {r.user_email ?? `User #${r.user_id}`} ·{' '}
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </Typography>
                      {!r.closed_at && (
                        <Button
                          size="small"
                          startIcon={<CloseIcon />}
                          onClick={() => handleClose(r.id)}
                          disabled={actionLoading === `close-${r.id}`}
                          sx={{ ml: 'auto' }}
                        >
                          Close
                        </Button>
                      )}
                    </Box>
                    {r.subject && (
                      <Typography variant="subtitle2" gutterBottom>
                        {r.subject}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {r.message}
                    </Typography>
                    {r.admin_reply && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">Your reply</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.admin_reply}</Typography>
                      </Box>
                    )}
                    {!r.closed_at && (
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          placeholder="Reply to user…"
                          multiline
                          minRows={2}
                          value={replyText[r.id] ?? ''}
                          onChange={(e) => setReplyText((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          sx={{ flex: 1, minWidth: 200 }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<SendIcon />}
                          onClick={() => handleReply(r.id)}
                          disabled={!((replyText[r.id] || '').trim()) || actionLoading === `reply-${r.id}`}
                        >
                          Reply
                        </Button>
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>
            )}
          </TabPanel>
        </Box>
      </Paper>
    </Container>
  );
}

export default Admin;
