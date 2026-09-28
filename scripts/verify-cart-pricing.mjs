import assert from 'node:assert/strict';
import { calculateCartQuantityDiscount } from '../src/lib/cartPricing.js';

const customTee = (quantity, extra = {}) => [{
  price: 34.99,
  quantity,
  isCustom: true,
  productType: 'T-Shirt',
  name: 'Adult Short Sleeve Tee',
  placement: 'front',
  ...extra,
}];

const single = calculateCartQuantityDiscount(customTee(1));
assert.equal(single.subtotal, 34.99, '1 custom tee must use the configured single-piece price');
assert.equal(single.afterDiscount, 34.99, '1 custom tee must not receive a volume discount');

const two = calculateCartQuantityDiscount(customTee(2));
assert.equal(two.subtotal, 69.98, '2 custom tees must preserve regular subtotal for discount display');
assert.equal(two.afterDiscount, 64.99, '2 custom tees must use the exact configured bundle price');
assert.equal(two.discount, 4.99, '2-piece exact bundle savings must be calculated correctly');

const three = calculateCartQuantityDiscount(customTee(3));
assert.equal(three.afterDiscount, 99.72, '3 custom tees must use the configured 5% tier');

const five = calculateCartQuantityDiscount(customTee(5));
assert.equal(five.afterDiscount, 149.99, '5 custom tees must use the exact configured bundle price instead of stacking the 5% tier');

const ten = calculateCartQuantityDiscount(customTee(10));
assert.equal(ten.afterDiscount, 279.99, '10 custom tees must use the exact configured bundle price instead of stacking the 15% tier');

const quote = calculateCartQuantityDiscount(customTee(50));
assert.equal(quote.requiresQuote, true, '50+ custom apparel pieces must require a custom quote');

const ordinary = calculateCartQuantityDiscount([{ price: 100, quantity: 3 }]);
assert.equal(ordinary.discount, 0, 'ordinary non-custom products must not inherit the retired cart-wide discount');
assert.equal(ordinary.afterDiscount, 300);

const exempt = calculateCartQuantityDiscount([{ price: 50, quantity: 3, discountExempt: true }]);
assert.equal(exempt.discount, 0, 'discount-exempt products such as DTF gang sheets must remain independent');
assert.equal(exempt.afterDiscount, 150);

console.log('Admin-managed apparel pricing thresholds verified.');
