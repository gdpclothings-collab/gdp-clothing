import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle, Package, Mail } from "lucide-react";
import { customerApi } from "@/lib/customerApi";

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const status = params.get("status") || "pending_payment";
  const paymentConfigured = params.get("configured") === "1";
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let active = true;
    const token = params.get("token");
    customerApi.getOrderConfirmation(orderNumber, token)
      .then((row) => {
        if (active) setOrder(row);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [orderNumber]);

  const paid = status === "paid" || status === "success" || (order?.paymentStatus === "paid");

  return (
    <div className="max-w-[800px] mx-auto px-4 py-16 text-center">
      {paid ? <CheckCircle2 size={64} className="mx-auto text-accent mb-4" /> : <Clock size={64} className="mx-auto text-accent mb-4" />}
      <h1 className="font-display text-5xl md:text-6xl leading-none">ORDER {paid ? "CONFIRMED" : "RECEIVED"}</h1>
      <p className="font-mono text-sm mt-3 text-muted-foreground">ORDER # {orderNumber}</p>

      <p className="mt-4 text-muted-foreground max-w-md mx-auto">
        {paid
          ? "Thank you! Your payment was successful. Your order is saved and ready for the next step."
          : paymentConfigured
            ? "Your order is saved. Complete payment to confirm production."
            : "Your order is saved. Our team will send a secure payment link to your email shortly to confirm production."}
      </p>

      {!paymentConfigured && !paid && (
        <div className="mt-6 inline-flex items-center gap-2 text-sm bg-accent/10 text-accent px-4 py-2">
          <AlertTriangle size={16} /> Online payment is being set up — you'll receive an invoice link by email.
        </div>
      )}

      {order && (
        <div className="mt-8 border border-border bg-card p-6 text-left">
          <h2 className="font-display text-2xl mb-4">ORDER DETAILS</h2>
          <div className="space-y-2 text-sm">
            {order.items?.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  {i.image && <img src={i.image} alt={i.isCustom ? "Approved final custom preview" : ""} className="h-20 w-20 shrink-0 rounded-lg border border-border bg-[#f3eee6] object-contain" />}
                  <span>{i.quantity}× {i.name} <span className="text-muted-foreground">({i.color} {i.size})</span>{i.isCustom && <span className="mt-1 block text-xs font-semibold text-emerald-700">Approved final preview</span>}</span>
                </div>
                <span className="shrink-0 font-mono">${(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold mt-4 pt-3 border-t border-border">
            <span>Total</span><span className="font-mono">${order.total?.toFixed(2)} CAD</span>
          </div>
          {order.status === "artwork_needed" && (
            <div className="mt-4 bg-accent/10 p-3 text-sm flex items-center gap-2">
              <Package size={16} className="text-accent" /> Your order includes custom items. A designer will prepare a digital proof for your approval in your account portal.
            </div>
          )}
          {paid && order.items?.some((item) => item.isCustom) && order.status !== "artwork_needed" && (
            <div className="mt-4 bg-emerald-50 p-3 text-sm flex items-center gap-2 text-emerald-900">
              <Package size={16} className="text-emerald-700" /> The approved preview shown above is locked. Its matching 300 DPI artwork is now in the production queue.
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3 flex-wrap">
        <Link to="/account?tab=orders" className="border border-border px-5 py-3 font-bold uppercase text-sm hover:border-accent">Track in Account</Link>
        <Link to="/shop" className="bg-primary text-primary-foreground px-5 py-3 font-bold uppercase text-sm hover:opacity-90">Keep Shopping</Link>
      </div>
      <p className="text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1"><Mail size={12} /> Questions? hello@gdpclothing.ca</p>
    </div>
  );
}
