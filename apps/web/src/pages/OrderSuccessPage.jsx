import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Package, CreditCard, MapPin, Phone } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { WHATSAPP_URL } from '@/lib/site';

const formatINR = (cents) => `\u20b9${(cents / 100).toFixed(2)}`;

const OrderSuccessPage = () => {
  const { clearCart } = useCart();
  const location = useLocation();
  const state = location.state || {};

  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { order_id, payment_id, customer, items, total } = state;

  return (
    <>
      <Helmet>
        <title>Order Confirmed — Iconic Handicraft</title>
        <meta name="description" content="Your order has been placed successfully." />
      </Helmet>
      <section className="min-h-[70vh] pt-32 pb-20 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-2xl px-6">
          <div className="text-center mb-10">
            <CheckCircle2 className="h-16 w-16 text-gold mx-auto mb-6" strokeWidth={1.25} />
            <h1 className="font-display text-primary text-4xl md:text-5xl mb-3">Order Confirmed!</h1>
            <p className="text-muted-foreground font-light text-lg">
              Thank you! Your order has been placed successfully.
            </p>
          </div>

          {/* Order Details */}
          <div className="bg-white border border-border rounded-2xl p-7 space-y-6 mb-6">
            <div>
              <h2 className="font-display text-2xl text-primary mb-4">Order Details</h2>
              <div className="space-y-2 text-sm">
                {order_id && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Order Number</span>
                    <span className="text-primary font-medium">{order_id}</span>
                  </div>
                )}
                {payment_id && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Payment ID</span>
                    <span className="text-primary font-medium">{payment_id}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Payment Status</span>
                  <span className="text-green-700 font-medium">✓ Paid</span>
                </div>
                {total && (
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="text-primary font-medium">{formatINR(total)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            {items && items.length > 0 && (
              <div>
                <h3 className="font-display text-xl text-primary mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-gold" strokeWidth={1.5} /> Items Ordered
                </h3>
                <div className="space-y-2">
                  {items.map((i) => (
                    <div key={i.variant.id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                      <span className="text-muted-foreground">{i.product.title} × {i.quantity}</span>
                      <span className="text-primary">{formatINR(i.variant.price_in_cents * i.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer & Shipping */}
            {customer && (
              <div className="grid sm:grid-cols-2 gap-6">
                {customer.email && (
                  <div>
                    <h3 className="font-display text-xl text-primary mb-2 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-gold" strokeWidth={1.5} /> Billing
                    </h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{customer.name}</p>
                      <p>{customer.email}</p>
                      <p>{customer.phone}</p>
                      {customer.gst && <p>GST: {customer.gst}</p>}
                    </div>
                  </div>
                )}
                {customer.address && (
                  <div>
                    <h3 className="font-display text-xl text-primary mb-2 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-gold" strokeWidth={1.5} /> Shipping
                    </h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{customer.address}</p>
                      <p>{customer.city}, {customer.state} — {customer.pincode}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 rounded-xl bg-gold/10 text-sm text-primary">
              <strong>Estimated processing time: 3–5 business days.</strong> Our team will reach out with shipping details.
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/collections"
              className="px-7 py-3.5 rounded-full bg-primary text-primary-foreground text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all"
            >
              Continue Shopping
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="px-7 py-3.5 rounded-full border border-primary text-primary text-sm tracking-wide hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <Phone className="inline h-4 w-4 mr-1" strokeWidth={1.5} /> Contact Support
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default OrderSuccessPage;
