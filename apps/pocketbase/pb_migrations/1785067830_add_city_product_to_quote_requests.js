/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("quote_requests");
    if (!collection.fields.getByName("city")) {
      collection.fields.add(
        new TextField({ name: "city", required: false, max: 100 }),
      );
    }
    if (!collection.fields.getByName("product_name")) {
      collection.fields.add(
        new TextField({ name: "product_name", required: false, max: 160 }),
      );
    }
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("quote_requests");
    collection.fields.removeByName("city");
    collection.fields.removeByName("product_name");
    app.save(collection);
  },
);
