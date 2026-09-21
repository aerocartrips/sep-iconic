/// <reference path="../pb_data/types.d.ts" />

// Replace RapidShyp shipping fields on `orders` with Delhivery B2B fields.
// All new fields are optional so existing orders stay valid.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("orders");

    const addText = (name, max) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(new TextField({ name, max: max || 0 }));
      }
    };

    addText("delhivery_job_id", 120);
    addText("delhivery_lrn", 120);
    addText("delhivery_awb", 120);
    addText("delhivery_courier", 120);
    addText("delhivery_status", 80);
    addText("delhivery_request_status", 40);
    addText("delhivery_label", 500);
    addText("delhivery_error", 2000);
    addText("delhivery_created_at", 60);

    if (!collection.fields.getByName("delhivery_pickup")) {
      collection.fields.add(new JSONField({ name: "delhivery_pickup" }));
    }
    if (!collection.fields.getByName("delhivery_history")) {
      collection.fields.add(new JSONField({ name: "delhivery_history" }));
    }

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
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("orders");
      [
        "delhivery_job_id",
        "delhivery_lrn",
        "delhivery_awb",
        "delhivery_courier",
        "delhivery_status",
        "delhivery_request_status",
        "delhivery_label",
        "delhivery_error",
        "delhivery_created_at",
        "delhivery_pickup",
        "delhivery_history",
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
