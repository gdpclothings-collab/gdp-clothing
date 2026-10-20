import assert from 'node:assert/strict';
import { calculateCartQuantityDiscount } from '../src/lib/cartPricing.js';
import { DEFAULT_APPAREL_PRICING } from '../src/lib/apparelPricing.js';

const prices = DEFAULT_APPAREL_PRICING.products.tshirt.front;
const round = (number) => Math.round((number + Number.EPSILON) * 100) / 100;

const customTee = (quantity, extra = {}) => [{
  price: prices[1],
  quantity,
  isCustom: true,
  productType: 'T-Shirt',
  name: 'Adult Short Sleeve Tee',
  placement: 'front',
  ...extra,
}];

const single = calculateCartQuantityDiscount(customTee(1));
assert.equal(single.subtotal, prices[1], '1 custom tee must use the configured single-piece price');
assert.equal(single.afterDiscount, prices[1], '1 custom tee must not receive a volume discount');

const two = calculateCartQuantityDiscount(customTee(2));
assert.equal(two.subtotal, round(prices[1] * 2), '2 custom tees must preserve regular subtotal for discount display');
assert.equal(two.afterDiscount, prices[2], '2 custom tees must use the exact configured bundle price');
assert.equal(two.discount, round(prices[1] * 2 - prices[2]), '2-piece exact bundle savings must be calculated correctly');

const three = calculateCartQuantityDiscount(customTee(3));
assert.equal(three.afterDiscount, round(prices[1] * 3 * 0.95), '3 custom tees must use the configured 5% tier');

const five = calculateCartQuantityDiscount(customTee(5));
assert.equal(five.afterDiscount, prices[5], '5 custom tees must use the exact configured bundle price instead of stacking the 5% tier');

const ten = calculateCartQuantityDiscount(customTee(10));
assert.equal(ten.afterDiscount, prices[10], '10 custom tees must use the exact configured bundle price instead of stacking the 15% tier');

const quote = calculateCartQuantityDiscount(customTee(50));
assert.equal(quote.requiresQuote, true, '50+ custom apparel pieces must require a custom quote');

const ordinary = calculateCartQuantityDiscount([{ price: 100, quantity: 3 }]);
assert.equal(ordinary.discount, 0, 'ordinary non-custom products must not inherit the retired cart-wide discount');
assert.equal(ordinary.afterDiscount, 300);

const exempt = calculateCartQuantityDiscount([{ price: 50, quantity: 3, discountExempt: true }]);
assert.equal(exempt.discount, 0, 'discount-exempt products such as DTF gang sheets must remain independent');
assert.equal(exempt.afterDiscount, 150);

console.log('Admin-managed apparel pricing thresholds verified.');
