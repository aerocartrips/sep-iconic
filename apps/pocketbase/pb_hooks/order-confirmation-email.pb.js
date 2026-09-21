/// <reference path="../pb_data/types.d.ts" />

onRecordAfterUpdateSuccess((e) => {
  if (e.record.get("status") !== "paid") {
    e.next();
    return;
  }

  const email = e.record.get("customer_email");
  if (!email) {
    e.next();
    return;
  }

  const name = e.record.get("customer_name") || "Valued Customer";
  const orderId = e.record.get("razorpay_order_id");
  const paymentId = e.record.get("razorpay_payment_id");
  const amountPaise = e.record.get("amount_in_paise") || 0;
  const amountFormatted = "\u20b9" + (amountPaise / 100).toFixed(2);
  let itemsHtml = "";
  try {
    const items = JSON.parse(JSON.stringify(e.record.get("items_json") || []));
    if (Array.isArray(items) && items.length > 0) {
      itemsHtml = items
        .map(
          (i) =>
            `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${i.title || i.product_title || "Product"}</td>` +
            `<td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>` +
            `<td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">\u20b9${((i.price_in_cents || 0) * (i.quantity || 1) / 100).toFixed(2)}</td></tr>`
        )
        .join("");
    }
  } catch (_) {}

  // Customer confirmation
  try {
    const msg = new MailerMessage({
      from: { name: "Iconic Handicraft" },
      to: [{ address: email }],
      subject: `Order Confirmed — ${orderId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
          <div style="background:#35543D;padding:24px 32px">
            <h1 style="color:#F8F5EE;font-family:Georgia,serif;margin:0;font-size:24px">Order Confirmed</h1>
          </div>
          <div style="padding:28px 32px">
            <p>Dear ${name},</p>
            <p>Thank you for your order! Your payment has been received and your order is being processed.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:6px 0;color:#666;width:40%">Order Number</td><td style="padding:6px 0;font-weight:bold">${orderId}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Payment ID</td><td style="padding:6px 0">${paymentId}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Payment Status</td><td style="padding:6px 0;color:#35543D;font-weight:bold">Paid</td></tr>
              <tr><td style="padding:6px 0;color:#666">Total Amount</td><td style="padding:6px 0;font-weight:bold">${amountFormatted}</td></tr>
            </table>
            ${
              itemsHtml
                ? `<h3 style="color:#35543D;font-family:Georgia,serif">Items Ordered</h3>
              <table style="width:100%;border-collapse:collapse">
                <thead><tr style="background:#f5f5f5">
                  <th style="padding:8px 12px;text-align:left">Product</th>
                  <th style="padding:8px 12px;text-align:center">Qty</th>
                  <th style="padding:8px 12px;text-align:right">Total</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
              </table>`
                : ""
            }
            <p style="margin-top:24px;color:#666">Estimated processing time: <strong>3–5 business days</strong>.</p>
            <p>Our team will contact you on your registered phone/email with shipping details.</p>
          </div>
          <div style="background:#f8f5ee;padding:16px 32px;font-size:12px;color:#888">
            Iconic Handicraft &nbsp;|&nbsp; support@iconichandicraft.com
          </div>
        </div>
      `,
    });
    $app.newMailClient().send(msg);
  } catch (err) {
    $app.logger().error("order confirmation email failed", "err", String(err));
  }

  // Admin notification
  try {
    const admin = new MailerMessage({
      from: { name: "Iconic Handicraft Website" },
      to: [{ address: "support@iconichandicraft.com" }],
      subject: `New Paid Order — ${orderId}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#333">
          <h3 style="color:#35543D">New Paid Order Received</h3>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Payment ID:</strong> ${paymentId}</p>
          <p><strong>Customer:</strong> ${name} (${email})</p>
          <p><strong>Phone:</strong> ${e.record.get("customer_phone") || "-"}</p>
          <p><strong>Amount:</strong> ${amountFormatted}</p>
          <p><strong>Shipping:</strong> ${e.record.get("shipping_address") || ""}, ${e.record.get("shipping_city") || ""}, ${e.record.get("shipping_state") || ""} - ${e.record.get("shipping_pincode") || ""}</p>
          <p><strong>GST:</strong> ${e.record.get("gst_number") || "-"}</p>
          <p><strong>Notes:</strong> ${e.record.get("order_notes") || "-"}</p>
        </div>
      `,
    });
    $app.newMailClient().send(admin);
  } catch (err) {
    $app.logger().error("order admin email failed", "err", String(err));
  }

  e.next();
}, "orders");
