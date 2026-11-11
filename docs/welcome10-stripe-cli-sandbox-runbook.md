# WELCOME10 Stripe sandbox-signed webhook QA — local test only

**Status:** Genuine Stripe-origin delivery is **BLOCKED** until Stripe CLI is authenticated on an operator-controlled computer. Preparing this test did not send a Stripe event.

## Purpose and boundaries

- Verify **genuine Stripe CLI-forwarded test-mode snapshot events**, not locally invented HMACs.
- Confirm signature acceptance, invalid-signature rejection, live-mode rejection, and exact replay deduplication.
- Receive the event types for successful checkout, failed PaymentIntent, and refunded charge. These demonstrate **event transport only**: they do not establish correct WELCOME10 database redemption, refund or reconciliation in the actual Edge Function.
- The receiver binds only to 127.0.0.1:4242, has **no Supabase client, database credentials, order API or live Stripe keys**, and does not fulfill or refund an order. Raw test events are held only in process memory.
- Stripe CLI trigger creates disposable **test-mode fixtures** in the selected Stripe sandbox. The runner never passes a --live flag.
- No paid tools, hosted Supabase project or public webhook/tunnel required. No production Edge Function deploy or guest OTP activation.

## Windows preparation

1. Download the QA branch qa/welcome10-guest-integration-20261111 from GitHub (Code -> Download ZIP), and extract it to a new folder. Do not use the production main branch.
2. Install Node.js 22 or later (nodejs.org) if not already installed.
3. Install the free Stripe CLI from [official Stripe CLI instructions](https://docs.stripe.com/stripe-cli). On Windows, winget install Stripe.StripeCLI is an option.
4. Double-click **DOUBLE-CLICK-WELCOME10-STRIPE-QA.cmd** in the extracted folder. If Stripe CLI is not authenticated, it opens the browser login. Choose the **GDP Clothing** Stripe account. Never paste pairing codes, API keys, tokens or webhook secrets into chats.
5. The runner verifies the account via a read-only API, connects a test-mode Stripe CLI listener to localhost and captures the temporary webhook signing secret only in memory. It triggers three test-mode fixture events (these are not real-money charges).
6. Upload only the sanitized RESULTS/WELCOME10-STRIPE-SANDBOX-QA-REPORT.txt, which contains PASS/BLOCKED outcomes without event payloads, secrets or customer data.

## Alternative command

After Stripe CLI login, run this from the root of the downloaded QA branch:

    node scripts/qa/welcome10-stripe-cli-run.mjs --run

Without --run the script only shows instructions. The GitHub CI tests the actual receiver with synthetic signatures, **not** authentic Stripe-origin forwarding.

## Interpretation

- PASS signed delivery: Stripe CLI forwarded a true test-mode event and the receiver verified its signed header.
- PASS replay: the exact signed event was accepted without counting a second unique event.
- PASS refunded/failed event: Stripe CLI delivered that event type with a valid signature. This is **transport only**.
- BLOCKED end-to-end: coupon reserve/consume, Stripe-paid order mapping, refunds and reconciliation across an isolated database and actual Edge Function still require a separate disposable-backend integration test. No production database may be used.
- A missing CLI, declined login, wrong account, unavailable fixture or missing forwarded event produces BLOCKED, never a fabricated PASS.

## Safety

Keep PR #607 draft and unmerged. Preserve WELCOME10 at 10%, Stripe Live Mode, PST 6%, GST 0%, customer orders, and existing production Edge Functions. Guest OTP stays OFF.

Official references: [Stripe CLI](https://docs.stripe.com/stripe-cli), [webhook testing](https://docs.stripe.com/webhooks/quickstart).
