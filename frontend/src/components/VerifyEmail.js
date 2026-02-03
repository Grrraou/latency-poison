import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Paper, Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { verifyEmail, getCurrentUser } from '../services/api';
import { useUser } from '../contexts/UserContext';

// Avoid sending the same token twice (e.g. React Strict Mode or two tabs)
const requestedTokens = new Set();

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useUser();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const successRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification link.');
      return;
    }
    if (requestedTokens.has(token)) {
      setStatus('already_used');
      setMessage('This link was already used or has expired. Your email is verified — try logging in.');
      return;
    }
    requestedTokens.add(token);
    let cancelled = false;
    (async () => {
      try {
        const data = await verifyEmail(token);
        if (cancelled) return;
        successRef.current = true;
        setStatus('success');
        setMessage(data.message || 'Email verified.');

        if (data.access_token) {
          setHasToken(true);
          localStorage.setItem('token', data.access_token);
          const user = { token: data.access_token, email: '' };
          try {
            const me = await getCurrentUser();
            user.email = me.email ?? user.email;
            user.is_admin = me.is_admin === true;
          } catch (_) {
            user.is_admin = false;
          }
          setUser(user);
          navigate('/configs', { replace: true });
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
  }, [token, setUser, navigate]);

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
              {hasToken ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>Taking you to the app…</Typography>
              ) : (
                <Button component={RouterLink} to="/login" variant="contained" sx={{ mt: 2 }}>Go to login</Button>
              )}
            </>
          )}
          {(status === 'error' || status === 'already_used') && (
            <>
              <Alert severity={status === 'already_used' ? 'info' : 'error'} sx={{ my: 2 }}>{message}</Alert>
              <Typography sx={{ mt: 2 }}>
                <RouterLink to="/login" style={{ fontWeight: 500 }}>Go to login</RouterLink>
              </Typography>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default VerifyEmail;
