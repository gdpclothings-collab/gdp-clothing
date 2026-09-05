import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const CartContext = createContext(null);
const CART_KEY = "gdp_cart_v1";
const WISH_KEY = "gdp_wishlist_v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  });
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gdp_saved_v1")) || []; } catch { return []; }
  });
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY)) || []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(WISH_KEY, JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem("gdp_saved_v1", JSON.stringify(saved)); }, [saved]);

  const addItem = useCallback((item) => {
    setItems(prev => {
      const key = item.customDesignId
        ? `custom_${item.customDesignId}_${item.size || ""}_${item.color || ""}_${item.variant || ""}`
        : `${item.productId}_${item.size || ""}_${item.color || ""}`;
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i);
      }
      return [...prev, { ...item, key, quantity: item.quantity || 1 }];
    });
  }, []);

  const updateQty = useCallback((key, quantity) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, quantity: Math.max(1, quantity) } : i));
  }, []);

  const removeItem = useCallback((key) => {
    setItems(prev => prev.filter(i => i.key !== key));
  }, []);

  const saveForLater = useCallback((key) => {
    setItems(prev => {
      const item = prev.find(i => i.key === key);
      if (item) setSaved(s => [...s, item]);
      return prev.filter(i => i.key !== key);
    });
  }, []);

  const moveToCart = useCallback((key) => {
    setSaved(prev => {
      const item = prev.find(i => i.key === key);
      if (item) addItem(item);
      return prev.filter(i => i.key !== key);
    });
  }, [addItem]);

  const clearCart = useCallback(() => setItems([]), []);

  const toggleWishlist = useCallback((productId) => {
    setWishlist(prev => prev.includes(productId) ? prev.filter(p => p !== productId) : [...prev, productId]);
  }, []);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, saved, wishlist, addItem, updateQty, removeItem, saveForLater, moveToCart,
      clearCart, toggleWishlist, subtotal, itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};