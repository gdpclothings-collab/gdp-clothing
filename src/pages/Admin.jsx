import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, Package, Boxes, Tags, Users, Megaphone,
  BadgePercent, FileCheck, Settings, Store, Search, Plus, X, Save,
  Pencil, Archive, TrendingUp, Clock, BarChart3, ExternalLink, Star,
  Image as ImageIcon, ChevronRight, CheckCircle2, AlertTriangle, DollarSign, Sparkles, Upload
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";

const STATUS_FLOW = [
  "pending_payment","paid","artwork_needed","design_in_progress","proof_ready",
  "awaiting_approval","approved","production_queue","printing","quality_control",
  "packing","ready_for_pickup","shipped","out_for_delivery","delivered","completed"
];

const NAV_GROUPS = [
  {
    label: "Store",
    items: [
      { id: "home", label: "Home", icon: LayoutDashboard },
      { id: "orders", label: "Orders", icon: ShoppingBag },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ]
  },
  {
    label: "Products",
    items: [
      { id: "products", label: "Products", icon: Package },
      { id: "inventory", label: "Inventory", icon: Boxes },
      { id: "collections", label: "Collections", icon: Tags },
    ]
  },
  {
    label: "Custom Studio",
    items: [
      { id: "custom-orders", label: "Custom Orders", icon: Sparkles },
      { id: "proofs", label: "Design Proofs", icon: FileCheck }
    ]
  },
  {
    label: "Production",
    items: [{ id: "production", label: "Production Queue", icon: Boxes }]
  },
  {
    label: "Customers",
    items: [{ id: "customers", label: "Customers", icon: Users }]
  },
  {
    label: "Marketing",
    items: [
      { id: "marketing", label: "Marketing", icon: Megaphone },
      { id: "discounts", label: "Discounts", icon: BadgePercent },
    ]
  },
  {
    label: "Content",
    items: [{ id: "reviews", label: "Reviews", icon: Star }]
  },
  {
    label: "Sales channels",
    items: [{ id: "online-store", label: "Online Store", icon: Store }]
  }
];

const ALL_NAV = NAV_GROUPS.flatMap(group => group.items);
const normalize = value => Array.isArray(value) ? value : value?.items || [];
const money = value => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const slugify = value => String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const splitComma = value => String(value || "").split(",").map(v => v.trim()).filter(Boolean);
const splitLines = value => String(value || "").split(/\n+/).map(v => v.trim()).filter(Boolean);

