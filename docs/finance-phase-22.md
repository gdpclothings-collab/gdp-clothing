# Finance Phase 22 — Chart of Accounts & General Ledger

Phase 22 adds the double-entry accounting foundation only.

## Included
- Standard GDP Clothing chart of accounts.
- Admin + MFA protected manual journal posting.
- Server-side debit = credit validation.
- Immutable posted entries.
- Reversals create a second equal-and-opposite posted journal instead of deleting or editing history.
- Protected trial balance and journal register.

## Deliberately not included
- Automatic posting from storefront orders.
- Automatic Stripe journal posting.
- Automatic AR/AP journal posting.
- Automatic expense journal posting.
- Automatic inventory/COGS journal posting.
- Historical backfill or opening balances.

Those integrations must be introduced separately to prevent duplicate accounting entries and false historical balances.
