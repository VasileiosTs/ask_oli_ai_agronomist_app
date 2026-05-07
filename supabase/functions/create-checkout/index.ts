import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// price lookup: PRICE_IDS[tier][period]
const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    month: Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') ?? '',
    year:  Deno.env.get('STRIPE_PRICE_PRO') ?? '',
  },
  agronomist: {
    month: Deno.env.get('STRIPE_PRICE_MASTER_MONTHLY') ?? '',
    year:  Deno.env.get('STRIPE_PRICE_MASTER') ?? '',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const { tier, period = 'year', success_url, cancel_url } = await req.json() as {
      tier: string;
      period?: 'month' | 'year';
      success_url?: string;
      cancel_url?: string;
    };

    const priceId = PRICE_IDS[tier]?.[period];
    if (!priceId) {
      return new Response(JSON.stringify({ error: `No price configured for ${tier}/${period}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

    // Fetch or create Stripe customer
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: profile } = await serviceClient
      .from('users')
      .select('stripe_customer_id, name, tier')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await serviceClient
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://ask-oli.com';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url ?? `${appUrl}/profile?upgraded=1`,
      cancel_url: cancel_url ?? `${appUrl}/profile`,
      subscription_data: {
        metadata: { supabase_user_id: user.id, tier, period },
      },
      metadata: { supabase_user_id: user.id, tier, period },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: { address: 'auto' },
      locale: 'auto',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-checkout error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
