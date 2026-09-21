import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ChevronLeft, Package, MapPin, CreditCard, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';

const formatINR = (cents) => `\u20b9${((cents || 0) / 100).toFixed(2)}`;

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
};

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    pb.collection('orders')
      .getOne(orderId)
      .then(setOrder)
      .catch((err) => setError(err.message || 'Order not found.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="pt-32 pb-20 text-center">
        <p className="font-display text-2xl text-primary mb-3">{error || 'Order not found'}</p>
        <Link to="/account" className="text-sm text-muted-foreground underline">Back to My Account</Link>
      </div>
    );
  }

  let items = [];
  try {
    items = JSON.parse(JSON.stringify(order.items_json || []));
  } catch (_) { items = []; }

  const productAmount = order.product_amount_in_paise || 0;
  const packaging = order.packaging_charges_in_paise || 0;
  const delivery = order.delivery_charges_in_paise || 0;

  return (
    <>
      <Helmet>
        <title>Order {order.order_number || order.razorpay_order_id} — Iconic Handicraft</title>
        <meta name="description" content="Your order details." />
      </Helmet>
      <section className="pt-32 md:pt-40 pb-20 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-3xl px-6">
          <Link to="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to Order History
          </Link>

          <div className="bg-white border border-border rounded-2xl p-7 md:p-9 space-y-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-gold tracking-[0.35em] uppercase text-xs block">Order Details</span>
                <h1 className="font-display text-primary text-3xl md:text-4xl mt-2">{order.order_number || order.razorpay_order_id}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(order.created).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span className={`text-xs uppercase tracking-wider px-3 py-1.5 rounded-full font-medium ${STATUS_STYLES[order.status] || 'bg-secondary text-muted-foreground'}`}>
                {order.status}
              </span>
            </div>

            {order.status === 'paid' && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 text-green-800 text-sm">
                <CheckCircle2 className="h-5 w-5" /> Payment Successful — ₹{((order.amount_in_paise || 0) / 100).toFixed(2)} paid via Razorpay
              </div>
            )}

            {/* Items */}
            {items.length > 0 && (
              <div>
                <h3 className="font-display text-xl text-primary mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-gold" strokeWidth={1.5} /> Items Ordered
                </h3>
                <div className="space-y-2">
                  {items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                      <span className="text-muted-foreground">{i.title || i.product_title || 'Product'} × {i.quantity}</span>
                      <span className="text-primary">{formatINR((i.price_in_cents || 0) * (i.quantity || 1))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charges breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Product Amount</span><span className="text-primary">{formatINR(productAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Master Packaging Charges</span><span className="text-primary">{formatINR(packaging)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Charges</span><span className="text-primary">{formatINR(delivery)}</span></div>
              <div className="flex justify-between text-lg text-primary font-medium pt-3 border-t border-border">
                <span>Grand Total</span><span>{formatINR(order.amount_in_paise)}</span>
              </div>
            </div>

            {/* Customer & shipping */}
            <div className="grid sm:grid-cols-2 gap-6 pt-2 border-t border-border">
              <div>
                <h3 className="font-display text-xl text-primary mb-2 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-gold" strokeWidth={1.5} /> Billing
                </h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{order.customer_name}</p>
                  <p>{order.customer_email}</p>
                  <p>{order.customer_phone}</p>
                  {order.gst_number && <p>GST: {order.gst_number}</p>}
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl text-primary mb-2 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gold" strokeWidth={1.5} /> Shipping
                </h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{order.shipping_address}</p>
                  <p>{order.shipping_city}, {order.shipping_state} — {order.shipping_pincode}</p>
                </div>
              </div>
            </div>

            {order.order_notes && (
              <div className="pt-2 border-t border-border">
                <h3 className="font-display text-xl text-primary mb-2">Order Notes</h3>
                <p className="text-sm text-muted-foreground">{order.order_notes}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default OrderDetailPage;
