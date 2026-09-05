import React, { useEffect, useMemo, useState } from "react";
import {
  Star,
  Search,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import { adminReviewsApi } from "@/lib/adminReviewsApi";

function Stars({ value }) {
  const rating = Math.max(0, Math.min(5, Number(value || 0)));
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={13}
          className={index < rating ? "fill-current text-amber-500" : "text-[#ccc]"}
        />
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function ReviewsModule() {
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setReviews(await adminReviewsApi.list({ status, search }));
    } catch (err) {
      console.error("Reviews load failed:", err);
      setError(err?.message || "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const moderate = async (review, nextStatus) => {
    try {
      await adminReviewsApi.setStatus(review.id, nextStatus);
      showNotice(`Review ${nextStatus}.`);
      await load();
    } catch (err) {
      console.error("Review moderation failed:", err);
      showNotice(err?.message || "Review update failed.");
    }
  };

  const toggleVerified = async (review) => {
    try {
      await adminReviewsApi.setVerified(review.id, !review.verified);
      showNotice(review.verified ? "Verified badge removed." : "Review marked verified.");
      await load();
    } catch (err) {
      console.error("Review verification failed:", err);
      showNotice(err?.message || "Verification update failed.");
    }
  };

  const stats = useMemo(() => ({
    total: reviews.length,
    pending: reviews.filter((review) => review.status === "pending").length,
    approved: reviews.filter((review) => review.status === "approved").length,
    rejected: reviews.filter((review) => review.status === "rejected").length,
  }), [reviews]);

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        <Summary label="Visible rows" value={stats.total} />
        <Summary label="Pending" value={stats.pending} />
        <Summary label="Approved" value={stats.approved} />
        <Summary label="Rejected" value={stats.rejected} />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer, product or review text"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {["all", "pending", "approved", "rejected"].map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`h-8 px-3 rounded-full text-xs font-medium border capitalize whitespace-nowrap ${
                  status === item ? "bg-[#222] text-white border-[#222]" : "border-[#d5d5d5] bg-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#777]">Loading reviews…</div>
          ) : reviews.length === 0 ? (
            <div className="py-12 text-center">
              <Star size={24} className="mx-auto text-[#aaa]" />
              <div className="font-medium mt-3">No matching reviews</div>
            </div>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-[#e2e2e2] overflow-hidden">
                <div className="p-4 flex flex-col xl:flex-row xl:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={review.rating} />
                      <StatusPill value={review.status} />
                      {review.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-[10px] font-semibold">
                          <ShieldCheck size={11} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="font-semibold mt-3">{review.title || "Customer review"}</div>
                    <div className="text-sm text-[#555] mt-2 leading-6">{review.body || "No written review."}</div>

                    <div className="text-xs text-[#777] mt-3">
                      {review.customer_name} {review.customer_email ? `· ${review.customer_email}` : ""} · {formatDate(review.created_at)}
                    </div>
                    <div className="text-xs text-[#777] mt-1">
                      Product: {review.product_name || "Unknown product"}
                    </div>

                    {(review.images || []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(review.images || []).slice(0, 6).map((url, index) => (
                          <div key={index} className="w-16 h-16 rounded-lg overflow-hidden bg-[#f2f2f2] border border-[#e2e2e2] grid place-items-center">
                            {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-[#aaa]" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="xl:w-[240px] shrink-0 grid grid-cols-2 xl:grid-cols-1 gap-2">
                    {review.status !== "approved" && (
                      <button
                        onClick={() => moderate(review, "approved")}
                        className="h-9 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold inline-flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                    )}
                    {review.status !== "rejected" && (
                      <button
                        onClick={() => moderate(review, "rejected")}
                        className="h-9 px-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold inline-flex items-center justify-center gap-2"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    )}
                    <button
                      onClick={() => toggleVerified(review)}
                      className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-xs font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={14} /> {review.verified ? "Remove verification" : "Mark verified"}
                    </button>
                    {review.status !== "pending" && (
                      <button
                        onClick={() => moderate(review, "pending")}
                        className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-xs font-semibold"
                      >
                        Return to pending
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="text-xs text-[#777]">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function StatusPill({ value }) {
  const cls =
    value === "approved"
      ? "bg-emerald-100 text-emerald-800"
      : value === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-800";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${cls}`}>
      {value || "pending"}
    </span>
  );
}
