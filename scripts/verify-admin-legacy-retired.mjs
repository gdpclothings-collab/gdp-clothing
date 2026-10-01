import fs from "node:fs";

const app = fs.readFileSync("src/App.jsx", "utf8");

function requireText(needle, label) {
  if (!app.includes(needle)) {
    throw new Error(`Missing retired legacy admin contract: ${label}`);
  }
}

requireText(
  '<Route path="/admin/legacy" element={<Navigate to="/admin" replace />} />',
  "legacy admin URL redirects to the production admin"
);
requireText(
  '<Route path="/admin/*" element={<AdminV3 />} />',
  "production admin remains the canonical admin route"
);

if (app.includes("import('@/pages/Admin')")) {
  throw new Error("Legacy Admin page must not remain reachable through the application bundle.");
}

if (app.includes('<Route path="/admin/legacy" element={<Admin />} />')) {
  throw new Error("Legacy admin mutation surface became reachable again.");
}

console.log("Legacy admin route retirement verified.");
