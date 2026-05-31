import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Map Stripe price IDs → app tiers (env vars mirror create-checkout)
const PRICE_TO_TIER: Record<string, string> = {};
const proPriceId          = Deno.env.get('STRIPE_PRICE_PRO');
const proPriceMonthlyId   = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY');
const masterPriceId       = Deno.env.get('STRIPE_PRICE_MASTER');
const masterPriceMonthlyId = Deno.env.get('STRIPE_PRICE_MASTER_MONTHLY');
if (proPriceId)           PRICE_TO_TIER[proPriceId]           = 'pro';
if (proPriceMonthlyId)    PRICE_TO_TIER[proPriceMonthlyId]    = 'pro';
if (masterPriceId)        PRICE_TO_TIER[masterPriceId]        = 'master';
if (masterPriceMonthlyId) PRICE_TO_TIER[masterPriceMonthlyId] = 'master';

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const body = await req.text();
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const tier   = session.metadata?.tier;
        if (!userId || !tier) break;

        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        // Fetch subscription to get period end + billing interval
        let periodEnd: Date | null = null;
        let billingPeriod: 'monthly' | 'yearly' | null = null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          periodEnd = new Date(sub.current_period_end * 1000);
          const interval = sub.items.data[0]?.price.recurring?.interval;
          billingPeriod = interval === 'year' ? 'yearly' : 'monthly';
        }
        // Fallback: use period from checkout metadata if sub fetch failed
        if (!billingPeriod && session.metadata?.period) {
          billingPeriod = session.metadata.period === 'year' ? 'yearly' : 'monthly';
        }

        await db.from('users').update({
          tier,
          tier_source: 'stripe',
          billing_period: billingPeriod,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subId ?? null,
          subscription_period_end: periodEnd?.toISOString() ?? null,
        }).eq('id', userId);

        console.log(`Upgraded user ${userId} to ${tier}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        // Determine new tier and billing period from price
        const priceId = sub.items.data[0]?.price.id;
        const newTier = priceId ? PRICE_TO_TIER[priceId] : undefined;
        const periodEnd = new Date(sub.current_period_end * 1000);
        const interval = sub.items.data[0]?.price.recurring?.interval;
        const billingPeriod = interval === 'year' ? 'yearly' : 'monthly';

        const update: Record<string, unknown> = {
          subscription_period_end: periodEnd.toISOString(),
          stripe_subscription_id: sub.id,
          billing_period: billingPeriod,
        };
        if (newTier) update.tier = newTier;

        await db.from('users').update(update).eq('id', userId);
        console.log(`Updated subscription for user ${userId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        await db.from('users').update({
          tier: 'free',
          tier_source: null,
          billing_period: null,
          stripe_subscription_id: null,
          subscription_period_end: null,
        }).eq('id', userId);

        console.log(`Downgraded user ${userId} to free`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Log but don't downgrade yet — Stripe retries before cancelling the sub
        console.warn('Payment failed for customer:', invoice.customer);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
