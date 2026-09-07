import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SeasonalArtworkSettings from "./SeasonalArtworkSettings";

export default function ArtworkLibraryTab() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    supabase.from("artwork_library")
      .select("*")
      .order("title").then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) setError("The artwork library is not available yet. Its database setup may still be pending.");
        else setRows(data || []);
        setLoading(false);
      }).catch(() => {
        if (active) { setError("Could not load artwork. Please try again later."); setLoading(false); }
      });
    return () => { active = false; };
  }, []);
  const needle = query.trim().toLowerCase();
  const collections = [...new Set(rows.map(row => row.category))].sort();
  const visible = rows.filter(row => (!collection || row.category === collection) && [row.title, row.category, ...(row.tags || [])].join(" ").toLowerCase().includes(needle))
    .sort((a, b) => a.category.localeCompare(b.category) || (a.metadata?.rank_in_collection || 999) - (b.metadata?.rank_in_collection || 999) || a.title.localeCompare(b.title));
  return <section className="rounded-xl border bg-white p-5">
    <h2 className="text-lg font-semibold">Artwork library</h2>
    <p className="text-sm text-gray-600 mt-1">Staff design candidates. Drafts are unavailable to shoppers until rights, production files and print proofs are verified.</p>
    <label className="block mt-4 text-sm">Season or holiday
      <select className="block border rounded p-2 mt-1 w-full" value={collection} onChange={event => setCollection(event.target.value)}>
        <option value="">All collections</option>
        {collections.map(category => <option key={category} value={category}>{category} ({rows.filter(row => row.category === category).length})</option>)}
      </select>
    </label>
    <label className="block mt-4 text-sm">Search artwork
      <input className="block border rounded p-2 mt-1 w-full" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, category or tag" />
    </label>
    {loading && <p role="status" className="py-6">Loading artwork…</p>}
    {error && <p role="alert" className="py-6 text-red-700">{error}</p>}
    {!loading && !error && <p role="status" className="mt-4 text-sm">{visible.length} artworks shown</p>}
    {!loading && !error && visible.length === 0 && <p className="py-6">No artwork matches.</p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
      {visible.map(row => <article key={row.id} className="border rounded-lg overflow-hidden">
        {row.preview_data_url && <img src={row.preview_data_url} alt={row.title} loading="lazy" className="w-full h-56 object-contain bg-gray-300" />}
        <div className="p-4"><h3 className="font-semibold">{row.title}</h3>
          <p className="text-sm mt-1">{row.category} · {row.status}</p>
          <p className="text-xs mt-2">{(row.tags || []).join(" · ")}</p>
          <p className="text-sm mt-2">{row.metadata?.rationale}</p>
          <p className="text-xs mt-3">Rights: {row.rights_status} · Ready-print: {row.ready_print ? "On" : "Off"} · Customizable: {row.customizable ? "On" : "Off"}</p>
          <p className="text-xs mt-2">{row.metadata?.production?.vector_source ? "Scalable vector source; garment size and fine lines require a print proof." : `Maximum ink size at 300 ppi: ${(row.metadata?.production?.max_ink_inches_at_300ppi || []).join(" × ")} inches`}</p>
          {row.metadata?.customization_mode === "name-or-monogram-frame" && <p className="text-xs mt-2">Personalization frame — add a name or monogram before printing.</p>}
          {(row.metadata?.review_flags || []).map(flag => <p key={flag} className="text-xs mt-2 text-amber-800">{flag}</p>)}
          <p className="text-xs mt-2">Source lettering is rasterized or outlined. Added personalization requires a separate text layer and proof.</p>
          <SeasonalArtworkSettings row={row} onSaved={updated => setRows(current => current.map(item => item.id === updated.id ? updated : item))} />
        </div>
      </article>)}
    </div>
  </section>;
}

