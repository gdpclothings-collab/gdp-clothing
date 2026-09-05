import React, { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";

const SUGGESTIONS = [
  "How does custom design work?",
  "What size should I order?",
  "How long does production take?",
  "Do you ship to the US?",
  "What's your return policy?",
];

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (q) => {
    if (!q.trim() || loading) return;
    const userMsg = q;
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);
    try {
      const q = userMsg.toLowerCase();
      let text = "I can help with custom designs, sizing, production, shipping and returns. For private order details, sign in and open My Account.";
      if (q.includes("custom") || q.includes("design")) text = "Choose a customizable product, open Custom Studio, upload your photos securely, choose your style and personalization, then approve the digital proof before printing.";
      else if (q.includes("size")) text = "Use the size options shown on each product page. If you're between sizes or want an oversized fit, choose the larger size.";
      else if (q.includes("production") || q.includes("turnaround")) text = "Custom production starts after proof approval. Standard turnaround is typically several business days, with timing shown on the product/customization flow.";
      else if (q.includes("ship") || q.includes("delivery")) text = "GDP Clothing supports shipping and Saskatoon local pickup. Shipping cost and available options are calculated during checkout.";
      else if (q.includes("return") || q.includes("refund")) text = "Stock items may be eligible for returns under the posted policy. Custom items are generally non-returnable unless defective because they are made specifically for you.";
      setMessages(m => [...m, { role: "assistant", text }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-accent text-accent-foreground rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        aria-label="Ask GDP AI"
      >
        <Sparkles size={22} />
      </button>

      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-50 w-full sm:w-96 h-[80vh] sm:h-[560px] bg-background border border-border shadow-2xl flex flex-col">
          <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <div>
                <div className="font-display text-xl leading-none">GDP ASSISTANT</div>
                <div className="font-mono text-[10px] text-primary-foreground/60 uppercase">Your design concierge</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">Hey! I'm your GDP Clothing assistant. Ask me anything about custom apparel, DTF printing, sizing, shipping or returns.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => ask(s)}
                      className="text-xs border border-border px-2.5 py-1.5 hover:border-accent hover:text-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block max-w-[85%] px-3 py-2 ${m.role === "user" ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-muted-foreground font-mono">● ● ●</div>}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="border-t border-border p-3 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask GDP…" className="flex-1 bg-secondary border border-border px-3 py-2 text-sm outline-none focus:border-accent" />
            <button type="submit" disabled={loading} className="bg-primary text-primary-foreground px-4 hover:opacity-90" aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}