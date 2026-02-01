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
import { register, resendVerification } from '../services/api';

function Register({ setUser }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
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
    setSuccess(null);
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const data = await register(formData.email, formData.password);
      setSuccess({
        message: data.message || 'Check your email to verify your account.',
        email: data.email,
        verification_link: data.verification_link || null,
      });
    } catch (err) {
      console.error('Registration error:', err);
      if (err.response?.data?.detail) {
        const errorDetail = err.response.data.detail;
        if (typeof errorDetail === 'string') {
          setError(errorDetail);
        } else if (Array.isArray(errorDetail)) {
          setError(errorDetail[0]?.msg || 'Registration failed');
        } else if (typeof errorDetail === 'object') {
          setError(Object.values(errorDetail)[0] || 'Registration failed');
        } else {
          setError('Registration failed');
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  };

  const handleResend = async () => {
    const email = success?.email || formData.email;
    if (!email) return;
    setResendMessage('');
    setResendLink(null);
    try {
      const data = await resendVerification(email);
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
            Register
          </Typography>
          {success ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>{success.message}</Alert>
              {success.verification_link && (
                <Collapse in>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No email server configured. Use this link to verify: <Link href={success.verification_link} target="_blank" rel="noopener noreferrer">Verify my email</Link>
                  </Alert>
                </Collapse>
              )}
              {resendMessage && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{resendMessage}</Typography>}
              {resendLink && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Link: <Link href={resendLink} target="_blank" rel="noopener noreferrer">Verify my email</Link>
                </Alert>
              )}
              <Button fullWidth variant="outlined" onClick={handleResend} sx={{ mb: 2 }}>
                Resend verification email
              </Button>
              <Typography align="center">
                <Link component={RouterLink} to="/login">Go to login</Link>
              </Typography>
            </>
          ) : (
          <>
          {error && (
            <Typography color="error" align="center" gutterBottom>
              {error}
            </Typography>
          )}
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
            <TextField
              fullWidth
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
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
              Register
            </Button>
            <Typography align="center">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login">
                Login here
              </Link>
            </Typography>
          </form>
          </>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default Register;  