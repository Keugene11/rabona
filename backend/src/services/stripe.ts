import Stripe from 'stripe';

// Lazy initialization - only create Stripe instance when needed
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Add it to your environment variables.');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-01-27.acacia',
    });
  }
  return stripeInstance;
}

// Product/Price IDs - you'll create these in Stripe Dashboard
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly',
  yearly: process.env.STRIPE_PRICE_YEARLY || 'price_yearly',
};

// In-memory store for subscriptions (replace with database in production)
const subscriptions: Map<string, {
  customerId: string;
  subscriptionId: string;
  status: string;
  plan: 'monthly' | 'yearly';
  currentPeriodEnd: Date;
}> = new Map();

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe();

  // Check if user already has a Stripe customer
  let customerId = subscriptions.get(userId)?.customerId;

  if (!customerId) {
    // Create new customer
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
  });

  return session.url || '';
}

export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const subscription = subscriptions.get(userId);

  if (!subscription?.customerId) {
    throw new Error('No subscription found for user');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.customerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function handleWebhook(
  body: Buffer,
  signature: string
): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        subscriptions.set(userId, {
          customerId: session.customer as string,
          subscriptionId: subscription.id,
          status: subscription.status,
          plan: subscription.items.data[0].price.id === PRICES.yearly ? 'yearly' : 'monthly',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find user by customer ID
      for (const [userId, sub] of subscriptions.entries()) {
        if (sub.customerId === customerId) {
          if (event.type === 'customer.subscription.deleted') {
            subscriptions.delete(userId);
          } else {
            subscriptions.set(userId, {
              ...sub,
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            });
          }
          break;
        }
      }
      break;
    }
  }
}

export function getSubscriptionStatus(userId: string): {
  isSubscribed: boolean;
  plan?: 'monthly' | 'yearly';
  status?: string;
  currentPeriodEnd?: Date;
} {
  const subscription = subscriptions.get(userId);

  if (!subscription) {
    return { isSubscribed: false };
  }

  const isActive = ['active', 'trialing'].includes(subscription.status);

  return {
    isSubscribed: isActive,
    plan: subscription.plan,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

export { getStripe as stripe };
