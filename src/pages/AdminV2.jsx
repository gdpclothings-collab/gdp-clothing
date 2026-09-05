import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Boxes,
  Users,
  TrendingUp,
  Megaphone,
  BadgePercent,
  FileText,
  Globe2,
  WalletCards,
  BarChart3,
  Sparkles,
  Factory,
  Store,
  Blocks,
  Settings,
  Search,
  Bell,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Plus,
  AlertTriangle,
  Clock3,
  CheckCircle2,
  CircleDollarSign,
  Command,
  ShieldCheck,
  ArrowRight,
  Palette,
  CreditCard,
  Truck,
  ReceiptText,
  UserRoundCog,
  LifeBuoy,
} from "lucide-react";
import { adminDashboardApi } from "@/lib/adminDashboardApi";
import OrdersModule from "@/components/admin/OrdersModule";
import ProductsModule from "@/components/admin/ProductsModule";
import InventoryModule from "@/components/admin/InventoryModule";
import CustomersModule from "@/components/admin/CustomersModule";
import DiscountsModule from "@/components/admin/DiscountsModule";
import CustomStudioAdminModule from "@/components/admin/CustomStudioAdminModule";
import ProductionModule from "@/components/admin/ProductionModule";
import AnalyticsModule from "@/components/admin/AnalyticsModule";
import { useAuth } from "@/lib/AuthContext";

