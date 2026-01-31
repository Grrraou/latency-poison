import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  Api as ApiIcon,
  Dashboard as DashboardIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { PROXY_API_BASE_URL } from '../config';

function CodeBlock({ children, title }) {
  return (
    <Paper sx={{ my: 2, overflow: 'hidden' }}>
      {title && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'grey.800', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
            {title}
          </Typography>
        </Box>
      )}
      <Box
        component="pre"
        sx={{
          p: 2,
          m: 0,
          overflow: 'auto',
          bgcolor: 'grey.900',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          '& code': { color: 'success.light' },
        }}
      >
        <code>{children}</code>
      </Box>
    </Paper>
  );
}

function Section({ icon: Icon, title, children, id }) {
  return (
    <Box sx={{ mb: 6 }} id={id}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Icon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h4">{title}</Typography>
      </Box>
      {children}
    </Box>
  );
}

const sections = [
  { id: 'how-it-works', title: 'How It Works', icon: ApiIcon },
  { id: 'config-setup', title: 'Config Setup', icon: DashboardIcon },
  { id: 'api-reference', title: 'API Reference', icon: CodeIcon },
  { id: 'examples', title: 'Examples', icon: SettingsIcon },
  { id: 'security', title: 'Security', icon: SecurityIcon },
];

