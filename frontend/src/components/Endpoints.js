import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Chip,
  Tooltip,
  CircularProgress,
  Divider,
  InputAdornment,
  Switch,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  PlayArrow as PlayIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { 
  fetchCollections, 
  createCollection, 
  deleteCollection, 
  fetchEndpoints, 
  fetchApiKeys,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
} from '../services/api';
import { API_ENDPOINTS } from '../config';

function Endpoints() {
  const [collections, setCollections] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedApiKey, setSelectedApiKey] = useState('');
  const [expandedCollection, setExpandedCollection] = useState(null);
  const [collectionEndpoints, setCollectionEndpoints] = useState({});
  const [testingEndpoint, setTestingEndpoint] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  
  // Collection dialog
  const [openCollectionDialog, setOpenCollectionDialog] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '' });
  
  // Endpoint dialogs
  const [openEndpointDialog, setOpenEndpointDialog] = useState(false);
  const [editEndpointDialog, setEditEndpointDialog] = useState(false);
  const [currentCollectionId, setCurrentCollectionId] = useState(null);
  const [newEndpoint, setNewEndpoint] = useState({
    name: '', url: '', method: 'GET', min_latency: 0, max_latency: 1000, fail_rate: 0
  });
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadData = useCallback(async () => {
    try {
      const [collectionsData, apiKeysData] = await Promise.all([
        fetchCollections(),
        fetchApiKeys()
      ]);
      setCollections(collectionsData);
      setApiKeys(apiKeysData);
      
      const activeKey = apiKeysData.find(k => k.is_active);
      if (activeKey && !selectedApiKey) {
        setSelectedApiKey(activeKey.key);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load data', severity: 'error' });
    }
  }, [selectedApiKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExpandCollection = async (collectionId) => {
    const newExpanded = expandedCollection === collectionId ? null : collectionId;
    setExpandedCollection(newExpanded);
    setTestResult(null);
    
    if (newExpanded && !collectionEndpoints[collectionId]) {
      try {
        const endpoints = await fetchEndpoints(collectionId);
        setCollectionEndpoints(prev => ({ ...prev, [collectionId]: endpoints }));
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to load endpoints', severity: 'error' });
      }
    }
  };

  const reloadEndpoints = async (collectionId) => {
    try {
      const endpoints = await fetchEndpoints(collectionId);
      setCollectionEndpoints(prev => ({ ...prev, [collectionId]: endpoints }));
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to reload endpoints', severity: 'error' });
    }
  };

  const getProxyUrl = (collectionId, endpoint = null) => {
    const base = `${API_ENDPOINTS.PROXY}/${collectionId}`;
    const params = new URLSearchParams();
    
    if (selectedApiKey) {
      params.append('api_key', selectedApiKey);
    }
    if (endpoint) {
      params.append('url', endpoint.url);
    }
    
    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
  };

  const getCurlCommand = (collectionId, endpoint) => {
    return `curl "${getProxyUrl(collectionId, endpoint)}"`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Copied to clipboard!', severity: 'success' });
  };

  const handleTestEndpoint = async (collectionId, endpoint) => {
    if (!selectedApiKey) {
      setSnackbar({ open: true, message: 'Please select an API key first', severity: 'warning' });
      return;
    }

    setTestingEndpoint(endpoint.id);
    setTestLoading(true);
    setTestResult(null);

    try {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(getProxyUrl(collectionId, endpoint), {
        method: 'GET', // Always GET since we're passing the URL as a parameter
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      setTestResult({
        endpointId: endpoint.id,
        status: response.status,
        statusText: response.statusText,
        time: endTime - startTime,
        data: data,
        success: response.ok,
      });
    } catch (err) {
      setTestResult({
        endpointId: endpoint.id,
        status: 0,
        statusText: err.name === 'AbortError' ? 'Timeout' : 'Error',
        time: 0,
        data: err.message,
        success: false,
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Collection handlers
  const handleCreateCollection = async () => {
    if (!newCollection.name.trim()) {
      setSnackbar({ open: true, message: 'Name is required', severity: 'error' });
      return;
    }
    try {
      await createCollection({ name: newCollection.name, description: newCollection.description });
      setNewCollection({ name: '', description: '' });
      setOpenCollectionDialog(false);
      loadData();
      setSnackbar({ open: true, message: 'Collection created', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create collection', severity: 'error' });
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!window.confirm('Delete this collection and all its endpoints?')) return;
    try {
      await deleteCollection(collectionId);
      loadData();
      setSnackbar({ open: true, message: 'Collection deleted', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete collection', severity: 'error' });
    }
  };

  // Pattern matching utilities for conflict detection
  const patternToRegex = (pattern) => {
    // Convert wildcard pattern to regex
    // * matches any characters
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(regexStr);
  };

  const patternsOverlap = (pattern1, pattern2) => {
    // Check if two patterns could match the same URL
    // This is a simplified check - not perfect but catches common cases
    
    if (pattern1 === pattern2) return true;
    if (pattern1 === '*' || pattern2 === '*') return true;
    
    // Check if one pattern could match what the other describes
    const regex1 = patternToRegex(pattern1);
    const regex2 = patternToRegex(pattern2);
    
    // Create sample URLs from patterns to test overlap
    const sample1 = pattern1.replace(/\*/g, 'test');
    const sample2 = pattern2.replace(/\*/g, 'test');
    
    // If pattern2 matches sample1 or pattern1 matches sample2, they overlap
    if (regex2.test(sample1) || regex1.test(sample2)) return true;
    
    // Check for prefix overlap (e.g., "https://api.com/*" and "https://api.com/users/*")
    const base1 = pattern1.split('*')[0];
    const base2 = pattern2.split('*')[0];
    if (base1 && base2) {
      if (base1.startsWith(base2) || base2.startsWith(base1)) return true;
    }
    
    return false;
  };

  const getPatternScore = (pattern) => {
    // Higher score = more specific
    if (pattern === '*') return 0;
    let score = 0;
    for (const ch of pattern) {
      if (ch !== '*') score++;
    }
    return score;
  };

  const findConflicts = (url, collectionId, excludeEndpointId = null) => {
    const endpoints = collectionEndpoints[collectionId] || [];
    const conflicts = [];
    
    for (const ep of endpoints) {
      if (excludeEndpointId && ep.id === excludeEndpointId) continue;
      if (!ep.is_active) continue;
      
      if (patternsOverlap(url, ep.url)) {
        const newScore = getPatternScore(url);
        const existingScore = getPatternScore(ep.url);
        
        conflicts.push({
          endpoint: ep,
          type: newScore === existingScore ? 'exact' : 
                newScore > existingScore ? 'overrides' : 'overridden',
          newScore,
          existingScore,
        });
      }
    }
    
    return conflicts;
  };

  // Endpoint handlers
  const openAddEndpoint = (collectionId) => {
    setCurrentCollectionId(collectionId);
    setNewEndpoint({ name: '', url: '', method: 'GET', min_latency: 0, max_latency: 1000, fail_rate: 0 });
    setOpenEndpointDialog(true);
  };

  const handleCreateEndpoint = async () => {
    if (!newEndpoint.name.trim() || !newEndpoint.url.trim()) {
      setSnackbar({ open: true, message: 'Name and URL pattern are required', severity: 'error' });
      return;
    }
    
    // Check for conflicts
    const conflicts = findConflicts(newEndpoint.url, currentCollectionId);
    if (conflicts.length > 0) {
      const exactConflicts = conflicts.filter(c => c.type === 'exact');
      if (exactConflicts.length > 0) {
        setSnackbar({ 
          open: true, 
          message: `Conflict: Pattern "${newEndpoint.url}" matches same URLs as "${exactConflicts[0].endpoint.name}"`, 
          severity: 'error' 
        });
        return;
      }
      // Warn but allow for overrides
      const msg = conflicts.map(c => 
        c.type === 'overrides' 
          ? `Will override "${c.endpoint.name}" for matching URLs`
          : `Will be overridden by "${c.endpoint.name}" for matching URLs`
      ).join('. ');
      if (!window.confirm(`Warning: ${msg}. Continue?`)) return;
    }
    
    try {
      await createEndpoint(currentCollectionId, {
        ...newEndpoint,
        collection_id: currentCollectionId
      });
      setOpenEndpointDialog(false);
      reloadEndpoints(currentCollectionId);
      setSnackbar({ open: true, message: 'Endpoint created', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create endpoint', severity: 'error' });
    }
  };

  const openEditEndpoint = (endpoint) => {
    setEditingEndpoint({ ...endpoint });
    setEditEndpointDialog(true);
  };

  const handleUpdateEndpoint = async () => {
    if (!editingEndpoint.url.trim()) {
      setSnackbar({ open: true, message: 'URL pattern is required', severity: 'error' });
      return;
    }
    
    // Check for conflicts (excluding current endpoint)
    const conflicts = findConflicts(editingEndpoint.url, editingEndpoint.collection_id, editingEndpoint.id);
    if (conflicts.length > 0) {
      const exactConflicts = conflicts.filter(c => c.type === 'exact');
      if (exactConflicts.length > 0) {
        setSnackbar({ 
          open: true, 
          message: `Conflict: Pattern matches same URLs as "${exactConflicts[0].endpoint.name}"`, 
          severity: 'error' 
        });
        return;
      }
      const msg = conflicts.map(c => 
        c.type === 'overrides' 
          ? `Will override "${c.endpoint.name}"`
          : `Will be overridden by "${c.endpoint.name}"`
      ).join('. ');
      if (!window.confirm(`Warning: ${msg}. Continue?`)) return;
    }
    
    try {
      await updateEndpoint(editingEndpoint.id, {
        name: editingEndpoint.name,
        url: editingEndpoint.url,
        method: editingEndpoint.method,
        min_latency: editingEndpoint.min_latency,
        max_latency: editingEndpoint.max_latency,
        fail_rate: editingEndpoint.fail_rate,
        is_active: editingEndpoint.is_active,
      });
      setEditEndpointDialog(false);
      reloadEndpoints(editingEndpoint.collection_id);
      setSnackbar({ open: true, message: 'Endpoint updated', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update endpoint', severity: 'error' });
    }
  };

  const handleDeleteEndpoint = async (endpoint) => {
    if (!window.confirm('Delete this endpoint?')) return;
    try {
      await deleteEndpoint(endpoint.id);
      reloadEndpoints(endpoint.collection_id);
      setSnackbar({ open: true, message: 'Endpoint deleted', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete endpoint', severity: 'error' });
    }
  };

  const handleToggleEndpoint = async (endpoint) => {
    try {
      await updateEndpoint(endpoint.id, { is_active: !endpoint.is_active });
      reloadEndpoints(endpoint.collection_id);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update endpoint', severity: 'error' });
    }
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'GET': return 'success';
      case 'POST': return 'primary';
      case 'PUT': return 'warning';
      case 'DELETE': return 'error';
      case 'PATCH': return 'secondary';
      default: return 'default';
    }
  };

  const getSelectedApiKeyObj = () => {
    return apiKeys.find(k => k.key === selectedApiKey);
  };

  const getCollectionNamesForKey = (apiKey) => {
    if (!apiKey || apiKey.all_collections) return [];
    return apiKey.collection_ids
      .map(id => collections.find(c => c.id === id)?.name)
      .filter(Boolean);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* API Key Selector */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>API Key</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <FormControl fullWidth size="small">
              <InputLabel>Select API Key</InputLabel>
              <Select
                value={selectedApiKey}
                onChange={(e) => setSelectedApiKey(e.target.value)}
                label="Select API Key"
              >
                {apiKeys.map((apiKey) => (
                  <MenuItem key={apiKey.id} value={apiKey.key} disabled={!apiKey.is_active}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <span>{apiKey.name}</span>
                      {!apiKey.is_active && <Chip label="Inactive" size="small" />}
                      {apiKey.all_collections ? (
                        <Chip label="All Collections" size="small" color="primary" />
                      ) : (
                        getCollectionNamesForKey(apiKey).map((name, idx) => (
                          <Chip key={idx} label={name} size="small" color="primary" variant="outlined" />
                        ))
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={7}>
            {selectedApiKey && (
              <Box>
                <TextField
                  size="small"
                  value={selectedApiKey}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    sx: { fontFamily: 'monospace', fontSize: '0.8rem' },
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Copy API Key">
                          <IconButton onClick={() => copyToClipboard(selectedApiKey)} size="small">
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
                {/* Show collections for selected key */}
                {getSelectedApiKeyObj() && !getSelectedApiKeyObj().all_collections && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Access:</Typography>
                    {getCollectionNamesForKey(getSelectedApiKeyObj()).map((name, idx) => (
                      <Chip key={idx} label={name} size="small" color="primary" variant="outlined" />
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Collections</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCollectionDialog(true)}>
          New Collection
        </Button>
      </Box>

      {/* Collections */}
      {collections.map((collection) => (
        <Accordion 
          key={collection.id}
          expanded={expandedCollection === collection.id}
          onChange={() => handleExpandCollection(collection.id)}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{collection.name}</Typography>
              <Chip label={`${collection.request_count || 0} req`} size="small" variant="outlined" />
              {collection.description && (
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {collection.description}
                </Typography>
              )}
              <IconButton 
                size="small" 
                color="error" 
                onClick={(e) => { e.stopPropagation(); handleDeleteCollection(collection.id); }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {/* Proxy Base URL Info */}
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Proxy Base: <code>{API_ENDPOINTS.PROXY}/{collection.id}</code>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Use with <code>?api_key=YOUR_KEY&url=TARGET_URL</code> — each endpoint below has a ready-to-use URL
              </Typography>
            </Box>

            {/* Endpoints Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Endpoints</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => openAddEndpoint(collection.id)}>
                Add Endpoint
              </Button>
            </Box>

            {/* Endpoints List */}
            {collectionEndpoints[collection.id]?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {collectionEndpoints[collection.id].map((endpoint) => (
                  <Card 
                    key={endpoint.id} 
                    variant="outlined"
                    sx={{ 
                      opacity: endpoint.is_active === false ? 0.6 : 1,
                      bgcolor: endpoint.is_active === false ? 'action.disabledBackground' : 'background.paper',
                    }}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      {/* Endpoint Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip label={endpoint.method} size="small" color={getMethodColor(endpoint.method)} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{endpoint.name}</Typography>
                        {endpoint.is_active === false && <Chip label="Off" size="small" />}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          {endpoint.min_latency}-{endpoint.max_latency}ms • {endpoint.fail_rate}% fail • {endpoint.request_count || 0} req
                        </Typography>
                      </Box>
                      
                      {/* Target URL */}
                      <Typography variant="caption" color="text.secondary">Target:</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
                        {endpoint.url}
                      </Typography>

                      {/* Proxy URL */}
                      <Typography variant="caption" color="text.secondary">Proxy URL:</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: 'monospace', 
                            fontSize: '0.7rem', 
                            flex: 1, 
                            wordBreak: 'break-all',
                            color: selectedApiKey ? 'text.primary' : 'text.disabled'
                          }}
                        >
                          {getProxyUrl(collection.id, endpoint)}
                        </Typography>
                        <Tooltip title="Copy proxy URL">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(getProxyUrl(collection.id, endpoint))}
                            disabled={!selectedApiKey}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
                        <Tooltip title={endpoint.is_active ? 'Active' : 'Inactive'}>
                          <Switch
                            size="small"
                            checked={endpoint.is_active !== false}
                            onChange={() => handleToggleEndpoint(endpoint)}
                          />
                        </Tooltip>
                        <Tooltip title="Copy cURL command">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(getCurlCommand(collection.id, endpoint))}
                            disabled={!selectedApiKey}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEditEndpoint(endpoint)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteEndpoint(endpoint)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={testLoading && testingEndpoint === endpoint.id ? <CircularProgress size={14} color="inherit" /> : <PlayIcon />}
                          onClick={() => handleTestEndpoint(collection.id, endpoint)}
                          disabled={!selectedApiKey || testLoading || endpoint.is_active === false}
                          sx={{ ml: 1 }}
                        >
                          Test
                        </Button>
                      </Box>

                      {/* Test Result */}
                      {testResult && testResult.endpointId === endpoint.id && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 1 }}>
                            {testResult.status} {testResult.statusText} • {testResult.time.toFixed(0)}ms
                          </Alert>
                          <Box
                            component="pre"
                            sx={{
                              p: 1.5,
                              bgcolor: 'grey.900',
                              color: 'grey.100',
                              borderRadius: 1,
                              overflow: 'auto',
                              maxHeight: 200,
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              m: 0,
                            }}
                          >
                            {typeof testResult.data === 'string' ? testResult.data : JSON.stringify(testResult.data, null, 2)}
                          </Box>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : collectionEndpoints[collection.id] ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No endpoints yet. Click "Add Endpoint" to create one.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}

      {collections.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No collections yet. Create one to get started!</Typography>
        </Paper>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={openCollectionDialog} onClose={() => setOpenCollectionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            margin="normal"
            value={newCollection.name}
            onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={newCollection.description}
            onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCollectionDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateCollection} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Create Endpoint Dialog */}
      <Dialog open={openEndpointDialog} onClose={() => setOpenEndpointDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Endpoint</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            margin="normal"
            value={newEndpoint.name}
            onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
            placeholder="Get Users"
          />
          <TextField
            label="URL Pattern"
            fullWidth
            margin="normal"
            value={newEndpoint.url}
            onChange={(e) => setNewEndpoint({ ...newEndpoint, url: e.target.value })}
            placeholder="https://api.example.com/*"
            helperText="Use * as wildcard. Examples: https://api.github.com/*, https://*.example.com/*, or just *"
          />
          {newEndpoint.url && findConflicts(newEndpoint.url, currentCollectionId).length > 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {findConflicts(newEndpoint.url, currentCollectionId).map((c, i) => (
                <div key={i}>
                  {c.type === 'exact' && `⚠️ Conflicts with "${c.endpoint.name}" (same specificity)`}
                  {c.type === 'overrides' && `This pattern will override "${c.endpoint.name}" for matching URLs`}
                  {c.type === 'overridden' && `This pattern will be overridden by "${c.endpoint.name}" for matching URLs`}
                </div>
              ))}
            </Alert>
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel>Method</InputLabel>
            <Select
              value={newEndpoint.method}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, method: e.target.value })}
              label="Method"
            >
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <Typography variant="caption">Min Latency: {newEndpoint.min_latency}ms</Typography>
              <Slider
                value={newEndpoint.min_latency}
                onChange={(e, v) => {
                  const newMin = v;
                  const newMax = Math.max(v, newEndpoint.max_latency);
                  setNewEndpoint({ ...newEndpoint, min_latency: newMin, max_latency: newMax });
                }}
                min={0} max={5000} step={50}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption">Max Latency: {newEndpoint.max_latency}ms</Typography>
              <Slider
                value={newEndpoint.max_latency}
                onChange={(e, v) => {
                  const newMax = v;
                  const newMin = Math.min(v, newEndpoint.min_latency);
                  setNewEndpoint({ ...newEndpoint, min_latency: newMin, max_latency: newMax });
                }}
                min={0} max={5000} step={50}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption">Fail Rate: {newEndpoint.fail_rate}%</Typography>
              <Slider
                value={newEndpoint.fail_rate}
                onChange={(e, v) => setNewEndpoint({ ...newEndpoint, fail_rate: v })}
                min={0} max={100} step={1}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEndpointDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateEndpoint} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Endpoint Dialog */}
      <Dialog open={editEndpointDialog} onClose={() => setEditEndpointDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Endpoint</DialogTitle>
        <DialogContent>
          {editingEndpoint && (
            <>
              <TextField
                autoFocus
                label="Name"
                fullWidth
                margin="normal"
                value={editingEndpoint.name}
                onChange={(e) => setEditingEndpoint({ ...editingEndpoint, name: e.target.value })}
              />
              <TextField
                label="URL Pattern"
                fullWidth
                margin="normal"
                value={editingEndpoint.url}
                onChange={(e) => setEditingEndpoint({ ...editingEndpoint, url: e.target.value })}
                helperText="Use * as wildcard. Examples: https://api.github.com/*, https://*.example.com/*, or just *"
              />
              {editingEndpoint.url && findConflicts(editingEndpoint.url, editingEndpoint.collection_id, editingEndpoint.id).length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {findConflicts(editingEndpoint.url, editingEndpoint.collection_id, editingEndpoint.id).map((c, i) => (
                    <div key={i}>
                      {c.type === 'exact' && `⚠️ Conflicts with "${c.endpoint.name}" (same specificity)`}
                      {c.type === 'overrides' && `This pattern will override "${c.endpoint.name}" for matching URLs`}
                      {c.type === 'overridden' && `This pattern will be overridden by "${c.endpoint.name}" for matching URLs`}
                    </div>
                  ))}
                </Alert>
              )}
              <FormControl fullWidth margin="normal">
                <InputLabel>Method</InputLabel>
                <Select
                  value={editingEndpoint.method}
                  onChange={(e) => setEditingEndpoint({ ...editingEndpoint, method: e.target.value })}
                  label="Method"
                >
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="caption">Min Latency: {editingEndpoint.min_latency}ms</Typography>
                  <Slider
                    value={editingEndpoint.min_latency}
                    onChange={(e, v) => {
                      const newMin = v;
                      const newMax = Math.max(v, editingEndpoint.max_latency);
                      setEditingEndpoint({ ...editingEndpoint, min_latency: newMin, max_latency: newMax });
                    }}
                    min={0} max={5000} step={50}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption">Max Latency: {editingEndpoint.max_latency}ms</Typography>
                  <Slider
                    value={editingEndpoint.max_latency}
                    onChange={(e, v) => {
                      const newMax = v;
                      const newMin = Math.min(v, editingEndpoint.min_latency);
                      setEditingEndpoint({ ...editingEndpoint, min_latency: newMin, max_latency: newMax });
                    }}
                    min={0} max={5000} step={50}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption">Fail Rate: {editingEndpoint.fail_rate}%</Typography>
                  <Slider
                    value={editingEndpoint.fail_rate}
                    onChange={(e, v) => setEditingEndpoint({ ...editingEndpoint, fail_rate: v })}
                    min={0} max={100} step={1}
                  />
                </Grid>
              </Grid>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEndpointDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateEndpoint} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Endpoints;
