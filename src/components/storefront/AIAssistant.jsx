import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  PackageSearch,
  Palette,
  Printer,
  RotateCcw,
  Send,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";

const STORAGE_KEY = "gdp-assistant-messages-v2";

const STARTER_ACTIONS = [
  {
    label: "Custom design",
    prompt: "How does custom design work?",
    icon: Palette,
  },
  {
    label: "DTF printing",
    prompt: "Tell me about DTF printing and gang sheets.",
    icon: Printer,
  },
  {
    label: "Find my size",
    prompt: "What size should I order?",
    icon: ShoppingBag,
  },
  {
    label: "Order help",
    prompt: "How can I check my order?",
    icon: PackageSearch,
  },
];

const HIDDEN_ROUTES = ["/custom-studio", "/design", "/checkout"];

const normalize = (value) => value.trim().toLowerCase();

function getResponse(message) {
  const q = normalize(message);

  if (/^(hi|hey|hello|yo|good morning|good afternoon|good evening)[!. ]*$/.test(q)) {
    return {
      text: "Hey! What can I help you with today — custom apparel, DTF printing, sizing, shipping, or an order question?",
    };
  }

  if (q.includes("custom") || q.includes("design") || q.includes("photo bootleg") || q.includes("memorial")) {
    return {
      text: "Start in Custom Studio. Choose your design path, garment, artwork or photos, personalize the layout, review the live preview, then continue when everything looks right.",
      action: { label: "Open Custom Studio", path: "/custom-studio" },
    };
  }

  if (q.includes("dtf") || q.includes("gang sheet") || q.includes("gangsheet") || q.includes("film") || q.includes("print ready")) {
    return {
      text: "For DTF, you can upload a print-ready gang sheet or build one in the GDP gang-sheet workspace. Your artwork stays arranged in the film preview before you add it to your bag.",
      action: { label: "Explore DTF Printing", path: "/dtf" },
    };
  }

  if (q.includes("size") || q.includes("fit") || q.includes("oversize") || q.includes("oversized")) {
    return {
      text: "Use the garment size guide and measurements shown with the product. If you are between sizes, compare the garment measurements with a shirt or hoodie you already like before ordering.",
      action: { label: "Shop Garments", path: "/shop" },
    };
  }

  if (q.includes("production") || q.includes("turnaround") || q.includes("how long") || q.includes("ready")) {
    return {
      text: "Production timing depends on the product and customization. Custom production begins after the design or proof is approved, and the applicable timing should be shown before checkout.",
    };
  }

  if (q.includes("ship") || q.includes("delivery") || q.includes("pickup") || q.includes("u.s") || q.includes("usa") || q.includes("united states")) {
    return {
      text: "Shipping and pickup options are confirmed during checkout. Enter your delivery address to see the available methods and calculated cost for your location.",
    };
  }

  if (q.includes("return") || q.includes("refund") || q.includes("exchange")) {
    return {
      text: "Return eligibility depends on the item and whether it was customized. Review GDP Clothing's posted policy before ordering, especially for made-to-order or personalized pieces.",
      action: { label: "View FAQ", path: "/faq" },
    };
  }

  if (q.includes("order") || q.includes("track") || q.includes("status") || q.includes("where is my")) {
    return {
      text: "For private order details, sign in and open My Account. That keeps order information out of the public chat.",
      action: { label: "Open My Account", path: "/account" },
    };
  }

  if (q.includes("shop") || q.includes("product") || q.includes("tee") || q.includes("t-shirt") || q.includes("hoodie") || q.includes("sweater")) {
    return {
      text: "You can browse GDP ready-to-wear and customizable garments in the shop. Product pages show the available colors, sizes, stock status, and customization options.",
      action: { label: "Shop GDP", path: "/shop" },
    };
  }

  if (q.includes("pay") || q.includes("payment") || q.includes("card") || q.includes("checkout")) {
    return {
      text: "Available payment options are shown securely during checkout after your contact, shipping, and order details are entered.",
    };
  }

  return {
    text: "I didn't quite catch that. Try asking me about Custom Studio, DTF printing, sizing, production time, shipping, returns, or an order. For account-specific details, use My Account.",
    showStarters: true,
  };
}

