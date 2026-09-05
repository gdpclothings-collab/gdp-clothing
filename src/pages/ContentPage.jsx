import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { storefrontContentApi } from "@/lib/storefrontContentApi";

export default function ContentPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const result = await storefrontContentApi.getPage(slug);
        if (!active) return;
        if (!result) {
          setPage(null);
          setNotFound(true);
          return;
        }
        setPage(result);
      } catch (error) {
        console.error("Content page load failed:", error);
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!page) return;
    const originalTitle = document.title;
    const title = page.seo?.title || page.title;
    document.title = `${title} · GDP Clothing`;

    const description = page.seo?.description || page.excerpt || "";
    let meta = document.querySelector('meta[name="description"]');
    const previous = meta?.getAttribute("content") || "";
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    if (description) meta.setAttribute("content", description);

    return () => {
      document.title = originalTitle;
      if (meta) meta.setAttribute("content", previous);
    };
  }, [page]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-20">
        <div className="text-sm text-muted-foreground">Loading page…</div>
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-20 text-center">
        <h1 className="font-display text-5xl">PAGE NOT FOUND</h1>
        <p className="text-muted-foreground mt-3">
          This GDP Clothing page is unavailable or has not been published.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide hover:text-accent"
        >
          <ArrowLeft size={15} /> Back home
        </Link>
      </div>
    );
  }

  const content = String(page.body?.content || "");

  return (
    <article className="max-w-4xl mx-auto px-4 lg:px-8 py-10 md:py-16">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
        {page.page_type || "Page"}
      </div>
      <h1 className="font-display text-5xl md:text-7xl leading-none mt-3">
        {page.title}
      </h1>
      {page.excerpt && (
        <p className="mt-5 text-lg text-muted-foreground leading-7 max-w-3xl">
          {page.excerpt}
        </p>
      )}

      <div className="mt-10 border-t border-border pt-8">
        {content ? (
          <div className="whitespace-pre-wrap text-base md:text-lg leading-8 text-foreground/90">
            {content}
          </div>
        ) : (
          <p className="text-muted-foreground">This page has no content yet.</p>
        )}
      </div>
    </article>
  );
}
