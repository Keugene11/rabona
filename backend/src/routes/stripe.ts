import { Router, Response, Request } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscriptionStatus,
  PRICES,
} from '../services/stripe';

const router = Router();

/**
 * POST /stripe/create-checkout-session
 * Create a Stripe checkout session for subscription
 */
router.post(
  '/create-checkout-session',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { plan = 'monthly' } = req.body;
      const priceId = plan === 'yearly' ? PRICES.yearly : PRICES.monthly;

      const origin = req.headers.origin || 'http://localhost:3001';
      const successUrl = `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/subscription/cancelled`;

      const url = await createCheckoutSession(
        req.userId!,
        req.userEmail!,
        priceId,
        successUrl,
        cancelUrl
      );

      res.json({ url });
    } catch (error: any) {
      console.error('Checkout session error:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  }
);

/**
 * POST /stripe/create-portal-session
 * Create a Stripe customer portal session
 */
router.post(
  '/create-portal-session',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const origin = req.headers.origin || 'http://localhost:3001';
      const returnUrl = `${origin}/settings`;

      const url = await createPortalSession(req.userId!, returnUrl);

      res.json({ url });
    } catch (error: any) {
      console.error('Portal session error:', error);
      res.status(500).json({ error: error.message || 'Failed to create portal session' });
    }
  }
);

/**
 * GET /stripe/subscription-status
 * Get current user's subscription status
 */
router.get(
  '/subscription-status',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const status = getSubscriptionStatus(req.userId!);
      res.json(status);
    } catch (error: any) {
      console.error('Subscription status error:', error);
      res.status(500).json({ error: 'Failed to get subscription status' });
    }
  }
);

/**
 * POST /stripe/webhook
 * Handle Stripe webhook events
 */
router.post(
  '/webhook',
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    try {
      await handleWebhook(req.body, signature);
      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /stripe/prices
 * Get available subscription prices
 */
router.get('/prices', (req: Request, res: Response) => {
  res.json({
    monthly: {
      id: PRICES.monthly,
      name: 'Monthly',
      price: 4.99,
      interval: 'month',
    },
    yearly: {
      id: PRICES.yearly,
      name: 'Yearly',
      price: 39.99,
      interval: 'year',
      savings: '33%',
    },
  });
});

export default router;
