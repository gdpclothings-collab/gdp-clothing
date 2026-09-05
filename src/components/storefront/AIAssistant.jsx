import React, { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the GDP Clothing shopping assistant for a Saskatoon custom apparel & print-on-demand streetwear brand. Slogan: "Design Your Dream, Wear Your Vision!". Answer the customer question helpfully, concisely, and on-brand. If asked about a specific order or account info, tell them to sign in and check their account portal, since you can't access private data here. Question: ${userMsg}`,
      });
      const text = typeof res === "string" ? res : res?.output || JSON.stringify(res);
      setMessages(m => [...m, { role: "assistant", text }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "I'm having trouble right now. Please reach out via our Contact page or open a support request." }]);
    }
    setLoading(false);
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