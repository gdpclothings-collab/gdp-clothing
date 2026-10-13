import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  registrationNextStep,
  REGISTRATION_REQUEST_TITLE,
  REGISTRATION_REQUEST_DESCRIPTION,
  REGISTRATION_EXISTING_ACCOUNT_HINT,
  VERIFICATION_RESEND_FEEDBACK,
} from "../src/lib/registrationFeedback.mjs";

test("new signup requiring verification gets account-neutral instructions", () => {
  const outcome = registrationNextStep({ data: { user: { id: "new-user", identities: [{}] }, session: null }, error: null });
  assert.equal(outcome, "check-account");
});

test("repeat signup with synthetic user gets the same instructions as a new user", () => {
  const outcome = registrationNextStep({ data: { user: { id: "obfuscated", identities: [] }, session: null }, error: null });
  assert.equal(outcome, "check-account");
});

test("explicit duplicate-account auth error also receives identical instructions", () => {
  const byCode = registrationNextStep({ error: { code: "user_already_exists", message: "Already registered" } });
  const byMessage = registrationNextStep({ error: { message: "User already registered" } });
  assert.equal(byCode, "check-account");
  assert.equal(byMessage, "check-account");
});

test("authenticated registration keeps the existing signed-in redirect behavior", () => {
  assert.equal(registrationNextStep({ data: { session: { access_token: "fixture" } }, error: null }), "signed-in");
});

test("real validation or service errors are not swallowed as a successful signup", () => {
  const error = Object.assign(new Error("Email address is invalid"), { code: "email_address_invalid" });
  assert.throws(() => registrationNextStep({ error }), (e) => e === error);
  const limited = Object.assign(new Error("Too many requests"), { status: 429 });
  assert.throws(() => registrationNextStep({ error: limited }), (e) => e === limited);
});

test("registration and resend guidance never claims confirmed email delivery", () => {
  const messages = [REGISTRATION_REQUEST_TITLE, REGISTRATION_REQUEST_DESCRIPTION,
    REGISTRATION_EXISTING_ACCOUNT_HINT, VERIFICATION_RESEND_FEEDBACK].join(" ");
  assert.match(messages, /already registered|already have|already registered\?/i);
  assert.match(messages, /sign in/i);
  assert.match(messages, /password/i);
  assert.doesNotMatch(messages, /we sent|email sent|verification email sent|account created|admin account/i);
});

test("registration UI provides safe login/reset links, keeps password checks and policies", () => {
  const jsx = readFileSync(new URL("../src/pages/Register.jsx", import.meta.url), "utf8");
  assert.match(jsx, /registrationNextStep\(\{ data, error: signUpError \}\)/);
  assert.match(jsx, /REGISTRATION_REQUEST_DESCRIPTION/);
  assert.match(jsx, /VERIFICATION_RESEND_FEEDBACK/);
  assert.match(jsx, /to="\/forgot-password"/);
  assert.match(jsx, /\/login\?returnTo=/);
  assert.match(jsx, /recordRegistrationAcceptance/);
  assert.match(jsx, /validatePassword\(password\)/);
  assert.match(jsx, /termsAccepted/);
  assert.match(jsx, /type: "signup"/);
  assert.doesNotMatch(jsx, /setConfirmationSent\(true\)|We sent a confirmation link|Verification email sent again/);
});

test("login and password recovery flows remain available", () => {
  const login = readFileSync(new URL("../src/pages/Login.jsx", import.meta.url), "utf8");
  const reset = readFileSync(new URL("../src/pages/ForgotPassword.jsx", import.meta.url), "utf8");
  assert.match(login, /supabase\.auth\.signInWithPassword/);
  assert.match(reset, /supabase\.auth\.resetPasswordForEmail/);
});
