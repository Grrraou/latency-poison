import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Paper,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Error as ErrorIcon,
  Api as ApiIcon,
  Code as CodeIcon,
  Dashboard as DashboardIcon,
  Security as SecurityIcon,
  CloudQueue as CloudIcon,
  Timeline as TimelineIcon,
  PlayArrow as PlayIcon,
  Lock as LockIcon,
  VisibilityOff as VisibilityOffIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { API_ENDPOINTS, PROXY_API_BASE_URL } from '../config';

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              bgcolor: 'primary.dark',
              borderRadius: 2,
              p: 1,
              mr: 2,
              display: 'flex',
            }}
          >
            <Icon sx={{ color: 'primary.light' }} />
          </Box>
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

function LiveDemo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  
  const demoLatency = 5000;
  const demoFailRate = 0.5;
  const demoFailCodes = '500,502,503';
  const demoUrl = 'https://api.github.com';

  const runDemo = async () => {
    setLoading(true);
    setResult(null);
    setResponseTime(null);
    
    try {
      const startTime = performance.now();
      const response = await fetch(
        `${API_ENDPOINTS.SANDBOX}?url=${encodeURIComponent(demoUrl)}&failrate=${demoFailRate}&failCodes=${demoFailCodes}&minLatency=${demoLatency}&maxLatency=${demoLatency}`
      );
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      
      // Check if the request was a simulated failure
      if (!response.ok) {
        const errorText = await response.text();
        setResult({ 
          simulatedFailure: true, 
          status: response.status, 
          message: errorText || 'Simulated server error' 
        });
        return;
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper 
      elevation={8} 
      sx={{ 
        p: 3, 
        bgcolor: 'background.paper', 
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
          # Live demo - {demoLatency}ms latency + {demoFailRate * 100}% fail rate
        </Typography>
        <Button 
          size="small" 
          variant="contained" 
          onClick={runDemo}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />}
          sx={{ minWidth: 100 }}
        >
          {loading ? 'Running...' : 'Run'}
        </Button>
      </Box>
      
      <Box
        component="pre"
        sx={{
          color: 'success.light',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          m: 0,
          overflow: 'auto',
          maxHeight: 300,
        }}
      >
        <Box component="span" sx={{ color: 'text.secondary' }}>$</Box>{' '}
        <Box component="span" sx={{ color: 'primary.light' }}>curl</Box>{' '}
        <Box component="span" sx={{ color: 'warning.light' }}>
          "{API_ENDPOINTS.SANDBOX}?url={demoUrl}&failrate={demoFailRate}&failCodes={demoFailCodes}&minLatency={demoLatency}&maxLatency={demoLatency}"
        </Box>
        {'\n\n'}
        {loading && (
          <Box component="span" sx={{ color: 'text.secondary' }}>
            Waiting for response...
          </Box>
        )}
        {result && !loading && result.simulatedFailure && (
          <>
            <Box component="span" sx={{ color: 'error.light' }}>
              # Simulated failure! ({responseTime}ms total, ~{demoLatency}ms injected)
            </Box>
            {'\n'}
            <Box component="span" sx={{ color: 'error.main' }}>
              HTTP {result.status}: {result.message}
            </Box>
            {'\n\n'}
            <Box component="span" sx={{ color: 'text.secondary' }}>
              # This is the fail rate feature in action - 50% chance of failure
            </Box>
          </>
        )}
        {result && !loading && !result.simulatedFailure && !result.error && (
          <>
            <Box component="span" sx={{ color: 'success.light' }}>
              # Success! ({responseTime}ms total, ~{demoLatency}ms injected)
            </Box>
            {'\n'}
            {JSON.stringify(result, null, 2).substring(0, 500)}
            {JSON.stringify(result, null, 2).length > 500 && '\n  ...'}
          </>
        )}
        {result && !loading && result.error && !result.simulatedFailure && (
          <>
            <Box component="span" sx={{ color: 'error.light' }}>
              # Network error
            </Box>
            {'\n'}
            <Box component="span" sx={{ color: 'error.main' }}>
              {result.error}
            </Box>
          </>
        )}
        {!result && !loading && (
          <Box component="span" sx={{ color: 'text.secondary' }}>
            Click "Run" to see the live demo
          </Box>
        )}
      </Box>
    </Paper>
  );
}

function Landing() {
  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          py: 8,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <img
                  src="/icon.png"
                  alt="Latency Poison Logo"
                  style={{ height: '80px', marginRight: '20px' }}
                />
                <Box>
                  <Typography variant="h2" component="h1" sx={{ fontWeight: 'bold', lineHeight: 1.1 }}>
                    Latency Poison
                  </Typography>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      color: 'primary.main', 
                      fontStyle: 'italic',
                      letterSpacing: '0.1em',
                      mt: 0.5
                    }}
                  >
                    the chaos proxy
                  </Typography>
                </Box>
              </Box>
              <Typography variant="h5" sx={{ mb: 3, color: 'text.secondary' }}>
                One config key → one target URL. Add latency and failures to any API.
              </Typography>
              <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
                Create a config key with a target URL and chaos settings. Call the proxy with your key in the path —
                e.g. <code>{PROXY_API_BASE_URL.replace(/\/$/, '')}/your_key/users</code> — and traffic is forwarded with latency and failure injection applied.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  component={RouterLink}
                  to="/sandbox"
                >
                  Try Sandbox
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component={RouterLink}
                  to="/register"
                >
                  Get Started
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <LiveDemo />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Screenshots Section */}
      <Box sx={{ bgcolor: 'background.paper', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" gutterBottom sx={{ mb: 2 }}>
            How it works
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 6 }}>
            Create config keys, set chaos, and call the proxy. Try Sandbox with no sign-up.
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Paper 
                elevation={4} 
                sx={{ 
                  overflow: 'hidden', 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <img
                  src="/screen1.png"
                  alt="Configs"
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    display: 'block' 
                  }}
                />
                <Box sx={{ p: 2, bgcolor: 'grey.900' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Configs
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    One config key → one target URL. Set fail rate, latency range, and error codes. Copy your proxy URL and use it in your app.
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper 
                elevation={4} 
                sx={{ 
                  overflow: 'hidden', 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <img
                  src="/screen2.png"
                  alt="Dashboard & Usage"
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    display: 'block' 
                  }}
                />
                <Box sx={{ p: 2, bgcolor: 'grey.900' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Dashboard & Usage
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Track requests per config key over time. View usage charts by hour, day, or month.
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Privacy & Security Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" align="center" gutterBottom sx={{ mb: 2 }}>
          Privacy & Security
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 6 }}>
          Your data stays yours. We never inspect or store your API traffic.
        </Typography>
        
        <Alert severity="success" sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            <strong>Zero Data Retention Policy</strong>
          </Typography>
          <Typography variant="body2">
            Latency Poison acts as a transparent pass-through proxy. We do not read, log, analyze, or store 
            any request bodies, response bodies, headers, or any data from the APIs you proxy.
          </Typography>
        </Alert>

        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ bgcolor: 'success.dark', borderRadius: 2, p: 1, mr: 2, display: 'flex' }}>
                    <VisibilityOffIcon sx={{ color: 'success.light' }} />
                  </Box>
                  <Typography variant="h6">No Content Inspection</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Request and response bodies pass through untouched. We never read, parse, or analyze 
                  the content of your API calls. Your data is completely opaque to us.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ bgcolor: 'success.dark', borderRadius: 2, p: 1, mr: 2, display: 'flex' }}>
                    <StorageIcon sx={{ color: 'success.light' }} />
                  </Box>
                  <Typography variant="h6">No Data Storage</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  We only store your config keys and aggregate usage counters. No request/response data, 
                  URLs with parameters, or API payloads are ever stored.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ bgcolor: 'success.dark', borderRadius: 2, p: 1, mr: 2, display: 'flex' }}>
                    <LockIcon sx={{ color: 'success.light' }} />
                  </Box>
                  <Typography variant="h6">Self-Hostable</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  For maximum security, deploy Latency Poison on your own infrastructure. The entire 
                  codebase is open source and can run in your private network or CI/CD environment.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Features Section */}
      <Box sx={{ bgcolor: 'background.paper', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" gutterBottom sx={{ mb: 6 }}>
            Features
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} sm={6} md={4}>
              <FeatureCard
                icon={SpeedIcon}
                title="Latency Injection"
                description="Add configurable delays to API responses. Set min/max ranges for realistic network simulation."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FeatureCard
                icon={ErrorIcon}
                title="Failure Simulation"
                description="Configure failure rates to randomly return 500 errors. Test your error handling and retry logic."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FeatureCard
                icon={ApiIcon}
                title="One Key, One URL"
                description="Each config key has a single target URL. Call proxy/key/path and traffic is forwarded with chaos applied."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FeatureCard
                icon={SecurityIcon}
                title="Config Keys"
                description="Create config keys (lp_...) with a target URL and chaos settings. Use the key in the proxy path."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FeatureCard
                icon={DashboardIcon}
                title="Usage by Key"
                description="Track requests per config key over time. View usage timeline by hour, day, or month."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FeatureCard
                icon={CloudIcon}
                title="High Performance"
                description="Built with Go and Fiber for minimal overhead. Fast proxy with sub-millisecond processing."
              />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" align="center" gutterBottom sx={{ mb: 6 }}>
          How It Works
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Typography variant="h5" sx={{ color: 'background.default', fontWeight: 'bold' }}>1</Typography>
              </Box>
              <Typography variant="h6" gutterBottom>Create a config key</Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in, go to Configs, and create a key. Set a target URL (e.g. https://api.github.com) and chaos: fail rate, latency, error codes.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Typography variant="h5" sx={{ color: 'background.default', fontWeight: 'bold' }}>2</Typography>
              </Box>
              <Typography variant="h6" gutterBottom>Get your proxy URL</Typography>
              <Typography variant="body2" color="text.secondary">
                Use https://proxy:port/your_key (or /your_key/path). The key identifies the config; path is appended to the target URL.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Typography variant="h5" sx={{ color: 'background.default', fontWeight: 'bold' }}>3</Typography>
              </Box>
              <Typography variant="h6" gutterBottom>Call the proxy</Typography>
              <Typography variant="body2" color="text.secondary">
                Point your app at the proxy URL. Latency and failures are applied automatically from your config.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Use Cases Section */}
      <Box sx={{ bgcolor: 'background.paper', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" gutterBottom sx={{ mb: 6 }}>
            Use Cases
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Chaos Engineering</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Inject random failures and latency to test how your system behaves under adverse conditions. 
                    Identify weak points before they become production incidents.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Development Testing</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Test loading states, timeout handling, and error recovery without modifying your backend. 
                    Perfect for frontend development and QA testing.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SpeedIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Performance Testing</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Simulate slow third-party APIs to understand how latency affects your application's 
                    performance and user experience.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Resilience Validation</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Verify that circuit breakers, retries, and fallbacks work correctly. 
                    Build confidence in your system's reliability.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Ready to test your resilience?
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Try the sandbox without signing up, or create an account to save your configurations.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/sandbox"
          >
            Try Sandbox Free
          </Button>
          <Button
            variant="outlined"
            size="large"
            component={RouterLink}
            to="/register"
          >
            Create Account
          </Button>
        </Stack>
      </Container>

      {/* Footer */}
      <Box sx={{ py: 4, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary">
          Latency Poison — Test your application's resilience
        </Typography>
      </Box>
    </Box>
  );
}

export default Landing;
