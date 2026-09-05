import React, { useState } from "react";
import { ChevronDown, ChevronUp, Mail, MapPin, Phone, Send } from "lucide-react";
import { customerApi } from "@/lib/customerApi";

const FAQS = [
  { q: "How does the custom design process work?", a: "Upload 1–5 photos, choose a style, personalize with names/dates, pick placement, color & size, then preview and order. Our designer creates a digital proof you approve before anything is printed." },
  { q: "What's the turnaround time?", a: "In-house items ship in 5–10 business days after proof approval. Print-on-demand items typically 7–14 business days. Local pickup available in Saskatoon." },
  { q: "Can I request revisions on my proof?", a: "Yes — every custom order includes free proof revisions. Request changes through your account portal until you're happy." },
  { q: "What's your return policy?", a: "Due to the custom nature of our products, custom items are non-returnable unless defective. Stock items can be returned within 14 days unworn." },
  { q: "Do you ship internationally?", a: "We ship across Canada and the US. International orders via POD partners — contact us for a quote." },
  { q: "What printing methods do you use?", a: "GDP operates in-house DTF (Direct-to-Film) and sublimation. Some items route to Printful/Printify for specialty fulfillment." },
];

const POLICIES = [
  { t: "Privacy Policy", b: "GDP Clothing collects only what's needed to fulfill orders and improve your experience. We never sell your data. Contact us to request deletion." },
  { t: "Terms of Service", b: "By ordering you confirm you own the rights to uploaded images. Custom orders require proof approval before production. Prices in CAD." },
  { t: "Shipping & Returns", b: "Free shipping over $150 CAD within Canada. Returns within 14 days on non-custom items. Custom items replaced if defective." },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ customerEmail: "", customerName: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await customerApi.createSupportTicket(form);
      setSent(true);
      setForm({ customerEmail: "", customerName: "", subject: "", message: "" });
    } catch { setError("Could not submit. Please email hello@gdpclothing.ca."); }
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 py-12">
      <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Help Center</span>
      <h1 className="font-display text-5xl md:text-6xl leading-none mt-1 mb-8">FAQ & SUPPORT</h1>

      <div className="space-y-2 mb-12">
        {FAQS.map((f, i) => (
          <div key={i} className="border border-border bg-card">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex justify-between items-center p-4 text-left">
              <span className="font-bold">{f.q}</span>
              {open === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {open === i && <div className="px-4 pb-4 text-sm text-muted-foreground">{f.a}</div>}
          </div>
        ))}
      </div>

      <h2 className="font-display text-3xl mb-4">POLICIES</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        {POLICIES.map(p => (
          <div key={p.t} className="border border-border p-4 bg-card">
            <h3 className="font-bold uppercase text-sm mb-1">{p.t}</h3>
            <p className="text-xs text-muted-foreground">{p.b}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display text-3xl mb-4">CONTACT US</h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2"><MapPin size={16} className="text-accent" /> Saskatoon, SK, Canada</p>
          <p className="flex items-center gap-2"><Phone size={16} className="text-accent" /> (306) 555-GDP1</p>
          <p className="flex items-center gap-2"><Mail size={16} className="text-accent" /> hello@gdpclothing.ca</p>
        </div>
        {sent ? (
          <div className="border border-accent bg-accent/10 p-6 text-center">
            <Send size={28} className="mx-auto text-accent mb-2" />
            <p className="font-bold uppercase">Message sent</p>
            <p className="text-sm text-muted-foreground mt-1">We'll get back to you within 1 business day.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Name" value={form.customerName} onChange={(e) => setForm({...form, customerName: e.target.value})} className="bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
              <input required type="email" placeholder="Email" value={form.customerEmail} onChange={(e) => setForm({...form, customerEmail: e.target.value})} className="bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
            </div>
            <input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} className="w-full bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
            <textarea required placeholder="How can we help?" rows={4} value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} className="w-full bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
            <button className="w-full bg-primary text-primary-foreground py-3 font-bold uppercase text-sm hover:opacity-90">Send Message</button>
          </form>
        )}
      </div>
    </div>
  );
}