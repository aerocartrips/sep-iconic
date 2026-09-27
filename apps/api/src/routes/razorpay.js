import Razorpay from 'razorpay';
import crypto from 'crypto';
import pocketbaseClient from '../utils/pocketbaseClient.js';
import { createShipmentCore } from './delhivery.js';
import logger from '../utils/logger.js';

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// ---- Business rules (enforced server-side, cannot be bypassed by the client) ----
const MOQ = 100; // Minimum Order Quantity per product line
const PACKAGING_DELHI_PAISE = 0; // ₹5 per piece within Delhi 0 for test
const PACKAGING_OUTSIDE_PAISE = 1500; // ₹15 per piece outside Delhi

function getRazorpay() {
  if (!KEY_ID || !KEY_SECRET) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing in apps/api/.env');
  return new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
}

function getRecordValue(record, key, fallback = '') {
  if (!record) return fallback;
  if (typeof record.get === 'function') return record.get(key);
  return record[key] ?? fallback;
}

function generateOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `IH-${ymd}-${rand}`;
}

// Determine whether the DELIVERY (shipping) address is inside Delhi.
// Uses shipping state, city and pincode — never the billing address alone.
function isDelhiDelivery(customer) {
  const state = String(customer?.state || '').toLowerCase().trim();
  const city = String(customer?.city || '').toLowerCase().trim();
  const pincode = String(customer?.pincode || '').replace(/\D/g, '');
  if (state === 'delhi' || state === 'new delhi') return true;
  if (city.includes('delhi')) return true;
  if (pincode.startsWith('110')) return true;
  return false;
}

// Recompute the authoritative order totals from the submitted items + delivery
// location. The client sends these too, but the server is the source of truth
// so a tampered request cannot bypass MOQ, packaging, or pricing.
function recomputeTotals(items, customer, deliveryChargesPaise) {
  let totalQuantity = 0;
  let productAmountPaise = 0;
  for (const it of items || []) {
    const qty = Number(it.quantity || 0);
    const price = Number(it.price_in_cents || 0);
    totalQuantity += qty;
    productAmountPaise += qty * price;
  }
  const packagingPaise =
    totalQuantity * (isDelhiDelivery(customer) ? PACKAGING_DELHI_PAISE : PACKAGING_OUTSIDE_PAISE);
  const delivery = Number.isFinite(Number(deliveryChargesPaise)) && Number(deliveryChargesPaise) >= 0
    ? Number(deliveryChargesPaise)
    : 0;
  const grandTotalPaise = productAmountPaise + packagingPaise + delivery;
  return { totalQuantity, productAmountPaise, packagingPaise, deliveryChargesPaise: delivery, grandTotalPaise };
}

// POST /razorpay/create-order
export async function createOrder(req, res) {
  const {
    amount_in_paise,
    customer,
    items,
    delivery_charges_in_paise,
    owner_id,
  } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ error: 'Your cart is empty.' });
  }

  // ---- Server-side MOQ enforcement: every product line must be >= MOQ ----
  const belowMoq = items.filter((it) => Number(it.quantity || 0) < MOQ);
  if (belowMoq.length > 0) {
    return res.status(422).json({
      error: `Minimum order quantity is ${MOQ} pieces per product. Please increase the quantity of ${belowMoq[0].title || belowMoq[0].product_title || 'the product'} to at least ${MOQ} pieces.`,
    });
  }

  // ---- Authoritative totals (server is source of truth) ----
  const totals = recomputeTotals(items, customer, delivery_charges_in_paise);

  const rz = getRazorpay();
  const rzOrder = await rz.orders.create({
    amount: totals.grandTotalPaise,
    currency: 'INR',
    receipt: `ih_${Date.now()}`,
    payment_capture: 1,
  });

  const orderNumber = generateOrderNumber();

  // Persist pending order in PocketBase. This record is created BEFORE payment,
  // so it always appears in the admin backend (as "pending") even if payment
  // verification were to fail later. verify-payment flips it to "paid".
  const pb = pocketbaseClient;
  await pb.collection('orders').create({
    order_number: orderNumber,
    razorpay_order_id: rzOrder.id,
    status: 'pending',
    customer_name: customer?.name || '',
    customer_email: customer?.email || '',
    customer_phone: customer?.phone || '',
    shipping_address: customer?.address || '',
    shipping_city: customer?.city || '',
    shipping_state: customer?.state || '',
    shipping_pincode: customer?.pincode || '',
    billing_address: customer?.address || '',
    gst_number: customer?.gst || '',
    eway_bill: String(customer?.eway_bill || '').replace(/\D/g, '').slice(0, 12),
    order_notes: customer?.notes || '',
    product_amount_in_paise: totals.productAmountPaise,
    packaging_charges_in_paise: totals.packagingPaise,
    delivery_charges_in_paise: totals.deliveryChargesPaise,
    total_quantity: totals.totalQuantity,
    amount_in_paise: totals.grandTotalPaise,
    items_json: items || [],
    owner: owner_id || '',
  });

  res.json({
    order_id: rzOrder.id,
    order_number: orderNumber,
    amount: rzOrder.amount,
    currency: rzOrder.currency,
    key_id: KEY_ID,
  });
}

