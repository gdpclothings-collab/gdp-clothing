import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  const stripeKey = secrets.get('STRIPE_SECRET_KEY');
  const webhookSecret = secrets.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    return Response.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature') || '';
  const body = await req.text();

  let event;
  try {
    const Stripe = (await import('npm:stripe')).default;
    const stripe = new Stripe(stripeKey);
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderNumber = session.metadata?.orderNumber;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const order = await base44.asServiceRole.entities.Order.get(orderId);
        const hasCustom = order?.items?.some(item => item?.isCustom);
        await base44.asServiceRole.entities.Order.update(orderId, {
          status: hasCustom ? 'artwork_needed' : 'paid',
          paymentStatus: 'paid',
          paymentIntentId: session.id
        });
        console.log(`Order ${orderNumber} marked paid${hasCustom ? ' and routed to artwork' : ''}.`);
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      console.warn('Payment failed:', intent.id);
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}