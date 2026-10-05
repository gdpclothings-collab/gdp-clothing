import fs from 'node:fs';
const src=fs.readFileSync('src/pages/CheckoutTwoStep.jsx','utf8');
const api=fs.readFileSync('src/lib/customerApi.js','utf8');
const edge=fs.readFileSync('supabase/functions/checkout/index.ts','utf8');
const pay=src.indexOf('Pay · $'); const consent=src.indexOf('I agree to the <Link to="/pages/terms"');
const checks=[
['payment initializes immediately',!src.includes('preparing.current || !form.termsAccepted')],
['session preparation does not claim acceptance',src.includes('termsAccepted:false }; if (tracking.current')],
['consent is below Pay',pay>=0&&consent>pay],
['Pay still requires consent',src.includes('disabled={placing||!actions||!canConfirm||!form.termsAccepted}')],
['consent recorded before Stripe confirm',src.indexOf('await customerApi.acceptCheckoutPolicies')>=0&&src.indexOf('await customerApi.acceptCheckoutPolicies')<src.indexOf('await actions.confirm()')],
['acceptance API exists',api.includes('action: "acceptCheckoutPolicies"')],
['backend prepare gate removed',!edge.includes('Accept the Terms & Conditions and Privacy Policy before checkout.')],
['backend acceptance audit exists',edge.includes('if (action === "acceptCheckoutPolicies")')],
];
for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)process.exitCode=1;}
