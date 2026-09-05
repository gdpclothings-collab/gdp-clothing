import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Package, Heart, User, LogOut, Clock, Eye, Sparkles, CheckCircle2, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";

const STATUS_LABELS = {
  pending_payment: "Pending Payment", paid: "Paid", artwork_needed: "Artwork Needed",
  design_in_progress: "Design In Progress", proof_ready: "Proof Ready", awaiting_approval: "Awaiting Your Approval",
  revision_requested: "Revision Requested", approved: "Approved", production_queue: "In Production Queue", printing: "Printing",
  quality_control: "Quality Control", packing: "Packing", shipped: "Shipped",
  out_for_delivery: "Out for Delivery", delivered: "Delivered", completed: "Completed",
  cancelled: "Cancelled", refunded: "Refunded"
};

export default function Account() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "orders";
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [trackInput, setTrackInput] = useState("");
  const [trackResult, setTrackResult] = useState(null);
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
      const { data } = await base44.functions.invoke("custom-proof-action", { action: "list" });
      setCustomOrders(data?.orders || []);
    } catch {
      setCustomError("Could not load your custom-order proofs.");
    } finally {
      setCustomLoading(false);
    }
  };

  useEffect(() => {
    base44.auth.me().then(current => {
      setUser(current);
      if (current?.email) {
        base44.entities.Order.filter({ customerEmail: current.email }, "-created_date", 50).then(r => setOrders(Array.isArray(r) ? r : r?.items || [])).catch(() => {});
      }
    }).catch(() => {});
    base44.entities.SavedDesign.filter({}, "-created_date", 20).then(r => setSavedDesigns(Array.isArray(r) ? r : r?.items || [])).catch(() => {});
    loadCustomOrders();
  }, []);

  useEffect(() => {
    if (!wishlist.length) { setWishProducts([]); return; }
    base44.entities.Product.filter({ id: { $in: wishlist } }).then(r => setWishProducts(Array.isArray(r) ? r : r?.items || [])).catch(() => {});
  }, [wishlist]);

  const setTab = (t) => { const n = new URLSearchParams(params); n.set("tab", t); setParams(n); };

  const approveProof = async (proofId) => {
    setCustomError("");
    try {
      const { data } = await base44.functions.invoke("custom-proof-action", { action: "approve", proofId });
      if (data?.error) setCustomError(data.message || "Could not approve proof.");
      else await loadCustomOrders();
    } catch (e) {
      setCustomError(e?.response?.data?.message || "Could not approve proof.");
    }
  };

  const requestRevision = async (proofId) => {
    const comment = (revisionText[proofId] || "").trim();
    if (!comment) return;
    setCustomError("");
    try {
      const { data } = await base44.functions.invoke("custom-proof-action", { action: "request_revision", proofId, comment });
      if (data?.error) setCustomError(data.message || "Could not request revision.");
      else {
        setRevisionText(prev => ({ ...prev, [proofId]: "" }));
        await loadCustomOrders();
      }
    } catch (e) {
      setCustomError(e?.response?.data?.message || "Could not request revision.");
    }
  };

  const trackOrder = async () => {
    if (!trackInput.trim()) return;
    setTrackResult(null);
    try {
      const r = await base44.entities.Order.filter({ orderNumber: trackInput.trim(), customerEmail: user?.email });
      const o = Array.isArray(r) ? r[0] : r?.items?.[0];
      setTrackResult(o || { notFound: true });
    } catch { setTrackResult({ notFound: true }); }
  };

  const TABS = [
    { id: "orders", label: "Orders", icon: Package },
    { id: "custom", label: "Custom Orders", icon: Sparkles },
    { id: "track", label: "Track Order", icon: Clock },
    { id: "wishlist", label: "Wishlist", icon: Heart },
    { id: "designs", label: "Saved Designs", icon: Eye },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
      <h1 className="font-display text-5xl md:text-6xl leading-none mb-2">MY ACCOUNT</h1>
      <p className="text-muted-foreground mb-8">{user?.email || "Welcome back"}</p>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-l-2 transition-colors ${tab === t.id ? "border-accent bg-accent/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
          <button onClick={() => base44.auth.logout("/")} className="flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide text-muted-foreground hover:text-destructive border-l-2 border-transparent">
            <LogOut size={16} /> Sign Out
          </button>
        </nav>

        <div className="min-h-[400px]">
          {tab === "orders" && (
            <div className="space-y-4">
              {orders.length === 0 ? <Empty icon={Package} text="No orders yet." cta /> : orders.map(o => (
                <div key={o.id} className="border border-border p-5 bg-card">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <div className="font-mono text-sm">{o.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.created_date).toLocaleDateString()}</div>
                    </div>
                    <span className="font-mono text-xs uppercase px-2 py-1 bg-accent/10 text-accent">{STATUS_LABELS[o.status] || o.status}</span>
                  </div>
                  <div className="mt-3 text-sm">{o.items?.length} item(s) · <span className="font-mono">${o.total?.toFixed(2)}</span></div>
                  {o.trackingNumber && <div className="mt-2 text-xs font-mono">Tracking: {o.carrier} {o.trackingNumber}</div>}
                </div>
              ))}
            </div>
          )}

          {tab === "custom" && (
            <div>
              <div className="flex items-end justify-between gap-3 mb-4">
                <div><h2 className="font-display text-3xl">CUSTOM ORDERS</h2><p className="text-sm text-muted-foreground">Proof approval, revisions and production status in one place.</p></div>
                <button onClick={loadCustomOrders} className="text-xs font-bold uppercase text-accent">Refresh</button>
              </div>
              {customError && <div className="mb-4 bg-destructive/10 text-destructive px-3 py-2 text-sm">{customError}</div>}
              {customLoading ? <p className="text-sm text-muted-foreground">Loading custom orders…</p> : customOrders.length === 0 ? <Empty icon={Sparkles} text="No custom orders yet." cta /> : (
                <div className="space-y-5">
                  {customOrders.map(entry => (
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
            <div>
              <h2 className="font-display text-3xl mb-4">TRACK AN ORDER</h2>
              <div className="flex gap-2">
                <input value={trackInput} onChange={(e) => setTrackInput(e.target.value)} placeholder="Order # e.g. GDP-12345678"
                  className="flex-1 bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
                <button onClick={trackOrder} className="bg-primary text-primary-foreground px-5 font-bold uppercase text-sm">Track</button>
              </div>
              {trackResult?.notFound && <p className="mt-4 text-sm text-muted-foreground">No order found with that number.</p>}
              {trackResult && !trackResult.notFound && (
                <div className="mt-4 border border-border p-5 bg-card">
                  <div className="flex justify-between"><span className="font-mono text-sm">{trackResult.orderNumber}</span>
                    <span className="font-mono text-xs uppercase px-2 py-1 bg-accent/10 text-accent">{STATUS_LABELS[trackResult.status] || trackResult.status}</span></div>
                  <p className="text-sm mt-2">{trackResult.items?.length} items · ${trackResult.total?.toFixed(2)}</p>
                  {trackResult.trackingNumber && <p className="text-xs font-mono mt-2">Tracking: {trackResult.carrier} {trackResult.trackingNumber}</p>}
                </div>
              )}
            </div>
          )}

          {tab === "wishlist" && (
            <div>
              {wishProducts.length === 0 ? <Empty icon={Heart} text="Your wishlist is empty." /> : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {wishProducts.map(p => (
                    <Link key={p.id} to={`/product/${p.id}`} className="border border-border p-3 hover:border-accent">
                      <div className="aspect-square bg-secondary overflow-hidden mb-2"><Image src={p.images?.[0]} alt={p.name} fittingType="fill" className="w-full h-full object-cover" /></div>
                      <div className="font-medium text-sm">{p.name}</div><div className="font-mono text-xs">${p.price?.toFixed(2)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "designs" && (
            <div>
              {savedDesigns.length === 0 ? <Empty icon={Eye} text="No saved designs yet." cta /> : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {savedDesigns.map(d => (
                    <Link key={d.id} to="/custom-studio" className="border border-border p-3 hover:border-accent">
                      <div className="aspect-square bg-secondary overflow-hidden mb-2">{d.previewUrl && <Image src={d.previewUrl} alt={d.name} fittingType="fill" className="w-full h-full object-cover" />}</div>
                      <div className="font-medium text-sm">{d.name}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div className="border border-border p-6 bg-card max-w-md">
              <h2 className="font-display text-3xl mb-4">PROFILE</h2>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground font-mono text-xs uppercase">Name</span><div>{user?.full_name || "—"}</div></div>
                <div><span className="text-muted-foreground font-mono text-xs uppercase">Email</span><div>{user?.email}</div></div>
                <div><span className="text-muted-foreground font-mono text-xs uppercase">Role</span><div className="font-mono uppercase">{user?.role}</div></div>
              </div>
              {user?.role === "admin" && <Link to="/admin" className="mt-4 inline-block bg-accent text-accent-foreground px-4 py-2 font-bold uppercase text-sm">Admin Dashboard</Link>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomOrderCard({ entry, revisionText, setRevisionText, onApprove, onRevision }) {
  const order = entry.order;
  const proof = entry.proofs?.[0];
  const design = entry.designs?.[0];
  const versions = proof?.versions || [];
  const currentVersion = versions.find(v => Number(v.version) === Number(proof?.currentVersion)) || versions[versions.length - 1];
  const actionable = proof && ["ready","sent","awaiting_approval","revised"].includes(proof.status);
  const steps = ["artwork_needed","design_in_progress","proof_ready","awaiting_approval","approved","production_queue","printing","quality_control","packing","shipped","delivered"];
  const currentIndex = steps.indexOf(order.status);

  return (
    <div className="border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm">{order.orderNumber}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {design?.occasion || "Custom order"}{design?.recipientType ? " · For " + design.recipientType : ""}
          </div>
          {order.needByDate && <div className="text-xs text-accent mt-1">Need by {order.needByDate}{order.priority === "rush" ? " · RUSH" : ""}</div>}
        </div>
        <span className="font-mono text-xs uppercase px-2 py-1 bg-accent/10 text-accent">{STATUS_LABELS[order.status] || order.status}</span>
      </div>

      <div className="p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
          {steps.slice(0, 8).map((status, index) => (
            <div key={status} className={"text-[10px] font-mono uppercase border px-2 py-2 " + (index <= currentIndex ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground")}>
              {index <= currentIndex ? "✓ " : ""}{STATUS_LABELS[status] || status.replaceAll("_"," ")}
            </div>
          ))}
        </div>

        {design && (
          <div className="grid md:grid-cols-[120px_1fr] gap-4 mb-5">
            <div className="aspect-square bg-secondary overflow-hidden">{design.previewUrl && <img src={design.previewUrl} alt="Custom design source" className="w-full h-full object-cover" />}</div>
            <div className="text-sm">
              <div className="font-bold">{design.productName}</div>
              <div className="text-muted-foreground mt-1">{design.designStyle} · {design.designMood || "Custom mood"} · Intensity {design.designIntensity || 3}/5</div>
              <div className="text-muted-foreground mt-1">{design.color} · {design.size}</div>
              {design.story && <div className="mt-3 bg-secondary p-3"><span className="font-mono text-[10px] uppercase text-muted-foreground">Story</span><div className="mt-1">{design.story}</div></div>}
            </div>
          </div>
        )}

        {proof ? (
          <div className="border border-border p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-bold">Design Proof {proof.currentVersion ? "v" + proof.currentVersion : ""}</div>
                <div className="text-xs text-muted-foreground">Status: {String(proof.status || "pending").replaceAll("_"," ")} · Revisions {proof.revisionCount || 0}/{proof.maxRevisions || 0}</div>
              </div>
              {proof.status === "approved" && <span className="text-green-600 inline-flex items-center gap-1 text-sm"><CheckCircle2 size={16}/> Approved</span>}
            </div>

            {currentVersion?.url ? <img src={currentVersion.url} alt="GDP design proof" className="w-full max-h-[560px] object-contain bg-secondary" /> : <div className="bg-secondary p-8 text-center text-sm text-muted-foreground">Your GDP designer has not uploaded the first proof yet.</div>}

            {proof.customerComments?.length > 0 && (
              <div className="mt-3 text-sm"><div className="font-mono text-[10px] uppercase text-muted-foreground">Your revision history</div>{proof.customerComments.map((comment,index)=><div key={index} className="mt-1 bg-secondary px-3 py-2">{comment}</div>)}</div>
            )}

            {actionable && currentVersion?.url && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <button onClick={() => onApprove(proof.id)} className="bg-accent text-accent-foreground px-4 py-3 font-bold uppercase text-sm inline-flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Approve for Printing</button>
                  <div>
                    <textarea value={revisionText[proof.id] || ""} onChange={e => setRevisionText(prev => ({ ...prev, [proof.id]: e.target.value }))} rows={2} placeholder="Tell us exactly what you want changed…" className="w-full border border-border bg-background px-3 py-2 text-sm" />
                    <button onClick={() => onRevision(proof.id)} disabled={!(revisionText[proof.id] || "").trim()} className="w-full mt-2 border border-border px-4 py-2 text-sm font-bold uppercase disabled:opacity-40 inline-flex items-center justify-center gap-2"><MessageSquare size={15}/> Request Changes</button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">Approve only when spelling, photos, colors and placement are correct. Production begins after approval.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-border bg-secondary p-4 text-sm text-muted-foreground">This custom design does not currently require a proof.</div>
        )}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text, cta }) {
  return <div className="text-center py-16"><Icon size={36} className="mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">{text}</p>{cta && <Link to="/shop" className="text-accent text-sm mt-2 inline-block">Start shopping →</Link>}</div>;
}