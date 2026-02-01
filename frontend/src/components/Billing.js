import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { STRIPE_PUBLISHABLE_KEY, STRIPE_DONATION_LINK } from '../config';
import { fetchBillingPlans, fetchBillingUsage, syncBillingFromStripe, createCheckout, createPortal, upgradeToPro } from '../services/api';

function Billing() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const cancel = searchParams.get('cancel');

  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const isLocalhostMode = STRIPE_PUBLISHABLE_KEY === 'localhost';
  const hasActiveSub = usage?.has_active_subscription === true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (searchParams.get('success') === '1') {
          await syncBillingFromStripe().catch(() => {});
        }
        const [usageData, plansData] = await Promise.all([
          fetchBillingUsage(),
          fetchBillingPlans().catch(() => ({ plans: [] })),
        ]);
        if (!cancelled) {
          setUsage(usageData);
          setPlans(plansData.plans || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load billing');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams.get('success')]);

  const handleCheckout = async (priceId) => {
    if (!priceId) return;
    setActionLoading('checkout');
    try {
      const { url } = await createCheckout(priceId);
      if (url) window.location.href = url;
    } catch (e) {
      setError(e.message || 'Checkout failed');
    } finally {
      setActionLoading('');
    }
  };

  const handlePortal = async () => {
    setActionLoading('portal');
    try {
      const { url } = await createPortal();
      if (url) window.location.href = url;
    } catch (e) {
      setError(e.message || 'Portal failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleUpgradeToPro = async () => {
    setActionLoading('upgrade');
    setError('');
    try {
      await upgradeToPro();
      const usageData = await fetchBillingUsage();
      setUsage(usageData);
    } catch (e) {
      setError(e.message || 'Upgrade failed');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography>Loading…</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Billing</Typography>

      {success === '1' && <Alert severity="success" sx={{ mb: 2 }}>Subscription activated. Thank you.</Alert>}
      {cancel === '1' && <Alert severity="info" sx={{ mb: 2 }}>Checkout cancelled.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {usage && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Current usage</Typography>
          <Typography>Plan: <strong>{usage.plan}</strong></Typography>
          <Typography>Config keys: {usage.keys_used} / {usage.keys_limit}</Typography>
          <Typography>Requests this month: {usage.requests_this_month.toLocaleString()} / {usage.requests_limit.toLocaleString()}</Typography>
        </Paper>
      )}

      {isLocalhostMode ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Support the project</Typography>
          <Typography color="text.secondary" paragraph>
            You are running in localhost mode. No Stripe subscription here — consider making a one-time donation to help development.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {STRIPE_DONATION_LINK ? (
              <Button variant="contained" href={STRIPE_DONATION_LINK} target="_blank" rel="noopener noreferrer">
                Donate with Stripe
              </Button>
            ) : null}
            <Button variant="outlined" href="https://ko-fi.com" target="_blank" rel="noopener noreferrer">
              Or Ko-fi
            </Button>
          </Box>
        </Paper>
      ) : hasActiveSub ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Manage subscription</Typography>
          <Typography color="text.secondary" paragraph>
            Update payment method, view invoices, or cancel your subscription.
          </Typography>
          {usage?.plan === 'starter' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Pro advantages</Typography>
              <Typography variant="body2" component="span">
                50 config keys (vs 10 on Starter), 500K requests/month (vs 50K). Upgrade to unlock more.
              </Typography>
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {usage?.plan === 'starter' && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleUpgradeToPro}
                disabled={!!actionLoading}
              >
                {actionLoading === 'upgrade' ? 'Upgrading…' : 'Upgrade to Pro'}
              </Button>
            )}
            <Button
              variant={usage?.plan === 'starter' ? 'outlined' : 'contained'}
              onClick={handlePortal}
              disabled={!!actionLoading}
            >
              {actionLoading === 'portal' ? 'Opening…' : 'Manage subscription / Invoices'}
            </Button>
          </Box>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {plans.map((plan) => (
            <Card key={plan.id} sx={{ minWidth: 180 }}>
              <CardContent>
                <Typography variant="h6">{plan.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {plan.keys} keys · {plan.requests_per_month?.toLocaleString()} req/month
                </Typography>
                <Typography variant="h5" sx={{ mt: 1 }}>{plan.price_display || '—'}</Typography>
              </CardContent>
              <CardActions>
                <Button size="small" variant="contained" onClick={() => handleCheckout(plan.price_id)} disabled={!!actionLoading}>
                  Subscribe
                </Button>
              </CardActions>
            </Card>
          ))}
          {plans.length === 0 && !isLocalhostMode && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>No subscription plans yet</Typography>
              <Typography variant="body2" color="text.secondary">
                To offer Starter and Pro subscriptions, create Products and Prices in your Stripe Dashboard, then add their Price IDs (e.g. <code>price_xxx</code>) to your server&apos;s .env: <code>STRIPE_STARTER_PRICE_ID</code> and <code>STRIPE_PRO_PRICE_ID</code>. Until then, only the free plan is available.
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Container>
  );
}

export default Billing;
