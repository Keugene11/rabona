import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  findUserById,
  updateUserStripeInfo,
  findUserByStripeCustomerId,
} from '../services/database';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Get subscription status
router.get('/subscription-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Subscription status request for userId:', req.userId);
    const user = await findUserById(req.userId!);
    if (!user) {
      console.log('User not found for userId:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found:', { id: user.id, email: user.email, tier: user.subscription_tier, stripeSubId: user.stripe_subscription_id });

    // If user has a subscription, fetch real-time status from Stripe
    if (user.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id) as Stripe.Subscription;
        console.log('Stripe subscription status:', subscription.status);
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';

        // Safely get current_period_end
        let currentPeriodEnd: string | null = null;
        const periodEnd = (subscription as any).current_period_end;
        if (periodEnd && typeof periodEnd === 'number') {
          try {
            currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
          } catch (dateErr) {
            console.error('Failed to parse current_period_end:', periodEnd);
          }
        }

        return res.json({
          isSubscribed: isActive,
          plan: 'monthly',
          status: subscription.status,
          currentPeriodEnd,
        });
      } catch (stripeErr) {
        console.error('Stripe subscription fetch failed:', stripeErr);
        // Subscription fetch failed but user has pro tier in DB - trust the DB
        if (user.subscription_tier === 'pro') {
          return res.json({
            isSubscribed: true,
            plan: 'monthly',
            status: 'active',
          });
        }
        // Subscription might have been deleted
        return res.json({
          isSubscribed: false,
          monthlyUsage: user.monthly_usage,
          limit: 5,
        });
      }
    }

    // No subscription - check tier directly
    const isSubscribed = user.subscription_tier === 'pro';
    console.log('No Stripe sub ID, checking tier. isSubscribed:', isSubscribed);
    return res.json({
      isSubscribed,
      monthlyUsage: user.monthly_usage,
      limit: 5,
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Create checkout session
router.post('/create-checkout-session', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await findUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await updateUserStripeInfo(user.id, { stripe_customer_id: customerId });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: STRIPE_PRICE_MONTHLY,
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}?subscription=success`,
      cancel_url: `${FRONTEND_URL}?subscription=cancelled`,
      metadata: {
        userId: user.id,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create portal session for managing subscription
router.post('/create-portal-session', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await findUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: FRONTEND_URL,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Webhook handler - must use raw body
router.post('/webhook', async (req: Request, res: Response) => {
  console.log('Webhook received!');
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured!');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, endpointSecret);
    console.log('Webhook verified, event type:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        console.log('Checkout completed:', { customerId, subscriptionId, metadata: session.metadata });

        // Find user by customer ID or metadata
        let user = await findUserByStripeCustomerId(customerId);
        console.log('User by customer ID:', user?.id || 'not found');

        if (!user && session.metadata?.userId) {
          user = await findUserById(session.metadata.userId);
          console.log('User by metadata userId:', user?.id || 'not found');
        }

        if (user) {
          await updateUserStripeInfo(user.id, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_tier: 'pro',
          });
          console.log(`SUCCESS: User ${user.id} (${user.email}) upgraded to pro`);
        } else {
          console.error('FAILED: Could not find user for checkout session');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await findUserByStripeCustomerId(customerId);

        if (user) {
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          await updateUserStripeInfo(user.id, {
            stripe_subscription_id: subscription.id,
            subscription_tier: isActive ? 'pro' : 'free',
          });
          console.log(`User ${user.id} subscription updated: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await findUserByStripeCustomerId(customerId);

        if (user) {
          await updateUserStripeInfo(user.id, {
            stripe_subscription_id: null,
            subscription_tier: 'free',
          });
          console.log(`User ${user.id} subscription cancelled`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
});

export default router;