const NAV_GROUPS = [
  {
    label: "Commerce",
    items: [
      { id: "home", label: "Home", icon: LayoutDashboard },
      { id: "orders", label: "Orders", icon: ShoppingBag },
      { id: "products", label: "Products", icon: Package },
      { id: "inventory", label: "Inventory", icon: Boxes },
      { id: "customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Growth",
    items: [
      { id: "growth", label: "Growth", icon: TrendingUp },
      { id: "marketing", label: "Marketing", icon: Megaphone },
      { id: "discounts", label: "Discounts", icon: BadgePercent },
      { id: "content", label: "Content", icon: FileText },
      { id: "markets", label: "Markets", icon: Globe2 },
    ],
  },
  {
    label: "Business",
    items: [
      { id: "finance", label: "Finance", icon: WalletCards },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "GDP Operations",
    items: [
      { id: "custom-studio", label: "Custom Studio", icon: Sparkles },
      { id: "production", label: "Production", icon: Factory },
    ],
  },
  {
    label: "Channels",
    items: [
      { id: "online-store", label: "Online Store", icon: Store },
      { id: "apps", label: "Apps & integrations", icon: Blocks },
    ],
  },
];

const MODULE_COPY = {
  orders: {
    title: "Orders",
    description: "Manage payments, fulfillment, custom-order states, shipping and customer communication.",
    items: ["Orders", "Draft orders", "Returns & refunds", "Fulfillment", "Abandoned checkout"],
  },
  products: {
    title: "Products",
    description: "Create and manage products, variants, collections, media, merchandising and SEO.",
    items: ["Products", "Variants", "Collections", "Categories", "Gift cards"],
  },
  inventory: {
    title: "Inventory",
    description: "Track stock by variant and prepare for multi-location inventory, adjustments and transfers.",
    items: ["Inventory levels", "Low stock", "Adjustments", "Transfers", "Locations"],
  },
  customers: {
    title: "Customers",
    description: "Build customer profiles, segments and complete purchase histories.",
    items: ["Customer profiles", "Segments", "Tags", "Addresses", "Purchase history"],
  },
  growth: {
    title: "Growth",
    description: "A GDP-specific opportunity center for conversion, retention and merchandising actions.",
    items: ["Opportunities", "Conversion actions", "Retention", "Merchandising", "Recommendations"],
  },
  marketing: {
    title: "Marketing",
    description: "Plan campaigns and measure the channels that drive GDP Clothing sales.",
    items: ["Campaigns", "Attribution", "Social", "Email", "Promotions"],
  },
  discounts: {
    title: "Discounts",
    description: "Control discount codes, automatic offers, eligibility, schedules and combinations.",
    items: ["Discount codes", "Automatic discounts", "Eligibility", "Schedules", "Combinations"],
  },
  content: {
    title: "Content",
    description: "Manage storefront media, pages and reusable commerce content from one place.",
    items: ["Files", "Pages", "Media library", "Reusable content", "SEO content"],
  },
  markets: {
    title: "Markets",
    description: "Prepare GDP Clothing for Canada, US and international pricing, domains and localization.",
    items: ["Regions", "Currencies", "Pricing", "Languages", "Domains"],
  },
  finance: {
    title: "Finance",
    description: "Centralize sales, refunds, taxes, processor fees and payout visibility.",
    items: ["Transactions", "Refunds", "Taxes", "Payouts", "Fees"],
  },
  analytics: {
    title: "Analytics",
    description: "Measure sales, conversion, products, customers and operational performance.",
    items: ["Dashboard", "Sales reports", "Product reports", "Customer reports", "Fulfillment reports"],
  },
  "custom-studio": {
    title: "GDP Custom Studio",
    description: "Operate the photo-to-shirt workflow from upload through proof approval.",
    items: ["Custom orders", "Customer uploads", "Artwork queue", "Proofs", "Revisions & approvals"],
  },
  production: {
    title: "Production",
    description: "Move approved designs through printing, quality control, packing and shipping.",
    items: ["Production queue", "Printing", "Quality control", "Packing", "Shipping handoff"],
  },
  "online-store": {
    title: "Online Store",
    description: "Control the GDP storefront presentation, navigation and customer-facing content.",
    items: ["Theme", "Navigation", "Pages", "Preferences", "Storefront preview"],
  },
  apps: {
    title: "Apps & integrations",
    description: "Manage the external services powering payments, data, fulfillment and communications.",
    items: ["Stripe", "Supabase", "POD providers", "Email", "Analytics"],
  },
  settings: {
    title: "Settings",
    description: "Commerce defaults, payments, checkout, shipping, taxes, users, permissions and policies.",
    items: ["Store details", "Payments", "Checkout", "Shipping", "Taxes", "Users & permissions"],
  },
};

function money(value, currency = "CAD") {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function resolveSection(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "admin") return "home";
  if (!parts[1]) return "home";
  return parts[1] === "legacy" ? "home" : parts[1];
}

export default function AdminV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const section = resolveSection(location.pathname);

  const [home, setHome] = useState(null);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);

  const openSection = (id) => {
    navigate(id === "home" ? "/admin" : `/admin/${id}`);
    setSidebarOpen(false);
  };

  const loadHome = async () => {
    setLoadingHome(true);
    setLoadError("");
    try {
      setHome(await adminDashboardApi.loadHome());
    } catch (error) {
      console.error("GDP admin home load failed:", error);
      setLoadError(error?.message || "Could not load admin overview.");
    } finally {
      setLoadingHome(false);
    }
  };

  useEffect(() => {
    loadHome();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSidebarOpen(false);
        setStoreMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const module = MODULE_COPY[section] || MODULE_COPY.settings;

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#181818]">
      <AdminTopBar
        user={user}
        onMenu={() => setSidebarOpen(true)}
        onSearch={() => setSearchOpen(true)}
        storeMenuOpen={storeMenuOpen}
        setStoreMenuOpen={setStoreMenuOpen}
      />

      <div className="flex min-h-[calc(100vh-56px)]">
        <AdminSidebar
          active={section}
          onSelect={openSection}
          className="hidden lg:flex"
        />

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <AdminSidebar
              active={section}
              onSelect={openSection}
              className="relative flex w-[290px] max-w-[88vw] h-full shadow-2xl"
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        )}

        <main className="min-w-0 flex-1">
          {section === "home" ? (
            <HomeModule
              data={home}
              loading={loadingHome}
              error={loadError}
              onRetry={loadHome}
              onOpen={openSection}
            />
          ) : section === "orders" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="Orders"
                description="Manage order lifecycle, payments, fulfillment, custom work and shipping."
              />
              <OrdersModule />
            </div>
          ) : section === "products" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="Products"
                description="Create and manage products, variants, inventory, merchandising and SEO."
              />
              <ProductsModule />
            </div>
          ) : section === "inventory" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="Inventory"
                description="Track stock by variant, identify low inventory and make controlled adjustments."
              />
              <InventoryModule />
            </div>
          ) : section === "customers" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="Customers"
                description="Understand customer value, order history, repeat business and account status."
              />
              <CustomersModule />
            </div>
          ) : section === "discounts" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="Discounts"
                description="Create promotion codes, eligibility rules, usage limits and campaign schedules."
              />
              <DiscountsModule />
            </div>
          ) : section === "custom-studio" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="GDP Custom Studio"
                description="Operate customer uploads, artwork, proof versions, revisions and approvals."
              />
              <CustomStudioAdminModule />
            </div>
          ) : section === "production" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="Production"
                description="Move approved work through print, quality control, packing and fulfillment."
              />
              <ProductionModule />
            </div>
          ) : section === "analytics" ? (
            <div>
              <PageHeader
                eyebrow="GDP Commerce Admin"
                title="Analytics"
                description="Measure revenue, orders, customers, custom-order share and product performance."
              />
              <AnalyticsModule />
            </div>
          ) : (
            <ModuleLanding
              module={module}
              section={section}
              onOpen={openSection}
            />
          )}
        </main>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function AdminTopBar({ user, onMenu, onSearch, storeMenuOpen, setStoreMenuOpen }) {
  const displayName = user?.display_name || user?.email?.split("@")[0] || "Admin";

  return (
    <header className="sticky top-0 z-40 h-14 bg-[#121212] text-white border-b border-white/10">
      <div className="h-full px-3 md:px-4 flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden rounded-lg p-2 hover:bg-white/10"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>

        <Link to="/admin" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-white text-black grid place-items-center font-black text-xs">
            GDP
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold leading-none">GDP Clothing</div>
            <div className="text-[10px] text-white/45 mt-1">Commerce Admin</div>
          </div>
        </Link>

        <button
          type="button"
          onClick={onSearch}
          className="mx-auto w-full max-w-[590px] h-9 px-3 rounded-lg bg-[#2a2a2a] border border-white/10 hover:bg-[#303030] flex items-center gap-2 text-sm text-white/65"
        >
          <Search size={16} />
          <span className="truncate">Search orders, products and customers</span>
          <span className="ml-auto hidden md:flex items-center gap-1 text-[10px] text-white/45 border border-white/10 rounded px-1.5 py-0.5">
            <Command size={10} /> K
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button className="hidden sm:grid w-9 h-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Help">
            <HelpCircle size={17} />
          </button>
          <button className="grid w-9 h-9 place-items-center rounded-lg hover:bg-white/10 relative" aria-label="Notifications">
            <Bell size={17} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setStoreMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10"
            >
              <div className="w-7 h-7 rounded-full bg-[#dff7e5] text-[#14532d] grid place-items-center text-xs font-bold">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <span className="hidden xl:block text-xs max-w-[130px] truncate">{displayName}</span>
              <ChevronDown size={14} className="text-white/55" />
            </button>

            {storeMenuOpen && (
              <div className="absolute right-0 top-11 w-64 rounded-xl bg-white text-[#181818] border border-[#ddd] shadow-2xl p-2">
                <div className="px-3 py-2 border-b border-[#eee]">
                  <div className="text-xs text-[#777]">Signed in as</div>
                  <div className="text-sm font-medium truncate mt-0.5">{user?.email || displayName}</div>
                </div>
                <Link to="/" className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f2f2f2] text-sm">
                  <ExternalLink size={15} /> View storefront
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function AdminSidebar({ active, onSelect, className = "", onClose }) {
  return (
    <aside className={`${className} flex-col bg-[#efefef] border-r border-[#dadada] w-[250px] shrink-0`}>
      <div className="lg:hidden h-14 px-4 border-b border-[#ddd] flex items-center justify-between">
        <div className="font-semibold">GDP Commerce</div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5" aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#777]">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition ${selected ? "bg-white shadow-sm font-semibold" : "hover:bg-white/60 text-[#404040]"}`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {selected && <ChevronRight size={14} className="ml-auto text-[#777]" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[#dadada] p-2">
        <button
          type="button"
          onClick={() => onSelect("settings")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm ${active === "settings" ? "bg-white shadow-sm font-semibold" : "hover:bg-white/60"}`}
        >
          <Settings size={17} /> Settings
        </button>
        <Link to="/admin/legacy" className="mt-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-white/60 text-[#555]">
          <Clock3 size={17} /> Current admin tools
        </Link>
      </div>
    </aside>
  );
}

function HomeModule({ data, loading, error, onRetry, onOpen }) {
  const currency = data?.settings?.currency || "CAD";
  const metrics = data?.metrics || {};

  return (
    <div>
      <PageHeader
        eyebrow="GDP Commerce Admin"
        title="Home"
        description="Your operational command center for sales, custom orders and production."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="h-9 px-3 rounded-lg border border-[#ccc] bg-white flex items-center gap-2 text-sm font-medium hover:bg-[#fafafa]"
            >
              <ExternalLink size={15} /> Storefront
            </Link>
            <button
              onClick={() => onOpen("products")}
              className="h-9 px-3 rounded-lg bg-[#222] text-white flex items-center gap-2 text-sm font-medium hover:bg-black"
            >
              <Plus size={15} /> Add product
            </button>
          </div>
        }
      />

      <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <div className="font-semibold text-red-800">Admin overview could not load</div>
              <div className="text-sm text-red-700 mt-1">{error}</div>
            </div>
            <button onClick={onRetry} className="px-3 py-2 bg-white border border-red-200 rounded-lg text-sm font-medium">
              Try again
            </button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            icon={CircleDollarSign}
            label="Recent paid revenue"
            value={loading ? "—" : money(metrics.recentPaidRevenue, currency)}
            helper="From the latest 8 orders"
          />
          <MetricCard
            icon={ShoppingBag}
            label="Orders needing attention"
            value={loading ? "—" : metrics.pendingOrders ?? 0}
            helper="Draft, unpaid or failed payment"
            tone={metrics.pendingOrders ? "warning" : "good"}
          />
          <MetricCard
            icon={Package}
            label="Active products"
            value={loading ? "—" : metrics.activeProducts ?? 0}
            helper={loading ? "Loading catalog…" : `${metrics.totalProducts || 0} products total`}
          />
          <MetricCard
            icon={Factory}
            label="In production"
            value={loading ? "—" : metrics.productionOrders ?? 0}
            helper={loading ? "Loading workflow…" : `${metrics.pendingProofs || 0} proofs need attention`}
            tone={metrics.pendingProofs ? "warning" : "neutral"}
          />
        </div>

        <div className="mt-6 grid xl:grid-cols-[1.7fr_1fr] gap-6">
          <Panel
            title="Recent orders"
            action={
              <button onClick={() => onOpen("orders")} className="text-sm font-medium hover:underline">
                View all
              </button>
            }
          >
            <RecentOrders orders={data?.recentOrders || []} loading={loading} currency={currency} />
          </Panel>

          <div className="space-y-6">
            <Panel title="Attention center">
              <AttentionRow
                icon={AlertTriangle}
                label="Orders needing payment attention"
                value={loading ? "—" : metrics.pendingOrders || 0}
                onClick={() => onOpen("orders")}
              />
              <AttentionRow
                icon={Sparkles}
                label="Design proofs in progress"
                value={loading ? "—" : metrics.pendingProofs || 0}
                onClick={() => onOpen("custom-studio")}
              />
              <AttentionRow
                icon={Factory}
                label="Orders in production"
                value={loading ? "—" : metrics.productionOrders || 0}
                onClick={() => onOpen("production")}
              />
              <AttentionRow
                icon={LifeBuoy}
                label="Open support tickets"
                value={loading ? "—" : metrics.openTickets || 0}
                onClick={() => onOpen("customers")}
              />
            </Panel>

            <Panel title="GDP workflow">
              <WorkflowStep icon={ShoppingBag} title="Order" text="Customer checkout and payment" />
              <WorkflowStep icon={Palette} title="Design" text="Artwork and proof approval" />
              <WorkflowStep icon={Factory} title="Production" text="Print, QC and packing" />
              <WorkflowStep icon={Truck} title="Fulfillment" text="Ship or pickup and complete" last />
            </Panel>
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <QuickAction
            icon={Package}
            title="Catalog"
            text="Products, variants and collections"
            onClick={() => onOpen("products")}
          />
          <QuickAction
            icon={Sparkles}
            title="Custom Studio"
            text="Artwork, proofs and approvals"
            onClick={() => onOpen("custom-studio")}
          />
          <QuickAction
            icon={BarChart3}
            title="Analytics"
            text="Sales and commerce performance"
            onClick={() => onOpen("analytics")}
          />
          <QuickAction
            icon={Settings}
            title="Settings"
            text="Commerce configuration and access"
            onClick={() => onOpen("settings")}
          />
        </div>
      </div>
    </div>
  );
}

function ModuleLanding({ module, section, onOpen }) {
  const iconMap = {
    orders: ShoppingBag,
    products: Package,
    inventory: Boxes,
    customers: Users,
    growth: TrendingUp,
    marketing: Megaphone,
    discounts: BadgePercent,
    content: FileText,
    markets: Globe2,
    finance: WalletCards,
    analytics: BarChart3,
    "custom-studio": Sparkles,
    production: Factory,
    "online-store": Store,
    apps: Blocks,
    settings: Settings,
  };
  const Icon = iconMap[section] || Settings;

  const settingsCards = section === "settings"
    ? [
        { icon: Store, title: "Store details", text: "Brand identity, contact details and defaults." },
        { icon: CreditCard, title: "Payments", text: "Stripe, payment capture and payout configuration." },
        { icon: ReceiptText, title: "Checkout & taxes", text: "Checkout rules, taxes, currency and order numbering." },
        { icon: Truck, title: "Shipping", text: "Shipping methods, rates, pickup and fulfillment rules." },
        { icon: UserRoundCog, title: "Users & permissions", text: "Admin and staff access controls." },
        { icon: ShieldCheck, title: "Privacy & policies", text: "Customer privacy, terms and commerce policies." },
      ]
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="GDP Commerce Admin"
        title={module.title}
        description={module.description}
        actions={
          <Link
            to="/admin/legacy"
            className="h-9 px-3 rounded-lg border border-[#ccc] bg-white flex items-center gap-2 text-sm font-medium hover:bg-[#fafafa]"
          >
            Current tools <ExternalLink size={15} />
          </Link>
        }
      />

      <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl border border-[#d8d8d8] bg-white overflow-hidden">
          <div className="p-6 md:p-8 border-b border-[#e5e5e5] bg-gradient-to-br from-white to-[#f8f8f8]">
            <div className="w-11 h-11 rounded-xl bg-[#191919] text-white grid place-items-center mb-5">
              <Icon size={21} />
            </div>
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold">Module shell is ready</h2>
              <p className="text-sm text-[#666] mt-2 leading-6">
                This section is now part of GDP&apos;s modular admin architecture. We are migrating the existing working tools into this route one workflow at a time so the live store stays stable.
              </p>
            </div>
          </div>

          {settingsCards ? (
            <div className="p-5 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {settingsCards.map((card) => (
                <div key={card.title} className="rounded-xl border border-[#e2e2e2] p-4 hover:border-[#bdbdbd] transition">
                  <card.icon size={18} className="mb-3" />
                  <div className="font-semibold text-sm">{card.title}</div>
                  <div className="text-xs text-[#777] mt-1 leading-5">{card.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {module.items.map((item) => (
                <div key={item} className="rounded-xl border border-[#e2e2e2] p-4 min-h-[115px] flex flex-col">
                  <div className="font-semibold text-sm">{item}</div>
                  <div className="text-xs text-[#777] mt-1">
                    Ready for workflow migration into the new GDP admin.
                  </div>
                  <div className="mt-auto pt-4 text-[11px] font-medium text-[#999] uppercase tracking-wide">
                    Planned module
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold text-blue-950">No current operations were removed.</div>
            <div className="text-xs text-blue-800 mt-1">
              The original GDP admin remains available while each section is moved and regression-tested.
            </div>
          </div>
          <Link to="/admin/legacy" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-950">
            Open current admin <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="border-b border-[#dedede] bg-white">
      <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-6 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#777]">{eyebrow}</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{title}</h1>
          <p className="text-sm text-[#707070] mt-1">{description}</p>
        </div>
        {actions}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone = "neutral" }) {
  const toneClass =
    tone === "warning"
      ? "bg-amber-50 border-amber-200"
      : tone === "good"
        ? "bg-emerald-50 border-emerald-200"
        : "bg-white border-[#dedede]";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-[#666]">{label}</div>
        <Icon size={17} className="text-[#666]" />
      </div>
      <div className="text-2xl font-semibold mt-3">{value}</div>
      <div className="text-xs text-[#777] mt-1">{helper}</div>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="min-h-12 px-4 py-3 border-b border-[#e8e8e8] flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

function RecentOrders({ orders, loading, currency }) {
  if (loading) {
    return <div className="p-6 text-sm text-[#777]">Loading recent orders…</div>;
  }

  if (!orders.length) {
    return (
      <div className="p-8 text-center">
        <ShoppingBag size={22} className="mx-auto text-[#aaa]" />
        <div className="text-sm font-medium mt-3">No orders yet</div>
        <div className="text-xs text-[#777] mt-1">New GDP orders will appear here.</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa] text-[#777] text-xs">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Order</th>
            <th className="text-left font-medium px-4 py-2.5">Customer</th>
            <th className="text-left font-medium px-4 py-2.5">Status</th>
            <th className="text-right font-medium px-4 py-2.5">Total</th>
            <th className="text-right font-medium px-4 py-2.5">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-[#eee] hover:bg-[#fafafa]">
              <td className="px-4 py-3 font-medium">{order.order_number}</td>
              <td className="px-4 py-3">
                <div>{order.customer_name || "Guest"}</div>
                <div className="text-[11px] text-[#888]">{order.customer_email}</div>
              </td>
              <td className="px-4 py-3">
                <Status status={order.status} />
              </td>
              <td className="px-4 py-3 text-right font-medium">{money(order.total, currency)}</td>
              <td className="px-4 py-3 text-right text-[#777]">{formatDate(order.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Status({ status }) {
  const normalized = String(status || "unknown").replaceAll("_", " ");
  const good = ["paid", "approved", "completed", "delivered"].includes(status);
  const warning = ["pending_payment", "payment_failed", "revision_requested", "awaiting_approval"].includes(status);
  const className = good
    ? "bg-emerald-100 text-emerald-800"
    : warning
      ? "bg-amber-100 text-amber-800"
      : "bg-[#eeeeee] text-[#555]";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium capitalize ${className}`}>{normalized}</span>;
}

function AttentionRow({ icon: Icon, label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-3 border-b last:border-b-0 border-[#eee] flex items-center gap-3 text-left hover:bg-[#fafafa]"
    >
      <div className="w-8 h-8 rounded-lg bg-[#f1f1f1] grid place-items-center">
        <Icon size={15} />
      </div>
      <span className="text-sm flex-1">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
      <ChevronRight size={15} className="text-[#aaa]" />
    </button>
  );
}

function WorkflowStep({ icon: Icon, title, text, last }) {
  return (
    <div className="px-4 py-3 flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#222] text-white grid place-items-center">
          <Icon size={14} />
        </div>
        {!last && <div className="w-px flex-1 min-h-4 bg-[#ddd] mt-1" />}
      </div>
      <div className="pb-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-[#777] mt-0.5">{text}</div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[#dedede] bg-white p-4 text-left hover:border-[#aaa] hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#f2f2f2] grid place-items-center">
          <Icon size={17} />
        </div>
        <ChevronRight size={16} className="text-[#aaa]" />
      </div>
      <div className="font-semibold text-sm mt-4">{title}</div>
      <div className="text-xs text-[#777] mt-1">{text}</div>
    </button>
  );
}

function GlobalSearch({ onClose }) {
  const inputRef = useRef(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState({ orders: [], products: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!term.trim()) {
      setResults({ orders: [], products: [] });
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await adminDashboardApi.globalSearch(term));
      } catch (error) {
        console.error("Admin global search failed:", error);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [term]);

  const hasResults = results.orders.length || results.products.length;

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 p-3 sm:p-8 flex items-start justify-center" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden mt-[7vh]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-14 px-4 flex items-center gap-3 border-b border-[#e5e5e5]">
          <Search size={18} className="text-[#777]" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search GDP Clothing"
            className="flex-1 outline-none text-sm"
          />
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]">
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {!term.trim() && (
            <div className="p-6 text-center text-sm text-[#777]">
              Search by order number, customer, email, product name, handle or category.
            </div>
          )}

          {term.trim() && loading && (
            <div className="p-6 text-center text-sm text-[#777]">Searching…</div>
          )}

          {term.trim() && !loading && !hasResults && (
            <div className="p-6 text-center text-sm text-[#777]">No matching orders or products.</div>
          )}

          {!loading && results.orders.length > 0 && (
            <SearchGroup title="Orders">
              {results.orders.map((order) => (
                <div key={order.id} className="px-4 py-3 border-t border-[#eee] flex items-center gap-3">
                  <ShoppingBag size={16} className="text-[#777]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{order.order_number}</div>
                    <div className="text-xs text-[#777] truncate">
                      {order.customer_name || "Guest"} · {order.customer_email}
                    </div>
                  </div>
                  <Status status={order.status} />
                </div>
              ))}
            </SearchGroup>
          )}

          {!loading && results.products.length > 0 && (
            <SearchGroup title="Products">
              {results.products.map((product) => (
                <div key={product.id} className="px-4 py-3 border-t border-[#eee] flex items-center gap-3">
                  <Package size={16} className="text-[#777]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{product.name}</div>
                    <div className="text-xs text-[#777] truncate">
                      /{product.slug}{product.category ? ` · ${product.category}` : ""}
                    </div>
                  </div>
                  <Status status={product.status} />
                </div>
              ))}
            </SearchGroup>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-[#eee] bg-[#fafafa] text-[11px] text-[#888] flex items-center justify-between">
          <span>GDP global admin search</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function SearchGroup({ title, children }) {
  return (
    <div>
      <div className="px-4 py-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-[#888] bg-[#fafafa]">
        {title}
      </div>
      {children}
    </div>
  );
}
