import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

function qtyDiscount(total, count) {
  if (count >= 3) return Math.round(total * 0.75 * 100) / 100;
  if (count >= 2) return Math.round(total * 0.80 * 100) / 100;
  return total;
}

function newOrderNumber() {
  return 'GDP-' + Date.now().toString().slice(-8);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = body.action || 'createOrder';

    // ---- Validate coupon ----
    if (action === 'validateCoupon') {
      const list = await base44.asServiceRole.entities.Discount.filter({ code: body.code || '' });
      const d = Array.isArray(list) ? list[0] : list?.items?.[0];
      if (!d || !d.active) return Response.json({ active: false });
      return Response.json({ active: true, type: d.type, value: d.value, code: d.code });
    }

    // ---- Create order ----
    const cart = Array.isArray(body.cart) ? body.cart : [];
    if (!cart.length) return Response.json({ error: true, message: 'Cart is empty.' }, { status: 400 });
    if (!body.customer?.email) return Response.json({ error: true, message: 'Email is required.' }, { status: 400 });

    const subtotal = cart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
    const itemCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);
    let discounted = qtyDiscount(subtotal, itemCount);
    let couponAmt = 0;

    if (body.discountCode) {
      const list = await base44.asServiceRole.entities.Discount.filter({ code: body.discountCode });
      const d = Array.isArray(list) ? list[0] : list?.items?.[0];
      if (d?.active) {
        couponAmt = d.type === 'fixed' ? d.value : Math.round(discounted * (d.value / 100) * 100) / 100;
      }
    }
    discounted = Math.max(0, Math.round((discounted - couponAmt) * 100) / 100);
    const freeShipThreshold = 150;
    const shipping = body.customer?.shippingMethod === 'pickup' ? 0 : (discounted >= freeShipThreshold ? 0 : 12.99);
    const tax = Math.round((discounted + shipping) * 0.11 * 100) / 100;
    const total = Math.round((discounted + shipping + tax) * 100) / 100;

    const orderNumber = newOrderNumber();

    // Determine custom-order metadata. Payment must complete before artwork starts.
    const hasCustom = cart.some(i => i.isCustom);
    const customDesignIds = [...new Set(cart.map(i => i.customDesignId).filter(Boolean))];
    const customItems = cart.filter(i => i.isCustom);
    const needByDates = customItems.map(i => i.needByDate).filter(Boolean).sort();
    const needByDate = needByDates[0] || null;
    const priority = customItems.some(i => i.priority === 'rush') ? 'rush' : 'standard';

    // Public checkout — no login required

    const order = await base44.asServiceRole.entities.Order.create({
      orderNumber,
      customerEmail: body.customer.email,
      customerName: `${body.customer.firstName || ''} ${body.customer.lastName || ''}`.trim(),
      customerPhone: body.customer.phone || '',
      items: cart.map(i => ({
        productId: i.productId, name: i.name, image: i.image, variant: i.variant,
        size: i.size, color: i.color, quantity: i.quantity, price: i.price,
        fulfillmentMode: i.fulfillmentMode || 'in_house', isCustom: !!i.isCustom,
        customDesignId: i.customDesignId || null
      })),
      subtotal, discount: (subtotal - discounted) + couponAmt, shipping, tax, total,
      status: 'pending_payment',
      needByDate: needByDate || undefined,
      priority,
      customDesignIds,
      shippingMethod: body.customer.shippingMethod || 'standard',
      shippingAddress: `${body.customer.address || ''}, ${body.customer.city || ''}, ${body.customer.province || ''} ${body.customer.postalCode || ''}, ${body.customer.country || ''}`,
      paymentStatus: 'pending', notes: body.customer.notes || '',
      discountCode: body.discountCode || '',       isGuest: true
    });

    // Bind custom design records and create one proof workspace per unique design.
    for (const designId of customDesignIds) {
      try {
        const design = await base44.asServiceRole.entities.CustomDesign.get(designId);
        await base44.asServiceRole.entities.CustomDesign.update(designId, {
          orderId: order.id,
          status: 'ordered'
        });
        if (design?.proofRequired !== false) {
          const existing = await base44.asServiceRole.entities.DesignProof.filter({ customDesignId: designId });
          const current = Array.isArray(existing) ? existing[0] : existing?.items?.[0];
          if (!current) {
            await base44.asServiceRole.entities.DesignProof.create({
              customDesignId: designId,
              orderId: order.id,
              status: 'pending',
              currentVersion: 0,
              revisionCount: 0,
              maxRevisions: Number(design?.revisionAllowance || 2),
              customerComments: [],
              adminComments: [],
              revisionPins: []
            });
          }
        }
      } catch (e) {
        console.error('Custom design binding failed:', designId, e?.message);
      }
    }

    // Reserve inventory for in-house non-custom items
    for (const item of cart) {
      if (item.fulfillmentMode === 'in_house' && !item.isCustom && item.productId && !item.productId.startsWith('custom_')) {
        try {
          const p = await base44.asServiceRole.entities.Product.get(item.productId);
          if (p?.variants?.length) {
            const variants = p.variants.map(v => {
              if (v.color === item.color && v.size === item.size) {
                return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) };
              }
              return v;
            });
            await base44.asServiceRole.entities.Product.update(item.productId, { variants });
          }
        } catch {}
      }
    }

    // Payment: create a Stripe Checkout Session (hosted) if configured; else mark pending honestly
    const stripeKey = secrets.get('STRIPE_SECRET_KEY');
    let paymentConfigured = false;
    let checkoutUrl = null;
    if (stripeKey) {
      paymentConfigured = true;
      try {
        const Stripe = (await import('npm:stripe')).default;
        const stripe = new Stripe(stripeKey);
        const appId = secrets.get('BASE44_APP_ID');
        const origin = body.origin || 'https://design-gdp-wear.base44.app';
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          currency: 'cad',
          line_items: cart.map(i => ({
            quantity: i.quantity || 1,
            price_data: {
              currency: 'cad',
              unit_amount: Math.round((i.price || 0) * 100),
              product_data: { name: `${i.name} (${i.color || ''} ${i.size || ''})`.trim(), images: i.image ? [i.image] : [] }
            }
          })),
          success_url: `${origin}/order/${orderNumber}?status=paid`,
          cancel_url: `${origin}/checkout?cancelled=1`,
          customer_email: body.customer?.email || undefined,
          metadata: { base44_app_id: appId, orderNumber, orderId: order.id }
        });
        checkoutUrl = session.url;
        await base44.asServiceRole.entities.Order.update(order.id, { paymentIntentId: session.id });
      } catch (e) {
        console.error('Stripe checkout session error:', e);
        return Response.json({ error: true, message: 'Payment setup failed: ' + e.message }, { status: 502 });
      }
    }

    return Response.json({
      orderNumber, orderId: order.id, total,
      paymentStatus: paymentConfigured ? 'pending' : 'pending',
      paymentConfigured, checkoutUrl
    });
  } catch (error) {
    return Response.json({ error: true, message: error.message }, { status: 500 });
  }
}