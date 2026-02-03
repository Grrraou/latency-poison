import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Paper, Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { verifyEmail } from '../services/api';

// Avoid sending the same token twice (e.g. React Strict Mode or two tabs)
const requestedTokens = new Set();

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const successRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification link.');
      return;
    }
    if (requestedTokens.has(token)) {
      return;
    }
    requestedTokens.add(token);
    let cancelled = false;
    (async () => {
      try {
        const data = await verifyEmail(token);
        if (!cancelled) {
          successRef.current = true;
          setStatus('success');
          setMessage(data.message || 'Email verified. You can now log in.');
        }
      } catch (err) {
        if (!cancelled && !successRef.current) {
          const detail = err.response?.data?.detail || err.message || '';
          const isInvalidOrExpired = typeof detail === 'string' && (detail.includes('Invalid') || detail.includes('expired') || detail.includes('already used'));
          setStatus(isInvalidOrExpired ? 'already_used' : 'error');
          setMessage(
            isInvalidOrExpired
              ? 'This link was already used or has expired. Your email is verified — try logging in.'
              : detail || 'Verification failed.'
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Email verification
          </Typography>
          {status === 'loading' && (
            <>
              <CircularProgress sx={{ my: 2 }} />
              <Typography color="text.secondary">Verifying…</Typography>
            </>
          )}
          {status === 'success' && (
            <>
              <Alert severity="success" sx={{ my: 2 }}>{message}</Alert>
              <Button component={RouterLink} to="/login" variant="contained">Go to login</Button>
            </>
          )}
          {(status === 'error' || status === 'already_used') && (
            <>
              <Alert severity={status === 'already_used' ? 'info' : 'error'} sx={{ my: 2 }}>{message}</Alert>
              <Button component={RouterLink} to="/login" variant="contained">Go to login</Button>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default VerifyEmail;
