// Collection-first product architecture for Iconic Handicraft.
//
// The single source of truth for product data (names, images, prices, sizes,
// SKUs) is the Hostinger Store Manager backend. Each sub-category maps to a
// real Store Manager category via `storeCategory` (matched with fuzzy
// normalization in useStoreCategoryProducts). The frontend only reorganizes
// how those backend products are surfaced — it never invents products.
//
// For sub-categories whose backend category is still empty (Birthday return
// gifts and Premium hampers), the products currently live in a legacy backend
// category. They are reassigned on the frontend via an explicit `productIds`
// list (real backend product ids) so every backend product stays discoverable
// through the new structure without being duplicated or deleted.

export const WORKSHOP_IMAGE = "https://images.hostinger.com/c0ea4ae9-7bdc-4867-88d1-f5ad1a5c68cb.png";

export const CRAFTY_CARRY_URL = "https://craftycarry.com";

// Real backend product image URLs (from the Store Manager catalog).
const IMG = {
  // Corporate Hampers
  leatheretteBaskets: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F5220ceef-cf1b-4afa-920a-033e5bb0a5d7.png",
  juteCottonBags: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F4f94bba7-568e-4c57-905c-a0056ab274aa.jpg",
  mdfBoxBasket: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Ff79f2ed8-7f0f-4226-bd31-d1d5739e6a82.jpg",
  kappaRigidBox: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fc2aebb49-ad9c-4bdf-8d71-fbf0be6662df.jpg",
  caps: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fd65e4918-457f-44bc-b6b1-5833ff04c52a.jpg",

  // Dry Fruits, Chocolate & Sweet Boxes
  dryFruitTrays: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F2708057d-3de1-4c87-878f-94c6fe026a8a.jpg",
  dryFruitBaskets: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F6acd6d6c-b199-45cc-9520-05c3ec4edd34.jpg",
  dryFruitJarBoxes: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fd9fb68d1-92e1-4608-8078-904e2ce7b01e.jpg",
  sweetBhajiBoxes: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F4051ce1c-e547-4ba1-be14-d8d602627cb2.jpg",
  chocolateBoxes: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fc2e38c96-a506-468a-b5a2-3072078912e0.jpg",
  cavityTrayBoxes: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fe242d3bd-e578-4054-8f80-0000da411f26.png",

  // Wedding Hampers
  weddingInvitationBoxes: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ/assets/57236ece-e2e5-49f3-98da-c9e60f76a77d.png",
  trousseauTrays: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F38fa610b-6bce-4b38-a2c1-8fed4a755f5d.jpg",
  trousseauBaskets: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F3f2b6027-8adc-4ce5-9786-b3b72f6cae76.jpg",
  trousseauStorageBoxes: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fad0c26f3-15f3-4e5f-af12-94dab9e5da15.jpg",
  trousseauJewelleryBoxes: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fd6daeef7-22cd-46b0-97f5-e15df132a796.jpg",

  // Birthday Hampers
  birthdayHero: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fad024a68-3bd9-42ab-a3b6-d438877792af.png",
  returnGiftBasket: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Ffe0faeeb-4913-4822-89ee-a2943ebd4cc6.jpg",
  returnGiftJarBox: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2Fcc02056c-67a0-433f-9bf7-7392dda43ba1.jpg",
  returnGiftTray: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F2a684553-a37d-4bae-ab2f-f7c7c279534b.jpg",
  returnGiftBags: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F43fd0467-be30-4d70-9870-8500535acef4.png",

  // Premium Hampers
  premiumHero: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F8f3f4dfa-9d37-4d2d-a658-81be67ab1b19.png",
  premiumBox: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F4559ce8e-bc92-463b-b714-8fb8a061d386.jpg",
  premiumBasket: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ%2Fassets%2F8f3f4dfa-9d37-4d2d-a658-81be67ab1b19.png",
  premiumTray: "https://cdn.zyrosite.com/cdn-ecommerce/store_01KYAEW73P06SE72FAQEVDVSZQ/assets/8d33879c-8f8c-43af-9a87-f5997b04375f.png",
};

