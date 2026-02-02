import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Paper, Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { verifyEmail } from '../services/api';

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
          const isInvalidOrExpired = typeof detail === 'string' && (detail.includes('Invalid') || detail.includes('expired'));
          setStatus('error');
          setMessage(
            isInvalidOrExpired
              ? 'This link is invalid, expired, or was already used. If you already verified your email, try logging in.'
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
          {status === 'error' && (
            <>
              <Alert severity="error" sx={{ my: 2 }}>{message}</Alert>
              <Button component={RouterLink} to="/login" variant="outlined">Go to login</Button>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default VerifyEmail;
