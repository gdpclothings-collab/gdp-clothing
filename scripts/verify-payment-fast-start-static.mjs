import fs from "node:fs";
const source = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
if (!source.includes("paymentPreparation.current = prepPromise")) throw new Error("Fast-start preparation missing");
if (!source.includes("preparedToken.current === token")) throw new Error("Fast-start token reuse missing");
if (!source.includes("await customerApi.acceptCheckoutPolicies")) throw new Error("Policy acceptance gate missing");
console.log("PASS payment fast-start static guard");
