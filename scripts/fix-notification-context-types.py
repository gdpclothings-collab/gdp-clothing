from pathlib import Path

path = Path("src/lib/NotificationContext.jsx")
source = path.read_text()
needle = "function normalizeNotification(options = {}) {"
replacement = "/** @returns {any} */\nfunction normalizeNotification(options = {}) {"
count = source.count(needle)
if count != 1:
    raise RuntimeError(f"normalizeNotification marker: expected 1 match, found {count}")
path.write_text(source.replace(needle, replacement, 1))
print("NotificationContext return typing applied.")
