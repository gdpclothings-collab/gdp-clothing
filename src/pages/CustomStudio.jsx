import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Upload, X, Star, Users, Heart, PawPrint, Trophy, Gift, Sparkles, ShieldCheck, AlertTriangle, Shirt, Plus, Minus } from "lucide-react";
import { customerApi } from "@/lib/customerApi";
import { useCart } from "@/lib/CartContext";\nimport Seo from "@/components/Seo";

const OCCASIONS = [
  { id: "love", label: "Love & Relationships", icon: Heart, options: ["Anniversary","Boyfriend","Girlfriend","Husband","Wife","Valentine's","Couple"] },
  { id: "family", label: "Family", icon: Users, options: ["Mom","Dad","Grandma","Grandpa","Mother's Day","Father's Day","Family Reunion"] },
  { id: "pets", label: "Pets", icon: PawPrint, options: ["Dog","Cat","Multiple Pets","Pet Memorial","Pet Mom / Dad"] },
  { id: "sports", label: "Sports & School", icon: Trophy, options: ["Senior Night","Graduation","Football","Basketball","Volleyball","Baseball","Hockey","Dance / Cheer"] },
  { id: "events", label: "Life Events", icon: Gift, options: ["Birthday","Wedding","Bachelorette","Retirement","Vacation","Reunion"] },
  { id: "memorial", label: "Memorial", icon: Heart, options: ["In Loving Memory","Celebration of Life","Memorial Event"] },
  { id: "other", label: "Just Because", icon: Sparkles, options: ["Best Friend","Inside Joke","Funny Shirt","For Myself","Designer's Choice"] }
];

const STYLES = [
  ["GDP Classic 90s","Layered portraits, chrome type, clouds and full retro energy."],
  ["GDP Y2K","Metallic type, stars, glow effects and early-2000s attitude."],
  ["GDP Vintage Wash","Muted colors, distressed graphics and old-photo texture."],
  ["GDP Sports Hype","Player portraits, number, team colors and season highlights."],
  ["GDP Memorial","Respectful composition with names, dates and meaningful text."],
  ["GDP Love Story","Couple-focused composition for anniversaries and gifts."],
  ["GDP Pet Legend","Bold pet portraits, names and playful personality."],
  ["GDP Minimal","Cleaner layout, fewer photos and quieter typography."],
  ["GDP Designer's Choice","Tell us the story and let a GDP designer choose the direction."]
];

const GARMENTS = [
  { type: "T-Shirt", label: "Classic Tee", tier: "classic", price: 34.99, desc: "Traditional everyday fit." },
  { type: "T-Shirt", label: "Premium Vintage Tee", tier: "premium_vintage", price: 42.99, desc: "Heavier, relaxed, washed streetwear feel." },
  { type: "T-Shirt", label: "Oversized Streetwear Tee", tier: "oversized", price: 46.99, desc: "Roomier silhouette built for bold graphics." },
  { type: "Hoodie", label: "Custom Hoodie", tier: "classic", price: 64.99, desc: "Warm heavyweight custom hoodie." },
  { type: "Crewneck", label: "Custom Crewneck", tier: "classic", price: 54.99, desc: "Classic crewneck for custom artwork." }
];

const COLORS = ["Black","Vintage Black","White","Charcoal","Navy","Sand","Forest"];
const SIZES = ["S","M","L","XL","2XL","3XL","4XL","5XL"];
const MOODS = ["Funny","Emotional","Cool","Romantic","Loud","Vintage","Elegant","Designer's choice"];
const STEPS = ["Occasion","Style","Garment","Photos","Personalize","Timing","Review"];
const MAX_MB = 12;
const OPTIMIZE_ABOVE_MB = 2.5;
const MAX_UPLOAD_DIMENSION = 3600;

function qualityFor(width, height) {
  const longest = Math.max(width || 0, height || 0);
  if (longest >= 1800) return "excellent";
  if (longest >= 1000) return "usable";
  return "replace_recommended";
}

function readLocalImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const result = { img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, url };
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

