import React from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";

export default function ProductCard({ product }) {
  const { wishlist, toggleWishlist } = useCart();
  const wished = product.id ? wishlist.includes(product.id) : false;

  return (
    <article className="group relative">
      <Link to={`/product/${product.id}`} className="block overflow-hidden bg-secondary">
        <div className="aspect-[3/4] overflow-hidden">
          <Image
            src={product.images?.[0]}
            alt={product.name}
            fittingType="fill"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <span className="absolute top-3 left-3 bg-destructive text-destructive-foreground font-mono text-[10px] px-2 py-1 uppercase tracking-wide">
            Sale
          </span>
        )}
        {product.bestSeller && (
          <span className="absolute top-3 right-3 bg-accent text-accent-foreground font-mono text-[10px] px-2 py-1 uppercase tracking-wide">
            Best Seller
          </span>
        )}
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); product.id && toggleWishlist(product.id); }}
        className="absolute top-3 right-3 p-1.5 bg-background/80 backdrop-blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Add to wishlist"
      >
        <Heart size={14} className={wished ? "fill-destructive text-destructive" : ""} />
      </button>
      <div className="mt-3 flex justify-between items-start gap-2">
        <div>
          <h3 className="font-medium text-sm leading-tight">
            <Link to={`/product/${product.id}`} className="hover:text-accent">{product.name}</Link>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono uppercase tracking-wide">{product.type}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono text-sm">${product.price?.toFixed(2)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="block text-xs text-muted-foreground line-through">${product.compareAtPrice?.toFixed(2)}</span>
          )}
        </div>
      </div>
    </article>
  );
}