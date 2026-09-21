import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MOQ } from '@/lib/storeMap';

const CART_KEY = 'e-commerce-cart';
const CartContext = createContext(null);

const readCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === CART_KEY) setItems(readCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback((entry, quantity = MOQ) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant.id === entry.variantId);
      const qty = Math.max(quantity, MOQ);
      const shipping = entry.shipping || null;
      if (existing) {
        return prev.map((i) =>
          i.variant.id === entry.variantId
            ? {
                ...i,
                quantity: Math.max(i.quantity + quantity, MOQ),
                // Refresh shipping meta if a newer add provides it
                shipping: shipping || i.shipping || null,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          product: { id: entry.productId, title: entry.title, image: entry.image },
          variant: {
            id: entry.variantId,
            price_in_cents: entry.price_in_cents,
            currency: entry.currency,
            title: entry.variantTitle || null,
            sku: entry.sku || null,
            weight: entry.weight ?? null,
          },
          quantity: qty,
          shipping,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((variantId, quantity) => {
    setItems((prev) =>
      prev.map((i) => (i.variant.id === variantId ? { ...i, quantity: Math.max(MOQ, quantity) } : i))
    );
  }, []);

  const removeItem = useCallback((variantId) => {
    setItems((prev) => prev.filter((i) => i.variant.id !== variantId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalPriceCents = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * (i.variant.price_in_cents || 0), 0),
    [items]
  );
  const hasBelowMoq = useMemo(() => items.some((i) => i.quantity < MOQ), [items]);

  const value = {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    totalCount,
    totalPriceCents,
    hasBelowMoq,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