function loadStoredMessages() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

export default function AIAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  const hiddenForPurchaseFlow =
    HIDDEN_ROUTES.some(
      (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
    ) || location.pathname.startsWith("/order/");

  useEffect(() => {
    if (hiddenForPurchaseFlow) setOpen(false);
  }, [hiddenForPurchaseFlow]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // Session persistence is a convenience only. Chat still works if storage is unavailable.
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 639px)").matches) {
      document.body.style.overflow = "hidden";
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 120);
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, open]);

  const clearConversation = () => {
    setMessages([]);
    setInput("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const ask = async (value) => {
    const userMsg = value.trim();
    if (!userMsg || loading) return;

    setMessages((current) => [...current, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const response = getResponse(userMsg);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.text,
          action: response.action,
          showStarters: response.showStarters,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (hiddenForPurchaseFlow) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:right-5"
          aria-label="Open GDP Assistant"
        >
          <Sparkles size={18} aria-hidden="true" />
          <span>Ask GDP</span>
        </button>
      )}

      {open && (
        <section
          className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-background sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:max-w-[calc(100vw-2.5rem)] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="GDP Clothing Assistant"
        >
          <header
            className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-primary px-4 pb-3 text-primary-foreground sm:pt-4"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Sparkles size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg leading-none tracking-wide">GDP ASSISTANT</div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary-foreground/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  Shopping + custom print help
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearConversation}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground/70 transition hover:bg-white/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label="Start a new conversation"
                  title="New conversation"
                >
                  <RotateCcw size={18} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground/80 transition hover:bg-white/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="Close GDP Assistant"
              >
                <X size={21} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background px-4 py-4"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="space-y-5">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
                    <MessageCircle size={15} aria-hidden="true" />
                  </div>
                  <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-sm leading-relaxed text-foreground">
                    Hey! I’m the GDP Clothing assistant. I can help you find the right product, understand Custom Studio, build a DTF order, choose a size, or find order help.
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Popular questions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {STARTER_ACTIONS.map(({ label, prompt, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => ask(prompt)}
                        className="flex min-h-16 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-3 text-left text-xs font-medium text-foreground transition hover:border-accent hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <Icon size={17} className="shrink-0 text-accent" aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-secondary/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Don’t share passwords or payment details here. For private order information, use My Account.
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={`${message.role}-${index}-${message.text.slice(0, 12)}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[86%] ${isUser ? "text-right" : "text-left"}`}>
                      <div
                        className={`inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed ${
                          isUser
                            ? "rounded-tr-md bg-accent text-accent-foreground"
                            : "rounded-tl-md bg-secondary text-foreground"
                        }`}
                      >
                        {message.text}
                      </div>

                      {!isUser && message.action && (
                        <button
                          type="button"
                          onClick={() => goTo(message.action.path)}
                          className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {message.action.label}
                        </button>
                      )}

                      {!isUser && message.showStarters && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {STARTER_ACTIONS.slice(0, 3).map(({ label, prompt }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => ask(prompt)}
                              className="min-h-9 rounded-full border border-border px-3 text-[11px] font-medium text-muted-foreground transition hover:border-accent hover:text-accent"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5 text-xs font-mono text-muted-foreground">
                    ● ● ●
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
            className="shrink-0 border-t border-border bg-background px-3 pt-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="gdp-assistant-input">
                Ask GDP a question
              </label>
              <input
                ref={inputRef}
                id="gdp-assistant-input"
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 500))}
                placeholder="Ask about products, custom orders, DTF…"
                autoComplete="off"
                enterKeyHint="send"
                className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-secondary px-3.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
