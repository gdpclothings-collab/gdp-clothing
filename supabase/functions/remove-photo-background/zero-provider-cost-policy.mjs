// GDP Clothing's standing zero-additional-charge requirement takes precedence
// over available remove.bg credits or a configured API key. There is no
// environment-variable or request-body override for this release gate.
// Re-enabling third-party processing requires a separately reviewed code change.
export function backgroundRemovalCostGate() {
  return {
    allowed: false,
    message: 'Automatic background removal is paused to prevent third-party processing charges. Your original photo remains available; upload a transparent PNG or edit it manually.',
  };
}
