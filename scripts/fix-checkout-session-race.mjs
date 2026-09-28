import fs from 'node:fs';
const path='src/pages/CheckoutTwoStep.jsx';
let s=fs.readFileSync(path,'utf8');
const old='void customerApi.trackCheckout(items, checkoutForm, { subtotal, discount:quantityDiscount + coupon, shipping, tax, total }, token).catch(() => {}); const data = await customerApi.createOrder(items, checkoutForm, checkoutForm.discountCode, window.location.origin, token);';
const next='await customerApi.trackCheckout(items, checkoutForm, { subtotal, discount:quantityDiscount + coupon, shipping, tax, total }, token); const data = await customerApi.createOrder(items, checkoutForm, checkoutForm.discountCode, window.location.origin, token);';
if(!s.includes(old)) throw new Error('Expected checkout preparation sequence not found');
s=s.replace(old,next);
fs.writeFileSync(path,s);
console.log('Checkout tracking is now awaited before claiming/creating the payment session.');