import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Package,
  Heart,
  User,
  LogOut,
  Clock,
  Eye,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
  RefreshCw,
  LockKeyhole,
  Mail,
  CalendarDays,
  LayoutDashboard,
} from "lucide-react";
import { customerApi } from "@/lib/customerApi";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";
import { privacyApi } from "@/lib/privacyApi";
import { getCustomerWorkflow, TERMINAL_ORDER_STATUSES } from "@/lib/orderWorkflow";

const STATUS_LABELS = {
  pending_payment: "Pending Payment",
  paid: "Paid",
  artwork_needed: "Artwork Needed",
  design_in_progress: "Design In Progress",
  proof_ready: "Proof Ready",
  awaiting_approval: "Awaiting Your Approval",
  revision_requested: "Revision Requested",
  approved: "Approved",
  production_queue: "In Production Queue",
  printing: "Printing",
  quality_control: "Quality Control",
  packing: "Packing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const ACCOUNT_TABS = [
  { id: "orders", label: "Orders", icon: Package, description: "Purchases & fulfillment" },
  { id: "custom", label: "Custom Orders", icon: Sparkles, description: "Proofs & production" },
  { id: "track", label: "Track Order", icon: Clock, description: "Shipment progress" },
  { id: "wishlist", label: "Wishlist", icon: Heart, description: "Saved products" },
  { id: "designs", label: "Saved Designs", icon: Eye, description: "Creative projects" },
  { id: "profile", label: "Profile", icon: User, description: "Account details" },
];

const formatMoney = (value) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};

const initialsFor = (user) => {
  const source = user?.display_name || user?.full_name || user?.email || "GDP";
  return String(source)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";
};

