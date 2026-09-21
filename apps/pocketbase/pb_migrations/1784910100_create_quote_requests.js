/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("quote_requests");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "quote_requests",
        // Public quote form: anyone can submit; nobody can read via REST.
        listRule: null,
        viewRule: null,
        createRule: "",
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "full_name", type: "text", required: true, max: 120 },
          { name: "company", type: "text", max: 160 },
          { name: "email", type: "email", required: true },
          { name: "phone", type: "text", max: 40 },
          { name: "category", type: "text", max: 80 },
          { name: "quantity", type: "text", max: 60 },
          { name: "budget", type: "text", max: 60 },
          { name: "message", type: "text", max: 2000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("quote_requests");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
