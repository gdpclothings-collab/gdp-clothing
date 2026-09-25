# AI Business Manager Phase 1.1

Safety boundary:
- Admin-only route behind the existing admin/MFA gates.
- Supabase Edge Function requires JWT and verifies admin role.
- Aggregate business signals only; no customer PII returned.
- Deterministic briefing and priority rules; no external paid AI API required.
- No insert, update, delete, refund, email, pricing, inventory-write, or deployment capability.

Rollback:
1. Revert the Phase 1.1 frontend merge to restore the Phase 1 UI.
2. Edge Function version 1 remains the known Phase 1 behavior and can be redeployed if Phase 1.1 backend rollback is required.
