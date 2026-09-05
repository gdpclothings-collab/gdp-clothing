import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Mail, MapPin, Send } from "lucide-react";
import { customerApi } from "@/lib/customerApi";
import Seo from "@/components/Seo";

const FAQS = [
  { q: "How does the custom design process work?", a: "Upload 1–5 photos, choose a style, personalize with names/dates, pick placement, color & size, then preview and order. Our designer creates a digital proof you approve before anything is printed." },
  { q: "What's the turnaround time?", a: "Timing depends on the garment, production method, artwork readiness, and whether a custom proof is required. Custom production begins after any required proof approval. Delivery estimates shown with the order are estimates rather than guaranteed dates." },
  { q: "Can I request revisions on my proof?", a: "Yes. Custom orders show the included revision allowance for that design. When a proof is awaiting approval, revision requests can be submitted through your account workflow." },
  { q: "What's your return policy?", a: "Custom and personalized items are generally final sale unless defective, damaged, or materially different from the approved order. Eligible non-custom items may be requested for return within 14 days in original condition. See Shipping & Returns for details." },
  { q: "Do you ship internationally?", a: "GDP Clothing's online checkout currently supports Canadian shipping addresses. Contact us if you have a request outside Canada." },
  { q: "What printing methods do you use?", a: "GDP Clothing supports in-house custom apparel production and configured partner fulfillment depending on the product. The product or order workflow identifies the applicable fulfillment path." },
];

const POLICIES = [
  { t: "Privacy Policy", b: "How GDP Clothing handles account, order, artwork, payment and support information.", to: "/pages/privacy" },
  { t: "Terms of Service", b: "Store terms for purchases, uploaded artwork, proof approval, payment and fulfillment.", to: "/pages/terms" },
  { t: "Shipping & Returns", b: "Canadian shipping, Saskatoon pickup, custom-order timing and return information.", to: "/pages/shipping-returns" },
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
    } catch { setError("Could not submit. Please email gdpclothings@gmail.com."); }
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 py-12">
      <Seo title="FAQ & Support" description="Get help with GDP Clothing custom designs, proofs, Canadian shipping, returns and order support." path="/faq" />
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
          <Link key={p.t} to={p.to} className="border border-border p-4 bg-card hover:border-accent transition-colors">
            <h3 className="font-bold uppercase text-sm mb-1">{p.t}</h3>
            <p className="text-xs text-muted-foreground">{p.b}</p>
          </Link>
        ))}
      </div>

      <h2 className="font-display text-3xl mb-4">CONTACT US</h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2"><MapPin size={16} className="text-accent" /> Saskatoon, SK, Canada</p>
          <p className="flex items-center gap-2"><Mail size={16} className="text-accent" /> gdpclothings@gmail.com</p>
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
              <div><label htmlFor="support-name" className="sr-only">Name</label><input id="support-name" required placeholder="Name" value={form.customerName} onChange={(e) => setForm({...form, customerName: e.target.value})} className="w-full bg-background border border-border px-3 py-2 outline-none focus:border-accent" /></div>
              <div><label htmlFor="support-email" className="sr-only">Email</label><input id="support-email" required type="email" placeholder="Email" value={form.customerEmail} onChange={(e) => setForm({...form, customerEmail: e.target.value})} className="w-full bg-background border border-border px-3 py-2 outline-none focus:border-accent" /></div>
            </div>
            <label htmlFor="support-subject" className="sr-only">Subject</label><input id="support-subject" required placeholder="Subject" value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} className="w-full bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
            <label htmlFor="support-message" className="sr-only">How can we help?</label><textarea id="support-message" required placeholder="How can we help?" rows={4} value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} className="w-full bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
            <button className="w-full bg-primary text-primary-foreground py-3 font-bold uppercase text-sm hover:opacity-90">Send Message</button>
          </form>
        )}
      </div>
    </div>
  );
}