function Documentation() {
  const proxyBaseUrl = PROXY_API_BASE_URL || 'http://localhost:8080';
  const location = useLocation();
  const displayApiKey = 'lp_your_key_from_configs_page';

  // Scroll to section if hash is present
  React.useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.slice(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location]);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h2" gutterBottom>
            Documentation
          </Typography>
          <Typography variant="h6" color="text.secondary">
            One key → one target URL. Call https://proxy:port/your_api_key (path appended to target URL).
          </Typography>
        </Box>

        {/* Quick Links / Table of Contents */}
        <Paper elevation={2} sx={{ mb: 6, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Links
          </Typography>
          <List dense sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {sections.map((section) => (
              <ListItem key={section.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.33%' }, py: 0.5 }}>
                <ListItemButton onClick={() => scrollToSection(section.id)} sx={{ borderRadius: 1 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <section.icon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={section.title} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* How It Works */}
        <Section icon={ApiIcon} title="How It Works" id="how-it-works">
          <Typography variant="body1" paragraph>
            <strong>One config key → one target URL.</strong> Each key has an API key (<code>lp_...</code>), a single target URL (e.g. <code>https://api.github.com</code>), and chaos settings (fail rate, latency, error codes).
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Without Latency Poison:</strong><br />
            <code>curl https://api.github.com/users</code>
            <br /><br />
            <strong>With Latency Poison:</strong> Put the proxy URL with your key in the path. Path is appended to the key’s target URL.<br />
            <code>curl "{proxyBaseUrl}/{displayApiKey}/users"</code>
          </Alert>
          <Typography variant="body1" paragraph>
            The proxy looks up the key from the path, applies latency and fail rate, then forwards to <strong>target_url + path</strong>.
          </Typography>
          <CodeBlock title="Flow">
{`Your App                         Latency Poison                         Real API
    |                                   |                                       |
    |-- GET /{displayApiKey}/users ----->|                                       |
    |                                   | [lookup key, add latency]              |
    |                                   | [maybe fail]                           |
    |                                   |-- GET target_url + /users ------------>|
    |                                   |<-------- response ----------------------|
    |<-------- response ----------------|                                       |`}
          </CodeBlock>
        </Section>

        <Divider sx={{ my: 6 }} />

        {/* Config Setup */}
        <Section icon={DashboardIcon} title="Config Setup" id="config-setup">
          <Typography variant="body1" paragraph>
            Sign in, then go to <strong>Configs</strong> in the menu.
          </Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">1. Create a config key</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Create a config key and copy its API key (starts with <code>lp_</code>). Set the <strong>target URL</strong> (e.g. <code>https://api.github.com</code>) and chaos: fail rate (0–100), min/max latency (ms), method (or ANY), optional error codes.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">2. Use the proxy URL in your app</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                In your config file, point the base URL to <code>https://proxy:port/your_api_key</code>. Requests to that URL (and subpaths) are forwarded to the key’s target URL with the same path. Example: <code>https://localhost:8080/lp_xxx/users</code> → <code>https://api.github.com/users</code> (if target URL is <code>https://api.github.com</code>).
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Section>

        <Divider sx={{ my: 6 }} />

        {/* API Reference */}
        <Section icon={CodeIcon} title="API Reference" id="api-reference">
          <Typography variant="body1" paragraph>
            The proxy path is <strong>/{'{apiKey}'}</strong> or <strong>/{'{apiKey}'}/path</strong>. The API key is the first path segment. The rest of the path (and query) is appended to the key’s target URL.
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Path</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell><code>/{'{apiKey}'}</code></TableCell>
                  <TableCell>Forwards to key’s target_url (root).</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>/{'{apiKey}'}/path</code></TableCell>
                  <TableCell>Forwards to key’s target_url + /path (and query).</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <CodeBlock title="GET">
{`curl "${proxyBaseUrl}/${displayApiKey}/users"`}
          </CodeBlock>
          <CodeBlock title="GET with query">
{`curl "${proxyBaseUrl}/${displayApiKey}/users?since=0"`}
          </CodeBlock>
          <CodeBlock title="POST with body">
{`curl -X POST "${proxyBaseUrl}/${displayApiKey}/post" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'`}
          </CodeBlock>
        </Section>

        <Divider sx={{ my: 6 }} />

        {/* Examples */}
        <Section icon={SettingsIcon} title="Examples" id="examples">
          <Typography variant="body1" paragraph>
            Set your app’s base URL to <code>https://proxy:port/your_api_key</code>. All requests go through the proxy; path and query are appended to the key’s target URL.
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Node / JavaScript</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CodeBlock title="config">
{`const LP_BASE = process.env.LATENCY_POISON_URL || '${proxyBaseUrl}';
const LP_KEY = process.env.LATENCY_POISON_API_KEY || '';

// Base URL for API calls: https://proxy:port/your_key -> target_url
const API_BASE = LP_KEY ? \`\${LP_BASE}/\${LP_KEY}\` : 'https://api.github.com';`}
              </CodeBlock>
              <CodeBlock title="Usage">
{`const response = await fetch(\`\${API_BASE}/users/\${username}\`);
return response.json();
// Without LP: https://api.github.com/users/octocat
// With LP:    ${proxyBaseUrl}/${displayApiKey}/users/octocat -> target_url + /users/octocat`}
              </CodeBlock>
              <CodeBlock title=".env">
{`LATENCY_POISON_URL=${proxyBaseUrl}
LATENCY_POISON_API_KEY=${displayApiKey}`}
              </CodeBlock>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Python</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CodeBlock title="config">
{`import os

LP_BASE = os.getenv('LATENCY_POISON_URL', '${proxyBaseUrl}')
LP_KEY = os.getenv('LATENCY_POISON_API_KEY', '')

API_BASE = f"{LP_BASE}/{LP_KEY}" if LP_KEY else "https://api.github.com"`}
              </CodeBlock>
              <CodeBlock title="Usage">
{`import requests

def get_github_user(username: str) -> dict:
    url = f"{API_BASE}/users/{username}"
    response = requests.get(url)
    return response.json()`}
              </CodeBlock>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">React / Frontend</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CodeBlock title="config">
{`const LP_BASE = process.env.REACT_APP_LATENCY_POISON_URL || '${proxyBaseUrl}';
const LP_KEY = process.env.REACT_APP_LATENCY_POISON_API_KEY || '';

export const API_BASE = LP_KEY ? \`\${LP_BASE}/\${LP_KEY}\` : 'https://api.github.com';`}
              </CodeBlock>
              <CodeBlock title=".env.development">
{`REACT_APP_LATENCY_POISON_URL=${proxyBaseUrl}
REACT_APP_LATENCY_POISON_API_KEY=${displayApiKey}`}
              </CodeBlock>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Docker Compose</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Run Latency Poison alongside your application in Docker:
              </Typography>
              <CodeBlock title="docker-compose.yml">
{`version: '3.8'

services:
  # Your application
  app:
    build: .
    environment:
      - LATENCY_POISON_URL=http://latency-poison:8080
      - LATENCY_POISON_API_KEY=${displayApiKey}
    depends_on:
      - latency-poison

  # Latency Poison proxy
  latency-poison:
    image: latency-poison:latest
    ports:
      - "8080:8080"  # Expose for debugging
    volumes:
      - latency-poison-data:/data

volumes:
  latency-poison-data:`}
              </CodeBlock>
            </AccordionDetails>
          </Accordion>
        </Section>

        <Divider sx={{ my: 6 }} />

        {/* MITM Proxy */}
        <Section icon={SecurityIcon} title="MITM Proxy (Per-Request Chaos)" id="mitm-proxy">
          <Alert severity="info" sx={{ mb: 3 }}>
            The <strong>MITM Proxy</strong> on port <code>9090</code> provides <strong>per-request</strong> chaos for HTTPS traffic.
            It forwards each request to the proxy using your API key in the path (<code>/{'{apiKey}'}/path</code>) so your key’s target URL and chaos apply per request.
          </Alert>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Setup Instructions</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Step 1: Start Services</Typography></AccordionSummary>
            <AccordionDetails>
              <Typography paragraph>The MITM proxy starts with <code>make dev</code> using the default config API key.</Typography>
              <CodeBlock title="Start all services">{`make dev\n# Default API key: lp_default_admin_key_change_in_production`}</CodeBlock>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Step 2: Extract CA Certificate</Typography></AccordionSummary>
            <AccordionDetails>
              <Typography paragraph>Extract the mitmproxy CA cert to install in your browser.</Typography>
              <CodeBlock title="Extract Certificate">{`make mitmproxy-cert`}</CodeBlock>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Step 3: Install Certificate in Browser</Typography></AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>Firefox: Settings → Privacy &amp; Security → Certificates → View Certificates → Authorities → Import. Chrome: Settings → Privacy and Security → Security → Manage certificates → Authorities → Import.</Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Step 4: Configure Browser Proxy</Typography></AccordionSummary>
            <AccordionDetails>
              <Typography paragraph>Set your browser proxy to:</Typography>
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>HTTP Proxy</strong></TableCell>
                      <TableCell><code>localhost:9090</code></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>HTTPS Proxy</strong></TableCell>
                      <TableCell><code>localhost:9090</code></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="info">
                No authentication is needed for the MITM proxy; your API key is configured when starting the service.
              </Alert>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>View MITM Proxy Logs</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CodeBlock title="View Logs">
{`# View MITM proxy logs
make mitmproxy-logs

# Or with docker-compose
docker-compose logs -f mitmproxy`}
              </CodeBlock>
              <Typography paragraph sx={{ mt: 2 }}>
                Each request will show in the logs as it's forwarded through the Latency Poison API proxy.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Alert severity="success" sx={{ mt: 3 }}>
            <strong>Result:</strong> With MITM proxy, when you load a page with 20 images from the same domain,
            each image request is handled individually. Some may load fast, some slow, and some may fail -
            exactly matching your config's latency and fail rate settings.
          </Alert>
        </Section>

        <Divider sx={{ my: 6 }} />

        {/* Security */}
        <Section icon={SecurityIcon} title="Security Best Practices" id="security">
          <Alert severity="error" sx={{ mb: 3 }}>
            <strong>Never use Latency Poison in production!</strong> It's designed for development and testing only.
          </Alert>

          <Typography variant="body1" component="div">
            <ul>
              <li>
                <strong>API Keys:</strong> Keep your API keys secret. Use environment variables, never commit them to version control.
              </li>
              <li>
                <strong>Environment Check:</strong> Always verify Latency Poison is disabled in production builds.
              </li>
              <li>
                <strong>Network Isolation:</strong> Run Latency Poison on a private network, not exposed to the internet.
              </li>
              <li>
                <strong>Hosts File:</strong> Remember to remove hosts file overrides when not testing.
              </li>
            </ul>
          </Typography>

          <CodeBlock title="Production safety check (JavaScript)">
{`// Add this check at application startup
if (process.env.NODE_ENV === 'production') {
  if (process.env.USE_LATENCY_POISON === 'true') {
    throw new Error('FATAL: Latency Poison must not be enabled in production!');
  }
}`}
          </CodeBlock>

          <CodeBlock title="Production safety check (Python)">
{`import os
import sys

if os.getenv('ENVIRONMENT') == 'production':
    if os.getenv('USE_LATENCY_POISON', '').lower() == 'true':
        print('FATAL: Latency Poison must not be enabled in production!', file=sys.stderr)
        sys.exit(1)`}
          </CodeBlock>
        </Section>

        {/* Footer */}
        <Box sx={{ mt: 8, py: 4, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Need help? <a href="/register" style={{ color: 'inherit' }}>Create an account</a> to create config keys (one key → one target URL).
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default Documentation;
