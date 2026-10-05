import fs from 'node:fs';
const src=fs.readFileSync('src/pages/CheckoutTwoStep.jsx','utf8');
const api=fs.readFileSync('src/lib/customerApi.js','utf8');
const edge=fs.readFileSync('supabase/functions/checkout/index.ts','utf8');
const pay=src.indexOf('Pay · $'); const consent=src.indexOf('I agree to the <Link to="/pages/terms"');
const accept=src.indexOf('await customerApi.acceptCheckoutPolicies');
const confirm=src.indexOf('paymentClient.stripe.confirmPayment');
const checks=[
['payment initializes immediately',src.includes('mode:"payment"')&&src.includes('elements.create("payment"')],
['session preparation does not claim acceptance',src.includes('termsAccepted:false')&&src.includes('customerApi.createOrder(items, checkoutForm')&&!src.includes('termsAccepted:true')],
['consent is below Pay',pay>=0&&consent>pay],
['Pay still requires consent',src.includes('disabled={placing || !paymentClient || !canConfirm || !form.termsAccepted}')],
['consent recorded before Stripe confirm',accept>=0&&confirm>=0&&accept<confirm],
['acceptance API exists',api.includes('action: "acceptCheckoutPolicies"')],
['backend prepare gate removed',!edge.includes('Accept the Terms & Conditions and Privacy Policy before checkout.')],
['backend acceptance audit exists',edge.includes('if (action === "acceptCheckoutPolicies")')],
];
for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)process.exitCode=1;}
