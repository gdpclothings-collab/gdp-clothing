import assert from 'node:assert/strict';
import { hydrateAuthUser } from '../src/lib/hydrateAuthUser.js';

function client(profile, role, error = null) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
    rpc: async (name) => {
      assert.equal(name, 'current_user_role');
      return { data: role, error };
    },
  };
}
const user = { id: 'caller', email: 'example@example.test', user_metadata: { role: 'admin' } };
// The AAL1 admin profile is hidden by RLS, but the role-only RPC allows MFA routing.
assert.equal((await hydrateAuthUser(client(null, 'admin'), user)).role, 'admin');
// Editable metadata must never promote a customer or a missing/failed lookup.
assert.equal((await hydrateAuthUser(client(null, 'customer'), user)).role, 'customer');
assert.equal((await hydrateAuthUser(client(null, null), user)).role, 'customer');
assert.equal((await hydrateAuthUser(client(null, 'admin', new Error('unavailable')), user)).role, 'customer');
// Normal profile hydration keeps the existing role and display data.
const hydrated = await hydrateAuthUser(client({ role: 'customer', display_name: 'Customer' }, 'admin'), user);
assert.equal(hydrated.role, 'customer');
assert.equal(hydrated.display_name, 'Customer');
assert.equal(await hydrateAuthUser(client(null, 'admin'), null), null);
console.log('PASS: admin MFA bootstrap, customer isolation, metadata spoofing, lookup failures, profile hydration, signed-out user');
