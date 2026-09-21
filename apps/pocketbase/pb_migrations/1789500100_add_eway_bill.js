/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("orders");
    if (!collection.fields.getByName("eway_bill")) {
      collection.fields.add(new TextField({ name: "eway_bill", max: 20 }));
    }
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("orders");
      if (collection.fields.getByName("eway_bill")) {
        collection.fields.removeByName("eway_bill");
        app.save(collection);
      }
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
