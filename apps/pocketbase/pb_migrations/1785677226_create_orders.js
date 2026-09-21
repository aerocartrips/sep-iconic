/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("orders");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "orders",
        listRule: null,
        viewRule: null,
        createRule: "",
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "razorpay_order_id", type: "text", required: true, max: 120 },
          { name: "razorpay_payment_id", type: "text", max: 120 },
          { name: "razorpay_signature", type: "text", max: 300 },
          { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "paid", "failed"] },
          { name: "customer_name", type: "text", max: 200 },
          { name: "customer_email", type: "email" },
          { name: "customer_phone", type: "text", max: 40 },
          { name: "shipping_address", type: "text", max: 500 },
          { name: "shipping_city", type: "text", max: 100 },
          { name: "shipping_state", type: "text", max: 100 },
          { name: "shipping_pincode", type: "text", max: 20 },
          { name: "gst_number", type: "text", max: 80 },
          { name: "order_notes", type: "text", max: 2000 },
          { name: "amount_in_paise", type: "number", required: true },
          { name: "items_json", type: "json" },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("orders");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
