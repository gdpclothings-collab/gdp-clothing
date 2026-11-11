// Never call a credit-consuming background-removal provider from the browser.
// This is a reviewed, default-off release gate, not a remote flag or setting
// customers can override. The Edge Function independently enforces the lock.
export const EXTERNAL_BACKGROUND_REMOVAL_ENABLED = false;
export const BACKGROUND_REMOVAL_PAUSED_MESSAGE =
  'Automatic background removal is paused to avoid extra processing charges. Upload a transparent PNG or refine your original photo manually.';
