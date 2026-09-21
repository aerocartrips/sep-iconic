// Maps the site's static collection catalogue (src/lib/collections.js) to the
// real Online Store products/variants used for direct purchase + checkout.
// Every product across a collection shares that collection's flagship store
// item for real cart/checkout — the static catalogue is presentation-only,
// the store item carries the real price, variant id and inventory.

export const STORE_PRODUCT_MAP = {
  "corporate-hampers": {
    productId: "prod_01KYAEXMH1KWZC267T41C87TDF",
    variantId: "variant_01KYAEXMKFS7043KRPC36RPKP5",
    title: "Executive Corporate Hamper",
    price_in_cents: 249900,
    currency: "inr",
  },
  "dry-fruits-chocolate-sweet-boxes": {
    productId: "prod_01KYAEXGWJKVTRY44K9FBN7VEB",
    variantId: "variant_01KYAEXGZ9BV57NZ1XGF33H70K",
    title: "Premium MDF Gift Box",
    price_in_cents: 89900,
    currency: "inr",
  },
  "wedding-hampers": {
    productId: "prod_01KYAEXKRA680FE4T9MXZHYK1W",
    variantId: "variant_01KYAEXKTRRDSTNQN5NYW0FHN5",
    title: "Luxury Wedding Hamper",
    price_in_cents: 329900,
    currency: "inr",
  },
  "birthday-hampers": {
    productId: "prod_01KYAEXH57PPDD998FRGZNCC1X",
    variantId: "variant_01KYAEXH7G0RTTNBDAN4T3G7XE",
    title: "Kids Birthday Hamper",
    price_in_cents: 149900,
    currency: "inr",
  },
  "premium-hampers": {
    productId: "prod_01KYAEXH0B5YXWG1NZBGBBJA33",
    variantId: "variant_01KYAEXH2QZW6C8EA3MADG5ZVE",
    title: "Festive Premium Hamper",
    price_in_cents: 279900,
    currency: "inr",
  },
  "eco-collection": {
    productId: "prod_01KYAEXGQ939MJ8AHZK3FADQSW",
    variantId: "variant_01KYAEXGSSYKFCP3XF9JHWH20D",
    title: "Eco Jute Gift Bag",
    price_in_cents: 39900,
    currency: "inr",
  },
};

export const MOQ = 100;

export const getStoreEntry = (collectionSlug) => STORE_PRODUCT_MAP[collectionSlug] || null;
