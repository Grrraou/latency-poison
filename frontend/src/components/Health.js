import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { checkApiHealth, checkProxyHealth } from '../services/api';

function ServiceStatus({ name, ok, status, data, loading }) {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{name}</Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : ok ? (
          <Chip icon={<CheckCircleIcon />} label="Up" color="success" size="small" />
        ) : (
          <Chip icon={<ErrorIcon />} label="Down" color="error" size="small" />
        )}
      </Box>
      {!loading && (
        <>
          <Typography variant="body2" color="text.secondary">
            Status: {status} {data?.service && `· ${data.service}`}
          </Typography>
          {!ok && data?.detail && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {data.detail}
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
}

function Health() {
  const [api, setApi] = useState({ loading: true, ok: false, status: 0, data: {} });
  const [proxy, setProxy] = useState({ loading: true, ok: false, status: 0, data: {} });

  const fetchHealth = async () => {
    setApi((p) => ({ ...p, loading: true }));
    setProxy((p) => ({ ...p, loading: true }));
    const [apiRes, proxyRes] = await Promise.all([
      checkApiHealth(),
      checkProxyHealth(),
    ]);
    setApi({ loading: false, ok: apiRes.ok, status: apiRes.status, data: apiRes.data });
    setProxy({ loading: false, ok: proxyRes.ok, status: proxyRes.status, data: proxyRes.data });
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const allUp = !api.loading && !proxy.loading && api.ok && proxy.ok;

  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth="md">
        <Typography variant="h4" gutterBottom>
          Server status
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Check that the API and proxy are reachable. No login required.
        </Typography>

        {allUp && (
          <Alert severity="success" sx={{ mb: 3 }}>
            All services are up.
          </Alert>
        )}
        {!api.loading && !proxy.loading && !allUp && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            One or more services are down. Check that <code>make dev</code> (or API and proxy) are running.
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <ServiceStatus
              name="API (auth & config keys)"
              loading={api.loading}
              ok={api.ok}
              status={api.status}
              data={api.data}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <ServiceStatus
              name="Proxy (config key routing & sandbox)"
              loading={proxy.loading}
              ok={proxy.ok}
              status={proxy.status}
              data={proxy.data}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Typography
            component="button"
            variant="body2"
            color="primary"
            onClick={fetchHealth}
            sx={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Refresh status
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default Health;
