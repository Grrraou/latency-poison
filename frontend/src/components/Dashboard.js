import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import KeyIcon from '@mui/icons-material/Key';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import TimelineIcon from '@mui/icons-material/Timeline';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fetchConfigKeys, fetchUsageTimeline, fetchUsageSummary } from '../services/api';

const COLORS = ['#90caf9', '#f48fb1', '#ce93d8', '#81c784', '#ffb74d'];

function Dashboard() {
  const [configKeys, setConfigKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupBy, setGroupBy] = useState('day');
  const [period, setPeriod] = useState('30d');
  const [usageTimeline, setUsageTimeline] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageSummary, setUsageSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchConfigKeys();
        if (!cancelled) setConfigKeys(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load config keys');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!configKeys.length) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchUsageSummary();
        if (!cancelled) setUsageSummary(data);
      } catch {
        if (!cancelled) setUsageSummary(null);
      }
    })();
    return () => { cancelled = true; };
  }, [configKeys.length]);

  useEffect(() => {
    if (!configKeys.length) return;
    let cancelled = false;
    setUsageLoading(true);
    (async () => {
      try {
        const params = { groupBy, period };
        if (groupBy === 'hour' && period === '30d') params.period = '7d';
        const data = await fetchUsageTimeline(params.groupBy, params.period);
        if (!cancelled) setUsageTimeline(data);
      } catch {
        if (!cancelled) setUsageTimeline(null);
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [configKeys.length, groupBy, period]);

  const activeCount = configKeys.filter((k) => k.is_active).length;
  const chartData = configKeys.map((k) => ({
    name: k.name || `Key ${k.id}`,
    fail_rate: k.fail_rate ?? 0,
    active: k.is_active ? 1 : 0,
  }));

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading dashboard…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Typography variant="h4">Dashboard</Typography>
          <Button
            component={RouterLink}
            to="/configs"
            variant="outlined"
            startIcon={<SettingsIcon />}
          >
            Manage configs
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Overview of your config keys. Usage tracking can be added later.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <KeyIcon color="primary" />
                  <Typography color="text.secondary" variant="body2">Total config keys</Typography>
                </Box>
                <Typography variant="h4">{configKeys.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckCircleIcon color="success" />
                  <Typography color="text.secondary" variant="body2">Active</Typography>
                </Box>
                <Typography variant="h4">{activeCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TimelineIcon color="primary" />
                  <Typography color="text.secondary" variant="body2">Total requests</Typography>
                </Box>
                <Typography variant="h4">{usageSummary ? usageSummary.total_requests : '—'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {usageSummary?.error && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            {usageSummary.error}
          </Alert>
        )}

        {configKeys.length > 0 && usageSummary && !usageSummary.error && usageSummary.total_requests === 0 && (
          <Alert severity="info" sx={{ mt: 3 }} variant="outlined">
            <Typography variant="subtitle2" gutterBottom>No usage recorded yet</Typography>
            <Typography variant="body2" component="div">
              1) Run <code>make init-db</code> to create the <code>usage_log</code> table (if not already).<br />
              2) Restart the proxy (so it writes usage).<br />
              3) Send requests through your config key URLs, e.g. <code>curl http://localhost:8080/your_key/get</code>.<br />
              4) Check proxy logs for &quot;Usage log insert failed&quot; — if present, the table may be missing or the proxy may be using a different database.
            </Typography>
          </Alert>
        )}

        {configKeys.length > 0 && (
          <>
            <Paper sx={{ p: 2, mt: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon /> Config keys — fail rate
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="fail_rate" name="Fail rate %" fill="#90caf9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>

            <Paper sx={{ p: 2, mt: 3 }}>
              <Typography variant="h6" gutterBottom>Config keys list</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Target URL</TableCell>
                      <TableCell align="right">Fail rate</TableCell>
                      <TableCell align="right">Latency (ms)</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {configKeys.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell>{k.name || '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={k.target_url || ''}>
                          {k.target_url || '—'}
                        </TableCell>
                        <TableCell align="right">{k.fail_rate ?? 0}%</TableCell>
                        <TableCell align="right">{k.min_latency ?? 0}–{k.max_latency ?? 0}</TableCell>
                        <TableCell>{k.is_active ? 'Active' : 'Inactive'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}

        {configKeys.length === 0 && (
          <Alert severity="info" sx={{ mt: 3 }}>
            No config keys yet. <Button component={RouterLink} to="/configs" color="inherit" sx={{ textDecoration: 'underline' }}>Create one</Button> to start using the proxy.
          </Alert>
        )}

        {/* Usage timeline */}
        {configKeys.length > 0 && (
          <Paper sx={{ p: 2, mt: 3 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon /> Usage over time
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={groupBy}
                exclusive
                onChange={(_, v) => v != null && setGroupBy(v)}
                aria-label="Group by"
              >
                <ToggleButton value="hour" aria-label="Hour">Hour</ToggleButton>
                <ToggleButton value="day" aria-label="Day">Day</ToggleButton>
                <ToggleButton value="month" aria-label="Month">Month</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                size="small"
                value={groupBy === 'hour' ? '7d' : period}
                exclusive
                onChange={(_, v) => v != null && setPeriod(v)}
                aria-label="Period"
              >
                <ToggleButton value="7d" disabled={groupBy === 'month'} aria-label="7 days">7d</ToggleButton>
                <ToggleButton value="30d" disabled={groupBy === 'hour'} aria-label="30 days">30d</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {usageLoading && (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading usage…</Typography>
            )}
            {!usageLoading && usageTimeline && usageTimeline.labels?.length > 0 && (
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={usageTimeline.labels.map((label, i) => {
                      const point = { label };
                      usageTimeline.series?.forEach((s, j) => {
                        point[s.key_name] = s.counts?.[i] ?? 0;
                      });
                      return point;
                    })}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {usageTimeline.series?.map((s, i) => (
                      <Line
                        key={s.key_id}
                        type="monotone"
                        dataKey={s.key_name}
                        name={s.key_name}
                        stroke={COLORS[i % COLORS.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
            {!usageLoading && usageTimeline && (!usageTimeline.labels?.length || usageTimeline.series?.every((s) => (s.counts || []).every((c) => c === 0))) && (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No usage in this period. Traffic through your config keys will appear here.
              </Typography>
            )}
          </Paper>
        )}
      </Container>
    </Box>
  );
}

export default Dashboard;