// POST /razorpay/verify-payment
// Idempotent: a successful payment creates/updates exactly one order, no matter
// how many times the callback fires or the confirmation page is refreshed.
export async function verifyPayment(req, res) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(422).json({ error: 'Missing payment verification fields' });
  }

  // Verify signature
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const pb = pocketbaseClient;

  if (expected !== razorpay_signature) {
    // Signature mismatch → mark the matching order as failed (do not delete it).
    try {
      const records = await pb.collection('orders').getFullList({
        filter: `razorpay_order_id = "${razorpay_order_id}"`,
      });
      if (records.length > 0) {
        await pb.collection('orders').update(records[0].id, { status: 'failed' });
      }
    } catch (err) {
      logger.error('Failed to mark order failed after signature mismatch', { razorpay_order_id, err: err.message });
    return res.status(400).json({ error: 'Payment signature verification failed',err });

    }
    logger.warn('Payment signature verification failed', { razorpay_order_id });
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }

  // Fetch the payment from Razorpay to validate status and order linkage
  let payment;
  try {
    const rz = getRazorpay();
    payment = await rz.payments.fetch(razorpay_payment_id);
  } catch (err) {
    logger.error('Razorpay payment fetch failed', { razorpay_payment_id, err: err?.message || err });
    return res.status(500).json({ error: 'Could not verify payment with Razorpay',err });
  }

  if (String(payment?.status) !== 'captured') {
    logger.warn('Payment not captured', { razorpay_payment_id, status: payment?.status });
    return res.status(400).json({ error: 'Payment not captured', status: payment?.status });
  }

  if (String(payment?.order_id) !== String(razorpay_order_id)) {
    logger.warn('Payment order_id mismatch', { razorpay_payment_id, payment_order_id: payment?.order_id });
    return res.status(400).json({ error: 'Order id mismatch', payment_order_id: payment?.order_id });
  }

  // Find the pending order by its Razorpay order id.
  let records;
  try {
    records = await pb.collection('orders').getFullList({
      filter: `razorpay_order_id = "${razorpay_order_id}"`,
    });
  } catch (e) {
    records = [];
    return res.json({ error: 'razorpay_order_id',e })
  }

  if (records.length === 0) {
    // No matching order — cannot mark a non-existent order paid.
    return res.status(404).json({ error: 'Order not found for this payment.' });
  }

  const existing = records[0];
  const existingStatus = String(getRecordValue(existing, 'status', ''));
  const existingPaymentId = String(getRecordValue(existing, 'razorpay_payment_id', ''));

  // IDEMPOTENCY: if this order is already verified as paid, just return success.
  // A repeated callback / page refresh must not create a duplicate or overwrite.
  if (existingStatus === 'paid' && existingPaymentId === razorpay_payment_id) {
    return res.json({
      success: true,
      order_id: razorpay_order_id,
      order_number: getRecordValue(existing, 'order_number', ''),
      payment_id: razorpay_payment_id,
      already_verified: true,
    });
  }

  // Mark the order as paid with the verified payment id + signature.
  let orderRecord;
  try {
    orderRecord = await pb.collection('orders').update(existing.id, {
      razorpay_payment_id,
      razorpay_signature,
      status: 'paid',
    });
  } catch (err) {
    logger.error('PocketBase order update failed', { id: existing.id, message: err?.message || err });
    return res.status(500).json({ error: 'PocketBase update failed', detail: String(err?.message || err) });
  }

  // After a verified payment, automatically create the Delhivery B2B shipment
  // so the order is booked with the courier (LRN/AWB stored back on the order).
  // This is non-fatal: if Delhivery fails, the order stays paid and the error
  // is persisted on the order for admin diagnosis.
  try {
    await createShipmentCore(pb, existing.id);
  } catch (err) {
    logger.error('Delhivery auto-shipment failed for order', existing.id, err);
    return res.status(500).json({ error: 'Delhivery auto-shipment failed for order', detail: String(err?.message || err) });
  }

  res.json({
    success: true,
    order_id: razorpay_order_id,
    order_number: getRecordValue(orderRecord, 'order_number', ''),
    payment_id: razorpay_payment_id,
  });
}
