import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Slider,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Tooltip,
  Divider,
  Chip,
} from '@mui/material';
import { API_ENDPOINTS } from '../config';

const DEFAULT_ERROR_CODES = [500, 503];

function QuickSandbox() {
  const [formData, setFormData] = useState({
    url: 'https://api.github.com',
    failRate: 0,
    minLatency: 0,
    maxLatency: 1000,
    errorCodes: [...DEFAULT_ERROR_CODES],
  });
  const [errorCodeInput, setErrorCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSliderChange = (event, newValue, name) => {
    if (name === 'minLatency' && newValue > formData.maxLatency) {
      setFormData({
        ...formData,
        minLatency: newValue,
        maxLatency: newValue,
      });
    } else if (name === 'maxLatency' && newValue < formData.minLatency) {
      setFormData({
        ...formData,
        minLatency: newValue,
        maxLatency: newValue,
      });
    } else {
      setFormData({
        ...formData,
        [name]: newValue,
      });
    }
  };

  const handleAddErrorCode = () => {
    const n = parseInt(errorCodeInput, 10);
    if (isNaN(n) || n < 100 || n > 599) return;
    if (formData.errorCodes.includes(n)) return;
    setFormData(f => ({
      ...f,
      errorCodes: [...f.errorCodes, n].sort((a, b) => a - b),
    }));
    setErrorCodeInput('');
  };

  const handleRemoveErrorCode = (code) => {
    setFormData(f => ({
      ...f,
      errorCodes: f.errorCodes.filter(c => c !== code),
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const startTime = performance.now();
      const failRateDecimal = formData.failRate / 100;
      const params = new URLSearchParams({
        url: formData.url,
        failrate: String(failRateDecimal),
        minLatency: String(formData.minLatency),
        maxLatency: String(formData.maxLatency),
      });
      if (formData.errorCodes.length > 0) {
        params.set('failCodes', formData.errorCodes.join(','));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_ENDPOINTS.SANDBOX}?${params.toString()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();

      if (!response.ok) {
        const text = await response.text();
        setResult({
          status: response.status,
          time: endTime - startTime,
          simulatedFailure: true,
          data: { status: response.status, body: text },
        });
        return;
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { _raw: text };
      }
      setResult({
        status: response.status,
        time: endTime - startTime,
        data,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out after 30 seconds');
      } else {
        setError(err.message);
      }
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Quick API Test
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Test your API endpoints with configurable latency and failure rates
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Target URL
            </Typography>
            <Tooltip title="The URL of the API endpoint you want to test">
              <TextField
                fullWidth
                label="URL"
                name="url"
                value={formData.url}
                onChange={handleChange}
                margin="normal"
                required
                placeholder="https://api.github.com"
                helperText="Try with https://api.github.com"
              />
            </Tooltip>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Latency Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set a range for random latency injection (in milliseconds)
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Tooltip title="Minimum delay to inject (in milliseconds)">
                  <Box>
                    <Typography gutterBottom>
                      Min Latency: {formData.minLatency}ms
                    </Typography>
                    <Slider
                      value={formData.minLatency}
                      onChange={(e, v) => handleSliderChange(e, v, 'minLatency')}
                      step={100}
                      marks
                      min={0}
                      max={5000}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                </Tooltip>
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="Maximum delay to inject (in milliseconds)">
                  <Box>
                    <Typography gutterBottom>
                      Max Latency: {formData.maxLatency}ms
                    </Typography>
                    <Slider
                      value={formData.maxLatency}
                      onChange={(e, v) => handleSliderChange(e, v, 'maxLatency')}
                      step={100}
                      marks
                      min={formData.minLatency}
                      max={5000}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                </Tooltip>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Failure Rate
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Chance (0–100%) that the request will fail. When it fails, one of the error codes below is returned at random (same as Configs).
            </Typography>
            <Tooltip title="Probability of the request failing (0-100%)">
              <Box>
                <Typography gutterBottom>
                  Failure Rate: {formData.failRate}%
                </Typography>
                <Slider
                  value={formData.failRate}
                  onChange={(e, v) => handleSliderChange(e, v, 'failRate')}
                  step={1}
                  marks
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                />
              </Box>
            </Tooltip>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Error codes (when failure is injected)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              HTTP status codes (100–599) to return when a failure is triggered. One is chosen at random. Same behavior as Configs.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              {(formData.errorCodes.length ? formData.errorCodes : []).map((code) => (
                <Chip
                  key={code}
                  label={code}
                  onDelete={() => handleRemoveErrorCode(code)}
                  size="small"
                />
              ))}
              <TextField
                size="small"
                placeholder="e.g. 502"
                sx={{ width: 80 }}
                value={errorCodeInput}
                onChange={(e) => setErrorCodeInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddErrorCode())}
              />
              <Button size="small" onClick={handleAddErrorCode}>
                Add
              </Button>
            </Box>
          </Box>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Test API'}
          </Button>
        </form>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            {result.simulatedFailure && (
              <Alert severity="info" sx={{ mb: 2 }}>Simulated failure — one of your error codes was returned.</Alert>
            )}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Status Code: {result.status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Response Time: {result.time.toFixed(2)}ms
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }} gutterBottom>
              Response Data:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: '400px',
                '& code': {
                  color: 'text.primary',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }
              }}
            >
              <code>
                {JSON.stringify(result.data, null, 2)}
              </code>
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default QuickSandbox; 