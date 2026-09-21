/// <reference path="../pb_data/types.d.ts" />

// Enforces DB-level idempotency for orders:
//   - razorpay_order_id  → UNIQUE (every Razorpay order id maps to one order row)
//   - razorpay_payment_id → UNIQUE WHERE non-empty (a successful payment can
//     only be attached to a single order, preventing duplicate paid orders even
//     if the payment callback fires more than once or the confirmation page is
//     refreshed). Empty/null payment ids (pending orders) are allowed to repeat.
//
// No data is deleted or altered — existing orders are preserved. Indexes are
// only added if not already present.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("orders");

    const hasIndex = (name) =>
      (collection.indexes || []).some((idx) => idx.includes(name));

    if (!hasIndex("idx_orders_razorpay_order_id")) {
      collection.indexes.push(
        "CREATE UNIQUE INDEX `idx_orders_razorpay_order_id` ON `orders` (`razorpay_order_id`)",
      );
    }
    if (!hasIndex("idx_orders_razorpay_payment_id")) {
      // Partial unique index: only enforces uniqueness for non-empty payment ids,
      // so multiple pending orders (empty payment id) coexist fine.
      collection.indexes.push(
        "CREATE UNIQUE INDEX `idx_orders_razorpay_payment_id` ON `orders` (`razorpay_payment_id`) WHERE `razorpay_payment_id` != ''",
      );
    }

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("orders");
      collection.indexes = (collection.indexes || []).filter(
        (idx) =>
          !idx.includes("idx_orders_razorpay_order_id") &&
          !idx.includes("idx_orders_razorpay_payment_id"),
      );
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
