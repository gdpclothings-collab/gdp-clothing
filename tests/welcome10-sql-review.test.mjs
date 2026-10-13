import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../docs/sql-drafts/welcome10-atomic-reservation.review.sql", import.meta.url), "utf8");
test("review draft serializes WELCOME10 reservations using discount row lock", () => {
  assert.match(sql, /from public\.discounts\s+where id = p_discount_id for update/i);
  assert.match(sql, /WELCOME_ALREADY_RESERVED/);
  assert.match(sql, /WELCOME_PREVIOUS_PAID_ORDER/);
  assert.match(sql, /WELCOME_ALREADY_REDEEMED/);
});
test("draft is not granted to browser roles", () => {
  assert.match(sql, /revoke all on function public\.reserve_welcome10_coupon[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.reserve_welcome10_coupon[\s\S]*to service_role/i);
});
test("draft remains explicitly non-production", () => {
  assert.match(sql, /REVIEW DRAFT ONLY/);
  assert.match(sql, /NOT A MIGRATION/);
});
