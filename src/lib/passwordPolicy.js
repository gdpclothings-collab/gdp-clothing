export const PASSWORD_POLICY_HINT =
  "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.";

const COMMON_PASSWORD_PATTERNS = [
  "password",
  "qwerty",
  "123456",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
];

export function validatePassword(password) {
  const value = String(password || "");

  if (value.length < 12) {
    return "Password must be at least 12 characters.";
  }
  if (!/[a-z]/.test(value)) {
    return "Password must include a lowercase letter.";
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must include an uppercase letter.";
  }
  if (!/\d/.test(value)) {
    return "Password must include a number.";
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must include a symbol.";
  }

  const lowered = value.toLowerCase();
  if (COMMON_PASSWORD_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return "Choose a less common password that does not contain an obvious password phrase.";
  }

  return "";
}
