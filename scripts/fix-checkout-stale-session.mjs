import fs from 'node:fs';

const path = 'src/pages/CheckoutTwoStep.jsx';
let source = fs.readFileSync(path, 'utf8');

const before = 'ensureToken(); navigate("/checkout/payment");';
const after = 'ensureToken(true); navigate("/checkout/payment");';

if (!source.includes(before)) {
  if (source.includes(after)) {
    console.log('Fresh checkout token fix is already applied.');
    process.exit(0);
  }
  throw new Error('Expected checkout payment transition was not found. Refusing broad rewrite.');
}

source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Checkout now rotates to a fresh session token before the first payment-page attempt.');
