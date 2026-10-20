import fs from "node:fs";

const adminV2 = fs.readFileSync("src/pages/AdminV2.jsx", "utf8");
const adminV3 = fs.readFileSync("src/pages/AdminV3.jsx", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing admin UX regression contract: ${label}`);
  }
}

function requireCount(source, needle, minimum, label) {
  const count = source.split(needle).length - 1;
  if (count < minimum) {
    throw new Error(`Admin UX regression contract failed: ${label} (found ${count}, expected at least ${minimum})`);
  }
}

requireText(
  adminV2,
  'aria-current={active === "settings" ? "page" : undefined}',
  "Store settings exposes aria-current"
);
requireText(
  adminV2,
  'aria-current={active === "apps" ? "page" : undefined}',
  "Apps & integrations exposes aria-current"
);
requireText(
  adminV2,
  'aria-current={active === "security" ? "page" : undefined}',
  "Security exposes aria-current"
);
for (const [needle, label] of [
  ["function AdminSectionLink(", "reusable native admin route links"],
  ['data-unsaved-bypass="true"', "link clicks delegate to the existing unsaved-change guard"],
  ["event.button !== 0", "non-primary clicks retain browser behavior"],
  ["event.ctrlKey", "Ctrl+Click retains native new-tab navigation"],
  ["event.metaKey", "Command+Click retains native new-tab navigation"],
  ["event.shiftKey", "Shift+Click retains native new-window navigation"],
  ["event.preventDefault();", "ordinary admin navigation remains guarded"],
  ["onSelect(section);", "ordinary admin navigation uses requestAction"],
  ['section={item.id}', "main sidebar entries have actual href destinations"],
  ['section="settings"', "settings has a link destination"],
  ['section="apps"', "apps has a link destination"],
  ['section="security"', "security has a link destination"],
]) requireText(adminV2, needle, label);
requireCount(adminV2, "<AdminSectionLink", 8, "sidebar and home module destination cards are links");
requireText(adminV2, 'onClick={onSignOut}', "sign-out controls stay buttons");
requireText(adminV2, 'role="dialog"', "Global Search uses dialog semantics");
requireText(adminV2, 'aria-modal="true"', "Global Search is marked modal");
requireText(adminV2, 'aria-label="GDP admin search"', "Global Search has an accessible name");
requireText(adminV2, 'aria-label="Close admin search"', "Global Search close button is labeled");

requireText(adminV3, "function MobileQuickActions()", "mobile Quick Actions component exists");
requireText(adminV3, 'role="menu"', "mobile Quick Actions exposes a menu role");
requireText(adminV3, 'aria-label="Admin quick actions"', "mobile Quick Actions menu is labeled");
requireText(adminV3, 'aria-expanded={open}', "mobile Quick Actions trigger exposes expanded state");
requireText(adminV3, 'aria-controls="admin-mobile-quick-actions"', "mobile Quick Actions trigger controls the menu");
requireText(adminV3, 'event.key==="Escape"', "Escape closes mobile Quick Actions");
requireText(adminV3, "<MobileQuickActions/>", "mobile Quick Actions is mounted");

requireCount(
  adminV3,
  "hidden md:inline-flex",
  5,
  "desktop floating admin shortcuts remain hidden below md"
);

console.log("Admin mobile and accessibility regression contracts verified.");
