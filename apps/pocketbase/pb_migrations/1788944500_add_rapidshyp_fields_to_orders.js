/// <reference path="../pb_data/types.d.ts" />

// Adds nullable RapidShyp B2B shipping fields to the existing `orders`
// collection. All fields are optional (nullable) so existing orders and the
// current payment/order flow are unaffected. RapidShyp data is written
// server-side by the Express superuser client; the collection updateRule
// stays `null` (superuser only), so customers cannot mutate shipping state.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("orders");

    const addText = (name, max) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new TextField({ name, max: max || 0 }));
      }
    };

    // Identifiers returned by RapidShyp
    addText("rapidshyp_order_id", 120);
    addText("rapidshyp_shipment_id", 120);
    addText("rapidshyp_awb", 120);
    addText("rapidshyp_courier", 120);

    // Shipping state + last request outcome
    addText("rapidshyp_status", 80);
    addText("rapidshyp_request_status", 40);

    // Label URL returned by the label endpoint
    addText("rapidshyp_label", 500);

    // Last error message (validation or API). Stored, never deletes the order.
    addText("rapidshyp_error", 2000);

    // ISO timestamp of the first successful RapidShyp order creation
    addText("rapidshyp_created_at", 60);

    // Appointment response (JSON: courier_appointment_id, start/end time, date)
    if (!collection.fields.getByName("rapidshyp_appointment")) {
      collection.fields.add(new JSONField({ name: "rapidshyp_appointment" }));
    }

    // Shipment history (JSON array): every action + response snapshot,
    // including old shipment ids preserved on deallocate.
    if (!collection.fields.getByName("rapidshyp_history")) {
      collection.fields.add(new JSONField({ name: "rapidshyp_history" }));
    }

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("orders");
      [
        "rapidshyp_order_id",
        "rapidshyp_shipment_id",
        "rapidshyp_awb",
        "rapidshyp_courier",
        "rapidshyp_status",
        "rapidshyp_request_status",
        "rapidshyp_label",
        "rapidshyp_error",
        "rapidshyp_created_at",
        "rapidshyp_appointment",
        "rapidshyp_history",
      ].forEach((n) => {
        if (collection.fields.getByName(n)) {
          collection.fields.removeByName(n);
        }
      });
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
