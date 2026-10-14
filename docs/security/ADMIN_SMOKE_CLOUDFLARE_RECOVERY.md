# GDP Clothing admin smoke: Cloudflare challenge recovery

## Known production incident (2026-10-14)
Production smoke #38576046708 passed the public storefront and Custom Studio checks but failed the authenticated admin check. Cloudflare served "Performing security verification" when the smoke account navigated to `/admin`. Its Ray ID was `a4a71bd3f8520cf6`. This is **not** evidence that admin login or authorization is broken.

## Safe troubleshooting
1. In the GDP Clothing zone in Cloudflare, open **Security > Events**. Filter by the Ray ID above and review the action, ruleset, and rule ID; also inspect new Ray IDs printed in subsequent CI runs.
2. Check whether the matched event came from a **custom WAF rule, Managed Rules, Bot Fight Mode, Super Bot Fight Mode or another product**. Fix the actual matching rule, not an unrelated setting. In particular, the Free plan's Bot Fight Mode cannot be excluded by WAF Skip rules.
3. Keep the shop's ordinary user/admin protection on. **Never** make a site-wide `/admin` or `/login` skip rule, globally allow GitHub-hosted runners, disable MFA, or bypass RLS in response to this CI failure.
4. If Cloudflare Access protects a narrowly scoped automation entry, configure a **dedicated service token** with an appropriate Service Auth policy and store the pair in GitHub Actions secrets `GDP_SMOKE_CF_ACCESS_CLIENT_ID` / `GDP_SMOKE_CF_ACCESS_CLIENT_SECRET`. The smoke runner only attaches these headers to exact HTTPS `gdpclothing.ca` requests, including its subsequent browser contexts. Cloudflare Access tokens are **not** a substitute for WAF rule decisions; a WAF Managed Challenge may still require a carefully constrained Cloudflare-side solution.
5. Rerun **GDP Clothing Production Smoke Bot** on the intended main commit. It should turn green **only after** the authenticated admin tests really complete. Review `admin-authenticated-smoke.json` and the Cloudflare Ray ID if it remains blocked.

## Verification boundaries
- The workflow deliberately fails closed when the live Cloudflare challenge prevents real admin coverage.
- Storefront/checkout tests continue running independently, but passing those tests cannot turn a failed admin verification green.
- Do not embed smoke credentials in source, URLs, screenshots or log output.
- Verify admin navigation and search without creating payments, orders or refunds.

Reference: Cloudflare WAF Skip rules documentation: https://developers.cloudflare.com/waf/custom-rules/skip/