async function prepareImageForUpload(file) {
  const local = await readLocalImage(file);
  const { img, width, height, url } = local;
  const longest = Math.max(width, height);
  const isPng = file.type === "image/png";
  const shouldOptimize = isPng || file.size > OPTIMIZE_ABOVE_MB * 1024 * 1024 || longest > MAX_UPLOAD_DIMENSION;

  if (!shouldOptimize) {
    URL.revokeObjectURL(url);
    return { file, width, height };
  }

  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / longest);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    return { file, width, height };
  }
  ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

  // WebP keeps PNG transparency while greatly reducing mobile upload size.
  const outputType = file.type === "image/webp" || isPng ? "image/webp" : "image/jpeg";
  const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, 0.9));
  URL.revokeObjectURL(url);

  if (!blob) return { file, width, height };
  if (!isPng && blob.size >= file.size) return { file, width, height };
  const baseName = file.name.replace(/\.[^.]+$/, "") || "gdp-photo";
  const extension = outputType === "image/webp" ? ".webp" : ".jpg";
  const optimized = new File([blob], baseName + extension, { type: outputType, lastModified: file.lastModified });
  return { file: optimized, width: outputWidth, height: outputHeight };
}

async function uploadWithRetry(file, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await customerApi.uploadArtwork(file);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 650));
    }
  }
  throw lastError || new Error("Upload failed.");
}

