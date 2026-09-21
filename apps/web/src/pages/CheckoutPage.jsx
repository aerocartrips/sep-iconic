import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import apiServerClient from '@/lib/apiServerClient';
import { aggregatePackage } from '@/lib/productShipping';

const formatINR = (cents) => `\u20b9${((cents || 0) / 100).toFixed(2)}`;
const PACKAGING_DELHI_PAISE = 500; // ₹5 per piece within Delhi
const PACKAGING_OUTSIDE_PAISE = 1500; // ₹15 per piece outside Delhi
const RATE_ERROR_MSG =
  'Shipping rate could not be calculated. Please check your delivery pincode or try again.';
const EWB_THRESHOLD_INR = 50000;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

const empty = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gst: '',
  eway: '',
  notes: '',
};

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Detect whether the delivery address is inside Delhi
function isDelhiDelivery(form) {
  const state = (form.state || '').toLowerCase().trim();
  const city = (form.city || '').toLowerCase().trim();
  const pincode = (form.pincode || '').trim();
  if (state === 'delhi' || state === 'new delhi') return true;
  if (city.includes('delhi')) return true;
  if (pincode.startsWith('110')) return true;
  return false;
}

const CheckoutPage = () => {
  const { items, totalPriceCents, hasBelowMoq } = useCart();
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Live Delhivery B2B shipping rate state
  const [shippingPaise, setShippingPaise] = useState(null); // null = not yet calculated
  const [shippingError, setShippingError] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingMeta, setShippingMeta] = useState(null); // courier info from API
  const rateReqId = useRef(0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Reactive charge calculations
  const totalQuantity = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const productAmount = totalPriceCents;
  const insideDelhi = useMemo(() => isDelhiDelivery(form), [form.state, form.city, form.pincode]);
  const packagingCharges = totalQuantity * (insideDelhi ? PACKAGING_DELHI_PAISE : PACKAGING_OUTSIDE_PAISE);

  const pkg = useMemo(() => aggregatePackage(items), [items]);

  // deliveryCharges: only a real API rate (including explicit free = 0). Never default to 0.
  const deliveryCharges = shippingPaise == null ? 0 : shippingPaise;
  const shippingReady = shippingPaise != null && !shippingError;
  const grandTotal = productAmount + packagingCharges + (shippingReady ? deliveryCharges : 0);

  // Recalculate shipping whenever pincode or cart package changes
  useEffect(() => {
    const pin = String(form.pincode || '').replace(/\D/g, '').slice(0, 6);

    // Reset while waiting for a complete pincode
    if (pin.length !== 6) {
      setShippingPaise(null);
      setShippingError('');
      setShippingMeta(null);
      setShippingLoading(false);
      return undefined;
    }

    if (!pkg.ok || pkg.package_weight_kg <= 0) {
      setShippingPaise(null);
      setShippingError(RATE_ERROR_MSG);
      setShippingMeta(null);
      setShippingLoading(false);
      return undefined;
    }

    const reqId = ++rateReqId.current;
    setShippingLoading(true);
    setShippingError('');

    const timer = setTimeout(async () => {
      try {
        const res = await apiServerClient.fetch('/delhivery/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delivery_pincode: pin,
            delivery_state: form.state,
            delivery_city: form.city,
            weight_kg: pkg.package_weight_kg,
            weight_gm: pkg.package_weight_gm,
            total_order_value: productAmount / 100,
            package_length_cm: pkg.package_length_cm,
            package_breadth_cm: pkg.package_breadth_cm,
            package_height_cm: pkg.package_height_cm,
            box_count: pkg.box_count,
            dimensions: pkg.dimensions,
            cod: false,
          }),
        });

        if (rateReqId.current !== reqId) return;

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.calculable === false) {
          const msg = String(data.error || '').trim();
          setShippingPaise(null);
          setShippingError(/^\d{3}$/.test(msg) ? RATE_ERROR_MSG : (msg || RATE_ERROR_MSG));
          setShippingMeta(null);
        } else {
          // Accept 0 only when API explicitly confirms free shipping
          const paise = Number(data.shipping_charges_in_paise);
          if (!Number.isFinite(paise) || paise < 0) {
            setShippingPaise(null);
            setShippingError(RATE_ERROR_MSG);
            setShippingMeta(null);
          } else {
            setShippingPaise(paise);
            setShippingError('');
            setShippingMeta({
              courier: data.courier || null,
              weight_kg: data.weight_kg,
              pickup_pincode: data.pickup_pincode,
              delivery_pincode: data.delivery_pincode,
            });
          }
        }
      } catch (err) {
        if (rateReqId.current !== reqId) return;
        console.error('Shipping rate error:', err);
        setShippingPaise(null);
        setShippingError(RATE_ERROR_MSG);
        setShippingMeta(null);
      } finally {
        if (rateReqId.current === reqId) setShippingLoading(false);
      }
    }, 400); // debounce pincode typing

    return () => {
      clearTimeout(timer);
    };
  }, [
    form.pincode,
    form.state,
    form.city,
    pkg.package_weight_kg,
    pkg.package_weight_gm,
    pkg.package_length_cm,
    pkg.package_breadth_cm,
    pkg.package_height_cm,
    pkg.box_count,
    pkg.dimensions,
    pkg.ok,
    productAmount,
    items,
  ]);

  if (items.length === 0) return <Navigate to="/cart" replace />;

  const field =
    'w-full bg-[hsl(var(--background))] border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-gold transition-colors';

  const submit = async (e) => {
    e.preventDefault();
    if (hasBelowMoq) return;

    const pin = String(form.pincode || '').replace(/\D/g, '');
    if (pin.length !== 6) {
      setError('Please enter a valid 6-digit delivery pincode to calculate shipping.');
      return;
    }
    if (!shippingReady) {
      setError(shippingError || RATE_ERROR_MSG);
      return;
    }
    if (form.gst && !GSTIN_RE.test(form.gst.trim())) {
      setError('Please enter a valid GSTIN or leave the GST field blank.');
      return;
    }
    if (grandTotal / 100 > EWB_THRESHOLD_INR) {
      const ewb = String(form.eway || '').replace(/\D/g, '');
      if (!/^\d{12}$/.test(ewb)) {
        setError('A 12-digit e-way bill is required for invoices above ₹50,000.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay checkout script');

      // Create Razorpay order on server (grand total includes packaging + live delivery)
      const createRes = await apiServerClient.fetch('/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_in_paise: grandTotal,
          product_amount_in_paise: productAmount,
          packaging_charges_in_paise: packagingCharges,
          delivery_charges_in_paise: deliveryCharges,
          total_quantity: totalQuantity,
          owner_id: isAuthed ? user?.id : '',
          customer: { ...form, eway_bill: String(form.eway || '').replace(/\D/g, '') },
          shipping_meta: shippingMeta,
          package: {
            weight_gm: pkg.package_weight_gm,
            weight_kg: pkg.package_weight_kg,
            length_cm: pkg.package_length_cm,
            breadth_cm: pkg.package_breadth_cm,
            height_cm: pkg.package_height_cm,
            box_count: pkg.box_count,
            dimensions: pkg.dimensions,
          },
          items: items.map((i) => ({
            product_id: i.product.id,
            product_title: i.product.title,
            variant_id: i.variant.id,
            sku: i.variant.sku || i.variant.id || i.product.id,
            price_in_cents: i.variant.price_in_cents,
            quantity: i.quantity,
            title: i.product.title,
            // Pass real dims/weight through to order + Delhivery shipment create
            weight_gm: i.shipping?.weight_gm || null,
            length_cm: i.shipping?.length_cm || null,
            breadth_cm: i.shipping?.breadth_cm || null,
            height_cm: i.shipping?.height_cm || null,
            size_label: i.shipping?.size_label || null,
          })),
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error || 'Could not create order');
      }

      const { order_id, order_number, amount, currency, key_id } = await createRes.json();

      // Open Razorpay modal
      const options = {
        key: key_id,
        amount,
        currency,
        name: 'Iconic Handicraft',
        description: 'Custom Gifting & Hampers',
        order_id,
        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },
        notes: {
          address: `${form.address}, ${form.city}, ${form.state} - ${form.pincode}`,
          gst: form.gst,
          order_notes: form.notes,
          order_number,
        },
        theme: { color: '#35543D' },
        handler: async (response) => {
          try {
            const verifyRes = await apiServerClient.fetch('/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                customer: form,
              }),
            });

            if (!verifyRes.ok) throw new Error('Payment verification failed');

            const data = await verifyRes.json();
            navigate('/order-success', {
              state: {
                order_id: data.order_number || order_number || order_id,
                payment_id: data.payment_id,
                customer: form,
                items,
                total: grandTotal,
                productAmount,
                packagingCharges,
                deliveryCharges,
              },
            });
          } catch (err) {
            setError('Payment was received but verification failed. Please contact support with your payment ID: ' + response.razorpay_payment_id);
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError('Payment was cancelled. Your cart is unchanged — please try again.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setError(`Payment failed: ${resp.error.description || 'Unknown error'}. Please try again.`);
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Could not start checkout. Please try again or contact us on WhatsApp.');
      setLoading(false);
    }
  };

  const pinComplete = String(form.pincode || '').replace(/\D/g, '').length === 6;

  return (
    <>
      <Helmet>
        <title>Checkout — Iconic Handicraft</title>
        <meta name="description" content="Complete your order securely with Razorpay." />
      </Helmet>

      <section className="pt-32 md:pt-40 pb-16 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <Breadcrumbs items={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
          <span className="text-gold tracking-[0.35em] uppercase text-xs mt-6 block">Secure Checkout</span>
          <h1 className="font-display text-primary text-4xl md:text-6xl mt-4 leading-tight">Checkout</h1>
          {!isAuthed && (
            <p className="text-sm text-muted-foreground mt-4">
              <Link to="/login" className="text-primary font-medium hover:text-gold transition-colors">Login</Link> or{' '}
              <Link to="/signup" className="text-primary font-medium hover:text-gold transition-colors">create an account</Link> to save this order to your order history.
            </p>
          )}
        </div>
      </section>

      <section className="pb-24 md:pb-32">
        <div className="mx-auto max-w-[90rem] px-6 grid lg:grid-cols-3 gap-10">
          <form onSubmit={submit} className="lg:col-span-2 bg-white border border-border rounded-2xl p-7 md:p-9 space-y-6">
            <div>
              <h3 className="font-display text-2xl text-primary mb-4">Customer Details</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <input required className={field} placeholder="Full Name" value={form.name} onChange={set('name')} />
                <input required type="email" className={field} placeholder="Email" value={form.email} onChange={set('email')} />
                <input required className={field} placeholder="Phone Number" value={form.phone} onChange={set('phone')} />
                <input className={field} placeholder="GST Number (optional)" value={form.gst} onChange={set('gst')} />
                {grandTotal / 100 > EWB_THRESHOLD_INR && (
                  <input
                    required
                    className={`${field} sm:col-span-2`}
                    placeholder="E-way bill (12 digits, required above ₹50,000)"
                    value={form.eway}
                    onChange={set('eway')}
                    inputMode="numeric"
                    maxLength={12}
                  />
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display text-2xl text-primary mb-4">Shipping Address</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <input required className={`${field} sm:col-span-2`} placeholder="Address" value={form.address} onChange={set('address')} />
                <input required className={field} placeholder="City" value={form.city} onChange={set('city')} />
                <input required className={field} placeholder="State" value={form.state} onChange={set('state')} />
                <input
                  required
                  className={field}
                  placeholder="Pincode"
                  value={form.pincode}
                  onChange={set('pincode')}
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {insideDelhi
                  ? `Delivery within Delhi — Master Packaging Charges: ₹5 × ${totalQuantity} units = ${formatINR(packagingCharges)}.`
                  : `Delivery outside Delhi — Master Packaging Charges of ₹15 × ${totalQuantity} units = ${formatINR(packagingCharges)} will be added.`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your 6-digit pincode to calculate live courier shipping charges.
              </p>
            </div>

            <div>
              <h3 className="font-display text-2xl text-primary mb-4">Order Notes</h3>
              <textarea rows={4} className={`${field} resize-none`} placeholder="Any special instructions for your order" value={form.notes} onChange={set('notes')} />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || hasBelowMoq || !shippingReady || shippingLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-50"
            >
              {(loading || shippingLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
              <ShieldCheck className="h-4 w-4" />
              {shippingReady ? `Pay ${formatINR(grandTotal)} Securely` : 'Enter pincode to calculate shipping'}
            </button>

            <p className="text-xs text-muted-foreground text-center">
              Powered by Razorpay · UPI · Cards · Net Banking · Wallets
            </p>
          </form>

          <div className="bg-white border border-border rounded-2xl p-7 h-fit">
            <h3 className="font-display text-2xl text-primary mb-5">Order Summary</h3>
            <div className="space-y-3 mb-5">
              {items.map((i) => (
                <div key={i.variant.id} className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground">
                    {i.product.title} × {i.quantity}
                    {i.shipping?.size_label && (
                      <span className="block text-[11px] text-muted-foreground/80">
                        Size: {i.shipping.size_label}
                      </span>
                    )}
                  </span>
                  <span className="text-primary whitespace-nowrap">{formatINR(i.variant.price_in_cents * i.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm pt-4 border-t border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product Amount</span>
                <span className="text-primary">{formatINR(productAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Master Packaging Charges</span>
                <span className="text-primary">{formatINR(packagingCharges)}</span>
              </div>
              <div className="flex justify-between items-start gap-3">
                <span className="text-muted-foreground">
                  Delivery Charges
                  {shippingMeta?.courier?.name && (
                    <span className="block text-[11px] text-muted-foreground/80">
                      via {shippingMeta.courier.name}
                      {shippingMeta.courier.edd ? ` · EDD ${shippingMeta.courier.edd}` : ''}
                    </span>
                  )}
                </span>
                <span className="text-primary text-right">
                  {shippingLoading && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating…
                    </span>
                  )}
                  {!shippingLoading && !pinComplete && (
                    <span className="text-muted-foreground text-xs">Enter pincode</span>
                  )}
                  {!shippingLoading && pinComplete && shippingError && (
                    <span className="text-destructive text-xs block max-w-[16rem] leading-snug">{shippingError}</span>
                  )}
                  {!shippingLoading && shippingReady && formatINR(deliveryCharges)}
                </span>
              </div>
              <div className="flex justify-between text-lg text-primary font-medium pt-3 border-t border-border">
                <span>Grand Total</span>
                <span>{shippingReady ? formatINR(grandTotal) : '—'}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gold/10 text-sm text-primary mt-5 mb-3">
              Need larger quantities? Request a Bulk Quote for wholesale pricing.
            </div>
            <Link
              to="/request-quote"
              className="w-full inline-flex items-center justify-center rounded-full border border-primary text-primary py-3 text-sm tracking-wide hover:bg-primary hover:text-primary-foreground transition-all"
            >
              Request Bulk Quote
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default CheckoutPage;
