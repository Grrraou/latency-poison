import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';

import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import QuickSandbox from './components/QuickSandbox';
import Landing from './components/Landing';
import Documentation from './components/Documentation';
import Configs from './components/Configs';
import Billing from './components/Billing';
import Health from './components/Health';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import VerifyEmail from './components/VerifyEmail';
import Contact from './components/Contact';
import Admin from './components/Admin';
import { UserProvider } from './contexts/UserContext';
import { getCurrentUser } from './services/api';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    secondary: { main: '#f48fb1' },
  },
});

function PrivateRoute({ user, children }) {
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ user, children }) {
  if (!user) return <Navigate to="/login" />;
  if (!user.is_admin) return <Navigate to="/" />;
  return children;
}

function AppContent({ user, setUser }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar user={user} setUser={setUser} />
      <Box component="main" sx={{ flexGrow: 1, mt: '64px' }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/configs" />} />
          <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/configs" />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/sandbox" element={<QuickSandbox />} />
          <Route path="/health" element={<Health />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/dashboard" element={<PrivateRoute user={user}><Dashboard /></PrivateRoute>} />
          <Route path="/configs" element={<PrivateRoute user={user}><Configs /></PrivateRoute>} />
          <Route path="/billing" element={<PrivateRoute user={user}><Billing /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute user={user}><Profile /></PrivateRoute>} />
          <Route path="/contact" element={<PrivateRoute user={user}><Contact /></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute user={user}><Admin /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setUser({ token });
      getCurrentUser()
        .then((me) => setUser((u) => (u ? { ...u, email: me.email, is_admin: me.is_admin === true } : u)))
        .catch(() => setUser((u) => (u ? { ...u, is_admin: false } : u)))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  if (loading) return <Box>Loading...</Box>;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <UserProvider>
        <AppContent user={user} setUser={setUser} />
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
