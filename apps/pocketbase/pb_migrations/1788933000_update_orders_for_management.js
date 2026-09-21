/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const collection = app.findCollectionByNameOrId("orders");

    // Add new fields only if missing
    if (!collection.fields.getByName("order_number")) {
      collection.fields.add(
        new TextField({ name: "order_number", max: 40 }),
      );
    }
    if (!collection.fields.getByName("product_amount_in_paise")) {
      collection.fields.add(
        new NumberField({ name: "product_amount_in_paise" }),
      );
    }
    if (!collection.fields.getByName("packaging_charges_in_paise")) {
      collection.fields.add(
        new NumberField({ name: "packaging_charges_in_paise" }),
      );
    }
    if (!collection.fields.getByName("delivery_charges_in_paise")) {
      collection.fields.add(
        new NumberField({ name: "delivery_charges_in_paise" }),
      );
    }
    if (!collection.fields.getByName("total_quantity")) {
      collection.fields.add(
        new NumberField({ name: "total_quantity" }),
      );
    }
    if (!collection.fields.getByName("billing_address")) {
      collection.fields.add(
        new TextField({ name: "billing_address", max: 500 }),
      );
    }
    if (!collection.fields.getByName("owner")) {
      collection.fields.add(
        new RelationField({
          name: "owner",
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        }),
      );
    }

    // Extend status select values
    const statusField = collection.fields.getByName("status");
    if (statusField) {
      statusField.values = [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "failed",
      ];
    }

    // Rules: users can view their own orders (by owner or matching email);
    // writes only via superuser (Express payment flow).
    collection.listRule =
      "@request.auth.id != '' && (owner = @request.auth.id || customer_email = @request.auth.email)";
    collection.viewRule =
      "@request.auth.id != '' && (owner = @request.auth.id || customer_email = @request.auth.email)";
    collection.createRule = "";
    collection.updateRule = null;
    collection.deleteRule = null;

    // Persist the new fields + rules BEFORE deduplicating records. Without
    // this save, the `order_number` column does not exist in the DB table yet,
    // so `app.save(record)` below silently drops the assigned value and every
    // row keeps its default empty string — which then makes the UNIQUE index
    // fail with "UNIQUE constraint failed: orders.order_number".
    app.save(collection);

    // Before creating the UNIQUE index, resolve any duplicate/empty
    // order_number values on existing records so the index can be built.
    // Production may have legacy orders created before this field existed,
    // all sharing an empty order_number — a UNIQUE index would fail there.
    const pad4 = (n) => String(n).padStart(4, "0");
    const datePart = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const day = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}${m}${day}`;
    };

    let existingOrders = [];
    try {
      existingOrders = app.findRecordsByFilter("orders", "id != ''");
    } catch (e) {
      if (!e.message.includes("no rows in result set")) throw e;
    }

    const usedNumbers = new Set();
    const toFix = [];
    for (const r of existingOrders) {
      const num = r.get("order_number");
      const val = num === null || num === undefined ? "" : String(num);
      if (!val || usedNumbers.has(val)) {
        toFix.push(r);
      } else {
        usedNumbers.add(val);
      }
    }

    // Assign unique IH-YYYYMMDD-XXXX numbers to duplicates/empties.
    let seq = 1;
    for (const r of toFix) {
      let candidate;
      do {
        const base = datePart(r.get("created") || new Date());
        candidate = `IH-${base}-${pad4(seq)}`;
        seq += 1;
      } while (usedNumbers.has(candidate));
      usedNumbers.add(candidate);
      r.set("order_number", candidate);
      app.save(r);
    }

    // Unique order number index. Added in a second collection save, AFTER the
    // dedup loop has made every order_number unique. Re-fetch the collection so
    // we push the index onto the persisted field set.
    const fresh = app.findCollectionByNameOrId("orders");
    const hasOrderNumberIndex = (fresh.indexes || []).some((idx) =>
      idx.includes("order_number"),
    );
    if (!hasOrderNumberIndex) {
      fresh.indexes.push(
        "CREATE UNIQUE INDEX `idx_orders_order_number` ON `orders` (`order_number`)",
      );
    }
    app.save(fresh);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("orders");
      ["order_number", "product_amount_in_paise", "packaging_charges_in_paise", "delivery_charges_in_paise", "total_quantity", "billing_address", "owner"].forEach((n) => {
        const f = collection.fields.getByName(n);
        if (f) collection.fields.remove(f);
      });
      const statusField = collection.fields.getByName("status");
      if (statusField) statusField.values = ["pending", "paid", "failed"];
      collection.listRule = null;
      collection.viewRule = null;
      collection.indexes = (collection.indexes || []).filter(
        (idx) => !idx.includes("order_number"),
      );
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
