/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
  const name = e.record.get("full_name");
  const email = e.record.get("email");
  const category = e.record.get("category") || "Custom gifting";
  const quantity = e.record.get("quantity") || "-";

  // Confirmation to the visitor
  try {
    const message = new MailerMessage({
      from: { name: "Iconic Handicraft" },
      to: [{ address: email }],
      subject: "We received your custom quote request",
      html: `
        <div style="font-family:Georgia,serif;color:#35543D">
          <h2 style="color:#35543D">Thank you, ${name}</h2>
          <p style="color:#444;font-family:Arial,sans-serif">
            Your request for <strong>${category}</strong> (quantity: ${quantity})
            has reached our craftsmanship team. A gifting specialist will contact
            you within one business day with a bespoke proposal.
          </p>
          <p style="color:#8A623A;font-family:Arial,sans-serif">Warm regards,<br/>Iconic Handicraft</p>
        </div>
      `,
    });
    $app.newMailClient().send(message);
  } catch (err) {
    $app.logger().error("quote confirmation email failed", "err", String(err));
  }

  // Notify admin
  try {
    const admin = new MailerMessage({
      from: { name: "Iconic Handicraft Website" },
      to: [{ address: "support@iconichandicraft.com" }],
      subject: `New quote request: ${category}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#333">
          <h3>New custom quote request</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Company:</strong> ${e.record.get("company") || "-"}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${e.record.get("phone") || "-"}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          <p><strong>Budget:</strong> ${e.record.get("budget") || "-"}</p>
          <p><strong>Message:</strong> ${e.record.get("message") || "-"}</p>
        </div>
      `,
    });
    $app.newMailClient().send(admin);
  } catch (err) {
    $app.logger().error("quote admin email failed", "err", String(err));
  }

  e.next();
}, "quote_requests");
