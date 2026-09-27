import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Store } from "lucide-react";
import ShippingDeliveryManager from "@/components/admin/ShippingDeliveryManager";

export default function AdminShipping() {
  const [notice, setNotice] = React.useState("");
  const notify = message => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  return <div className="min-h-screen bg-[#f6f6f7] text-[#202223]">
    <header className="sticky top-0 z-20 bg-white border-b border-[#e1e3e5] px-4 md:px-8 py-4"><div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="/admin" className="border rounded-lg p-2" aria-label="Back to admin"><ArrowLeft size={18}/></Link><div><h1 className="text-xl md:text-2xl font-semibold">Shipping & Delivery</h1><p className="text-xs text-[#6d7175] mt-0.5">Profiles, zones, rates, pickup, packages and delivery controls.</p></div></div><Link to="/" className="text-sm flex items-center gap-2"><Store size={16}/> View store</Link></div></header>
    {notice && <div className="fixed right-4 top-20 z-50 bg-[#202223] text-white px-4 py-3 rounded-lg shadow-xl text-sm">{notice}</div>}
    <main className="max-w-[1400px] mx-auto p-4 md:p-8"><ShippingDeliveryManager notify={notify}/></main>
  </div>;
}
