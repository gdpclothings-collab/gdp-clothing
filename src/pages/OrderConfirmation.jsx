import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Package, Mail } from "lucide-react";
import { customerApi } from "@/lib/customerApi";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { scopedStorageKey } from "@/lib/customerStorageScope";

const FORM_KEY = "gdp_checkout_form_v3";

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { clearCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    let intervalId = null;
    let timeoutId = null;

    const refresh = async () => {
      try {
        const row = await customerApi.getOrderConfirmation(orderNumber, token);
        if (!active) return;
        setOrder(row);
        setLoading(false);
        if (row?.paymentStatus && row.paymentStatus !== "pending" && intervalId) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    refresh();
    intervalId = window.setInterval(refresh, 2000);
    timeoutId = window.setTimeout(() => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = null;
    }, 60000);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [orderNumber, token]);

  const paid = order?.paymentStatus === "paid";
  const failed = order?.paymentStatus === "failed" || order?.status === "payment_failed";
  const pending = Boolean(order && !paid && !failed);

  useEffect(() => {
    if (!paid) return;
    try {
      localStorage.removeItem(scopedStorageKey("gdp_checkout_session_v2", user));
      sessionStorage.removeItem(FORM_KEY);
    } catch {}
    clearCart();
  }, [paid, user, clearCart]);

  const heading = paid ? "ORDER CONFIRMED" : failed ? "PAYMENT NOT COMPLETED" : loading ? "VERIFYING PAYMENT" : "PAYMENT PENDING";

  return (
    <div className="max-w-[800px] mx-auto px-4 py-16 text-center">
      {paid ? (
        <CheckCircle2 size={64} className="mx-auto text-accent mb-4" />
      ) : failed ? (
        <AlertTriangle size={64} className="mx-auto text-destructive mb-4" />
      ) : (
        <Clock size={64} className="mx-auto text-accent mb-4" />
      )}
      <h1 className="font-display text-5xl md:text-6xl leading-none">{heading}</h1>
      <p className="font-mono text-sm mt-3 text-muted-foreground">ORDER # {orderNumber}</p>

      <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
        {paid
          ? "Thank you! Your payment has been confirmed by our secure payment system. Your order is saved and ready for the next step."
          : failed
            ? "Your order was saved, but payment was not completed. Your cart has been kept so you can safely try payment again."
            : loading
              ? "We are checking the secure server for the latest payment status."
              : "Your order is saved, but payment has not been confirmed yet. If you closed or cancelled Affirm, Klarna, or another payment window, production has not started and your cart is still kept."}
      </p>

      {pending && (
        <div className="mt-6 inline-flex items-center gap-2 text-sm bg-amber-50 text-amber-950 px-4 py-2 border border-amber-200">
          <Clock size={16} /> Payment is not confirmed yet. This page will check again automatically.
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
          {paid && order.status === "artwork_needed" && (
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
        {!paid && <Link to="/checkout/payment" className="bg-primary text-primary-foreground px-5 py-3 font-bold uppercase text-sm hover:opacity-90">Return to Checkout</Link>}
        <Link to="/account?tab=orders" className="border border-border px-5 py-3 font-bold uppercase text-sm hover:border-accent">Track in Account</Link>
        {paid && <Link to="/shop" className="bg-primary text-primary-foreground px-5 py-3 font-bold uppercase text-sm hover:opacity-90">Keep Shopping</Link>}
      </div>
      <p className="text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1"><Mail size={12} /> Questions? hello@gdpclothing.ca</p>
    </div>
  );
}
