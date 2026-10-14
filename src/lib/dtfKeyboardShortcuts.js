const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"], [role="spinbutton"]';

/** Returns true only when a selected gang sheet design can safely be deleted. */
export function isDtfArtworkDeleteShortcut(event) {
  if (!event || (event.key !== "Delete" && event.key !== "Backspace")) return false;
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  return !event.target?.closest?.(EDITABLE_SELECTOR);
}
