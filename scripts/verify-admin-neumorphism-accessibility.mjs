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
