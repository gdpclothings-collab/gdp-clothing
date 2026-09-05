import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Heart } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";

export default function ProductCard({ product }) {
  const { wishlist, toggleWishlist } = useCart();
  const wished = product.id ? wishlist.includes(product.id) : false;
  const hasSecondImage = Boolean(product.images?.[1]);

  return (
    <article className="group relative min-w-0">
      <Link to={"/product/" + product.id} className="relative block overflow-hidden bg-[#e9e7e1]">
        <div className="aspect-[3/4] overflow-hidden">
          <Image
            src={product.images?.[0]}
            alt={product.name}
            fittingType="fill"
            className={"h-full w-full object-cover transition-all duration-700 " + (hasSecondImage ? "group-hover:opacity-0 group-hover:scale-[1.02]" : "group-hover:scale-[1.035]")}
          />
          {hasSecondImage && (
            <Image
              src={product.images?.[1]}
              alt=""
              fittingType="fill"
              className="absolute inset-0 h-full w-full scale-[1.02] object-cover opacity-0 transition-all duration-700 group-hover:scale-100 group-hover:opacity-100"
            />
          )}
        </div>

        <div className="absolute left-2.5 top-2.5 flex max-w-[70%] flex-wrap gap-1.5 sm:left-3 sm:top-3">
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="bg-[#e11d2e] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white sm:text-[9px]">Sale</span>
          )}
          {product.bestSeller && (
            <span className="bg-black px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white sm:text-[9px]">Best seller</span>
          )}
          {product.newArrival && (
            <span className="bg-white px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-black sm:text-[9px]">New drop</span>
          )}
        </div>

        <div className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-between bg-black/88 px-3 py-2.5 text-white opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="text-[9px] font-black uppercase tracking-[0.14em]">View piece</span>
          <ArrowUpRight size={14} />
        </div>
      </Link>

      <button
        onClick={(event) => {
          event.preventDefault();
          product.id && toggleWishlist(product.id);
        }}
        className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow-sm backdrop-blur transition hover:bg-black hover:text-white sm:right-3 sm:top-3 lg:opacity-0 lg:group-hover:opacity-100"
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart size={14} className={wished ? "fill-[#e11d2e] text-[#e11d2e]" : ""} />
      </button>

      <div className="border-b border-black/15 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-black/38 sm:text-[9px]">{product.type || "GDP Clothing"}</p>
            <h3 className="mt-1 truncate text-xs font-bold sm:text-sm">
              <Link to={"/product/" + product.id} className="transition hover:text-[#e11d2e]">{product.name}</Link>
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <span className="font-mono text-xs sm:text-sm">${Number(product.price || 0).toFixed(2)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="block text-[10px] text-black/35 line-through">${Number(product.compareAtPrice).toFixed(2)}</span>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.13em] text-black/38 sm:text-[9px]">
          <span>{product.customDesignable ? "Customizable" : "Ready to wear"}</span>
          <span>CAD</span>
        </div>
      </div>
    </article>
  );
}