export default function Admin() {
  const [tab, setTab] = useState("home");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [customDesigns, setCustomDesigns] = useState([]);
  const [collections, setCollections] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState(null);
  const [search, setSearch] = useState("");
  const [productStatus, setProductStatus] = useState("all");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.loadDashboard();
      setOrders(data.orders || []);
      setProducts(data.products || []);
      setProofs(data.proofs || []);
      setCustomDesigns(data.customDesigns || []);
      setCollections(data.collections || []);
      setDiscounts(data.discounts || []);
      setReviews(data.reviews || []);
      setStoreSettings(data.storeSettings || null);
    } catch (error) {
      console.error("Admin dashboard load failed:", error);
      showNotice(error.message || "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const paidOrders = orders.filter(o => o.paymentStatus === "paid");
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const avgOrderValue = paidOrders.length ? revenue / paidOrders.length : 0;
  const pendingProofs = proofs.filter(p => !["approved","rejected"].includes(p.status)).length;
  const customOrders = orders.filter(o => o.items?.some(item => item?.isCustom));
  const inProduction = orders.filter(o => ["production_queue","printing","quality_control","packing"].includes(o.status)).length;
  const activeProducts = products.filter(p => p.status === "active").length;
  const activeDiscounts = discounts.filter(d => d.active).length;

  const customers = useMemo(() => {
    const map = new Map();
    orders.forEach(order => {
      const email = order.customerEmail || "Unknown";
      if (!map.has(email)) {
        map.set(email, { email, name: order.customerName || "Guest", orders: 0, spent: 0, lastOrder: order.created_date });
      }
      const customer = map.get(email);
      customer.orders += 1;
      customer.spent += Number(order.total || 0);
      if (order.created_date && (!customer.lastOrder || order.created_date > customer.lastOrder)) customer.lastOrder = order.created_date;
    });
    return [...map.values()].sort((a, b) => b.spent - a.spent);
  }, [orders]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(product => {
      const matchesStatus = productStatus === "all" || product.status === productStatus;
      const haystack = [product.name, product.category, product.type, product.vendor, ...(product.tags || [])].join(" ").toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [products, search, productStatus]);

  const inventoryRows = useMemo(() => {
    return products.flatMap(product => {
      const variants = product.variants?.length ? product.variants : [{ name: "Default", sku: "", stock: 0, price: product.price }];
      return variants.map((variant, index) => ({
        key: `${product.id}-${index}`,
        product,
        variant,
        stock: Number(variant.stock || 0)
      }));
    });
  }, [products]);

  const inventoryUnits = inventoryRows.reduce((sum, row) => sum + row.stock, 0);
  const lowStockThreshold = Number(storeSettings?.lowStockThreshold ?? 5);
  const lowStockRows = inventoryRows.filter(row => row.stock <= lowStockThreshold);

  const activeNav = ALL_NAV.find(item => item.id === tab);
  const openPanel = (type, record = null) => setPanel({ type, record });
  const showNotice = message => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const advanceStatus = async (id, current) => {
    const idx = STATUS_FLOW.indexOf(current);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    await adminApi.updateOrder(id, { status: next, fulfillmentStatus: next });
    showNotice(`Order advanced to ${next.replaceAll("_", " ")}.`);
    load();
  };

  const startArtwork = async order => {
    await adminApi.updateOrder(order.id, { status: "design_in_progress", fulfillmentStatus: "design_in_progress" });
    const proof = proofs.find(p => p.orderId === order.id);
    if (proof) await adminApi.updateProof(proof.id, { status: "in_progress" });
    showNotice("Artwork moved to design in progress.");
    load();
  };

  const uploadProof = async (proof, file) => {
    if (!file) return;
    try {
      await adminApi.uploadProof(proof, file);
      showNotice("New proof version uploaded and sent for approval.");
      load();
    } catch (error) {
      console.error("Proof upload failed:", error);
      showNotice(error.message || "Proof upload failed.");
    }
  };

  const updateChecklist = async (order, key, checked) => {
    const next = { ...(order.productionChecklist || {}), [key]: checked };
    await adminApi.updateOrder(order.id, { productionChecklist: next });
    load();
  };

  const releaseToProduction = async order => {
    const keys = ["customerChecked","garmentChecked","sizeColorQtyChecked","spellingChecked","proofVersionChecked","placementChecked","approvalCaptured","printFileAttached"];
    const ready = keys.every(key => order.productionChecklist?.[key]);
    if (!ready) {
      showNotice("Complete every production check before release.");
      return;
    }
    await adminApi.updateOrder(order.id, { status: "production_queue", fulfillmentStatus: "production_queue" });
    showNotice("Order released to production.");
    load();
  };

  const archiveProduct = async product => {
    if (!window.confirm(`Archive "${product.name}"? It will no longer appear as an active product.`)) return;
    await adminApi.archiveProduct(product.id);
    showNotice("Product archived.");
    load();
  };

  const updateReviewStatus = async (review, status) => {
    await adminApi.updateReview(review.id, status);
    showNotice(`Review ${status}.`);
    load();
  };

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-[#202223] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:flex h-screen sticky top-0 bg-[#1a1a1a] text-white flex-col border-r border-white/10">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-2xl leading-none">GDP CLOTHING</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 mt-1">Commerce admin</div>
            </div>
            <Store size={18} className="text-accent" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-4">
              <div className="px-2 mb-1 text-[10px] uppercase tracking-[0.16em] text-white/35">{group.label}</div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-left transition ${tab === item.id ? "bg-white/12 text-white font-semibold" : "text-white/72 hover:bg-white/8 hover:text-white"}`}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  {item.id === "orders" && orders.length > 0 && <span className="ml-auto text-[10px] bg-white/10 rounded-full px-1.5 py-0.5">{orders.length}</span>}
                  {item.id === "custom-orders" && customOrders.length > 0 && <span className="ml-auto text-[10px] bg-white/10 rounded-full px-1.5 py-0.5">{customOrders.length}</span>}
                  {item.id === "proofs" && pendingProofs > 0 && <span className="ml-auto text-[10px] bg-accent text-white rounded-full px-1.5 py-0.5">{pendingProofs}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-white/10">
          <button onClick={() => setTab("settings")} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm ${tab === "settings" ? "bg-white/12" : "text-white/72 hover:bg-white/8"}`}>
            <Settings size={17} /> Settings
          </button>
          <Link to="/" className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-white/72 hover:bg-white/8">
            <ExternalLink size={17} /> View storefront
          </Link>
        </div>
      </aside>

      <div className="lg:hidden sticky top-0 z-30 bg-[#1a1a1a] text-white border-b border-white/10">
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
          <span className="font-display text-xl mr-2 whitespace-nowrap">GDP</span>
          {[...ALL_NAV, { id: "settings", label: "Settings", icon: Settings }].map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs whitespace-nowrap ${tab === item.id ? "bg-white/15" : "text-white/70"}`}
            >
              <item.icon size={14} /> {item.label}
            </button>
          ))}
        </div>
      </div>

      <main className="min-w-0">
        <header className="bg-white border-b border-[#e1e3e5] px-4 md:px-8 py-4 sticky top-[45px] lg:top-0 z-20">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">{tab === "settings" ? "Settings" : activeNav?.label || "Admin"}</h1>
              <p className="text-xs text-[#6d7175] mt-0.5">{sectionDescription(tab)}</p>
            </div>
            <div className="flex items-center gap-2">
              {tab === "products" && <PrimaryButton onClick={() => openPanel("product")}><Plus size={15} /> Add product</PrimaryButton>}
              {tab === "collections" && <PrimaryButton onClick={() => openPanel("collection")}><Plus size={15} /> Create collection</PrimaryButton>}
              {tab === "discounts" && <PrimaryButton onClick={() => openPanel("discount")}><Plus size={15} /> Create discount</PrimaryButton>}
              {tab === "settings" && <PrimaryButton onClick={() => openPanel("settings", storeSettings)}><Pencil size={15} /> Edit settings</PrimaryButton>}
            </div>
          </div>
        </header>

        <div className="max-w-[1400px] mx-auto p-4 md:p-8">
          {notice && (
            <div className="fixed right-4 top-20 z-50 bg-[#202223] text-white px-4 py-3 rounded-lg shadow-xl text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-400" /> {notice}
            </div>
          )}

          {loading && <div className="text-sm text-[#6d7175] py-8">Loading commerce data…</div>}

          {!loading && tab === "home" && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard icon={DollarSign} label="Revenue" value={money(revenue)} helper="Paid orders" />
                <MetricCard icon={ShoppingBag} label="Orders" value={orders.length} helper={`${paidOrders.length} paid`} />
                <MetricCard icon={Package} label="Active products" value={activeProducts} helper={`${products.length} total`} />
                <MetricCard icon={Clock} label="In production" value={inProduction} helper={`${pendingProofs} proofs need attention`} />
              </div>
              <div className="grid xl:grid-cols-[1.6fr_1fr] gap-6">
                <Card title="Recent orders" action={<button onClick={() => setTab("orders")} className="text-sm text-accent">View all</button>}>
                  <OrderTable orders={orders.slice(0, 8)} onAdvance={advanceStatus} compact />
                </Card>
                <Card title="Store health">
                  <HealthRow label="Active products" value={activeProducts} status={activeProducts > 0 ? "good" : "warn"} />
                  <HealthRow label="Low stock variants" value={lowStockRows.length} status={lowStockRows.length ? "warn" : "good"} />
                  <HealthRow label="Pending design proofs" value={pendingProofs} status={pendingProofs ? "warn" : "good"} />
                  <HealthRow label="Active discounts" value={activeDiscounts} status="neutral" />
                  <button onClick={() => setTab("online-store")} className="mt-4 w-full border rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-[#f6f6f7]">
                    Open online store controls
                  </button>
                </Card>
              </div>
            </div>
          )}

          {!loading && tab === "orders" && (
            <Card>
              <OrderTable orders={orders} onAdvance={advanceStatus} />
            </Card>
          )}

          {!loading && tab === "analytics" && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard icon={TrendingUp} label="Gross revenue" value={money(revenue)} helper="Paid orders only" />
                <MetricCard icon={ShoppingBag} label="Average order value" value={money(avgOrderValue)} helper={`${paidOrders.length} paid orders`} />
                <MetricCard icon={Users} label="Customers" value={customers.length} helper="Unique customer emails" />
                <MetricCard icon={Boxes} label="Inventory units" value={inventoryUnits} helper={`${inventoryRows.length} variants`} />
              </div>
              <Card title="Operations snapshot">
                <div className="grid md:grid-cols-3 gap-4">
                  <Snapshot label="Awaiting payment" value={orders.filter(o => ["draft","pending_payment"].includes(o.status)).length} />
                  <Snapshot label="Custom artwork" value={orders.filter(o => ["artwork_needed","design_in_progress","proof_ready","awaiting_approval"].includes(o.status)).length} />
                  <Snapshot label="Fulfillment" value={orders.filter(o => ["production_queue","printing","quality_control","packing","ready_for_pickup","shipped","out_for_delivery"].includes(o.status)).length} />
                </div>
              </Card>
            </div>
          )}

          {!loading && tab === "products" && (
            <div className="space-y-4">
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c9196]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products" className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-white" />
                </div>
                <select value={productStatus} onChange={e => setProductStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
                <span className="text-xs text-[#6d7175] md:ml-auto">{filteredProducts.length} products</span>
              </div>
              <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                <ProductTable products={filteredProducts} onEdit={product => openPanel("product", product)} onArchive={archiveProduct} />
              </div>
            </div>
          )}

          {!loading && tab === "inventory" && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <MetricCard icon={Boxes} label="Inventory units" value={inventoryUnits} helper="Across all variants" />
                <MetricCard icon={AlertTriangle} label="Low stock" value={lowStockRows.length} helper={`Threshold ≤ ${lowStockThreshold}`} />
                <MetricCard icon={Package} label="Tracked products" value={products.filter(p => p.trackInventory !== false).length} helper={`${products.length} products total`} />
              </div>
              <Card title="Inventory">
                <InventoryTable rows={inventoryRows} onEdit={product => openPanel("product", product)} threshold={lowStockThreshold} />
              </Card>
            </div>
          )}

          {!loading && tab === "collections" && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {collections.length === 0 && <EmptyState title="No collections yet" text="Create collections to organize products for storefront browsing." action={() => openPanel("collection")} />}
              {collections.map(collection => (
                <button key={collection.id} onClick={() => openPanel("collection", collection)} className="bg-white border border-[#e1e3e5] rounded-xl p-4 text-left hover:border-[#b7b9bb] transition">
                  <div className="aspect-[16/7] rounded-lg bg-[#f1f2f3] overflow-hidden mb-4 flex items-center justify-center">
                    {collection.image ? <img src={collection.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-[#8c9196]" />}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{collection.name}</div>
                      <div className="text-xs text-[#6d7175] mt-1">/{collection.slug}</div>
                    </div>
                    <StatusPill status={collection.status} />
                  </div>
                  <p className="text-sm text-[#6d7175] mt-3 line-clamp-2">{collection.description || "No description yet."}</p>
                </button>
              ))}
            </div>
          )}

          {!loading && tab === "customers" && (
            <Card>
              {customers.length === 0 ? <EmptyState title="No customers yet" text="Customers will appear here after orders are placed." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f6f6f7] text-[#6d7175]"><tr><Th>Customer</Th><Th>Orders</Th><Th>Total spent</Th><Th>Last order</Th></tr></thead>
                    <tbody>
                      {customers.map(customer => (
                        <tr key={customer.email} className="border-t border-[#e1e3e5]">
                          <Td><div className="font-medium">{customer.name}</div><div className="text-xs text-[#6d7175]">{customer.email}</div></Td>
                          <Td>{customer.orders}</Td>
                          <Td>{money(customer.spent)}</Td>
                          <Td>{formatDate(customer.lastOrder)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {!loading && tab === "marketing" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <MarketingCard icon={BadgePercent} title="Discounts" text="Create percentage, fixed-amount, and free-shipping promotions." value={`${activeDiscounts} active`} onClick={() => setTab("discounts")} />
              <MarketingCard icon={Package} title="Product merchandising" text="Use featured, best seller, and new arrival flags to control storefront placement." value={`${products.filter(p => p.featured || p.bestSeller || p.newArrival).length} promoted`} onClick={() => setTab("products")} />
              <MarketingCard icon={Star} title="Reviews" text="Moderate customer reviews before they become part of your storefront trust layer." value={`${reviews.filter(r => r.status === "pending").length} pending`} onClick={() => setTab("reviews")} />
            </div>
          )}

          {!loading && tab === "discounts" && (
            <Card>
              {discounts.length === 0 ? <EmptyState title="No discounts yet" text="Create a code for promotions, launches, or customer offers." action={() => openPanel("discount")} /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f6f6f7] text-[#6d7175]"><tr><Th>Code</Th><Th>Type</Th><Th>Value</Th><Th>Usage</Th><Th>Status</Th><Th></Th></tr></thead>
                    <tbody>
                      {discounts.map(discount => (
                        <tr key={discount.id} className="border-t border-[#e1e3e5]">
                          <Td><span className="font-mono font-semibold">{discount.code}</span></Td>
                          <Td>{discount.type?.replaceAll("_", " ")}</Td>
                          <Td>{discount.type === "percentage" ? `${discount.value}%` : discount.type === "fixed" ? money(discount.value) : "Free shipping"}</Td>
                          <Td>{discount.usageCount || 0}{discount.usageLimit ? ` / ${discount.usageLimit}` : ""}</Td>
                          <Td><StatusPill status={discount.active ? "active" : "inactive"} /></Td>
                          <Td><button onClick={() => openPanel("discount", discount)} className="text-accent font-medium">Edit</button></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {!loading && tab === "custom-orders" && (
            <div className="space-y-4">
              {customOrders.length === 0 ? <EmptyState title="No custom orders yet" text="Paid Custom Studio orders will appear here for artwork and proof handling." /> : customOrders.map(order => {
                const designId = order.customDesignIds?.[0] || order.items?.find(item => item?.isCustom)?.customDesignId;
                const design = customDesigns.find(item => item.id === designId);
                const proof = proofs.find(item => item.orderId === order.id);
                return (
                  <div key={order.id} className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-[#e1e3e5] flex flex-wrap justify-between gap-3">
                      <div>
                        <div className="font-semibold">{order.orderNumber} · {order.customerName || "Customer"}</div>
                        <div className="text-xs text-[#6d7175] mt-1">{order.customerEmail}</div>
                        {order.needByDate && <div className="text-xs text-accent mt-1">Need by {order.needByDate}{order.priority === "rush" ? " · RUSH" : ""}</div>}
                      </div>
                      <div className="flex items-center gap-2"><StatusPill status={order.status} />{order.status === "artwork_needed" && <button onClick={() => startArtwork(order)} className="bg-[#202223] text-white rounded-lg px-3 py-2 text-xs font-medium">Start artwork</button>}</div>
                    </div>
                    <div className="p-4 grid lg:grid-cols-[180px_1fr_220px] gap-4">
                      <div>
                        <div className="grid grid-cols-3 gap-1">
                          {(design?.photoAssets?.length ? design.photoAssets : (design?.photos || []).map(url => ({ url }))).slice(0,6).map((photo,index) => <img key={index} src={photo.url || photo} alt="" className="aspect-square w-full object-cover bg-[#f1f2f3]" />)}
                        </div>
                        <div className="text-[10px] font-mono text-[#6d7175] mt-2">{design?.photoAssets?.length || design?.photos?.length || 0} source photo(s)</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-accent font-semibold">{design?.occasion || "Custom order"} · {design?.designStyle || "Custom style"}</div>
                        <div className="font-semibold mt-1">{design?.productName || order.items?.[0]?.name}</div>
                        <div className="text-sm text-[#6d7175] mt-1">{design?.color} · {design?.size} · Intensity {design?.designIntensity || 3}/5</div>
                        {design?.personalization?.name && <div className="mt-3 text-sm"><span className="text-[#6d7175]">Printed headline:</span> {design.personalization.name}</div>}
                        {design?.story && <div className="mt-2 bg-[#f6f6f7] rounded-lg p-3 text-sm"><span className="text-[10px] uppercase font-mono text-[#6d7175]">Customer story</span><div className="mt-1">{design.story}</div></div>}
                        {design?.personalization?.instructions && <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm"><span className="text-[10px] uppercase font-mono text-amber-700">Designer notes — not printed</span><div className="mt-1">{design.personalization.instructions}</div></div>}
                      </div>
                      <div className="border border-[#e1e3e5] rounded-lg p-3 h-fit">
                        <div className="text-xs text-[#6d7175]">Proof workspace</div>
                        <div className="font-semibold mt-1">{proof ? ("v" + (proof.currentVersion || 0) + " · " + String(proof.status).replaceAll("_"," ")) : "No proof record"}</div>
                        <div className="text-xs text-[#6d7175] mt-1">{proof ? ("Revisions " + (proof.revisionCount || 0) + "/" + (proof.maxRevisions || 0)) : ""}</div>
                        {proof && <button onClick={() => setTab("proofs")} className="mt-3 w-full border rounded-lg px-3 py-2 text-xs font-medium">Open proofs</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && tab === "proofs" && (
            <div className="space-y-4">
              {proofs.length === 0 ? <EmptyState title="No design proofs yet" text="Proof workspaces are created automatically when a custom order is placed." /> : proofs.map(proof => {
                const order = orders.find(item => item.id === proof.orderId);
                const versions = proof.versions || [];
                const current = versions.find(version => Number(version.version) === Number(proof.currentVersion)) || versions[versions.length - 1];
                return (
                  <div key={proof.id} className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-[#e1e3e5] flex flex-wrap justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-accent font-semibold">Proof v{proof.currentVersion || 0} · {proof.status?.replaceAll("_", " ")}</div>
                        <div className="font-medium mt-1">{order?.orderNumber || proof.orderId || "Unlinked order"} · {order?.customerName || ""}</div>
                        <div className="text-xs text-[#6d7175] mt-1">Revisions {proof.revisionCount || 0}/{proof.maxRevisions || 0}</div>
                      </div>
                      <label className="cursor-pointer inline-flex items-center gap-2 bg-[#202223] text-white rounded-lg px-3 py-2 text-xs font-medium h-fit">
                        <Upload size={14} /> {proof.currentVersion ? "Upload next version" : "Upload first proof"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => uploadProof(proof, e.target.files?.[0])} />
                      </label>
                    </div>
                    <div className="p-4 grid lg:grid-cols-[1fr_320px] gap-4">
                      <div>{current?.url ? <img src={current.url} alt="Current design proof" className="w-full max-h-[620px] object-contain bg-[#f1f2f3]" /> : <div className="min-h-52 bg-[#f1f2f3] flex items-center justify-center text-sm text-[#6d7175]">No proof image uploaded yet.</div>}</div>
                      <div>
                        {proof.customerComments?.length > 0 ? <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><div className="text-[10px] uppercase font-mono text-amber-700">Customer revision requests</div>{proof.customerComments.map((comment,index)=><div key={index} className="mt-2 text-sm">{index + 1}. {comment}</div>)}</div> : <div className="bg-[#f6f6f7] rounded-lg p-3 text-sm text-[#6d7175]">No customer revision comments.</div>}
                        {proof.status === "approved" && <div className="mt-3 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm"><CheckCircle2 size={16} className="inline mr-1"/> Approved by {proof.approvedBy || "customer"}{proof.approvedAt ? " on " + formatDate(proof.approvedAt) : ""}</div>}
                        <div className="mt-3 text-xs text-[#6d7175]">Every upload creates a new proof version. Previous versions remain in history.</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && tab === "production" && (
            <div className="space-y-4">
              {customOrders.filter(order => ["approved","production_queue","printing","quality_control","packing","ready_for_pickup"].includes(order.status)).length === 0 ? <EmptyState title="Production queue is clear" text="Approved custom orders will appear here after customer proof approval." /> : customOrders.filter(order => ["approved","production_queue","printing","quality_control","packing","ready_for_pickup"].includes(order.status)).map(order => (
                <div key={order.id} className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-[#e1e3e5] flex items-center justify-between gap-3">
                    <div><div className="font-semibold">{order.orderNumber}</div><div className="text-xs text-[#6d7175]">{order.customerName} · {order.items?.length || 0} line item(s)</div></div>
                    <StatusPill status={order.status} />
                  </div>
                  {order.status === "approved" ? (
                    <div className="p-4">
                      <div className="font-semibold mb-3">Pre-production release checklist</div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {[
                          ["customerChecked","Correct customer"],
                          ["garmentChecked","Correct garment"],
                          ["sizeColorQtyChecked","Size / color / qty"],
                          ["spellingChecked","Text & spelling"],
                          ["proofVersionChecked","Approved proof version"],
                          ["placementChecked","Print placement"],
                          ["approvalCaptured","Approval captured"],
                          ["printFileAttached","Print file ready"]
                        ].map(([key,label]) => <label key={key} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><input type="checkbox" checked={!!order.productionChecklist?.[key]} onChange={e => updateChecklist(order,key,e.target.checked)} /> {label}</label>)}
                      </div>
                      <button onClick={() => releaseToProduction(order)} className="mt-4 bg-[#202223] text-white rounded-lg px-4 py-2.5 text-sm font-medium">Release to Production</button>
                    </div>
                  ) : (
                    <div className="p-4"><OrderTable orders={[order]} onAdvance={advanceStatus} /></div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && tab === "reviews" && (
            <div className="space-y-3">
              {reviews.length === 0 ? <EmptyState title="No reviews yet" text="Customer reviews will appear here for moderation." /> : reviews.map(review => (
                <div key={review.id} className="bg-white border border-[#e1e3e5] rounded-xl p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><span className="font-semibold">{review.customerName}</span><span className="text-amber-500">{"★".repeat(Math.max(0, Math.min(5, Number(review.rating || 0))))}</span></div>
                      <div className="text-xs text-[#6d7175] mt-1">{review.productName || review.productId}</div>
                      {review.title && <div className="font-medium mt-3">{review.title}</div>}
                      <p className="text-sm mt-1">{review.body}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={review.status} />
                      {review.status !== "approved" && <button onClick={() => updateReviewStatus(review, "approved")} className="border rounded-lg px-3 py-1.5 text-xs font-medium">Approve</button>}
                      {review.status !== "rejected" && <button onClick={() => updateReviewStatus(review, "rejected")} className="border rounded-lg px-3 py-1.5 text-xs font-medium">Reject</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === "online-store" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <StorefrontCard title="Storefront" text="Preview the customer-facing GDP Clothing home page." href="/" />
              <StorefrontCard title="Shop" text="Review the public product catalogue and collection browsing experience." href="/shop" />
              <StorefrontCard title="Custom designer" text="Open the custom apparel design workflow customers use." href="/custom-studio" />
              <StorefrontCard title="FAQ & policies" text="Review customer-facing help, policies, and store information." href="/faq" />
            </div>
          )}

          {!loading && tab === "settings" && (
            <div className="grid lg:grid-cols-2 gap-4">
              <SettingsCard label="Store details" value={storeSettings?.storeName || "GDP Clothing"} helper={storeSettings?.contactEmail || "Contact email not set"} onClick={() => openPanel("settings", storeSettings)} />
              <SettingsCard label="Markets & currency" value={storeSettings?.currency || "CAD"} helper={storeSettings?.timezone || "America/Regina"} onClick={() => openPanel("settings", storeSettings)} />
              <SettingsCard label="Inventory" value={`Low stock at ${lowStockThreshold} units`} helper="Used by the admin inventory warning system" onClick={() => openPanel("settings", storeSettings)} />
              <SettingsCard label="Storefront" value="GDP Clothing online store" helper="Open the sales channel to review public pages" onClick={() => setTab("online-store")} />
            </div>
          )}
        </div>
      </main>

      {panel && (
        <SideEditor
          key={`${panel.type}-${panel.record?.id || "new"}`}
          panel={panel}
          collections={collections}
          onClose={() => setPanel(null)}
          onSaved={async message => {
            setPanel(null);
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function sectionDescription(tab) {
  const descriptions = {
    home: "Store performance and work that needs attention.",
    orders: "Manage payment, custom-artwork, production, and fulfillment status.",
    analytics: "A commerce snapshot based on your current Base44 order data.",
    products: "List, edit, publish, archive, and merchandise products.",
    inventory: "Track product variants, SKUs, and stock levels.",
    collections: "Organize products into storefront collections.",
    customers: "Customer history derived from store orders.",
    marketing: "Promotion and merchandising controls.",
    discounts: "Create and manage discount codes.",
    "custom-orders": "Artwork queue with customer photos, story, deadline and designer instructions.",
    proofs: "Upload versioned design proofs and manage customer revisions.",
    production: "Release approved custom work through GDP production quality gates.",
    reviews: "Moderate customer product reviews.",
    "online-store": "Customer-facing sales channel shortcuts.",
    settings: "Store identity, commerce defaults, and operational settings."
  };
  return descriptions[tab] || "";
}

function PrimaryButton({ children, onClick }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 bg-[#202223] text-white rounded-lg px-3.5 py-2 text-sm font-medium hover:bg-black transition">{children}</button>;
}

function Card({ title = null, action = null, children = null }) {
  return (
    <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
      {(title || action) && <div className="px-4 py-3 border-b border-[#e1e3e5] flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2>{action}</div>}
      <div>{children}</div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="bg-white border border-[#e1e3e5] rounded-xl p-4">
      <div className="flex items-center justify-between"><span className="text-sm text-[#6d7175]">{label}</span><Icon size={17} className="text-[#8c9196]" /></div>
      <div className="text-2xl font-semibold mt-3">{value}</div>
      <div className="text-xs text-[#8c9196] mt-1">{helper}</div>
    </div>
  );
}

function Snapshot({ label, value }) {
  return <div className="p-4"><div className="text-3xl font-semibold">{value}</div><div className="text-sm text-[#6d7175] mt-1">{label}</div></div>;
}

function HealthRow({ label, value, status }) {
  const icon = status === "good" ? <CheckCircle2 size={15} className="text-green-600" /> : status === "warn" ? <AlertTriangle size={15} className="text-amber-600" /> : <ChevronRight size={15} className="text-[#8c9196]" />;
  return <div className="flex items-center gap-2 px-4 py-3 border-b last:border-b-0 border-[#e1e3e5]"><span>{icon}</span><span className="text-sm flex-1">{label}</span><span className="font-semibold text-sm">{value}</span></div>;
}

function ProductTable({ products, onEdit, onArchive }) {
  if (!products.length) return <div className="p-10 text-center text-sm text-[#6d7175]">No products match this view.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#f6f6f7] text-[#6d7175]">
          <tr><Th>Product</Th><Th>Status</Th><Th>Inventory</Th><Th>Category</Th><Th>Price</Th><Th></Th></tr>
        </thead>
        <tbody>
          {products.map(product => {
            const inventory = (product.variants || []).reduce((sum, v) => sum + Number(v.stock || 0), 0);
            return (
              <tr key={product.id} className="border-t border-[#e1e3e5] hover:bg-[#fafbfb]">
                <Td>
                  <button onClick={() => onEdit(product)} className="flex items-center gap-3 text-left">
                    <div className="w-11 h-11 rounded-lg bg-[#f1f2f3] overflow-hidden shrink-0 flex items-center justify-center">
                      {product.images?.[0] ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-[#8c9196]" />}
                    </div>
                    <div><div className="font-medium">{product.name}</div><div className="text-xs text-[#8c9196]">{product.vendor || "GDP Clothing"}</div></div>
                  </button>
                </Td>
                <Td><StatusPill status={product.status} /></Td>
                <Td>{product.trackInventory === false ? "Not tracked" : `${inventory} in stock`}</Td>
                <Td>{product.category || product.type || "—"}</Td>
                <Td>{money(product.price)}</Td>
                <Td>
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => onEdit(product)} className="text-accent font-medium">Edit</button>
                    {product.status !== "archived" && <button onClick={() => onArchive(product)} className="text-[#6d7175]" title="Archive"><Archive size={16} /></button>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTable({ rows, onEdit, threshold }) {
  if (!rows.length) return <div className="p-10 text-center text-sm text-[#6d7175]">No inventory rows yet.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#f6f6f7] text-[#6d7175]"><tr><Th>Product</Th><Th>Variant</Th><Th>SKU</Th><Th>Available</Th><Th>State</Th><Th></Th></tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className="border-t border-[#e1e3e5]">
              <Td><div className="font-medium">{row.product.name}</div></Td>
              <Td>{row.variant.name || [row.variant.size, row.variant.color].filter(Boolean).join(" / ") || "Default"}</Td>
              <Td><span className="font-mono text-xs">{row.variant.sku || "—"}</span></Td>
              <Td>{row.stock}</Td>
              <Td>{row.product.trackInventory === false ? <StatusPill status="not tracked" /> : row.stock <= threshold ? <StatusPill status="low stock" /> : <StatusPill status="in stock" />}</Td>
              <Td><button onClick={() => onEdit(row.product)} className="text-accent font-medium">Edit product</button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderTable({ orders, onAdvance, compact = false }) {
  if (!orders.length) return <div className="p-10 text-center text-sm text-[#6d7175]">No orders yet.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#f6f6f7] text-[#6d7175]"><tr><Th>Order</Th><Th>Customer</Th><Th>Total</Th><Th>Payment</Th><Th>Status</Th>{!compact && <Th>Action</Th>}</tr></thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id} className="border-t border-[#e1e3e5] hover:bg-[#fafbfb]">
              <Td><span className="font-mono font-medium">{order.orderNumber}</span><div className="text-xs text-[#8c9196]">{order.items?.length || 0} item(s)</div></Td>
              <Td><div className="font-medium">{order.customerName || "Guest"}</div><div className="text-xs text-[#8c9196]">{order.customerEmail}</div></Td>
              <Td>{money(order.total)}</Td>
              <Td><StatusPill status={order.paymentStatus} /></Td>
              <Td><StatusPill status={order.status} /></Td>
              {!compact && <Td><button onClick={() => onAdvance(order.id, order.status)} className="text-accent font-medium">Advance →</button></Td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketingCard({ icon: Icon, title, text, value, onClick }) {
  return <button onClick={onClick} className="bg-white border border-[#e1e3e5] rounded-xl p-5 text-left hover:border-[#b7b9bb]">
    <div className="flex items-center justify-between"><div className="w-9 h-9 rounded-lg bg-[#f1f2f3] flex items-center justify-center"><Icon size={18} /></div><span className="text-xs text-[#6d7175]">{value}</span></div>
    <div className="font-semibold mt-4">{title}</div><p className="text-sm text-[#6d7175] mt-1">{text}</p>
  </button>;
}

function StorefrontCard({ title, text, href }) {
  return <Link to={href} className="bg-white border border-[#e1e3e5] rounded-xl p-5 hover:border-[#b7b9bb]">
    <div className="flex items-center justify-between"><Store size={20} /><ExternalLink size={16} className="text-[#8c9196]" /></div>
    <div className="font-semibold mt-4">{title}</div><p className="text-sm text-[#6d7175] mt-1">{text}</p>
  </Link>;
}

function SettingsCard({ label, value, helper, onClick }) {
  return <button onClick={onClick} className="bg-white border border-[#e1e3e5] rounded-xl p-5 text-left hover:border-[#b7b9bb]">
    <div className="text-sm font-semibold">{label}</div><div className="text-lg mt-3">{value}</div><div className="text-xs text-[#6d7175] mt-1">{helper}</div>
  </button>;
}

function EmptyState({ title, text, action = null }) {
  return <div className="bg-white border border-[#e1e3e5] rounded-xl p-10 text-center col-span-full">
    <div className="font-semibold">{title}</div><p className="text-sm text-[#6d7175] mt-1">{text}</p>
    {action && <button onClick={action} className="mt-4 bg-[#202223] text-white rounded-lg px-3.5 py-2 text-sm font-medium">Create now</button>}
  </div>;
}

function StatusPill({ status }) {
  const label = String(status || "unknown").replaceAll("_", " ");
  const positive = ["active","paid","approved","completed","delivered","in stock"].includes(String(status));
  const caution = ["pending","pending_payment","awaiting_approval","revision_requested","low stock","payment_failed"].includes(String(status));
  const cls = positive ? "bg-green-100 text-green-800" : caution ? "bg-amber-100 text-amber-800" : "bg-[#f1f2f3] text-[#5c5f62]";
  return <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium capitalize ${cls}`}>{label}</span>;
}

function Th({ children = null }) { return <th className="text-left font-medium px-4 py-3 whitespace-nowrap">{children}</th>; }
function Td({ children = null }) { return <td className="px-4 py-3 align-middle">{children}</td>; }
function formatDate(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); } catch { return "—"; }
}

function SideEditor({ panel, collections, onClose, onSaved }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[620px] h-full bg-[#f6f6f7] shadow-2xl overflow-y-auto">
        {panel.type === "product" && <ProductEditor record={panel.record} collections={collections} onClose={onClose} onSaved={onSaved} />}
        {panel.type === "collection" && <CollectionEditor record={panel.record} onClose={onClose} onSaved={onSaved} />}
        {panel.type === "discount" && <DiscountEditor record={panel.record} onClose={onClose} onSaved={onSaved} />}
        {panel.type === "settings" && <SettingsEditor record={panel.record} onClose={onClose} onSaved={onSaved} />}
      </div>
    </div>
  );
}

function EditorHeader({ title, subtitle, onClose }) {
  return <div className="sticky top-0 z-10 bg-white border-b border-[#e1e3e5] px-5 py-4 flex items-center justify-between gap-3">
    <div><div className="font-semibold">{title}</div>{subtitle && <div className="text-xs text-[#6d7175] mt-0.5">{subtitle}</div>}</div>
    <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-[#f1f2f3] flex items-center justify-center"><X size={18} /></button>
  </div>;
}

function EditorFooter({ saving, onClose }) {
  return <div className="sticky bottom-0 bg-white border-t border-[#e1e3e5] px-5 py-4 flex justify-end gap-2">
    <button type="button" onClick={onClose} className="border rounded-lg px-4 py-2 text-sm font-medium">Cancel</button>
    <button type="submit" disabled={saving} className="bg-[#202223] text-white rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"><Save size={15} /> {saving ? "Saving…" : "Save"}</button>
  </div>;
}

function FormSection({ title, children }) {
  return <section className="bg-white border border-[#e1e3e5] rounded-xl p-4">
    <h3 className="font-semibold text-sm mb-4">{title}</h3>
    <div className="space-y-4">{children}</div>
  </section>;
}

function Field({ label, children = null, helper = null }) {
  return <label className="block"><span className="block text-sm font-medium mb-1.5">{label}</span>{children}{helper && <span className="block text-xs text-[#8c9196] mt-1">{helper}</span>}</label>;
}
const inputCls = "w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#202223]/15";
const textareaCls = `${inputCls} min-h-[96px] resize-y`;

function ProductEditor({ record, collections, onClose, onSaved }) {
  const firstVariant = record?.variants?.[0] || {};
  const [form, setForm] = useState({
    name: record?.name || "",
    slug: record?.slug || "",
    description: record?.description || "",
    status: record?.status || "draft",
    type: record?.type || "T-Shirt",
    category: record?.category || "",
    vendor: record?.vendor || "GDP Clothing",
    price: record?.price ?? "",
    compareAtPrice: record?.compareAtPrice ?? "",
    costPerItem: record?.costPerItem ?? "",
    images: (record?.images || []).join("\n"),
    tags: (record?.tags || []).join(", "),
    sizes: (record?.sizes || []).join(", "),
    colors: (record?.colors || []).join(", "),
    fulfillmentMode: record?.fulfillmentMode || "in_house",
    podProvider: record?.podProvider || "",
    baseSku: firstVariant.sku || "",
    startingStock: firstVariant.stock ?? 0,
    barcode: record?.barcode || "",
    trackInventory: record?.trackInventory !== false,
    requiresShipping: record?.requiresShipping !== false,
    taxable: record?.taxable !== false,
    featured: !!record?.featured,
    bestSeller: !!record?.bestSeller,
    newArrival: !!record?.newArrival,
    customDesignable: !!record?.customDesignable,
    customMinPhotos: record?.customization?.minPhotos ?? 1,
    customMaxPhotos: record?.customization?.maxPhotos ?? 10,
    customProofRequired: record?.customization?.proofRequired !== false,
    customIncludedRevisions: record?.customization?.includedRevisions ?? 2,
    customProofTurnaround: record?.customization?.proofTurnaround || "1–2 business days",
    customProductionTurnaround: record?.customization?.productionTurnaround || "3–5 business days after approval",
    customRushDesignFee: record?.customization?.rushDesignFee ?? 10,
    customRushProductionFee: record?.customization?.rushProductionFee ?? 15,
    customFrontBackFee: record?.customization?.frontBackFee ?? 10,
    customAllowedStyles: (record?.customization?.allowedStyles || []).join(", "),
    material: record?.material || "",
    seoTitle: record?.seo?.title || "",
    seoDescription: record?.seo?.description || "",
    collectionIds: record?.collectionIds || []
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const handleName = value => {
    setForm(prev => ({ ...prev, name: value, slug: record?.id || prev.slug ? prev.slug : slugify(value) }));
  };
  const toggleCollection = id => set("collectionIds", form.collectionIds.includes(id) ? form.collectionIds.filter(x => x !== id) : [...form.collectionIds, id]);

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const sizes = splitComma(form.sizes);
      const colors = splitComma(form.colors);
      const existingVariants = record?.variants || [];
      const dimensions = [];
      if (sizes.length || colors.length) {
        const sizeValues = sizes.length ? sizes : [""];
        const colorValues = colors.length ? colors : [""];
        sizeValues.forEach(size => colorValues.forEach(color => dimensions.push({ size, color })));
      } else {
        dimensions.push({ size: "", color: "" });
      }
      const variants = dimensions.map((combo, index) => {
        const existing = existingVariants.find(v => (v.size || "") === combo.size && (v.color || "") === combo.color) || (dimensions.length === 1 ? existingVariants[0] : null);
        const suffix = [combo.size, combo.color].filter(Boolean).join("-");
        return {
          name: [combo.size, combo.color].filter(Boolean).join(" / ") || "Default",
          sku: existing?.sku || [form.baseSku, suffix].filter(Boolean).join("-"),
          podSku: existing?.podSku || "",
          stock: existing?.stock ?? Number(form.startingStock || 0),
          price: existing?.price ?? Number(form.price || 0),
          color: combo.color,
          size: combo.size
        };
      });

      const data = {
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        description: form.description,
        status: form.status,
        type: form.type,
        category: form.category,
        vendor: form.vendor,
        price: Number(form.price || 0),
        compareAtPrice: form.compareAtPrice === "" ? null : Number(form.compareAtPrice),
        costPerItem: form.costPerItem === "" ? null : Number(form.costPerItem),
        images: splitLines(form.images),
        tags: splitComma(form.tags),
        sizes,
        colors,
        variants,
        fulfillmentMode: form.fulfillmentMode,
        podProvider: form.podProvider,
        barcode: form.barcode,
        trackInventory: form.trackInventory,
        requiresShipping: form.requiresShipping,
        taxable: form.taxable,
        featured: form.featured,
        bestSeller: form.bestSeller,
        newArrival: form.newArrival,
        customDesignable: form.customDesignable,
        customization: {
          minPhotos: Number(form.customMinPhotos || 1),
          maxPhotos: Number(form.customMaxPhotos || 10),
          proofRequired: form.customProofRequired,
          includedRevisions: Number(form.customIncludedRevisions || 0),
          proofTurnaround: form.customProofTurnaround,
          productionTurnaround: form.customProductionTurnaround,
          rushDesignFee: Number(form.customRushDesignFee || 0),
          rushProductionFee: Number(form.customRushProductionFee || 0),
          frontBackFee: Number(form.customFrontBackFee || 0),
          allowedStyles: splitComma(form.customAllowedStyles)
        },
        material: form.material,
        collectionIds: form.collectionIds,
        seo: { title: form.seoTitle, description: form.seoDescription }
      };

      await adminApi.saveProduct(record?.id || null, data);
      onSaved(record?.id ? "Product updated." : "Product created.");
    } finally {
      setSaving(false);
    }
  };

  return <form onSubmit={submit}>
    <EditorHeader title={record?.id ? "Edit product" : "Add product"} subtitle="Shopify-style product listing workspace" onClose={onClose} />
    <div className="p-4 md:p-5 space-y-4">
      <FormSection title="Product details">
        <Field label="Title"><input value={form.name} onChange={e => handleName(e.target.value)} className={inputCls} required /></Field>
        <Field label="Description"><textarea value={form.description} onChange={e => set("description", e.target.value)} className={textareaCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status"><select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></Field>
          <Field label="Product type"><select value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}>{["T-Shirt","Hoodie","Crewneck","Sweatshirt","Sweater","Kids","DTF Transfer","DTF Gang Sheet","Custom"].map(v => <option key={v}>{v}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><input value={form.category} onChange={e => set("category", e.target.value)} className={inputCls} placeholder="e.g. Custom shirts" /></Field>
          <Field label="Vendor"><input value={form.vendor} onChange={e => set("vendor", e.target.value)} className={inputCls} /></Field>
        </div>
      </FormSection>

      <FormSection title="Media">
        <Field label="Image URLs" helper="One image URL per line. The first image is the product thumbnail."><textarea value={form.images} onChange={e => set("images", e.target.value)} className={textareaCls} placeholder="https://…" /></Field>
      </FormSection>

      <FormSection title="Pricing">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price"><input type="number" step="0.01" min="0" value={form.price} onChange={e => set("price", e.target.value)} className={inputCls} required /></Field>
          <Field label="Compare-at price"><input type="number" step="0.01" min="0" value={form.compareAtPrice} onChange={e => set("compareAtPrice", e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Cost per item"><input type="number" step="0.01" min="0" value={form.costPerItem} onChange={e => set("costPerItem", e.target.value)} className={inputCls} /></Field>
      </FormSection>

      <FormSection title="Variants & inventory">
        <Field label="Sizes" helper="Comma separated, e.g. S, M, L, XL"><input value={form.sizes} onChange={e => set("sizes", e.target.value)} className={inputCls} /></Field>
        <Field label="Colors" helper="Comma separated, e.g. Black, White, Navy"><input value={form.colors} onChange={e => set("colors", e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Base SKU"><input value={form.baseSku} onChange={e => set("baseSku", e.target.value)} className={inputCls} placeholder="GDP-TEE-001" /></Field>
          <Field label="Starting stock" helper="Applied to new variants only."><input type="number" min="0" value={form.startingStock} onChange={e => set("startingStock", e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Barcode"><input value={form.barcode} onChange={e => set("barcode", e.target.value)} className={inputCls} /></Field>
        <Toggle checked={form.trackInventory} onChange={v => set("trackInventory", v)} label="Track inventory" />
      </FormSection>

      <FormSection title="Fulfillment">
        <Field label="Fulfillment mode"><select value={form.fulfillmentMode} onChange={e => set("fulfillmentMode", e.target.value)} className={inputCls}><option value="in_house">In house</option><option value="pod">Print on demand</option><option value="dropship">Dropship</option><option value="hybrid">Hybrid</option><option value="manual">Manual</option></select></Field>
        {["pod","hybrid"].includes(form.fulfillmentMode) && <Field label="POD provider"><input value={form.podProvider} onChange={e => set("podProvider", e.target.value)} className={inputCls} placeholder="Printful, Printify, Gelato…" /></Field>}
        <Toggle checked={form.requiresShipping} onChange={v => set("requiresShipping", v)} label="This is a physical product" />
        <Toggle checked={form.taxable} onChange={v => set("taxable", v)} label="Charge tax on this product" />
      </FormSection>

      <FormSection title="Collections & merchandising">
        {collections.length ? <div className="grid grid-cols-2 gap-2">{collections.map(collection => <label key={collection.id} className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm"><input type="checkbox" checked={form.collectionIds.includes(collection.id)} onChange={() => toggleCollection(collection.id)} /> {collection.name}</label>)}</div> : <div className="text-sm text-[#6d7175]">No collections created yet.</div>}
        <Field label="Tags"><input value={form.tags} onChange={e => set("tags", e.target.value)} className={inputCls} placeholder="custom, gift, family" /></Field>
        <Field label="Material"><input value={form.material} onChange={e => set("material", e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Toggle checked={form.featured} onChange={v => set("featured", v)} label="Featured" />
          <Toggle checked={form.bestSeller} onChange={v => set("bestSeller", v)} label="Best seller" />
          <Toggle checked={form.newArrival} onChange={v => set("newArrival", v)} label="New arrival" />
          <Toggle checked={form.customDesignable} onChange={v => set("customDesignable", v)} label="Custom designable" />
        </div>
      </FormSection>

      {form.customDesignable && (
        <FormSection title="GDP Custom Studio">
          <div className="bg-[#eef4ff] border border-[#c9d8ff] rounded-lg p-3 text-sm">
            This product enters the occasion-first Custom Studio instead of normal add-to-cart. Configure the customer design experience here.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum photos"><input type="number" min="1" value={form.customMinPhotos} onChange={e => set("customMinPhotos", e.target.value)} className={inputCls} /></Field>
            <Field label="Maximum photos"><input type="number" min="1" max="20" value={form.customMaxPhotos} onChange={e => set("customMaxPhotos", e.target.value)} className={inputCls} /></Field>
          </div>
          <Toggle checked={form.customProofRequired} onChange={v => set("customProofRequired", v)} label="Require customer proof approval before printing" />
          <Field label="Included revisions"><input type="number" min="0" value={form.customIncludedRevisions} onChange={e => set("customIncludedRevisions", e.target.value)} className={inputCls} /></Field>
          <Field label="Proof turnaround"><input value={form.customProofTurnaround} onChange={e => set("customProofTurnaround", e.target.value)} className={inputCls} placeholder="1–2 business days" /></Field>
          <Field label="Production turnaround"><input value={form.customProductionTurnaround} onChange={e => set("customProductionTurnaround", e.target.value)} className={inputCls} placeholder="3–5 business days after approval" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Rush design fee"><input type="number" min="0" step="0.01" value={form.customRushDesignFee} onChange={e => set("customRushDesignFee", e.target.value)} className={inputCls} /></Field>
            <Field label="Rush production fee"><input type="number" min="0" step="0.01" value={form.customRushProductionFee} onChange={e => set("customRushProductionFee", e.target.value)} className={inputCls} /></Field>
            <Field label="Front + back fee"><input type="number" min="0" step="0.01" value={form.customFrontBackFee} onChange={e => set("customFrontBackFee", e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Allowed style names" helper="Comma separated. Leave blank to show the full GDP style library."><input value={form.customAllowedStyles} onChange={e => set("customAllowedStyles", e.target.value)} className={inputCls} placeholder="GDP Classic 90s, GDP Y2K, GDP Memorial" /></Field>
        </FormSection>
      )}

      <FormSection title="Search engine listing">
        <Field label="URL handle"><input value={form.slug} onChange={e => set("slug", e.target.value)} className={inputCls} /></Field>
        <Field label="Page title"><input value={form.seoTitle} onChange={e => set("seoTitle", e.target.value)} className={inputCls} /></Field>
        <Field label="Meta description"><textarea value={form.seoDescription} onChange={e => set("seoDescription", e.target.value)} className={textareaCls} /></Field>
      </FormSection>
    </div>
    <EditorFooter saving={saving} onClose={onClose} />
  </form>;
}

function CollectionEditor({ record, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: record?.name || "",
    slug: record?.slug || "",
    description: record?.description || "",
    image: record?.image || "",
    tagline: record?.tagline || "",
    seasonal: !!record?.seasonal,
    status: record?.status || "active",
    sortOrder: record?.sortOrder || "manual"
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const data = { ...form, slug: slugify(form.slug || form.name) };
      await adminApi.saveCollection(record?.id || null, data);
      onSaved(record?.id ? "Collection updated." : "Collection created.");
    } finally { setSaving(false); }
  };
  return <form onSubmit={submit}>
    <EditorHeader title={record?.id ? "Edit collection" : "Create collection"} subtitle="Organize products for storefront browsing" onClose={onClose} />
    <div className="p-5 space-y-4">
      <FormSection title="Collection details">
        <Field label="Title"><input value={form.name} onChange={e => { set("name", e.target.value); if (!record?.id && !form.slug) set("slug", slugify(e.target.value)); }} className={inputCls} required /></Field>
        <Field label="Description"><textarea value={form.description} onChange={e => set("description", e.target.value)} className={textareaCls} /></Field>
        <Field label="Tagline"><input value={form.tagline} onChange={e => set("tagline", e.target.value)} className={inputCls} /></Field>
        <Field label="Image URL"><input value={form.image} onChange={e => set("image", e.target.value)} className={inputCls} /></Field>
        <Field label="URL handle"><input value={form.slug} onChange={e => set("slug", e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status"><select value={form.status} onChange={e => set("status", e.target.value)} className={inputCls}><option value="active">Active</option><option value="archived">Archived</option></select></Field>
          <Field label="Sort order"><select value={form.sortOrder} onChange={e => set("sortOrder", e.target.value)} className={inputCls}><option value="manual">Manual</option><option value="best_selling">Best selling</option><option value="alpha_asc">A–Z</option><option value="alpha_desc">Z–A</option><option value="price_asc">Lowest price</option><option value="price_desc">Highest price</option><option value="newest">Newest</option></select></Field>
        </div>
        <Toggle checked={form.seasonal} onChange={v => set("seasonal", v)} label="Seasonal collection" />
      </FormSection>
    </div>
    <EditorFooter saving={saving} onClose={onClose} />
  </form>;
}

function DiscountEditor({ record, onClose, onSaved }) {
  const [form, setForm] = useState({
    code: record?.code || "",
    type: record?.type || "percentage",
    value: record?.value ?? "",
    appliesTo: record?.appliesTo || "all",
    appliesToId: record?.appliesToId || "",
    minPurchase: record?.minPurchase ?? "",
    active: record?.active !== false,
    startsAt: record?.startsAt ? String(record.startsAt).slice(0,16) : "",
    endsAt: record?.endsAt ? String(record.endsAt).slice(0,16) : "",
    usageLimit: record?.usageLimit ?? ""
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const data = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value || 0),
        appliesTo: form.appliesTo,
        appliesToId: form.appliesToId,
        minPurchase: form.minPurchase === "" ? null : Number(form.minPurchase),
        active: form.active,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit)
      };
      await adminApi.saveDiscount(record?.id || null, data);
      onSaved(record?.id ? "Discount updated." : "Discount created.");
    } finally { setSaving(false); }
  };
  return <form onSubmit={submit}>
    <EditorHeader title={record?.id ? "Edit discount" : "Create discount"} subtitle="Promotion controls for the GDP Clothing store" onClose={onClose} />
    <div className="p-5 space-y-4">
      <FormSection title="Discount code">
        <Field label="Code"><input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())} className={inputCls} placeholder="GDP10" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option><option value="free_shipping">Free shipping</option></select></Field>
          <Field label={form.type === "percentage" ? "Percentage" : "Value"}><input type="number" min="0" step="0.01" value={form.value} onChange={e => set("value", e.target.value)} className={inputCls} required /></Field>
        </div>
        <Field label="Minimum purchase"><input type="number" min="0" step="0.01" value={form.minPurchase} onChange={e => set("minPurchase", e.target.value)} className={inputCls} /></Field>
        <Field label="Usage limit"><input type="number" min="1" value={form.usageLimit} onChange={e => set("usageLimit", e.target.value)} className={inputCls} /></Field>
        <Toggle checked={form.active} onChange={v => set("active", v)} label="Discount is active" />
      </FormSection>
      <FormSection title="Schedule">
        <Field label="Starts"><input type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)} className={inputCls} /></Field>
        <Field label="Ends"><input type="datetime-local" value={form.endsAt} onChange={e => set("endsAt", e.target.value)} className={inputCls} /></Field>
      </FormSection>
    </div>
    <EditorFooter saving={saving} onClose={onClose} />
  </form>;
}

function SettingsEditor({ record, onClose, onSaved }) {
  const [form, setForm] = useState({
    storeName: record?.storeName || "GDP Clothing",
    slogan: record?.slogan || "Design Your Dream, Wear Your Vision!",
    currency: record?.currency || "CAD",
    timezone: record?.timezone || "America/Regina",
    orderPrefix: record?.orderPrefix || "GDP",
    lowStockThreshold: record?.lowStockThreshold ?? 5,
    contactEmail: record?.contactEmail || "",
    phone: record?.phone || "",
    address: record?.address || "",
    logo: record?.logo || "",
    primaryColor: record?.primaryColor || "",
    instagram: record?.instagram || "",
    facebook: record?.facebook || "",
    tiktok: record?.tiktok || "",
    youtube: record?.youtube || "",
    footerText: record?.footerText || ""
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const data = { ...form, lowStockThreshold: Number(form.lowStockThreshold || 0) };
      await adminApi.saveStoreSettings(record?.id || null, data);
      onSaved("Store settings saved.");
    } finally { setSaving(false); }
  };
  return <form onSubmit={submit}>
    <EditorHeader title="Store settings" subtitle="Commerce defaults and GDP Clothing identity" onClose={onClose} />
    <div className="p-5 space-y-4">
      <FormSection title="Store details">
        <Field label="Store name"><input value={form.storeName} onChange={e => set("storeName", e.target.value)} className={inputCls} required /></Field>
        <Field label="Slogan"><input value={form.slogan} onChange={e => set("slogan", e.target.value)} className={inputCls} /></Field>
        <Field label="Contact email"><input type="email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} className={inputCls} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} /></Field>
        <Field label="Business address"><textarea value={form.address} onChange={e => set("address", e.target.value)} className={textareaCls} /></Field>
      </FormSection>
      <FormSection title="Commerce defaults">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency"><select value={form.currency} onChange={e => set("currency", e.target.value)} className={inputCls}><option>CAD</option><option>USD</option></select></Field>
          <Field label="Order prefix"><input value={form.orderPrefix} onChange={e => set("orderPrefix", e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Timezone"><input value={form.timezone} onChange={e => set("timezone", e.target.value)} className={inputCls} /></Field>
        <Field label="Low-stock threshold"><input type="number" min="0" value={form.lowStockThreshold} onChange={e => set("lowStockThreshold", e.target.value)} className={inputCls} /></Field>
      </FormSection>
      <FormSection title="Brand & social">
        <Field label="Logo URL"><input value={form.logo} onChange={e => set("logo", e.target.value)} className={inputCls} /></Field>
        <Field label="Primary color"><input value={form.primaryColor} onChange={e => set("primaryColor", e.target.value)} className={inputCls} placeholder="#000000" /></Field>
        <Field label="Instagram"><input value={form.instagram} onChange={e => set("instagram", e.target.value)} className={inputCls} /></Field>
        <Field label="Facebook"><input value={form.facebook} onChange={e => set("facebook", e.target.value)} className={inputCls} /></Field>
        <Field label="TikTok"><input value={form.tiktok} onChange={e => set("tiktok", e.target.value)} className={inputCls} /></Field>
        <Field label="YouTube"><input value={form.youtube} onChange={e => set("youtube", e.target.value)} className={inputCls} /></Field>
        <Field label="Footer text"><textarea value={form.footerText} onChange={e => set("footerText", e.target.value)} className={textareaCls} /></Field>
      </FormSection>
    </div>
    <EditorFooter saving={saving} onClose={onClose} />
  </form>;
}

function Toggle({ checked, onChange, label }) {
  return <label className="flex items-center gap-3 cursor-pointer text-sm">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4" />
    <span>{label}</span>
  </label>;
}