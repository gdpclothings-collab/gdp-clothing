import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  readStoredJson,
  removeStoredKey,
  scopedStorageKey,
  writeStoredJson,
} from "@/lib/customerStorageScope";

const CartContext = createContext(null);
const CART_KEY = "gdp_cart_v2";
const SAVED_KEY = "gdp_saved_v2";
const WISH_KEY = "gdp_wishlist_v2";
const LEGACY_KEYS = ["gdp_cart_v1", "gdp_saved_v1", "gdp_wishlist_v1"];

export function CartProvider({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const storageKeys = useMemo(() => ({
    cart: scopedStorageKey(CART_KEY, user),
    saved: scopedStorageKey(SAVED_KEY, user),
    wishlist: scopedStorageKey(WISH_KEY, user),
  }), [user?.id]);
  const storageSignature = `${storageKeys.cart}|${storageKeys.saved}|${storageKeys.wishlist}`;

  const [items, setItems] = useState([]);
  const [saved, setSaved] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loadedStorageSignature, setLoadedStorageSignature] = useState("");

  useEffect(() => {
    if (isLoadingAuth) {
      setLoadedStorageSignature("");
      return;
    }

    setItems(readStoredJson(storageKeys.cart, []));
    setSaved(readStoredJson(storageKeys.saved, []));
    setWishlist(readStoredJson(storageKeys.wishlist, []));
    setLoadedStorageSignature(storageSignature);

    // The old v1 keys were shared by every account in the browser. Remove
    // them after auth resolution so they can never leak into another user.
    LEGACY_KEYS.forEach(removeStoredKey);
  }, [
    isLoadingAuth,
    storageKeys.cart,
    storageKeys.saved,
    storageKeys.wishlist,
    storageSignature,
  ]);

  useEffect(() => {
    if (loadedStorageSignature !== storageSignature) return;
    writeStoredJson(storageKeys.cart, items);
  }, [items, loadedStorageSignature, storageSignature, storageKeys.cart]);

  useEffect(() => {
    if (loadedStorageSignature !== storageSignature) return;
    writeStoredJson(storageKeys.wishlist, wishlist);
  }, [wishlist, loadedStorageSignature, storageSignature, storageKeys.wishlist]);

  useEffect(() => {
    if (loadedStorageSignature !== storageSignature) return;
    writeStoredJson(storageKeys.saved, saved);
  }, [saved, loadedStorageSignature, storageSignature, storageKeys.saved]);

  const addItem = useCallback((item) => {
    setItems(prev => {
      const key = item.dtfSpec?.configId
        ? `dtf_${item.dtfSpec.configId}`
        : item.customDesignId
          ? `custom_${item.customDesignId}_${item.size || ""}_${item.color || ""}_${item.variant || ""}`
          : `${item.productId}_${item.variantId || ""}_${item.size || ""}_${item.color || ""}`;
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
