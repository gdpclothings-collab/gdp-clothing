import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Upload, Check, X, ImageIcon, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";

const GARMENTS = [
  { type: "T-Shirt", price: 34.99, img: "/images/gdp-tshirt.svg" },
  { type: "Hoodie", price: 64.99, img: "/images/gdp-hero.svg" },
  { type: "Crewneck", price: 54.99, img: "/images/gdp-crewneck.svg" },
  { type: "Sweatshirt", price: 58.99, img: "/images/gdp-crewneck.svg" },
];

const STYLES = ["Vintage Bootleg", "Retro", "Minimal", "Memorial", "Pet", "Couple", "Family", "Birthday", "Wedding", "Sports", "Custom Request"];

const PLACEMENTS = [
  { id: "front", label: "Front", x: 50, y: 40 },
  { id: "back", label: "Back", x: 50, y: 40 },
  { id: "left_chest", label: "Left Chest", x: 30, y: 30 },
  { id: "large_front", label: "Large Front", x: 50, y: 45 },
  { id: "large_back", label: "Large Back", x: 50, y: 45 },
];

const COLORS = ["Black", "White", "Charcoal", "Navy", "Sand", "Forest"];
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const MAX_PHOTOS = 5;
const MAX_MB = 12;

export default function Design() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [step, setStep] = useState(1);
  const [garment, setGarment] = useState(GARMENTS[0]);
  const [designStyle, setDesignStyle] = useState("Vintage Bootleg");
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [warn, setWarn] = useState("");
  const [personalization, setPersonalization] = useState({ name: "", nickname: "", dates: "", message: "", quote: "", number: "", instructions: "" });
  const [placement, setPlacement] = useState("front");
  const [color, setColor] = useState("Black");
  const [size, setSize] = useState("M");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const pid = params.get("product");
    if (pid) {
      base44.entities.Product.get(pid).then(p => {
        const g = GARMENTS.find(x => x.type === p.type);
        if (g) setGarment(g);
      }).catch(() => {});
    }
  }, []);

  const handleFiles = async (files) => {
    setWarn("");
    const arr = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (!arr.length) return;
    setUploading(true);
    const next = [...photos];
    for (const f of arr) {
      if (f.size > MAX_MB * 1024 * 1024) { setWarn(`${f.name} exceeds ${MAX_MB}MB limit.`); continue; }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setWarn(`${f.name} is not a supported format (JPG/PNG/WEBP).`); continue; }
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        const img = new Image();
        img.onload = () => {
          if (img.width < 800) setWarn(`"${f.name}" is ${img.width}×${img.height} — low resolution may affect print quality. We recommend 1500px+.`);
        };
        img.src = file_url;
        next.push({ url: file_url, name: f.name });
      } catch { setWarn(`Upload failed for ${f.name}.`); }
    }
    setPhotos(next);
    setUploading(false);
  };

  const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i));

  const STEPS = ["Product", "Style", "Photos", "Personalize", "Placement", "Preview", "Cart"];

  const canNext = step !== 3 || photos.length > 0;

  const addToCart = async () => {
    let customDesignId;
    try {
      const rec = await base44.entities.CustomDesign.create({
        productName: garment.type, designStyle, photos,
        personalization, placement, color, size,
        status: "in_cart", previewUrl: photos[0]?.url || ""
      });
      customDesignId = rec.id;
    } catch { customDesignId = `local_${Date.now()}`; }

    addItem({
      productId: `custom_${garment.type}`, name: `Custom ${garment.type} — ${designStyle}`,
      image: garment.img, variant: garment.type, size, color, quantity: qty,
      price: garment.price * qty, isCustom: true, customDesignId,
      fulfillmentMode: "in_house"
    });
    navigate("/cart");
  };

  const placementCoords = PLACEMENTS.find(p => p.id === placement);

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-6">
      <div className="mb-6">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">The Atelier</span>
        <h1 className="font-display text-5xl md:text-6xl leading-none mt-1">DESIGN YOUR OWN</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center shrink-0">
            <button onClick={() => setStep(i + 1)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide border transition-colors ${
                step === i + 1 ? "bg-primary text-primary-foreground border-primary" : step > i + 1 ? "border-accent text-accent" : "border-border text-muted-foreground"
              }`}>
              {step > i + 1 ? <Check size={14} /> : <span className="font-mono">0{i + 1}</span>}{s}
            </button>
            {i < STEPS.length - 1 && <div className="w-3 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="bg-card border border-border p-6 min-h-[420px]">
          {/* STEP 1: GARMENT */}
          {step === 1 && (
            <div>
              <h2 className="font-display text-3xl mb-4">CHOOSE YOUR GARMENT</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {GARMENTS.map(g => (
                  <button key={g.type} onClick={() => setGarment(g)}
                    className={`border p-3 text-left transition-colors ${garment.type === g.type ? "border-accent bg-accent/5" : "border-border hover:border-accent"}`}>
                    <div className="aspect-square bg-secondary mb-2 overflow-hidden"><Image src={g.img} alt={g.type} fittingType="fill" className="w-full h-full object-cover" /></div>
                    <div className="font-bold uppercase text-sm">{g.type}</div>
                    <div className="font-mono text-xs text-muted-foreground">${g.price}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: STYLE */}
          {step === 2 && (
            <div>
              <h2 className="font-display text-3xl mb-4">CHOOSE YOUR DESIGN STYLE</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STYLES.map(s => (
                  <button key={s} onClick={() => setDesignStyle(s)}
                    className={`border p-4 text-left transition-colors ${designStyle === s ? "border-accent bg-accent/5" : "border-border hover:border-accent"}`}>
                    <div className="font-bold uppercase text-sm">{s}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: PHOTOS */}
          {step === 3 && (
            <div>
              <h2 className="font-display text-3xl mb-2">UPLOAD YOUR PHOTOS</h2>
              <p className="text-sm text-muted-foreground mb-4">Up to {MAX_PHOTOS} photos · JPG, PNG, WEBP · max {MAX_MB}MB each. We recommend 1500px+ for crisp prints.</p>
              <label className="border-2 border-dashed border-border p-8 flex flex-col items-center cursor-pointer hover:border-accent transition-colors">
                {uploading ? <div className="font-mono text-sm">UPLOADING…</div> : (
                  <>
                    <Upload size={28} className="mb-2" />
                    <span className="text-sm font-bold uppercase">Click to upload</span>
                    <span className="text-xs text-muted-foreground mt-1">or drag & drop</span>
                  </>
                )}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />
              </label>
              {warn && (
                <div className="mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2">
                  <AlertTriangle size={16} /> {warn}
                </div>
              )}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-4">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square bg-secondary overflow-hidden group">
                      <Image src={p.url} alt={p.name} fittingType="fill" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-background/80 rounded-full p-1" aria-label="Remove"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 font-mono text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS} PHOTOS</div>
            </div>
          )}

          {/* STEP 4: PERSONALIZATION */}
          {step === 4 && (
            <div>
              <h2 className="font-display text-3xl mb-4">PERSONALIZE IT</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  ["name", "Name"], ["nickname", "Nickname"], ["dates", "Dates"],
                  ["number", "Number"], ["quote", "Quote / Message"], ["message", "Custom Instructions"]
                ].map(([k, label]) => (
                  <div key={k}>
                    <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
                    <input value={personalization[k]} onChange={(e) => setPersonalization({ ...personalization, [k]: e.target.value })}
                      className="w-full bg-background border border-border px-3 py-2 mt-1 outline-none focus:border-accent" />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Special Instructions for our designer</label>
                  <textarea value={personalization.instructions} onChange={(e) => setPersonalization({ ...personalization, instructions: e.target.value })}
                    rows={3} className="w-full bg-background border border-border px-3 py-2 mt-1 outline-none focus:border-accent" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PLACEMENT */}
          {step === 5 && (
            <div>
              <h2 className="font-display text-3xl mb-4">CHOOSE PLACEMENT</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {PLACEMENTS.map(p => (
                  <button key={p.id} onClick={() => setPlacement(p.id)}
                    className={`border p-4 text-left transition-colors ${placement === p.id ? "border-accent bg-accent/5" : "border-border hover:border-accent"}`}>
                    <div className="font-bold uppercase text-sm">{p.label}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="font-mono text-xs uppercase text-muted-foreground">Color</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setColor(c)}
                        className={`px-3 py-2 text-xs uppercase border ${color === c ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-mono text-xs uppercase text-muted-foreground">Size</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {SIZES.map(s => (
                      <button key={s} onClick={() => setSize(s)}
                        className={`min-w-10 px-3 py-2 text-xs font-bold uppercase border ${size === s ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: PREVIEW */}
          {step === 6 && (
            <div>
              <h2 className="font-display text-3xl mb-4">PREVIEW YOUR DESIGN</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: color === "Black" ? "#1a1a1a" : color === "White" ? "#f5f5f5" : "#888" }}>
                    <span className="font-mono text-xs uppercase text-background/40">{color} · {garment.type}</span>
                  </div>
                  {photos[0] && (
                    <div className="absolute" style={{
                      left: `${placementCoords.x - 22}%`, top: `${placementCoords.y - 22}%`, width: "44%", height: "44%"
                    }}>
                      <Image src={photos[0].url} alt="Design preview" fittingType="fill" className="w-full h-full object-cover mix-blend-multiply" />
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 bg-primary/80 text-primary-foreground px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide">
                    Digital preview — colour not guaranteed exact
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <Row k="Garment" v={garment.type} />
                  <Row k="Style" v={designStyle} />
                  <Row k="Placement" v={PLACEMENTS.find(p=>p.id===placement).label} />
                  <Row k="Color" v={color} />
                  <Row k="Size" v={size} />
                  <Row k="Photos" v={`${photos.length} uploaded`} />
                  {personalization.name && <Row k="Name" v={personalization.name} />}
                  {personalization.dates && <Row k="Dates" v={personalization.dates} />}
                  {personalization.quote && <Row k="Quote" v={personalization.quote} />}
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: CART */}
          {step === 7 && (
            <div className="text-center py-10">
              <div className="font-display text-6xl mb-3">READY TO GO</div>
              <p className="text-muted-foreground max-w-md mx-auto">Your custom {garment.type} will get a digital proof from our designer before any printing. You'll approve it in your account portal.</p>
              <button onClick={addToCart} className="mt-6 bg-accent text-accent-foreground px-8 py-4 font-bold uppercase tracking-wide inline-flex items-center gap-2 hover:opacity-90">
                Add to Cart — ${(garment.price * qty).toFixed(2)}
              </button>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between mt-8 pt-4 border-t border-border">
            <button disabled={step === 1} onClick={() => setStep(s => s - 1)}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase disabled:opacity-30 hover:text-accent">
              <ArrowLeft size={16} /> Back
            </button>
            {step < 7 ? (
              <button disabled={!canNext} onClick={() => setStep(s => s + 1)}
                className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold uppercase tracking-wide inline-flex items-center gap-2 disabled:opacity-30">
                Continue <ArrowRight size={16} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Configuration Ledger */}
        <aside className="bg-primary text-primary-foreground border border-primary p-5 h-fit sticky top-24">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">Configuration Ledger</div>
          <div className="aspect-square bg-secondary/10 mb-4 overflow-hidden">
            <Image src={garment.img} alt={garment.type} fittingType="fill" className="w-full h-full object-cover" />
          </div>
          <h3 className="font-display text-2xl leading-none">CUSTOM {garment.type.toUpperCase()}</h3>
          <div className="text-sm text-primary-foreground/70 font-mono uppercase mt-1">{designStyle}</div>
          <div className="mt-4 space-y-1.5 text-sm border-t border-primary-foreground/20 pt-4">
            <LedgerRow k="Placement" v={PLACEMENTS.find(p=>p.id===placement).label} />
            <LedgerRow k="Color" v={color} />
            <LedgerRow k="Size" v={size} />
            <LedgerRow k="Photos" v={`${photos.length}/${MAX_PHOTOS}`} />
            <LedgerRow k="Qty" v={qty} />
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary-foreground/20">
            <span className="font-mono text-xs uppercase">Unit</span>
            <span className="font-mono">${garment.price.toFixed(2)}</span>
          </div>
          <div className="text-xs text-primary-foreground/60 mt-2">2 items ≈ 20% off · 3+ items ≈ 25% off applied at checkout</div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-1 border border-primary-foreground/30">-</button>
            <span className="font-mono px-3">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="px-3 py-1 border border-primary-foreground/30">+</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }) { return <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground font-mono text-xs uppercase">{k}</span><span className="font-medium">{v}</span></div>; }
function LedgerRow({ k, v }) { return <div className="flex justify-between"><span className="text-primary-foreground/60 font-mono text-xs uppercase">{k}</span><span className="font-mono text-sm">{v}</span></div>; }