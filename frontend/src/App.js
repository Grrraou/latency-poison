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
import { UserProvider } from './contexts/UserContext';

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

function AppContent({ user, setUser }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar user={user} setUser={setUser} />
      <Box component="main" sx={{ flexGrow: 1, mt: '64px' }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/configs" />} />
          <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/configs" />} />
          <Route path="/sandbox" element={<QuickSandbox />} />
          <Route path="/health" element={<Health />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/dashboard" element={<PrivateRoute user={user}><Dashboard /></PrivateRoute>} />
          <Route path="/configs" element={<PrivateRoute user={user}><Configs /></PrivateRoute>} />
          <Route path="/billing" element={<PrivateRoute user={user}><Billing /></PrivateRoute>} />
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
    if (token) setUser({ token });
    setLoading(false);
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