export default function CustomStudio() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState(null);
  const [occasionGroup, setOccasionGroup] = useState("love");
  const [occasion, setOccasion] = useState("Anniversary");
  const [recipientType, setRecipientType] = useState("");
  const [designStyle, setDesignStyle] = useState("GDP Classic 90s");
  const [designMood, setDesignMood] = useState("Cool");
  const [designIntensity, setDesignIntensity] = useState(4);
  const [garment, setGarment] = useState(GARMENTS[0]);
  const [color, setColor] = useState("Black");
  const [size, setSize] = useState("M");
  const [qty, setQty] = useState(1);
  const [placement, setPlacement] = useState("front");
  const [groupGarments, setGroupGarments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [warn, setWarn] = useState("");
  const [personalization, setPersonalization] = useState({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "" });
  const [story, setStory] = useState("");
  const [needByDate, setNeedByDate] = useState("");
  const [priority, setPriority] = useState("standard");
  const [proofRequired, setProofRequired] = useState(true);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [approvalAcknowledged, setApprovalAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const productId = params.get("product");
        const p = productId
          ? await customerApi.getProduct(productId)
          : await customerApi.getDefaultCustomProduct();

        if (!active || !p) return;
        setProduct(p);
        setColor(p?.colors?.[0] || "Black");
        setSize(p?.sizes?.[0] || "M");
        setProofRequired(p?.customization?.proofRequired !== false);
        if (p?.customization?.allowedStyles?.length) setDesignStyle(p.customization.allowedStyles[0]);

        const match = GARMENTS.find(g => g.type === p?.type);
        if (match) {
          setGarment({
            ...match,
            price: Number(p.price || match.price),
            label: p.name || match.label
          });
        }
      } catch (error) {
        if (active) setWarn(error?.message || "Could not load the custom product.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const config = product?.customization || {};
  const styleOptions = config.allowedStyles?.length ? STYLES.filter(style => config.allowedStyles.includes(style[0])) : STYLES;
  const maxPhotos = Number(config.maxPhotos || 10);
  const minPhotos = Number(config.minPhotos || 1);
  const revisions = Number(config.includedRevisions || 2);
  const rushFee = Number(config.rushDesignFee || 10) + Number(config.rushProductionFee || 15);
  const frontBackFee = Number(config.frontBackFee || 10);

  const unitPrice = useMemo(() => {
    let amount = Number(product?.price || garment.price || 0);
    if (placement === "front_back") amount += frontBackFee;
    if (priority === "rush") amount += rushFee;
    return Math.round(amount * 100) / 100;
  }, [product, garment, placement, priority, frontBackFee, rushFee]);

  const totalUnits = qty + groupGarments.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const estimatedSubtotal = unitPrice * totalUnits;

  async function uploadFiles(files) {
    setWarn("");
    const incoming = Array.from(files).slice(0, maxPhotos - photos.length);
    if (!incoming.length || uploading) return;

    const valid = [];
    const errors = [];
    for (const file of incoming) {
      if (file.size > MAX_MB * 1024 * 1024) errors.push(file.name + " is larger than " + MAX_MB + "MB.");
      else if (!["image/jpeg","image/png","image/webp"].includes(file.type)) errors.push(file.name + " is not JPG, PNG, or WEBP.");
      else valid.push(file);
    }
    if (errors.length) setWarn(errors.join(" "));
    if (!valid.length) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: valid.length });
    const results = new Array(valid.length);
    let cursor = 0;
    let completed = 0;

    async function worker() {
      while (cursor < valid.length) {
        const index = cursor++;
        const original = valid[index];
        try {
          const prepared = await prepareImageForUpload(original);
          const uploaded = await uploadWithRetry(prepared.file);
          results[index] = {
            url: uploaded.file_url,
            path: uploaded.storage_path,
            name: original.name,
            width: prepared.width,
            height: prepared.height,
            quality: qualityFor(prepared.width, prepared.height)
          };
        } catch (error) {
          errors.push(error?.message || ("Upload failed for " + original.name + "."));
        } finally {
          completed += 1;
          setUploadProgress({ done: completed, total: valid.length });
        }
      }
    }

    const workerCount = window.innerWidth < 768 ? 1 : Math.min(2, valid.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const uploadedPhotos = results.filter(Boolean);
    setPhotos(prev => {
      const hadPrimary = prev.some(p => p.isPrimary);
      return [...prev, ...uploadedPhotos.map((photo, index) => ({ ...photo, isPrimary: !hadPrimary && index === 0 }))];
    });
    if (errors.length) setWarn(errors.join(" "));
    setUploading(false);
  }

  const setPrimary = index => setPhotos(prev => prev.map((photo, i) => ({ ...photo, isPrimary: i === index })));
  const removePhoto = index => setPhotos(prev => {
    const next = prev.filter((_, i) => i !== index);
    if (next.length && !next.some(p => p.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    return next;
  });

  const addGroupGarment = () => setGroupGarments(prev => [...prev, { size, color, quantity: 1 }]);
  const updateGroup = (index, patch) => setGroupGarments(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  const removeGroup = index => setGroupGarments(prev => prev.filter((_, i) => i !== index));

  const canContinue = () => {
    if (step === 4) return photos.length >= minPhotos;
    if (step === 6) return rightsConfirmed && approvalAcknowledged;
    return true;
  };

  async function createAndAdd() {
    if (!rightsConfirmed || !approvalAcknowledged || photos.length < minPhotos) return;
    setSaving(true);
    try {
      let primaryIndex = photos.findIndex(p => p.isPrimary);
      if (primaryIndex < 0) primaryIndex = 0;
      const productId = product?.id || null;
      const design = await customerApi.createCustomDesign({
        productId,
        productName: product?.name || garment.label,
        name: personalization.name || (occasion + " Custom Design"),
        designStyle,
        photos: photos.map(p => p.url),
        photoAssets: photos,
        personalization,
        placement,
        color,
        size,
        previewUrl: photos[primaryIndex]?.url || "",
        occasion,
        recipientType,
        designMood,
        story,
        designIntensity,
        garmentTier: garment.tier,
        needByDate: needByDate || undefined,
        priority,
        proofRequired,
        revisionAllowance: revisions,
        primaryPhotoIndex: primaryIndex,
        customerConfirmedRights: rightsConfirmed,
        approvalPolicyAcknowledged: approvalAcknowledged,
        additionalGarments: groupGarments,
        status: "in_cart"
      });

      const common = {
        productId,
        name: product?.name || garment.label,
        image: product?.images?.[0] || photos[primaryIndex]?.url || "",
        variant: garment.label,
        price: unitPrice,
        isCustom: true,
        customDesignId: design.id,
        fulfillmentMode: product?.fulfillmentMode || "in_house",
        designStyle,
        occasion,
        needByDate,
        priority,
        proofRequired
      };

      addItem({ ...common, size, color, quantity: qty });
      groupGarments.forEach(item => addItem({ ...common, size: item.size, color: item.color, quantity: Number(item.quantity || 1) }));
      navigate("/cart");
    } catch (error) {
      setWarn(error?.message || "Could not save your custom design.");
      setSaving(false);
    }
  }

  const activeOccasion = OCCASIONS.find(group => group.id === occasionGroup) || OCCASIONS[0];

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-6 md:py-10">\n      <Seo title="Custom Design Studio" description="Create personalized GDP Clothing apparel from your photos, people, pets, milestones and ideas with a guided proof-based design workflow." path="/custom-studio" />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent">GDP Custom Studio</span>
          <h1 className="font-display text-5xl md:text-7xl leading-none mt-1">MAKE IT PERSONAL</h1>
          <p className="text-muted-foreground max-w-2xl mt-2">Turn your favorite people, pets and memories into wearable art. A real GDP designer reviews every custom order before production.</p>
        </div>
        <div className="text-xs font-mono uppercase text-muted-foreground">Step {step} of {STEPS.length}</div>
      </div>

      <div className="mb-7 overflow-x-auto pb-2"><div className="flex min-w-max gap-1">
        {STEPS.map((label, index) => {
          const number = index + 1;
          return <button key={label} onClick={() => number < step && setStep(number)} className={"px-3 py-2 border text-xs font-bold uppercase tracking-wide " + (step === number ? "bg-primary text-primary-foreground border-primary" : step > number ? "border-accent text-accent" : "border-border text-muted-foreground")}>
            {step > number ? <Check size={13} className="inline mr-1" /> : null}{number}. {label}
          </button>;
        })}
      </div></div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <section className="bg-card border border-border p-5 md:p-7 min-h-[520px]">
          {step === 1 && <div>
            <StepTitle eyebrow="Start with the reason" title="WHAT ARE YOU MAKING?" text="Choosing the occasion helps our designer understand the emotion and visual direction." />
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {OCCASIONS.map(group => {
                const Icon = group.icon;
                return <button key={group.id} onClick={() => { setOccasionGroup(group.id); setOccasion(group.options[0]); }} className={"border p-4 text-left " + (occasionGroup === group.id ? "border-accent bg-accent/5" : "border-border hover:border-accent")}>
                  <Icon size={20} className="mb-3" /><div className="font-bold">{group.label}</div>
                </button>;
              })}
            </div>
            <div className="mt-6"><label className="font-mono text-xs uppercase text-muted-foreground">Occasion / recipient</label><div className="flex flex-wrap gap-2 mt-2">
              {activeOccasion.options.map(option => <button key={option} onClick={() => setOccasion(option)} className={"px-3 py-2 border text-sm " + (occasion === option ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{option}</button>)}
            </div></div>
            <Field label="Who is this for? (optional)" value={recipientType} onChange={setRecipientType} placeholder="Dad, Sarah, Coach Mike, Milo the dog…" />
          </div>}

          {step === 2 && <div>
            <StepTitle eyebrow="Choose the visual direction" title="PICK A GDP STYLE" text="You choose the vibe. Our designer handles the actual composition." />
            <div className="grid md:grid-cols-2 gap-3">
              {styleOptions.map(style => <button key={style[0]} onClick={() => setDesignStyle(style[0])} className={"border p-4 text-left " + (designStyle === style[0] ? "border-accent bg-accent/5" : "border-border hover:border-accent")}>
                <div className="font-bold">{style[0]}</div><p className="text-sm text-muted-foreground mt-1">{style[1]}</p>
              </button>)}
            </div>
            <div className="grid md:grid-cols-2 gap-5 mt-6">
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Mood</label><div className="flex flex-wrap gap-2 mt-2">
                {MOODS.map(mood => <button key={mood} onClick={() => setDesignMood(mood)} className={"px-3 py-2 border text-sm " + (designMood === mood ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{mood}</button>)}
              </div></div>
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Design intensity — {designIntensity}/5</label><input type="range" min="1" max="5" value={designIntensity} onChange={e => setDesignIntensity(Number(e.target.value))} className="w-full mt-4" /><div className="flex justify-between text-[10px] uppercase font-mono text-muted-foreground"><span>Clean</span><span>Balanced</span><span>Maximum Chaos</span></div></div>
            </div>
          </div>}

          {step === 3 && <div>
            <StepTitle eyebrow="Choose the canvas" title="GARMENT, FIT & GROUP ORDER" text="Create one design and use it across multiple shirt sizes or colors." />
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(product ? [{ ...garment, label: product.name, price: Number(product.price || garment.price) }] : GARMENTS).map(option => <button key={option.label} onClick={() => setGarment(option)} className={"border p-4 text-left " + (garment.label === option.label ? "border-accent bg-accent/5" : "border-border")}>
                <Shirt size={22} className="mb-3" /><div className="font-bold">{option.label}</div><div className="font-mono text-sm mt-1">{"$" + Number(option.price).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-2">{option.desc}</p>
              </button>)}
            </div>
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <SelectField label="Color" value={color} onChange={setColor} options={product?.colors?.length ? product.colors : COLORS} />
              <SelectField label="Size" value={size} onChange={setSize} options={product?.sizes?.length ? product.sizes : SIZES} />
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Quantity</label><div className="mt-1 flex items-center border border-border w-fit"><button onClick={() => setQty(v => Math.max(1,v-1))} className="p-2"><Minus size={15}/></button><span className="px-4 font-mono">{qty}</span><button onClick={() => setQty(v => v+1)} className="p-2"><Plus size={15}/></button></div></div>
            </div>
            <div className="mt-5"><label className="font-mono text-xs uppercase text-muted-foreground">Print placement</label><div className="flex gap-2 mt-2"><Choice active={placement === "front"} onClick={() => setPlacement("front")}>Front only</Choice><Choice active={placement === "front_back"} onClick={() => setPlacement("front_back")}>Front + back (+{"$" + frontBackFee})</Choice></div></div>
            <div className="mt-7 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-4"><div><div className="font-bold">One design, many shirts</div><p className="text-sm text-muted-foreground">Perfect for families, teams, senior nights and memorial groups.</p></div><button onClick={addGroupGarment} className="text-accent text-sm font-bold inline-flex items-center gap-1 whitespace-nowrap"><Plus size={15}/> Add shirt</button></div>
              {groupGarments.map((item,index) => <GroupRow key={index} item={item} colors={product?.colors?.length ? product.colors : COLORS} sizes={product?.sizes?.length ? product.sizes : SIZES} onChange={patch => updateGroup(index,patch)} onRemove={() => removeGroup(index)} />)}
            </div>
          </div>}

          {step === 4 && <div>
            <StepTitle eyebrow="Your memories" title="UPLOAD YOUR BEST PHOTOS" text={"Upload " + minPhotos + "–" + maxPhotos + " photos. We check resolution before you order so poor source images do not become surprise print problems."} />
            <label className={"border-2 border-dashed border-border min-h-44 flex flex-col items-center justify-center hover:border-accent " + (uploading ? "cursor-wait opacity-80" : "cursor-pointer")}>
              <Upload size={28}/>
              <div className="font-bold mt-2">{uploading ? "Optimizing & uploading…" : "Upload photos"}</div>
              {uploading && uploadProgress.total > 0 && <div className="font-mono text-xs mt-1">{uploadProgress.done}/{uploadProgress.total} complete · {Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</div>}
              <div className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP · max {MAX_MB}MB each</div>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={e => uploadFiles(e.target.files)} />
            </label>
            {warn && <div className="mt-3 bg-destructive/10 text-destructive px-3 py-2 text-sm flex items-center gap-2"><AlertTriangle size={15}/>{warn}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              {photos.map((photo,index) => <PhotoCard key={photo.url} photo={photo} onPrimary={() => setPrimary(index)} onRemove={() => removePhoto(index)} />)}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-3">{photos.length}/{maxPhotos} photos</div>
          </div>}

          {step === 5 && <div>
            <StepTitle eyebrow="Make it yours" title="TEXT + STORY" text="Separate printed text from designer notes so instructions never accidentally appear on the shirt." />
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Main name / headline" value={personalization.name} onChange={v => setPersonalization({...personalization,name:v})} placeholder="BIG MIKE" />
              <Field label="Nickname" value={personalization.nickname} onChange={v => setPersonalization({...personalization,nickname:v})} placeholder="THE LEGEND" />
              <Field label="Dates / year" value={personalization.dates} onChange={v => setPersonalization({...personalization,dates:v})} placeholder="1966 · 2026" />
              <Field label="Number" value={personalization.number} onChange={v => setPersonalization({...personalization,number:v})} placeholder="23" />
              <Field label="Quote or printed message" value={personalization.quote} onChange={v => setPersonalization({...personalization,quote:v})} placeholder="Forever in our hearts" />
              <Field label="Additional printed text" value={personalization.message} onChange={v => setPersonalization({...personalization,message:v})} placeholder="Optional" />
            </div>
            <TextArea label="Tell us the story" value={story} onChange={setStory} placeholder="Dad loves fishing, classic cars, and embarrassing us with dad jokes…" />
            <TextArea label="Notes for our designer — NOT printed" value={personalization.instructions} onChange={v => setPersonalization({...personalization,instructions:v})} placeholder="Use photo #1 in the center. Make the name large. Keep the overall look vintage." />
          </div>}

          {step === 6 && <div>
            <StepTitle eyebrow="Set expectations" title="TIMING + DESIGN PROOF" text="We would rather be transparent about timing than promise a date we cannot meet." />
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Need it by</label><input type="date" value={needByDate} onChange={e => setNeedByDate(e.target.value)} className="w-full border border-border bg-background px-3 py-2 mt-1"/></div>
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Priority</label><div className="flex gap-2 mt-1"><Choice active={priority === "standard"} onClick={() => setPriority("standard")}>Standard</Choice><Choice active={priority === "rush"} onClick={() => setPriority("rush")}>Rush (+{"$" + rushFee})</Choice></div></div>
            </div>
            <div className="mt-6 border border-border p-4"><div className="flex items-start gap-3"><ShieldCheck size={22} className="text-accent shrink-0"/><div><div className="font-bold">GDP Design Guarantee</div><p className="text-sm text-muted-foreground mt-1">{proofRequired ? "You receive a proof before printing with " + revisions + " included revision(s)." : "This product is configured to skip proofing."}</p></div></div></div>
            <label className="flex items-start gap-3 mt-5 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} className="mt-1"/><span>I confirm I own or have permission to use the photos and artwork I submitted.</span></label>
            <label className="flex items-start gap-3 mt-3 text-sm"><input type="checkbox" checked={approvalAcknowledged} onChange={e => setApprovalAcknowledged(e.target.checked)} className="mt-1"/><span>I understand production begins after artwork approval and approved artwork cannot be changed after production starts.</span></label>
          </div>}

          {step === 7 && <div>
            <StepTitle eyebrow="Final check" title="REVIEW YOUR CUSTOM ORDER" text="Nothing is printed yet. This saves your design and adds the selected garments to your cart." />
            <div className="grid md:grid-cols-2 gap-4">
              <ReviewCard label="Occasion" value={occasion} sub={recipientType} />
              <ReviewCard label="Style" value={designStyle} sub={designMood + " · Intensity " + designIntensity + "/5"} />
              <ReviewCard label="Garment" value={product?.name || garment.label} sub={color + " · " + size + " · Qty " + qty} />
              <ReviewCard label="Photos" value={photos.length + " uploaded"} sub={photos.some(p => p.quality === "replace_recommended") ? "One or more photos should ideally be replaced." : "Photo quality check complete."} />
              <ReviewCard label="Proof" value={proofRequired ? "Required before print" : "Proof skipped"} sub={proofRequired ? revisions + " included revision(s)" : ""} />
              <ReviewCard label="Timing" value={priority === "rush" ? "Rush" : "Standard"} sub={needByDate ? "Need by " + needByDate : "No event date selected"} />
            </div>
            {groupGarments.length > 0 && <div className="mt-4 border border-border p-4"><div className="font-bold">Additional shirts using the same design</div>{groupGarments.map((g,i) => <div key={i} className="text-sm text-muted-foreground mt-1">{g.quantity}× {g.color} · {g.size}</div>)}</div>}
            <div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Before cart discounts, shipping, tax or coupon.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>
            <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="w-full mt-5 bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide disabled:opacity-50">{saving ? "Saving custom design…" : "Add Custom Order to Cart →"}</button>
          </div>}
        </section>

        <aside className="bg-primary text-primary-foreground p-5 h-fit lg:sticky lg:top-24">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">Live order summary</div>
          <div className="font-display text-3xl mt-2">{occasion}</div>
          <SummaryRow label="Style" value={designStyle.replace("GDP ","")} />
          <SummaryRow label="Mood" value={designMood} />
          <SummaryRow label="Garment" value={product?.name || garment.label} />
          <SummaryRow label="Size / Color" value={size + " / " + color} />
          <SummaryRow label="Photos" value={photos.length + "/" + maxPhotos} />
          <SummaryRow label="Total shirts" value={totalUnits} />
          <SummaryRow label="Proof" value={proofRequired ? "Before print" : "Skipped"} />
          <div className="border-t border-primary-foreground/20 mt-5 pt-4 flex justify-between items-end"><span className="text-xs uppercase font-mono opacity-60">Unit price</span><span className="font-display text-3xl">{"$" + unitPrice.toFixed(2)}</span></div>
          <div className="mt-5 text-xs opacity-70 leading-relaxed">A real GDP designer reviews every custom order before production. Photo quality warnings are recommendations, not automatic rejection.</div>
        </aside>
      </div>

      <div className="mt-6 flex justify-between gap-3">
        <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="inline-flex items-center gap-2 border border-border px-5 py-3 font-bold uppercase text-sm"><ArrowLeft size={16}/>{step === 1 ? "Back" : "Previous"}</button>
        {step < STEPS.length && <button disabled={!canContinue()} onClick={() => canContinue() && setStep(step + 1)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-bold uppercase text-sm disabled:opacity-40">Continue <ArrowRight size={16}/></button>}
      </div>
    </div>
  );
}

function StepTitle({ eyebrow, title, text }) {
  return <div className="mb-6"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{eyebrow}</div><h2 className="font-display text-4xl md:text-5xl leading-none mt-1">{title}</h2><p className="text-sm text-muted-foreground mt-2 max-w-2xl">{text}</p></div>;
}
function Field({ label, value, onChange, placeholder }) {
  return <div className="mt-4"><label className="font-mono text-xs uppercase text-muted-foreground">{label}</label><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-border bg-background px-3 py-2.5 mt-1 outline-none focus:border-accent"/></div>;
}
function TextArea({ label, value, onChange, placeholder }) {
  return <div className="mt-5"><label className="font-mono text-xs uppercase text-muted-foreground">{label}</label><textarea rows={4} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-border bg-background px-3 py-2.5 mt-1 outline-none focus:border-accent"/></div>;
}
function SelectField({ label, value, onChange, options }) {
  return <div><label className="font-mono text-xs uppercase text-muted-foreground">{label}</label><select value={value} onChange={e => onChange(e.target.value)} className="w-full border border-border bg-background px-3 py-2.5 mt-1">{options.map(option => <option key={option}>{option}</option>)}</select></div>;
}
function Choice({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={"border px-3 py-2 text-sm " + (active ? "border-accent bg-accent/5 text-accent" : "border-border")}>{children}</button>;
}
function ReviewCard({ label, value, sub }) {
  return <div className="border border-border p-4"><div className="font-mono text-[10px] uppercase text-muted-foreground">{label}</div><div className="font-bold mt-1">{value}</div>{sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}</div>;
}
function SummaryRow({ label, value }) {
  return <div className="flex justify-between gap-3 mt-3 text-sm"><span className="opacity-55">{label}</span><span className="text-right">{value}</span></div>;
}
function GroupRow({ item, colors, sizes, onChange, onRemove }) {
  return <div className="grid grid-cols-[1fr_1fr_80px_36px] gap-2 mt-3"><select value={item.color} onChange={e => onChange({color:e.target.value})} className="border border-border bg-background px-2 py-2 text-sm">{colors.map(v => <option key={v}>{v}</option>)}</select><select value={item.size} onChange={e => onChange({size:e.target.value})} className="border border-border bg-background px-2 py-2 text-sm">{sizes.map(v => <option key={v}>{v}</option>)}</select><input type="number" min="1" value={item.quantity} onChange={e => onChange({quantity:Number(e.target.value)})} className="border border-border bg-background px-2 py-2 text-sm"/><button onClick={onRemove} className="border border-border"><X size={14} className="mx-auto"/></button></div>;
}
function PhotoCard({ photo, onPrimary, onRemove }) {
  const qClass = photo.quality === "excellent" ? "text-green-600" : photo.quality === "usable" ? "text-amber-600" : "text-destructive";
  const qLabel = photo.quality === "excellent" ? "Excellent for print" : photo.quality === "usable" ? "Usable resolution" : "Replace recommended";
  return <div className="border border-border bg-secondary relative"><div className="aspect-square overflow-hidden"><img src={photo.url} alt={photo.name} className="w-full h-full object-cover"/></div><button onClick={onRemove} className="absolute top-1 right-1 bg-background/90 p-1"><X size={13}/></button><div className="p-2"><button onClick={onPrimary} className={"text-[10px] uppercase font-mono flex items-center gap-1 " + (photo.isPrimary ? "text-accent" : "text-muted-foreground")}><Star size={12} className={photo.isPrimary ? "fill-accent" : ""}/>{photo.isPrimary ? "Primary photo" : "Make primary"}</button><div className={"mt-1 text-[10px] uppercase font-mono " + qClass}>{qLabel}</div><div className="text-[10px] text-muted-foreground">{photo.width}×{photo.height}</div></div></div>;
}