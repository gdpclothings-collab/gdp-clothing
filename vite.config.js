import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_CHUNKS = [
  ["ProductsModule", "admin-products"],
  ["OrdersModule", "admin-orders"],
  ["DraftOrdersModule", "admin-draft-orders"],
  ["ReturnsModule", "admin-returns"],
  ["AbandonedCheckoutsModule", "admin-abandoned-checkouts"],
  ["InventoryOperationsModule", "admin-inventory-operations"],
  ["InventoryModule", "admin-inventory"],
  ["CustomersModule", "admin-customers"],
  ["CustomerGroupsModule", "admin-customer-groups"],
  ["CollectionsModule", "admin-collections"],
  ["ReviewsModule", "admin-reviews"],
  ["DiscountsModule", "admin-discounts"],
  ["CustomStudioAdminModule", "admin-custom-studio"],
  ["ProductionModule", "admin-production"],
  ["AnalyticsModule", "admin-analytics"],
  ["FinanceModule", "admin-finance"],
  ["SettingsModule", "admin-settings"],
  ["AdvancedSettingsModule", "admin-advanced-settings"],
  ["MarketsManagementModule", "admin-markets"],
  ["ContentManagementModule", "admin-content"],
  ["LandingPageModule", "admin-landing-page"],
  ["BusinessInsightsModules", "admin-business-insights"],
];

function manualChunks(id) {
  const normalizedId = id.replaceAll("\\", "/");

  if (normalizedId.includes("/node_modules/recharts/") || normalizedId.includes("/node_modules/d3-")) {
    return "vendor-charts";
  }

  if (normalizedId.includes("/src/components/admin/")) {
    const match = ADMIN_CHUNKS.find(([moduleName]) => normalizedId.includes(`/${moduleName}.`));
    if (match) return match[1];
    return "admin-shared";
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
