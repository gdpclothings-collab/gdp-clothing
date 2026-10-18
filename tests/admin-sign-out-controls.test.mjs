import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/pages/AdminV2.jsx", "utf8");
const auth = readFileSync("src/lib/AuthContext.jsx", "utf8");
const smoke = readFileSync("scripts/admin-authenticated-smoke.mjs", "utf8");

test("admin sidebar and account menu have usable Sign out actions", () => {
  assert.match(shell, /aria-label="Admin account menu"/);
  assert.match(shell, /aria-expanded=\{storeMenuOpen\}/);
  assert.match(shell, /function AdminSidebar\(\{ active, onSelect, onSignOut, signingOut,/);
  assert.match(shell, /function AdminTopBar\(\{ user, onMenu, onSearch, storeMenuOpen, setStoreMenuOpen, onSignOut, signingOut \}\)/);
  assert.equal((shell.match(/onClick=\{onSignOut\}/g)||[]).length, 2);
  assert.match(shell, /<LogOut size=\{17\} \/>/);
  assert.match(shell, /<LogOut size=\{15\} \/>/);
  assert.match(shell, /aria-label="Open navigation"/);
  assert.match(shell, /aria-label="Close navigation"/);
});

test("signout is a real Supabase session invalidation and guarded against unsaved edits", () => {
  assert.match(shell, /const \{ user, logout \} = useAuth\(\)/);
  assert.match(auth, /await supabase\.auth\.signOut\(\)/);
  assert.match(shell, /requestAction\(\(\) => \{/);
  assert.match(shell, /void logout\(false\)/);
  assert.match(shell, /navigate\("\/login", \{ replace: true \}\)/);
  assert.match(shell, /Sign out with unsaved changes/);
  assert.match(shell, /Save your changes before signing out, discard them, or keep editing/);
  assert.match(shell, /if \(signingOut\) return/);
  assert.match(shell, /"Sign out failed"/);
  assert.doesNotMatch(shell, /localStorage\.clear|sessionStorage\.clear|deleteUser|\.auth\.admin/i);
});

test("production smoke verifies both entrypoints WITHOUT triggering signout", () => {
  assert.match(smoke, /"desktop admin sign out entry"/);
  assert.match(smoke, /"mobile admin sign out entry"/);
  assert.match(smoke, /getByRole\("button", \{ name: "Admin account menu" \}\)/);
  assert.match(smoke, /getByRole\("button", \{ name: "Sign out" \}\)\.isVisible\(\)/);
  assert.match(smoke, /getByRole\("button", \{ name: "Open navigation" \}\)\.click\(\)/);
  assert.doesNotMatch(smoke, /getByRole\("button", \{ name: "Sign out" \}\)\.click\(\)/);
});
