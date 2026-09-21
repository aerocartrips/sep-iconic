export const LOGO_URL =
  "https://horizons-cdn.hostinger.com/d5eb7cbb-48ed-41aa-b968-4a11089ceea8/a86878aea2601e47fa215a8873613049.png";

export const INDIAMART_LOGO_URL =
  "https://horizons-cdn.hostinger.com/d5eb7cbb-48ed-41aa-b968-4a11089ceea8/59c8a05abd404c57f62f8d0fdbab9c1a.png";

/** Digits only with country code for wa.me */
export const WHATSAPP_NUMBER = "919315748789";
/** Local display / tel: link (no spaces for tel reliability) */
export const PHONE_TEL = "9315748789";
export const PHONE = "+91 93157 48789";

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hello Iconic Handicraft, I would like to know more about your premium gifting solutions."
)}`;

/**
 * Build a product-specific WhatsApp enquiry URL so the admin can identify the item.
 * @param {{ name?: string, title?: string, id?: string, sku?: string, url?: string }} product
 */
export function getProductWhatsAppUrl(product = {}) {
  const name = product.name || product.title || "your product";
  const id = product.id || product.sku || product.slug || "";
  const url =
    product.url ||
    (typeof window !== "undefined" && product.id
      ? `${window.location.origin}/product/${product.id}`
      : "");
  const lines = [
    `Hello Iconic Handicraft, I am interested in ${name}.`,
    "Please share more details, pricing and availability.",
  ];
  if (id) lines.push(`Product ID: ${id}`);
  if (url) lines.push(`Product: ${url}`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join(" "))}`;
}

export const EMAIL = "support@iconichandicraft.com";

export const SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/iconichandicraft_com/",
  youtube: "https://www.youtube.com/@iconichandicraft",
  facebook: "https://www.facebook.com/profile.php?id=61588108885817",
  linkedin: "https://www.linkedin.com/company/132374212/",
};
export const ADDRESS = "Iconic Handicraft, Industrial Estate, India";
export const CRAFTY_CARRY_URL = "https://craftycarry.com";

const HERO = {
  corporate: "https://images.hostinger.com/af79db7c-e8a0-439b-818b-8dc3df3c797f.png",
  mdf: "https://images.hostinger.com/21c56f21-a2ae-4958-b10b-bc0d84512e64.png",
  eco: "https://images.hostinger.com/61c256cc-8695-4a53-8906-141fe33efe89.png",
  wedding: "https://images.hostinger.com/82ad4bf8-db5d-47e4-99dc-c7271ae42c1d.png",
  birthday: "https://images.hostinger.com/fc7fa40f-fd9a-45cd-9ffc-1edcf19e68a9.png",
  festive: "https://images.hostinger.com/2c09c9dd-16f7-4a10-904b-763f6affa943.png",
};

export const QUOTE_IMAGE =
  "https://images.hostinger.com/7a41efda-82b4-44b1-acea-66246fd9b738.png";

export const HERO_SLIDES = [
  {
    image: HERO.corporate,
    eyebrow: "Corporate Gifting",
    title: "Corporate Hampers",
    description:
      "Luxury corporate gifting solutions with complete customization and refined branding.",
  },
  {
    image: HERO.mdf,
    eyebrow: "Luxury Packaging",
    title: "Dry Fruits, Chocolate & Sweet Boxes",
    description:
      "Premium MDF boxes designed for gifting, branding and luxury packaging.",
  },
  {
    image: HERO.eco,
    eyebrow: "Eco Collection by Iconic Handicraft",
    title: "Crafty Carry Eco Collection",
    description:
      "Premium jute bags, cotton bags and jacquard bags — sustainable luxury.",
    externalCta: { label: "Visit Crafty Carry", url: CRAFTY_CARRY_URL },
  },
  {
    image: HERO.wedding,
    eyebrow: "Celebrations",
    title: "Wedding Hampers",
    description:
      "Luxury wedding boxes, invitation hampers, return gifts and customized names.",
  },
  {
    image: HERO.birthday,
    eyebrow: "Celebrations",
    title: "Birthday Hampers",
    description:
      "Kids birthday hampers, luxury birthday packaging and customized themes.",
  },
  {
    image: HERO.festive,
    eyebrow: "Festive Season",
    title: "Premium Hampers",
    description:
      "Luxury festive gifting for Diwali, Christmas and corporate festivals.",
  },
];

export const CATEGORY_OPTIONS = [
  "Corporate Hampers",
  "Dry Fruits, Chocolate & Sweet Boxes",
  "Wedding Hampers",
  "Birthday Hampers",
  "Premium Hampers",
  "Eco Collection",
  "Other / Custom",
];
