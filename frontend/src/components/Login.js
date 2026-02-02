import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Link,
  Alert,
  Collapse,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { login, resendVerification, getCurrentUser } from '../services/api';

function Login({ setUser }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendLink, setResendLink] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailNotVerified(false);
    try {
      const data = await login(formData.email, formData.password);
      localStorage.setItem('token', data.access_token);
      const user = { email: formData.email, token: data.access_token };
      try {
        const me = await getCurrentUser();
        user.is_admin = me.is_admin === true;
      } catch (_) {
        user.is_admin = false;
      }
      setUser(user);
      navigate('/configs');
    } catch (err) {
      console.error('Login error:', err);
      if (err.status === 403) {
        setEmailNotVerified(true);
        setError(err.response?.data?.detail || 'Please verify your email before logging in.');
        return;
      }
      if (err.response?.data?.detail) {
        const errorDetail = err.response.data.detail;
        if (typeof errorDetail === 'string') {
          setError(errorDetail);
        } else if (Array.isArray(errorDetail)) {
          setError(errorDetail[0]?.msg || 'Login failed');
        } else if (typeof errorDetail === 'object') {
          setError(Object.values(errorDetail)[0] || 'Login failed');
        } else {
          setError('Login failed');
        }
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResendMessage('');
    setResendLink(null);
    try {
      const data = await resendVerification(resendEmail.trim());
      setResendMessage(data.message || 'Verification email sent.');
      if (data.verification_link) setResendLink(data.verification_link);
    } catch (err) {
      setResendMessage(err.response?.data?.detail || 'Failed to resend.');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Login
          </Typography>
          {error && (
            <Alert severity={emailNotVerified ? 'warning' : 'error'} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Collapse in={emailNotVerified}>
            <Box sx={{ mb: 2, p: 1, bgcolor: 'action.hover' }}>
              <Typography variant="body2" gutterBottom>Resend verification email</Typography>
              <TextField
                size="small"
                fullWidth
                label="Email"
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                margin="dense"
                placeholder="Your registration email"
              />
              <Button size="small" onClick={handleResend} sx={{ mt: 1 }}>Send</Button>
              {resendMessage && <Typography variant="caption" display="block" sx={{ mt: 1 }}>{resendMessage}</Typography>}
              {resendLink && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  No email server configured. Use this link: <Link href={resendLink} target="_blank" rel="noopener noreferrer">Verify my email</Link>
                </Alert>
              )}
            </Box>
          </Collapse>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, mb: 2 }}
            >
              Login
            </Button>
            <Typography align="center">
              Don't have an account?{' '}
              <Link component={RouterLink} to="/register">
                Register here
              </Link>
            </Typography>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login; 