export default function Account() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") || "orders";
  const tab = ACCOUNT_TABS.some((item) => item.id === requestedTab) ? requestedTab : "orders";
  const activeTab = ACCOUNT_TABS.find((item) => item.id === tab) || ACCOUNT_TABS[0];

  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [trackInput, setTrackInput] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const { wishlist } = useCart();
  const [wishProducts, setWishProducts] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [customLoading, setCustomLoading] = useState(true);
  const [customError, setCustomError] = useState("");
  const [revisionText, setRevisionText] = useState({});

  const loadCustomOrders = async () => {
    setCustomLoading(true);
    setCustomError("");
    try {
      const data = await customerApi.proofAction("list");
      setCustomOrders(data?.orders || []);
    } catch {
      setCustomError("Could not load your custom-order proofs.");
    } finally {
      setCustomLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    Promise.all([customerApi.listOrders(), customerApi.listSavedDesigns()])
      .then(([orderRows, designRows]) => {
        if (!active) return;
        setOrders(orderRows || []);
        setSavedDesigns(designRows || []);
      })
      .catch(() => {});

    loadCustomOrders();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!wishlist.length) {
      setWishProducts([]);
      return;
    }
    customerApi.getProducts(wishlist).then(setWishProducts).catch(() => setWishProducts([]));
  }, [wishlist]);

  const setTab = (nextTab) => {
    const next = new URLSearchParams(params);
    next.set("tab", nextTab);
    setParams(next);
  };

  const approveProof = async (proofId) => {
    setCustomError("");
    try {
      await customerApi.proofAction("approve", { proofId });
      await loadCustomOrders();
    } catch (error) {
      setCustomError(error?.response?.data?.message || "Could not approve proof.");
    }
  };

  const requestRevision = async (proofId) => {
    const comment = (revisionText[proofId] || "").trim();
    if (!comment) return;
    setCustomError("");
    try {
      await customerApi.proofAction("request_revision", { proofId, comment });
      setRevisionText((previous) => ({ ...previous, [proofId]: "" }));
      await loadCustomOrders();
    } catch (error) {
      setCustomError(error?.response?.data?.message || "Could not request revision.");
    }
  };

  const trackOrder = async (orderNumber = trackInput) => {
    const value = String(orderNumber || "").trim();
    if (!value) return;
    setTrackInput(value);
    setTrackResult(null);
    setTrackLoading(true);
    try {
      const order = await customerApi.trackOrder(value);
      setTrackResult(order || { notFound: true });
    } catch {
      setTrackResult({ notFound: true });
    } finally {
      setTrackLoading(false);
    }
  };

  const openTracking = (orderNumber) => {
    setTrackInput(orderNumber || "");
    setTrackResult(null);
    setTab("track");
    window.setTimeout(() => trackOrder(orderNumber), 0);
  };

  const latestOrder = orders[0];
  const pendingCustomCount = customOrders.filter((entry) => {
    const status = entry?.order?.status;
    return status && !TERMINAL_ORDER_STATUSES.includes(status) && status !== "delivered";
  }).length;

  return (
    <div className="min-h-[70vh]">
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary-foreground/70 mb-2">
                Customer Portal
              </div>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl leading-[0.88]">MY ACCOUNT</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-primary-foreground/75">
                <span className="inline-flex items-center gap-2">
                  <Mail size={14} aria-hidden="true" />
                  {user?.email || "Signed in"}
                </span>
                <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-primary-foreground/35" />
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Secure customer account
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center gap-2 border border-primary-foreground/25 px-4 py-3 text-xs font-bold uppercase tracking-wide hover:bg-primary-foreground hover:text-primary transition-colors"
              >
                <ShoppingBag size={15} />
                Continue Shopping
              </Link>
              {user?.role === "admin" && (
                <Link
                  to="/admin"
                  className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground px-4 py-3 text-xs font-bold uppercase tracking-wide hover:opacity-90"
                >
                  <LayoutDashboard size={15} />
                  Admin Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-6 md:mb-8">
          <SummaryCard label="Orders" value={orders.length} detail={latestOrder ? `Latest ${formatDate(latestOrder.created_date)}` : "No orders yet"} />
          <SummaryCard label="Custom Orders" value={customOrders.length} detail={pendingCustomCount ? `${pendingCustomCount} in progress` : "Nothing pending"} />
          <SummaryCard label="Saved Designs" value={savedDesigns.length} detail="Ready to revisit" />
          <SummaryCard label="Wishlist" value={wishlist.length} detail="Saved for later" />
        </div>

        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <aside className="lg:sticky lg:top-24 space-y-4">
            <div className="border border-border bg-card">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 shrink-0 bg-primary text-primary-foreground flex items-center justify-center font-display text-2xl">
                    {initialsFor(user)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {user?.display_name || user?.full_name || "GDP Customer"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Account Role</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider border border-border bg-secondary px-2 py-1">
                    {user?.role || "customer"}
                  </span>
                </div>
              </div>

              <nav className="p-2" aria-label="Account navigation">
                {ACCOUNT_TABS.map((item) => {
                  const Icon = item.icon;
                  const selected = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTab(item.id)}
                      aria-current={selected ? "page" : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-l-2 ${selected ? "border-accent bg-accent/5 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/70"}`}
                    >
                      <Icon size={17} className={selected ? "text-accent" : ""} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold uppercase tracking-wide">{item.label}</span>
                        <span className="hidden lg:block text-[11px] mt-0.5">{item.description}</span>
                      </span>
                      <ChevronRight size={14} className="hidden lg:block opacity-45" />
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-border p-2">
                <button
                  onClick={() => logout(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-wide text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut size={17} />
                  Sign Out
                </button>
              </div>
            </div>

            <div className="hidden lg:block border border-border bg-secondary/60 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Need help?</div>
              <p className="text-sm mt-2 leading-relaxed">Questions about an order, proof, or delivery? Our support page is one click away.</p>
              <Link to="/pages/contact" className="inline-flex items-center gap-1 mt-3 text-xs font-bold uppercase tracking-wide text-accent">
                Contact Support <ArrowRight size={13} />
              </Link>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="border border-border bg-card min-h-[560px]">
              <div className="px-5 sm:px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Account / {activeTab.label}</div>
                  <h2 className="font-display text-3xl sm:text-4xl mt-1 leading-none">{activeTab.label}</h2>
                  <p className="text-sm text-muted-foreground mt-2">{activeTab.description}</p>
                </div>
                {tab === "custom" && (
                  <button
                    onClick={loadCustomOrders}
                    disabled={customLoading}
                    className="inline-flex items-center justify-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-wide hover:border-foreground disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={customLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                )}
              </div>

              <div className="p-5 sm:p-6">
                {tab === "orders" && (
                  <div className="space-y-4">
                    {orders.length === 0 ? (
                      <Empty icon={Package} text="No orders yet." ctaText="Start shopping" ctaTo="/shop" />
                    ) : (
                      orders.map((order) => (
                        <div key={order.id} className="border border-border bg-background hover:border-foreground/35 transition-colors">
                          <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-mono text-sm font-semibold">{order.orderNumber}</div>
                                <StatusBadge status={order.status} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>{formatDate(order.created_date)}</span>
                                <span>{order.items?.length || 0} item(s)</span>
                                <span className="font-mono text-foreground">{formatMoney(order.total)}</span>
                              </div>
                              {order.trackingNumber && (
                                <div className="mt-3 text-xs font-mono text-muted-foreground">
                                  Tracking: <span className="text-foreground">{order.carrier || "Carrier"} {order.trackingNumber}</span>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => openTracking(order.orderNumber)}
                              className="inline-flex shrink-0 items-center justify-center gap-2 border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wide hover:border-accent hover:text-accent transition-colors"
                            >
                              Track Order <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === "custom" && (
                  <div>
                    {customError && (
                      <div className="mb-4 border border-destructive/25 bg-destructive/10 text-destructive px-4 py-3 text-sm">
                        {customError}
                      </div>
                    )}
                    {customLoading ? (
                      <LoadingState text="Loading custom orders…" />
                    ) : customOrders.length === 0 ? (
                      <Empty icon={Sparkles} text="No custom orders yet." ctaText="Open Custom Studio" ctaTo="/custom-studio" />
                    ) : (
                      <div className="space-y-5">
                        {customOrders.map((entry) => (
                          <CustomOrderCard
                            key={entry.order.id}
                            entry={entry}
                            revisionText={revisionText}
                            setRevisionText={setRevisionText}
                            onApprove={approveProof}
                            onRevision={requestRevision}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "track" && (
                  <div className="max-w-4xl">
                    <div className="border border-border bg-secondary/45 p-4 sm:p-5">
                      <label htmlFor="account-track-order" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Order Number
                      </label>
                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        <input
                          id="account-track-order"
                          value={trackInput}
                          onChange={(event) => setTrackInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") trackOrder();
                          }}
                          placeholder="e.g. GDP-12345678"
                          className="min-w-0 flex-1 bg-background border border-border px-3 py-3 outline-none focus:border-accent"
                        />
                        <button
                          onClick={() => trackOrder()}
                          disabled={!trackInput.trim() || trackLoading}
                          className="bg-primary text-primary-foreground px-6 py-3 font-bold uppercase text-sm disabled:opacity-45 inline-flex items-center justify-center gap-2"
                        >
                          {trackLoading && <RefreshCw size={15} className="animate-spin" />}
                          {trackLoading ? "Tracking" : "Track"}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">Use the GDP order number from your confirmation email or order history.</p>
                    </div>

                    {trackResult?.notFound && (
                      <div className="mt-4 border border-border bg-background p-5">
                        <div className="font-bold">Order not found</div>
                        <p className="text-sm text-muted-foreground mt-1">Double-check the order number and make sure you are signed into the account used for the purchase.</p>
                      </div>
                    )}

                    {trackResult && !trackResult.notFound && (
                      <div className="mt-4 border border-border bg-background overflow-hidden">
                        <div className="p-5 border-b border-border flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-sm font-semibold">{trackResult.orderNumber}</div>
                            <div className="text-xs text-muted-foreground mt-1">{formatDate(trackResult.created_date)}</div>
                          </div>
                          <StatusBadge status={trackResult.status} />
                        </div>
                        <div className="p-5 grid sm:grid-cols-3 gap-4">
                          <InfoStat label="Items" value={trackResult.items?.length || 0} />
                          <InfoStat label="Order Total" value={formatMoney(trackResult.total)} />
                          <InfoStat label="Carrier" value={trackResult.carrier || "Not assigned yet"} />
                        </div>
                        <div className="px-5 pb-5">
                          <CustomerWorkflowProgress order={trackResult} />
                        </div>
                        {trackResult.trackingNumber && (
                          <div className="px-5 pb-5 text-xs font-mono">
                            Tracking number: <span className="font-semibold">{trackResult.trackingNumber}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tab === "wishlist" && (
                  <div>
                    {wishProducts.length === 0 ? (
                      <Empty icon={Heart} text="Your wishlist is empty." ctaText="Browse the shop" ctaTo="/shop" />
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {wishProducts.map((product) => (
                          <Link key={product.id} to={`/product/${product.id}`} className="group border border-border bg-background p-3 hover:border-accent transition-colors">
                            <div className="aspect-square bg-secondary overflow-hidden mb-3">
                              <Image
                                src={product.images?.[0]}
                                alt={product.name}
                                fittingType="fill"
                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                              />
                            </div>
                            <div className="font-medium text-sm leading-snug">{product.name}</div>
                            <div className="font-mono text-xs mt-1">{formatMoney(product.price)}</div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "designs" && (
                  <div>
                    {savedDesigns.length === 0 ? (
                      <Empty icon={Eye} text="No saved designs yet." ctaText="Open Custom Studio" ctaTo="/custom-studio" />
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {savedDesigns.map((design) => (
                          <Link key={design.id} to="/custom-studio" className="group border border-border bg-background p-3 hover:border-accent transition-colors">
                            <div className="aspect-square bg-secondary overflow-hidden mb-3">
                              {design.previewUrl ? (
                                <Image
                                  src={design.previewUrl}
                                  alt={design.name || "Saved design"}
                                  fittingType="fill"
                                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <Eye size={28} />
                                </div>
                              )}
                            </div>
                            <div className="font-medium text-sm">{design.name || "Saved design"}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">Open in Custom Studio</div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "profile" && (
                  <ProfilePanel user={user} />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ProfilePanel({ user }) {
  return (
    <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] gap-5">
      <section className="border border-border bg-background">
        <div className="p-5 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">Account Information</h3>
            <p className="text-xs text-muted-foreground mt-1">Your identity and access details for GDP Clothing.</p>
          </div>
          <div className="w-10 h-10 bg-secondary flex items-center justify-center">
            <User size={19} />
          </div>
        </div>

        <div className="divide-y divide-border">
          <ProfileRow label="Display Name" value={user?.display_name || user?.full_name || "—"} icon={User} />
          <ProfileRow label="Email Address" value={user?.email || "—"} icon={Mail} />
          <ProfileRow label="Account Role" value={user?.role || "customer"} icon={ShieldCheck} capitalize />
          <ProfileRow label="Member Since" value={formatDate(user?.created_at)} icon={CalendarDays} />
        </div>
      </section>

      <div className="space-y-5">
        <section className="border border-border bg-secondary/45 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 bg-background border border-border flex items-center justify-center">
              <ShieldCheck size={19} className="text-accent" />
            </div>
            <div>
              <h3 className="font-bold">Account secure</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Your account is authenticated through GDP Clothing's secure sign-in system.</p>
            </div>
          </div>
        </section>

        <section className="border border-border bg-background p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Security</div>
          <h3 className="font-display text-2xl mt-1">PASSWORD & ACCESS</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Need a new password? Use the secure reset flow linked to your account email.</p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-flex items-center gap-2 border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wide hover:border-accent hover:text-accent"
          >
            <LockKeyhole size={14} />
            Reset Password
          </Link>
        </section>

        <PrivacyControls user={user} />

        {user?.role === "admin" && (
          <section className="border border-accent/30 bg-accent/5 p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Access</div>
            <h3 className="font-display text-2xl mt-1">STORE MANAGEMENT</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Manage products, orders, content, and store settings from the admin workspace.</p>
            <Link
              to="/admin"
              className="mt-4 inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
            >
              <LayoutDashboard size={14} />
              Open Admin Dashboard
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

function PrivacyControls({ user }) {
  const [privacy, setPrivacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  const loadPrivacy = async () => {
    setLoading(true);
    try {
      setPrivacy(await privacyApi.getAccountPrivacy());
    } catch (error) {
      setMessage(error?.message || "Could not load privacy controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrivacy();
  }, []);

  const updateMarketing = async (consent) => {
    setWorking("marketing");
    setMessage("");
    try {
      await privacyApi.recordMarketingConsent(user?.email || "", consent, "account");
      setMessage(consent ? "Marketing emails are now enabled." : "Marketing consent has been withdrawn.");
      await loadPrivacy();
    } catch (error) {
      setMessage(error?.message || "Could not update marketing preference.");
    } finally {
      setWorking("");
    }
  };

  const submitRequest = async (type) => {
    const duplicate = privacy?.requests?.some((request) =>
      request.request_type === type && ["open", "in_review"].includes(request.status)
    );
    if (duplicate) {
      setMessage("A request of this type is already open.");
      return;
    }

    setWorking(type);
    setMessage("");
    try {
      await privacyApi.createPrivacyRequest(
        type,
        type === "deletion"
          ? "Please review my account and personal information for deletion or de-identification, subject to required transaction, legal, tax, security and dispute-retention obligations."
          : type === "correction"
            ? "Please contact me to review and correct personal information associated with my GDP Clothing account."
            : "Please provide access to or an export of personal information associated with my GDP Clothing account."
      );
      setMessage("Privacy request submitted. GDP Clothing will review it and may verify your identity.");
      await loadPrivacy();
    } catch (error) {
      setMessage(error?.message || "Could not submit the privacy request.");
    } finally {
      setWorking("");
    }
  };

  const subscribed = privacy?.marketingStatus === "subscribed";
  const openRequests = (privacy?.requests || []).filter((request) =>
    ["open", "in_review"].includes(request.status)
  );

  return (
    <section className="border border-border bg-background p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Privacy & data</div>
      <h3 className="font-display text-2xl mt-1">YOUR PRIVACY CONTROLS</h3>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Manage optional marketing and submit access, correction or deletion-review requests.
      </p>

      <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide">Marketing emails</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {loading ? "Checking preference…" : subscribed ? "Subscribed" : "Not subscribed"}
            </div>
          </div>
          <button
            type="button"
            disabled={loading || working === "marketing"}
            onClick={() => updateMarketing(!subscribed)}
            className="border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wide hover:border-accent disabled:opacity-45"
          >
            {working === "marketing" ? "Saving…" : subscribed ? "Unsubscribe" : "Subscribe"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          disabled={Boolean(working)}
          onClick={() => submitRequest("access")}
          className="border border-border px-3 py-2.5 text-left text-xs font-semibold hover:border-accent disabled:opacity-45"
        >
          Request access / data export
        </button>
        <button
          type="button"
          disabled={Boolean(working)}
          onClick={() => submitRequest("correction")}
          className="border border-border px-3 py-2.5 text-left text-xs font-semibold hover:border-accent disabled:opacity-45"
        >
          Request correction
        </button>
        <button
          type="button"
          disabled={Boolean(working)}
          onClick={() => submitRequest("deletion")}
          className="border border-destructive/35 px-3 py-2.5 text-left text-xs font-semibold text-destructive hover:border-destructive disabled:opacity-45"
        >
          Request deletion review
        </button>
      </div>

      {openRequests.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Open requests</div>
          <div className="mt-2 space-y-1.5">
            {openRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="flex justify-between gap-3 text-xs">
                <span className="capitalize">{String(request.request_type || "").replaceAll("_", " ")}</span>
                <span className="capitalize text-muted-foreground">{String(request.status || "").replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && <div className="mt-3 text-xs leading-5 text-muted-foreground">{message}</div>}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
        <Link to="/pages/privacy" className="font-semibold text-accent hover:underline">Privacy Policy</Link>
        <Link to="/pages/data-retention" className="text-muted-foreground hover:text-foreground">Retention & deletion</Link>
        <Link to="/pages/marketing-consent" className="text-muted-foreground hover:text-foreground">Marketing consent</Link>
      </div>
    </section>
  );
}

function ProfileRow({ label, value, icon: Icon, capitalize = false }) {
  return (
    <div className="p-5 flex items-center gap-4">
      <div className="w-9 h-9 shrink-0 bg-secondary flex items-center justify-center text-muted-foreground">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className={`mt-1 text-sm font-medium break-words ${capitalize ? "capitalize" : ""}`}>{value}</div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <div className="border border-border bg-card p-4 md:p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl md:text-4xl leading-none mt-2">{value}</div>
      <div className="text-[11px] md:text-xs text-muted-foreground mt-2 truncate">{detail}</div>
    </div>
  );
}

function InfoStat({ label, value }) {
  return (
    <div className="border-l-2 border-accent pl-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className="inline-flex font-mono text-[10px] uppercase tracking-wide px-2 py-1 bg-accent/10 text-accent border border-accent/20">
      {STATUS_LABELS[status] || String(status || "Pending").replaceAll("_", " ")}
    </span>
  );
}

function CustomerWorkflowProgress({ order }) {
  const steps = getCustomerWorkflow(order);
  return (
    <div className="border-t border-border pt-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
        Order progress
      </div>
      <ol className="grid grid-cols-2 md:grid-cols-3 gap-2" aria-label="Order progress">
        {steps.map((step, index) => (
          <li
            key={String(step.id)}
            className={
              "border px-3 py-3 text-xs font-semibold " +
              (step.complete
                ? "border-accent/35 bg-accent/5 text-foreground"
                : "border-border text-muted-foreground")
            }
          >
            <span className="font-mono text-[10px] mr-2">{step.complete ? "✓" : index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>
      {order.fulfillmentStatus === "ready_for_pickup" && (
        <p className="mt-3 text-sm text-muted-foreground">Your order is ready for pickup.</p>
      )}
      {["shipped", "out_for_delivery"].includes(order.fulfillmentStatus) && order.trackingNumber && (
        <p className="mt-3 text-sm text-muted-foreground">
          Shipped with {order.carrier}: <span className="font-mono text-foreground">{order.trackingNumber}</span>
        </p>
      )}
    </div>
  );
}

function LoadingState({ text }) {
  return (
    <div className="min-h-[280px] flex flex-col items-center justify-center text-center">
      <RefreshCw size={24} className="animate-spin text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function CustomOrderCard({ entry, revisionText, setRevisionText, onApprove, onRevision }) {
  const order = entry.order;
  const proof = entry.proofs?.[0];
  const design = entry.designs?.[0];
  const versions = proof?.versions || [];
  const currentVersion = versions.find((version) => Number(version.version) === Number(proof?.currentVersion)) || versions[versions.length - 1];
  const actionable = proof && ["ready", "sent", "awaiting_approval", "revised"].includes(proof.status);
  const steps = [
    "artwork_needed",
    "design_in_progress",
    "proof_ready",
    "awaiting_approval",
    "approved",
    "production_queue",
    "printing",
    "quality_control",
    "packing",
    "shipped",
    "delivered",
  ];
  const currentIndex = steps.indexOf(order.status);

  return (
    <div className="border border-border bg-background overflow-hidden">
      <div className="p-5 border-b border-border flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-semibold">{order.orderNumber}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {design?.occasion || "Custom order"}
            {design?.recipientType ? " · For " + design.recipientType : ""}
          </div>
          {order.needByDate && (
            <div className="text-xs text-accent mt-1">
              Need by {order.needByDate}
              {order.priority === "rush" ? " · RUSH" : ""}
            </div>
          )}
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
          {steps.slice(0, 8).map((status, index) => (
            <div
              key={status}
              className={
                "text-[10px] font-mono uppercase border px-2 py-2 " +
                (index <= currentIndex ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground")
              }
            >
              {index <= currentIndex ? "✓ " : ""}
              {STATUS_LABELS[status] || status.replaceAll("_", " ")}
            </div>
          ))}
        </div>

        {design && (
          <div className="grid md:grid-cols-[120px_1fr] gap-4 mb-5">
            <div className="aspect-square bg-secondary overflow-hidden">
              {design.previewUrl && <img src={design.previewUrl} alt="Custom design source" className="w-full h-full object-cover" />}
            </div>
            <div className="text-sm">
              <div className="font-bold">{design.productName}</div>
              <div className="text-muted-foreground mt-1">
                {design.designStyle} · {design.designMood || "Custom mood"} · Intensity {design.designIntensity || 3}/5
              </div>
              <div className="text-muted-foreground mt-1">
                {design.color} · {design.size}
              </div>
              {design.story && (
                <div className="mt-3 bg-secondary p-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Story</span>
                  <div className="mt-1">{design.story}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {proof ? (
          <div className="border border-border p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-bold">Design Proof {proof.currentVersion ? "v" + proof.currentVersion : ""}</div>
                <div className="text-xs text-muted-foreground">
                  Status: {String(proof.status || "pending").replaceAll("_", " ")} · Revisions {proof.revisionCount || 0}/{proof.maxRevisions || 0}
                </div>
              </div>
              {proof.status === "approved" && (
                <span className="text-green-600 inline-flex items-center gap-1 text-sm">
                  <CheckCircle2 size={16} /> Approved
                </span>
              )}
            </div>

            {currentVersion?.url ? (
              <img src={currentVersion.url} alt="GDP design proof" className="w-full max-h-[560px] object-contain bg-secondary" />
            ) : (
              <div className="bg-secondary p-8 text-center text-sm text-muted-foreground">
                Your GDP designer has not uploaded the first proof yet.
              </div>
            )}

            {proof.customerComments?.length > 0 && (
              <div className="mt-3 text-sm">
                <div className="font-mono text-[10px] uppercase text-muted-foreground">Your revision history</div>
                {proof.customerComments.map((comment, index) => (
                  <div key={index} className="mt-1 bg-secondary px-3 py-2">
                    {comment}
                  </div>
                ))}
              </div>
            )}

            {actionable && currentVersion?.url && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => onApprove(proof.id)}
                    className="bg-accent text-accent-foreground px-4 py-3 font-bold uppercase text-sm inline-flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Approve for Printing
                  </button>
                  <div>
                    <textarea
                      value={revisionText[proof.id] || ""}
                      onChange={(event) => setRevisionText((previous) => ({ ...previous, [proof.id]: event.target.value }))}
                      rows={2}
                      placeholder="Tell us exactly what you want changed…"
                      className="w-full border border-border bg-background px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => onRevision(proof.id)}
                      disabled={!(revisionText[proof.id] || "").trim()}
                      className="w-full mt-2 border border-border px-4 py-2 text-sm font-bold uppercase disabled:opacity-40 inline-flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={15} /> Request Changes
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Approve only when spelling, photos, colors and placement are correct. Production begins after approval.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-border bg-secondary p-4 text-sm text-muted-foreground">
            This custom design does not currently require a proof.
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text, ctaText, ctaTo }) {
  return (
    <div className="min-h-[360px] flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 border border-border bg-secondary flex items-center justify-center mb-4">
        <Icon size={24} className="text-muted-foreground" />
      </div>
      <p className="font-medium">{text}</p>
      {ctaText && ctaTo && (
        <Link to={ctaTo} className="mt-3 inline-flex items-center gap-1 text-accent text-sm font-bold">
          {ctaText} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
