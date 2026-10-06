
# GDP Clothing Facebook Messenger Agent

This integration adds a secure Facebook Page Messenger auto-reply agent at:

`https://gdpclothing.ca/api/messenger`

It is intentionally isolated from checkout, payments, Finance, Custom Studio, and storefront rendering.

## What it does

- Verifies Meta webhook requests with `X-Hub-Signature-256`.
- Replies to Messenger text messages and postbacks.
- Uses live GDP Clothing Supabase data for:
  - product names and current prices,
  - shipping rates and local pickup,
  - active discount codes.
- Uses editable deterministic FAQ knowledge for common questions.
- Hands sensitive topics to a human instead of guessing:
  - refunds,
  - returns,
  - cancellations,
  - payment disputes/problems,
  - order tracking/status,
  - explicit requests for a person.
- Suppresses automation for the handoff window so the bot does not fight with a human reply.
- Deduplicates Messenger events.
- Does not store raw customer message text in the event log.

Normal replies do not require a paid LLM.

## Cloudflare Pages secrets and variables

In Cloudflare Dashboard:

1. Open **Workers & Pages**.
2. Open the GDP Clothing Pages project.
3. Go to **Settings → Variables and Secrets**.
4. Add the following to **Production**.

### Encrypt these as Secrets

- `META_APP_SECRET`
- `META_PAGE_ACCESS_TOKEN`
- `META_VERIFY_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`

### Add these as Variables

- `META_PAGE_ID`
- `META_GRAPH_VERSION=v26.0`
- `SUPABASE_URL=https://mcmancxsqlhxnjhlnfkz.supabase.co`

Never place Meta tokens, the Meta App Secret, or the Supabase service-role key in a `VITE_*` variable.

After saving runtime secrets/variables, redeploy the Pages project so Functions receive them.

## Meta Messenger configuration

Use the Meta app connected to the GDP Clothing Facebook Page.

1. In Meta for Developers, add/configure the Messenger use case/product.
2. Connect the GDP Clothing Facebook Page.
3. Generate a Page Access Token and store it only as the Cloudflare `META_PAGE_ACCESS_TOKEN` secret.
4. Set the callback URL to:
   `https://gdpclothing.ca/api/messenger`
5. Set the webhook verify token to the exact same value stored in Cloudflare as `META_VERIFY_TOKEN`.
6. Subscribe the Page webhook to:
   - `messages`
   - `messaging_postbacks`
7. Ensure the app/Page has the required Messenger permission, including `pages_messaging`.
8. Test first using an account/Page role allowed by the Meta app.
9. For production messaging to the public, complete any App Review / business verification / access level that Meta requires for the app and Page.

The Send API reply is a response to a customer-initiated Messenger interaction and remains subject to Meta's messaging-window and platform policies.

## Supabase objects

Migration:

`20261006000834_messenger_agent_foundation.sql`

Tables:

- `messenger_agent_settings` — server-only agent configuration.
- `messenger_agent_knowledge` — editable FAQ/intent responses.
- `messenger_agent_events` — hashed/deduplicated event diagnostics; no raw message body.
- `messenger_agent_handoffs` — temporary Page-scoped Messenger user IDs used only while automation is paused for human handling.

All four tables have RLS enabled and public client access revoked.

## Default behavior

Examples:

- “How much is the hoodie?” → reads the live product price.
- “Do you deliver?” → reads live delivery/shipping settings.
- “Do you have a discount code?” → reads active discounts.
- “Can I customize a shirt?” → gives Custom Studio/product information.
- “I need a refund.” → pauses automation and hands the thread to a human.
- “Human please.” → pauses automation and hands the thread to a human.

Default human handoff timeout: **12 hours**.

## Safe rollout checklist

Before enabling the Meta webhook for public customers:

- Cloudflare secrets are present in Production.
- Meta webhook verification succeeds.
- `messages` and `messaging_postbacks` are subscribed.
- Test “hello”.
- Test a product price question.
- Test shipping.
- Test current discount code.
- Test “refund” and confirm the bot stops replying after the handoff response.
- Confirm no secret appears in browser source, Vite environment variables, Git history, or logs.

## Regression test

Run:

`node scripts/verify-messenger-agent.mjs`

This checks routing logic and Meta HMAC signature verification without making live Messenger calls.
