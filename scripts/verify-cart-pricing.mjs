import assert from 'node:assert/strict';
import { calculateCartQuantityDiscount } from '../src/lib/cartPricing.js';

const price = (quantity, extra = {}) => [{ price: 100, quantity, ...extra }];
assert.equal(calculateCartQuantityDiscount(price(1)).factor, 1, '1 eligible unit must have no quantity discount');
assert.equal(calculateCartQuantityDiscount(price(2)).factor, 0.8, '2 eligible units must retain the configured 20% discount');
assert.equal(calculateCartQuantityDiscount(price(3)).factor, 0.75, '3+ eligible units must retain the configured 25% discount');
assert.equal(calculateCartQuantityDiscount(price(7)).factor, 0.75, '7 eligible units must stay on the 25% tier');
const mixed = calculateCartQuantityDiscount([{ price: 100, quantity: 2 }, { price: 50, quantity: 3, discountExempt: true }]);
assert.equal(mixed.eligibleCount, 2);
assert.equal(mixed.discount, 40);
assert.equal(mixed.afterDiscount, 310);
console.log('Cart pricing thresholds verified.');
