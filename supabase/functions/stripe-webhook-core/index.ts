// Internal GDP Clothing Stripe webhook processor pinned to production commit 7e3dc9bbced1f630c6ced6cda6012169d01d3139.
// The public stripe-webhook gateway re-signs verified events with the existing server-only webhook secret before forwarding here.
import "https://raw.githubusercontent.com/gdpclothings-collab/gdp-clothing/7e3dc9bbced1f630c6ced6cda6012169d01d3139/supabase/functions/stripe-webhook/index.ts";
