import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  AlertTriangle,
  Package,
  Boxes,
  Image as ImageIcon,
  BadgePercent,
  Star,
  Sparkles,
  Megaphone,
  CheckCircle2,
  Globe2,
  Store,
  ExternalLink,
  Database,
  CreditCard,
  Cloud,
  Github,
  Blocks,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { adminBusinessInsightsApi } from "@/lib/adminBusinessInsightsApi";

function useInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminBusinessInsightsApi.load());
    } catch (err) {
      console.error("Business insights load failed:", err);
      setError(err?.message || "Could not load commerce insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { data, loading, error, load };
}

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

export function GrowthModule({ onOpen }) {
  const { data, loading, error, load } = useInsights();
  const metrics = data?.metrics || {};

  const opportunities = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: "Complete product inventory setup",
        description: `${metrics.productsWithoutVariants || 0} product(s) have no active variants.`,
        value: metrics.productsWithoutVariants || 0,
        icon: Boxes,
        action: "inventory",
        priority: metrics.productsWithoutVariants ? "high" : "good",
      },
      {
        title: "Add product media",
        description: `${metrics.productsWithoutMedia || 0} product(s) have no product images.`,
        value: metrics.productsWithoutMedia || 0,
        icon: ImageIcon,
        action: "products",
        priority: metrics.productsWithoutMedia ? "high" : "good",
      },
      {
        title: "Resolve low stock",
        description: `${metrics.lowStockVariants || 0} active variant(s) are at or below the low-stock threshold.`,
        value: metrics.lowStockVariants || 0,
        icon: AlertTriangle,
        action: "inventory",
        priority: metrics.lowStockVariants ? "medium" : "good",
      },
      {
        title: "Strengthen merchandising",
        description: `${metrics.featuredProducts || 0} featured, ${metrics.bestSellers || 0} best seller and ${metrics.newArrivals || 0} new-arrival flags are active.`,
        value: (metrics.featuredProducts || 0) + (metrics.bestSellers || 0) + (metrics.newArrivals || 0),
        icon: TrendingUp,
        action: "products",
        priority: metrics.featuredProducts ? "good" : "medium",
      },
      {
        title: "Build social proof",
        description: `${metrics.pendingReviews || 0} review(s) are waiting for moderation.`,
        value: metrics.pendingReviews || 0,
        icon: Star,
        action: "content",
        priority: metrics.pendingReviews ? "medium" : "good",
      },
      {
        title: "Promote Custom Studio",
        description: `${metrics.customProducts || 0} product(s) currently support GDP Custom Studio.`,
        value: metrics.customProducts || 0,
        icon: Sparkles,
        action: "custom-studio",
        priority: metrics.customProducts ? "good" : "medium",
      },
    ];
  }, [data, metrics]);

  return (
    <ModuleFrame
      loading={loading}
      error={error}
      onRefresh={load}
      intro="GDP Growth turns store data into an operating to-do list instead of a generic dashboard."
    >
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Active products" value={loading ? "—" : metrics.activeProducts ?? 0} icon={Package} />
        <MetricCard label="Paid orders" value={loading ? "—" : metrics.paidOrders ?? 0} icon={TrendingUp} />
        <MetricCard label="Paid revenue" value={loading ? "—" : money(metrics.paidRevenue)} icon={TrendingUp} />
        <MetricCard label="Active discounts" value={loading ? "—" : metrics.activeDiscounts ?? 0} icon={BadgePercent} />
      </div>

      <section className="mt-6 rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e8e8]">
          <div className="text-sm font-semibold">Growth opportunities</div>
          <div className="text-xs text-[#777] mt-0.5">Prioritized actions from current GDP commerce data</div>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
          {opportunities.map((item) => (
            <button
              key={item.title}
              onClick={() => onOpen?.(item.action)}
              className="rounded-xl border border-[#e1e1e1] p-4 text-left hover:border-[#bdbdbd] hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-9 h-9 rounded-lg grid place-items-center ${
                  item.priority === "high"
                    ? "bg-red-50 text-red-700"
                    : item.priority === "medium"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                }`}>
                  <item.icon size={16} />
                </div>
                <span className="text-xl font-semibold">{item.value}</span>
              </div>
              <div className="font-semibold text-sm mt-4">{item.title}</div>
              <div className="text-xs text-[#777] mt-1 leading-5">{item.description}</div>
              <div className="mt-4 text-xs font-semibold inline-flex items-center gap-1">
                Open <ArrowRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </ModuleFrame>
  );
}

export function MarketingModule({ onOpen }) {
  const { data, loading, error, load } = useInsights();
  const metrics = data?.metrics || {};
  const discounts = data?.discounts || [];

  return (
    <ModuleFrame
      loading={loading}
      error={error}
      onRefresh={load}
      intro="Marketing connects promotions, merchandising and customer trust signals in one GDP workspace."
    >
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Active discounts" value={loading ? "—" : metrics.activeDiscounts ?? 0} icon={BadgePercent} />
        <MetricCard label="Featured products" value={loading ? "—" : metrics.featuredProducts ?? 0} icon={Megaphone} />
        <MetricCard label="Best sellers" value={loading ? "—" : metrics.bestSellers ?? 0} icon={TrendingUp} />
        <MetricCard label="Approved reviews" value={loading ? "—" : metrics.approvedReviews ?? 0} icon={Star} />
      </div>

      <div className="mt-6 grid xl:grid-cols-[1.2fr_.8fr] gap-6">
        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e8e8e8] flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Promotion activity</div>
              <div className="text-xs text-[#777] mt-0.5">Discounts currently configured</div>
            </div>
            <button onClick={() => onOpen?.("discounts")} className="text-xs font-semibold">Manage discounts</button>
          </div>
          <div className="divide-y divide-[#eeeeee]">
            {discounts.slice(0, 8).map((discount) => (
              <div key={discount.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f2f2f2] grid place-items-center"><BadgePercent size={14} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono font-semibold">{discount.code}</div>
                  <div className="text-[11px] text-[#777]">{discount.type.replaceAll("_", " ")}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                  discount.active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"
                }`}>
                  {discount.active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
            {!loading && !discounts.length && <div className="p-6 text-sm text-center text-[#777]">No promotions yet.</div>}
          </div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white p-4">
          <div className="text-sm font-semibold">Merchandising signals</div>
          <div className="mt-4 space-y-3">
            <SignalRow label="Featured" value={metrics.featuredProducts || 0} />
            <SignalRow label="Best seller" value={metrics.bestSellers || 0} />
            <SignalRow label="New arrival" value={metrics.newArrivals || 0} />
            <SignalRow label="Custom Studio" value={metrics.customProducts || 0} />
            <SignalRow label="Reviews pending" value={metrics.pendingReviews || 0} />
          </div>
          <button onClick={() => onOpen?.("products")} className="mt-5 w-full h-9 rounded-lg border border-[#d5d5d5] text-sm font-medium">
            Open product merchandising
          </button>
        </section>
      </div>
    </ModuleFrame>
  );
}

export function ContentModule({ onOpen }) {
  const { data, loading, error, load } = useInsights();
  const media = data?.media || [];
  const reviews = data?.reviews || [];

  return (
    <ModuleFrame
      loading={loading}
      error={error}
      onRefresh={load}
      intro="Content centralizes product media and the customer proof layer used across the GDP storefront."
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <MetricCard label="Product media files" value={loading ? "—" : media.length} icon={ImageIcon} />
        <MetricCard label="Approved reviews" value={loading ? "—" : reviews.filter((review) => review.status === "approved").length} icon={Star} />
        <MetricCard label="Pending reviews" value={loading ? "—" : reviews.filter((review) => review.status === "pending").length} icon={AlertTriangle} />
      </div>

      <section className="mt-6 rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e8e8] flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Media library</div>
            <div className="text-xs text-[#777] mt-0.5">Product images currently referenced by the storefront</div>
          </div>
          <button onClick={() => onOpen?.("products")} className="text-xs font-semibold">Manage products</button>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {media.slice(0, 36).map((item) => (
            <div key={item.id} className="rounded-lg border border-[#e2e2e2] overflow-hidden bg-[#fafafa]">
              <div className="aspect-square bg-[#f1f1f1]">
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="p-2">
                <div className="text-[11px] font-medium truncate">{item.productName}</div>
                <div className="text-[9px] text-[#888] mt-0.5">{item.primary ? "Primary" : "Gallery"}</div>
              </div>
            </div>
          ))}
          {!loading && !media.length && (
            <div className="col-span-full py-12 text-center text-sm text-[#777]">No product media found.</div>
          )}
        </div>
      </section>
    </ModuleFrame>
  );
}

export function MarketsModule({ onOpen }) {
  const { data, loading, error, load } = useInsights();
  const settings = data?.settings;

  return (
    <ModuleFrame
      loading={loading}
      error={error}
      onRefresh={load}
      intro="Markets prepares GDP Clothing for regional pricing, currencies, domains and localization."
    >
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <MarketCard
          name="Canada"
          badge="Primary market"
          currency={settings?.currency || "CAD"}
          timezone={settings?.timezone || "America/Regina"}
          status="Active"
        />
        <MarketCard
          name="United States"
          badge="Expansion"
          currency="USD"
          timezone="Regional"
          status="Not configured"
        />
        <MarketCard
          name="International"
          badge="Future"
          currency="Multi-currency"
          timezone="Regional"
          status="Not configured"
        />
      </div>

      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm font-semibold text-blue-950">Current market foundation</div>
        <div className="text-xs text-blue-800 mt-1 leading-5">
          GDP currently operates with one store currency and timezone. The Markets shell is ready for region-specific pricing, domains, languages and shipping rules when expansion begins.
        </div>
        <button onClick={() => onOpen?.("settings")} className="mt-3 text-xs font-semibold inline-flex items-center gap-1">
          Open commerce defaults <ArrowRight size={12} />
        </button>
      </div>
    </ModuleFrame>
  );
}

export function OnlineStoreModule({ onOpen }) {
  const { data, loading, error, load } = useInsights();
  const settings = data?.settings;

  return (
    <ModuleFrame
      loading={loading}
      error={error}
      onRefresh={load}
      intro="Online Store is the control surface for the GDP customer-facing experience."
    >
      <div className="grid xl:grid-cols-[1fr_.8fr] gap-6">
        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="p-5 border-b border-[#e8e8e8] bg-gradient-to-br from-white to-[#f7f7f7]">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#888] font-semibold">Store identity</div>
            <div className="text-2xl font-semibold mt-2">{settings?.store_name || "GDP Clothing"}</div>
            <div className="text-sm text-[#777] mt-1">{settings?.slogan || "Design Your Dream, Wear Your Vision!"}</div>
          </div>
          <div className="p-4 grid sm:grid-cols-3 gap-3">
            <StoreLink to="/" title="Home" />
            <StoreLink to="/shop" title="Shop" />
            <StoreLink to="/custom-studio" title="Custom Studio" />
          </div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white p-4">
          <div className="text-sm font-semibold">Storefront controls</div>
          <div className="mt-4 space-y-3">
            <ControlRow icon={Store} label="Brand & identity" status="Active" />
            <ControlRow icon={Package} label="Product catalog" status="Active" />
            <ControlRow icon={Sparkles} label="Custom Studio" status="Active" />
            <ControlRow icon={BadgePercent} label="Discount codes" status="Active" />
            <ControlRow icon={Star} label="Reviews" status="Data layer ready" />
          </div>
          <button onClick={() => onOpen?.("settings")} className="mt-5 w-full h-9 rounded-lg border border-[#d5d5d5] text-sm font-medium">
            Edit store settings
          </button>
        </section>
      </div>
    </ModuleFrame>
  );
}

export function AppsModule() {
  const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  const stripeConfigured = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

  const integrations = [
    {
      name: "Supabase",
      description: "Database, authentication, storage and row-level security.",
      icon: Database,
      status: supabaseConfigured ? "Configured" : "Missing environment",
      good: supabaseConfigured,
    },
    {
      name: "Stripe",
      description: "Secure checkout, payment intents and webhook-based payment state.",
      icon: CreditCard,
      status: stripeConfigured ? "Client key configured" : "Server integration available",
      good: true,
    },
    {
      name: "GitHub",
      description: "Source control and automated build verification.",
      icon: Github,
      status: "Active repository",
      good: true,
    },
    {
      name: "Cloud deployment",
      description: "GDP storefront deployment is managed outside the application runtime.",
      icon: Cloud,
      status: "External deployment",
      good: true,
    },
  ];

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <div key={integration.name} className="rounded-xl border border-[#dedede] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f1f1f1] grid place-items-center"><integration.icon size={18} /></div>
              <div className="min-w-0">
                <div className="font-semibold">{integration.name}</div>
                <div className="text-xs text-[#777] mt-1 leading-5">{integration.description}</div>
              </div>
            </div>
            <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              integration.good ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}>
              {integration.status}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-[#cfcfcf] bg-[#fafafa] p-5">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#e4e4e4] grid place-items-center"><Blocks size={18} /></div>
          <div className="font-semibold mt-4">Future integrations</div>
          <div className="text-xs text-[#777] mt-1 leading-5">
            POD fulfillment, transactional email, analytics, social selling and shipping carriers can plug into this layer without coupling them to the storefront.
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleFrame({ loading, error, onRefresh, intro, children }) {
  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-[#777]">{intro}</div>
        <button onClick={onRefresh} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {children}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className="text-[#777]" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function SignalRow({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f7f7f7] px-3 py-2.5 flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function MarketCard({ name, badge, currency, timezone, status }) {
  const active = status === "Active";
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f1f1f1] grid place-items-center"><Globe2 size={18} /></div>
        <span className="rounded-full bg-[#f1f1f1] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide">{badge}</span>
      </div>
      <div className="font-semibold text-lg mt-4">{name}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-[#f7f7f7] p-2"><div className="text-[#888]">Currency</div><div className="font-medium mt-1">{currency}</div></div>
        <div className="rounded-lg bg-[#f7f7f7] p-2"><div className="text-[#888]">Timezone</div><div className="font-medium mt-1 truncate">{timezone}</div></div>
      </div>
      <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"
      }`}>{status}</div>
    </div>
  );
}

function StoreLink({ to, title }) {
  return (
    <Link to={to} target="_blank" className="rounded-lg border border-[#dedede] p-3 hover:bg-[#fafafa]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <ExternalLink size={13} className="text-[#777]" />
      </div>
      <div className="text-[10px] text-[#888] mt-1">{to}</div>
    </Link>
  );
}

function ControlRow({ icon: Icon, label, status }) {
  return (
    <div className="rounded-lg bg-[#f7f7f7] px-3 py-2.5 flex items-center gap-2">
      <Icon size={14} className="text-[#777]" />
      <span className="text-sm flex-1">{label}</span>
      <span className="text-[10px] font-medium text-[#777]">{status}</span>
    </div>
  );
}
