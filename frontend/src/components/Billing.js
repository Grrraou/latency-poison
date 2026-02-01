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
import { fetchBillingPlans, fetchBillingUsage, fetchBillingInvoices, syncBillingFromStripe, createCheckout, createPortal, upgradeToPro, getCurrentUser } from '../services/api';
import { Link as RouterLink } from 'react-router-dom';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Link from '@mui/material/Link';

function Billing() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const cancel = searchParams.get('cancel');

  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const isLocalhostMode = STRIPE_PUBLISHABLE_KEY === 'localhost';
  const hasActiveSub = usage?.has_active_subscription === true;
  const hasInvoicingAddress = user?.billing_first_name && user?.billing_last_name && user?.billing_address_line1 && user?.billing_postal_code && user?.billing_city && user?.billing_country;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (searchParams.get('success') === '1') {
          await syncBillingFromStripe().catch(() => {});
        }
        const [usageData, plansData, invoicesData, userData] = await Promise.all([
          fetchBillingUsage(),
          fetchBillingPlans().catch(() => ({ plans: [] })),
          fetchBillingInvoices().catch(() => ({ invoices: [] })),
          getCurrentUser().catch(() => null),
        ]);
        if (!cancelled) {
          setUsage(usageData);
          setPlans(plansData.plans || []);
          setInvoices(invoicesData.invoices || []);
          setUser(userData);
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
    setError('');
    setActionLoading('checkout');
    try {
      const { url } = await createCheckout(priceId);
      if (url) window.location.href = url;
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Checkout failed';
      setError(msg);
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

      {!isLocalhostMode && !hasActiveSub && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Invoicing address</Typography>
          {hasInvoicingAddress ? (
            <>
              <Typography variant="body2" color="text.secondary" paragraph>
                Your invoicing address is set and will appear on your subscription invoices.
              </Typography>
              <Button component={RouterLink} to="/profile" size="small" variant="outlined">
                Edit in Profile
              </Button>
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 1 }}>
                Invoices require first name, last name, and full address in Profile before subscribing.
              </Alert>
              <Button component={RouterLink} to="/profile" variant="outlined" color="primary">
                Set invoicing address in Profile
              </Button>
            </>
          )}
        </Paper>
      )}

      {!isLocalhostMode && (hasActiveSub || invoices.length > 0) && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Invoices</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Stripe creates invoices automatically for your subscription. View or download them below.
          </Typography>
          {invoices.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No invoices yet.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv) => {
                  const date = inv.created ? new Date(inv.created).toLocaleDateString() : '—';
                  const amount = (inv.amount_paid ?? inv.amount_due ?? 0) / 100;
                  const symbol = inv.currency === 'EUR' ? '€' : inv.currency ? ` ${inv.currency}` : '';
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.number || inv.id || '—'}</TableCell>
                      <TableCell>{date}</TableCell>
                      <TableCell>{inv.status || '—'}</TableCell>
                      <TableCell align="right">{amount.toFixed(2)}{symbol}</TableCell>
                      <TableCell align="right">
                        {inv.hosted_invoice_url && (
                          <Link href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" sx={{ mr: 1 }}>
                            View
                          </Link>
                        )}
                        {inv.invoice_pdf && (
                          <Link href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                            PDF
                          </Link>
                        )}
                        {!inv.hosted_invoice_url && !inv.invoice_pdf && '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
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
                <Button size="small" variant="contained" onClick={() => handleCheckout(plan.price_id)} disabled={!!actionLoading || !hasInvoicingAddress}>
                  Subscribe
                </Button>
              </CardActions>
            </Card>
          ))}

        </Box>
      )}
    </Container>
  );
}

export default Billing;