export const COLLECTIONS = [
  {
    slug: "corporate-hampers",
    title: "Corporate Hampers",
    eyebrow: "Corporate Gifting",
    description:
      "Luxury corporate gifting solutions with complete customization and refined branding for enterprises and institutions.",
    heroImage: IMG.leatheretteBaskets,
    categories: [
      {
        slug: "leatherette-baskets",
        title: "MDF & Leatherette Basket",
        storeCategory: "Leatherette Mdf  Baskets",
        description: "Refined MDF and leatherette-finish baskets for premium corporate gifting.",
        image: IMG.leatheretteBaskets,
      },
      {
        slug: "jute-cotton-bags",
        title: "Jute & Cotton Bags",
        storeCategory: "Jute and Cotton Bags",
        description: "Sustainable jute and cotton carry bags for corporate hampers.",
        image: IMG.juteCottonBags,
      },
      {
        slug: "mdf-box-basket",
        title: "MDF Box",
        storeCategory: "MDF Box & Basket",
        description: "Engineered wood boxes combining durability with elegance.",
        image: IMG.mdfBoxBasket,
      },
      {
        slug: "kappa-rigid-boxes",
        title: "Kappa Rigid Box",
        storeCategory: "Kappa Rigid Box",
        description: "Sturdy rigid board boxes with a premium foil-finished exterior.",
        image: IMG.kappaRigidBox,
      },
      {
        slug: "cap",
        title: "CAP",
        storeCategory: "CAP",
        description: "Custom-branded baseball caps and headwear for corporate gifting.",
        image: IMG.caps,
      },
    ],
  },
  {
    slug: "dry-fruits-chocolate-sweet-boxes",
    title: "Dry Fruits, Chocolate & Sweet Boxes",
    eyebrow: "Luxury Packaging",
    description: "Premium MDF boxes engineered for gifting, branding and luxury packaging.",
    heroImage: IMG.dryFruitJarBoxes,
    categories: [
      {
        slug: "dry-fruit-chocolate-sweet-trays",
        title: "Dry Fruits / Chocolate / Sweet Trays",
        storeCategory: "Dry fruits/ Choclate/ Sweet Trays",
        description: "Elegant compartmentalized wooden trays for dry fruits, chocolates and sweets.",
        image: IMG.dryFruitTrays,
      },
      {
        slug: "dry-fruit-chocolate-sweet-baskets",
        title: "Dry Fruits / Chocolate / Sweet Basket",
        storeCategory: "Dry fruits/ Choclate/ Sweet Basket ",
        description: "Handwoven baskets styled for dry fruit, chocolate and sweet gifting.",
        image: IMG.dryFruitBaskets,
      },
      {
        slug: "dry-fruit-boxes",
        title: "Dry Fruits Boxes (2/3/4/5/6 Jar)",
        storeCategory: "Dry fruit Boxes ( 2 Jar , 3 Jar, 4 Jar, 5 Jar, 6 Jar)",
        description: "MDF dry fruit boxes available in 2, 3, 4, 5 and 6 jar configurations.",
        image: IMG.dryFruitJarBoxes,
      },
      {
        slug: "sweet-bhaji-boxes",
        title: "Sweet Bhaji Box",
        storeCategory: "Sweet Bhaji Box ",
        description: "Traditional compartment boxes designed for mithai and bhaji gifting.",
        image: IMG.sweetBhajiBoxes,
      },
      {
        slug: "chocolate-boxes",
        title: "Chocolate Boxes",
        storeCategory: "Choclate Box",
        description: "Premium MDF chocolate boxes finished with foil and ribbon detailing.",
        image: IMG.chocolateBoxes,
      },
      {
        slug: "dry-fruit-chocolate-sweet-box-cavity-tray",
        title: "Dry Fruits / Chocolate / Sweet Box (Jar with Cavity Tray)",
        storeCategory: "Dry Fruit/Choclate/ Sweet Box (Jar with Cavity Tray)",
        description: "Jar boxes with cavity trays for premium dry fruit, chocolate and sweet gifting.",
        image: IMG.cavityTrayBoxes,
      },
    ],
  },
  {
    slug: "wedding-hampers",
    title: "Wedding Hampers",
    eyebrow: "Celebrations",
    description: "Luxury wedding boxes, invitation hampers and trousseau packaging.",
    heroImage: IMG.weddingInvitationBoxes,
    categories: [
      {
        slug: "wedding-invitation-boxes",
        title: "Wedding Invitation Box",
        storeCategory: "Wedding Invitation Boxes",
        description: "Ornate boxes crafted to present wedding invitations in style.",
        image: IMG.weddingInvitationBoxes,
      },
      {
        slug: "trousseau-packaging-trays",
        title: "Trousseau Packaging Trays",
        storeCategory: "Trousseau Packaging Trays",
        description: "Velvet-lined trays for bridal trousseau presentation.",
        image: IMG.trousseauTrays,
      },
      {
        slug: "trousseau-packaging-baskets",
        title: "Trousseau Packaging Basket",
        storeCategory: "Trousseau Packaging Basket ",
        description: "Woven trousseau baskets finished with fabric and trims.",
        image: IMG.trousseauBaskets,
      },
      {
        slug: "trousseau-packaging-storage-box",
        title: "Trousseau Packaging Storage Box",
        storeCategory: "Trousseau Packaging Storage Box ",
        description: "Rigid trousseau storage boxes with fabric covering and gold detailing.",
        image: IMG.trousseauStorageBoxes,
      },
      {
        slug: "trousseau-packaging-jewellery-boxes",
        title: "Trousseau Packaging Jewellery Boxes",
        storeCategory: "Trousseau Packaging Jewellery Boxes",
        description: "Velvet-interior jewellery boxes for bridal trousseau sets.",
        image: IMG.trousseauJewelleryBoxes,
      },
    ],
  },
  {
    slug: "birthday-hampers",
    title: "Birthday Hampers",
    eyebrow: "Celebrations",
    description: "Return gift hampers, luxury birthday packaging and customized themes.",
    heroImage: IMG.birthdayHero,
    categories: [
      {
        slug: "return-gift-basket-hamper",
        title: "Return Gift Basket Hamper",
        storeCategory: "Return Gift Basket Hamper",
        description: "Basket-style return gift hampers for birthdays and celebrations.",
        image: IMG.returnGiftBasket,
      },
      {
        slug: "return-gift-jar-box-hamper",
        title: "Return Gift Jar Box Hamper",
        storeCategory: "Return Gift Jar Box Hamper",
        description: "Jar and box-style return gift hampers for birthday favours.",
        image: IMG.returnGiftJarBox,
      },
      {
        slug: "return-gift-bags-hamper",
        title: "Return Gift Bags Hamper",
        storeCategory: "Return Gift Bags Hamper",
        description: "Bag-style return gift hampers for birthdays and celebrations.",
        image: IMG.returnGiftBags,
      },
    ],
  },
  {
    slug: "premium-hampers",
    title: "Premium Hampers",
    eyebrow: "Festive Season",
    description: "Luxury festive gifting for Diwali, Christmas and corporate festivals.",
    heroImage: IMG.premiumHero,
    categories: [
      {
        slug: "premium-box-hamper",
        title: "Premium Box Hamper",
        storeCategory: "Premium Box Hamper",
        description: "Premium box hampers for leadership, clients and festive gifting.",
        image: IMG.premiumBox,
      },
      {
        slug: "premium-basket-hamper",
        title: "Premium Basket Hamper",
        storeCategory: "Premium Basket Hamper",
        description: "Premium basket hampers curated for festive and corporate gifting.",
        image: IMG.premiumBasket,
      },
      {
        slug: "premium-tray-hamper",
        title: "Premium Tray Hamper",
        storeCategory: "Premium Tray Hamper",
        description: "Premium tray hampers for elegant festive presentation.",
        image: IMG.premiumTray,
      },
    ],
  },
  {
    slug: "eco-collection",
    title: "Eco Collection",
    eyebrow: "Sustainable Gifting",
    description:
      "Premium jute, cotton and eco-friendly bags — sustainably crafted for conscious gifting and branding.",
    heroImage: IMG.juteCottonBags,
    // Redirects to the Crafty Carry storefront in a new tab.
    external: CRAFTY_CARRY_URL,
    categories: [],
  },
];

export const getCollection = (slug) => COLLECTIONS.find((c) => c.slug === slug);

export const getCategory = (collectionSlug, categorySlug) => {
  const collection = getCollection(collectionSlug);
  if (!collection) return { collection: null, category: null };
  const category = collection.categories.find((c) => c.slug === categorySlug);
  return { collection, category };
};

export const getProduct = (collectionSlug, categorySlug, productSlug) => {
  const { collection, category } = getCategory(collectionSlug, categorySlug);
  if (!category) return { collection, category: null, product: null };
  const product = (category.products || []).find((p) => p.slug === productSlug);
  return { collection, category, product };
};
