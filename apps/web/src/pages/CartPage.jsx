import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useCart } from '@/context/CartContext';
import { MOQ } from '@/lib/storeMap';
import { WHATSAPP_URL } from '@/lib/site';

const formatINR = (cents) => `\u20b9${(cents / 100).toFixed(2)}`;

const CartPage = () => {
  const { items, updateQuantity, removeItem, totalPriceCents, hasBelowMoq } = useCart();
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Your Cart — Iconic Handicraft</title>
      </Helmet>

      <section className="pt-32 md:pt-40 pb-16 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <Breadcrumbs items={[{ label: 'Cart' }]} />
          <span className="text-gold tracking-[0.35em] uppercase text-xs mt-6 block">Your Selection</span>
          <h1 className="font-display text-primary text-4xl md:text-6xl mt-4 leading-tight">Shopping Cart</h1>
        </div>
      </section>

      <section className="pb-24 md:pb-32">
        <div className="mx-auto max-w-[90rem] px-6">
          {items.length === 0 ? (
            <div className="text-center py-24 bg-white border border-border rounded-[2rem]">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-5" strokeWidth={1.25} />
              <p className="font-display text-2xl text-primary mb-3">Your cart is empty</p>
              <p className="text-muted-foreground font-light mb-6">Browse our collections to add products.</p>
              <Link to="/collections" className="inline-block px-7 py-3 rounded-full bg-primary text-primary-foreground text-sm">
                Explore Collections
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-5">
                {items.map((item) => (
                  <div key={item.variant.id} className="flex gap-5 bg-white border border-border rounded-2xl p-5">
                    {item.product.image && (
                      <img src={item.product.image} alt={item.product.title} className="h-28 w-28 rounded-xl object-contain bg-secondary/40 border border-border flex-shrink-0" draggable={false} onContextMenu={(e) => e.preventDefault()} />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl text-primary mb-1 truncate">{item.product.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{formatINR(item.variant.price_in_cents)} / piece</p>

                      {item.quantity < MOQ && (
                        <p className="text-destructive text-xs mb-2">
                          Minimum Order Quantity is {MOQ} pieces. Please increase your quantity to continue.
                        </p>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-border rounded-full overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.variant.id, item.quantity - 1)}
                            className="h-9 w-9 flex items-center justify-center hover:bg-secondary"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            min={MOQ}
                            onChange={(e) => updateQuantity(item.variant.id, parseInt(e.target.value, 10) || 0)}
                            className="w-16 text-center text-sm outline-none"
                          />
                          <button
                            onClick={() => updateQuantity(item.variant.id, item.quantity + 1)}
                            className="h-9 w-9 flex items-center justify-center hover:bg-secondary"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.variant.id)}
                          className="h-9 w-9 flex items-center justify-center rounded-full border border-border text-destructive hover:bg-destructive/10"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="font-display text-xl text-primary flex-shrink-0">
                      {formatINR(item.variant.price_in_cents * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-border rounded-2xl p-7 h-fit">
                <h3 className="font-display text-2xl text-primary mb-5">Order Summary</h3>
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>Items</span>
                  <span>{items.reduce((s, i) => s + i.quantity, 0)} pieces</span>
                </div>
                <div className="flex justify-between text-lg text-primary font-medium mb-6 pt-4 border-t border-border">
                  <span>Total</span>
                  <span>{formatINR(totalPriceCents)}</span>
                </div>

                <button
                  disabled={hasBelowMoq}
                  onClick={() => navigate('/checkout')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Proceed to Checkout <ArrowRight className="h-4 w-4" />
                </button>

                <div className="mt-6 p-4 rounded-xl bg-gold/10 text-sm text-primary">
                  Need more than the selected quantity? Request a Bulk Quote for discounted wholesale pricing.
                </div>
                <Link
                  to="/request-quote"
                  className="mt-3 w-full inline-flex items-center justify-center rounded-full border border-primary text-primary py-3 text-sm tracking-wide hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  Request Bulk Quote
                </Link>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 w-full inline-flex items-center justify-center rounded-full border border-border text-muted-foreground py-3 text-sm tracking-wide hover:border-gold hover:text-primary transition-all"
                >
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default CartPage;
