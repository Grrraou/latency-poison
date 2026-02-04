import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';

function Navbar({ user, setUser }) {
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogoutClick = () => setLogoutOpen(true);

  const handleLogoutConfirm = () => {
    setLogoutOpen(false);
    localStorage.removeItem('token');
    setUser(null);
  };

  const handleLogoutCancel = () => setLogoutOpen(false);

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <Box
          component={RouterLink}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            mr: 2,
          }}
        >
          <img
            src="/icon.png"
            alt="Latency Poison Logo"
            style={{ height: '40px', marginRight: '16px' }}
          />
          <Typography variant="h6">
            Latency Poison
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {user ? (
            <>
              <Button color="inherit" component={RouterLink} to="/dashboard">
                Dashboard
              </Button>
              <Button color="inherit" component={RouterLink} to="/configs">
                Configs
              </Button>
              <Button color="inherit" component={RouterLink} to="/billing">
                Billing
              </Button>
              <Button color="inherit" component={RouterLink} to="/profile">
                Profile
              </Button>
              <Button color="inherit" component={RouterLink} to="/contact">
                Contact
              </Button>
              {user.is_admin && (
                <Button color="inherit" component={RouterLink} to="/admin">
                  Admin
                </Button>
              )}
              <Button color="inherit" component={RouterLink} to="/sandbox">
                Sandbox
              </Button>
              <Button color="inherit" component={RouterLink} to="/health">
                Health
              </Button>
              <Button color="inherit" component={RouterLink} to="/docs">
                Docs
              </Button>
              <Button color="inherit" onClick={handleLogoutClick}>
                Logout
              </Button>
              <Dialog open={logoutOpen} onClose={handleLogoutCancel}>
                <DialogTitle>Log out?</DialogTitle>
                <DialogContent>
                  <DialogContentText>Are you sure you want to log out?</DialogContentText>
                </DialogContent>
                <DialogActions>
                  <Button onClick={handleLogoutCancel}>Cancel</Button>
                  <Button onClick={handleLogoutConfirm} color="primary" variant="contained" autoFocus>
                    Log out
                  </Button>
                </DialogActions>
              </Dialog>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/">
                Home
              </Button>
              <Button color="inherit" component={RouterLink} to="/health">
                Health
              </Button>
              <Button color="inherit" component={RouterLink} to="/docs">
                Docs
              </Button>
              <Button color="inherit" component={RouterLink} to="/sandbox">
                Sandbox
              </Button>
              <Button color="inherit" component={RouterLink} to="/login">
                Login
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                component={RouterLink}
                to="/register"
                sx={{ ml: 1 }}
              >
                Sign Up
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
