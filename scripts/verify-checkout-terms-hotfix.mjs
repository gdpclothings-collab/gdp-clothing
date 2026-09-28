import fs from 'node:fs';
const src = fs.readFileSync('src/pages/CheckoutTwoStep.jsx','utf8');
const checks = [
  ['payment waits for acceptance', src.includes('|| !form.termsAccepted) return;')],
  ['accepted terms sent to server', src.includes('termsAccepted:true')],
  ['effect reruns after acceptance', src.includes('[isPayment, form.termsAccepted]')],
  ['checkout tracking awaited before order creation', src.includes('await customerApi.trackCheckout') && src.indexOf('await customerApi.trackCheckout') < src.indexOf('await customerApi.createOrder')],
  ['edit resets acceptance', src.includes('termsAccepted:false')],
];
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if (!ok) process.exitCode = 1; }
