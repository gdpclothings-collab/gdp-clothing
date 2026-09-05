import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle, Package, Mail } from "lucide-react";
import { customerApi } from "@/lib/customerApi";\nimport Seo from "@/components/Seo";

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
    <div className="max-w-[800px] mx-auto px-4 py-16 text-center">\n      <Seo title="Order Confirmation" description="GDP Clothing order confirmation." path={`/order/${orderNumber}`} noIndex />
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
              <div key={idx} className="flex justify-between border-b border-border pb-2">
                <span>{i.quantity}× {i.name} <span className="text-muted-foreground">({i.color} {i.size})</span></span>
                <span className="font-mono">${(i.price * i.quantity).toFixed(2)}</span>
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
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3 flex-wrap">
        <Link to="/account?tab=orders" className="border border-border px-5 py-3 font-bold uppercase text-sm hover:border-accent">Track in Account</Link>
        <Link to="/shop" className="bg-primary text-primary-foreground px-5 py-3 font-bold uppercase text-sm hover:opacity-90">Keep Shopping</Link>
      </div>
      <p className="text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1"><Mail size={12} /> Questions? gdpclothings@gmail.com</p>
    </div>
  );
}