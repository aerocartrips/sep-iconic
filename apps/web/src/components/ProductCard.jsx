import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Sparkles, MessageCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { getStoreEntry, MOQ } from '@/lib/storeMap';
import { toast } from '@/hooks/use-toast';
import { getProductWhatsAppUrl } from '@/lib/site';
import ProtectedProductImage from '@/components/ProtectedProductImage';
import { buildLineShippingMeta } from '@/lib/productShipping';

const formatINR = (cents) => `\u20b9${(cents / 100).toFixed(2)}`;

const ProductCard = ({ product, to, index = 0, collectionSlug, collectionTitle }) => {
  const { addItem } = useCart();
  const navigate = useNavigate();

  const storeEntry = product.isStoreProduct ? null : getStoreEntry(collectionSlug);
  const productName = product.name || product.title || '';

  const displayPrice = product.isStoreProduct
    ? product.price_in_cents
    : storeEntry?.price_in_cents;

  const productPath =
    to ||
    (product.isStoreProduct && product.id ? `/product/${product.id}` : '#');

  const whatsappHref = getProductWhatsAppUrl({
    name: productName,
    id: product.id || product.sku || product.slug,
    sku: product.sku,
    url:
      typeof window !== 'undefined'
        ? `${window.location.origin}${productPath.startsWith('/') ? productPath : `/${productPath}`}`
        : productPath,
  });

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (product.isStoreProduct) {
      const firstVariant = product.variants?.[0];
      if (!firstVariant) return;
      const shipping = buildLineShippingMeta(product, firstVariant);
      addItem(
        {
          productId: product.id,
          variantId: firstVariant.id,
          title: productName,
          image: product.image,
          price_in_cents: firstVariant.price_in_cents || product.price_in_cents,
          currency: firstVariant.currency || product.currency || 'inr',
          variantTitle: firstVariant.title || null,
          sku: firstVariant.sku || product.sku || product.id,
          weight: firstVariant.weight ?? null,
          shipping,
        },
        MOQ
      );
    } else {
      if (!storeEntry) return;
      addItem(
        {
          productId: storeEntry.productId,
          variantId: storeEntry.variantId,
          title: productName,
          image: product.image,
          price_in_cents: storeEntry.price_in_cents,
          currency: storeEntry.currency,
        },
        MOQ
      );
    }
    toast({ title: 'Added to cart', description: `${productName} × ${MOQ} pieces` });
  };

  const handleBulkQuote = (e) => {
    e.preventDefault();
    navigate(
      `/request-quote?category=${encodeURIComponent(collectionTitle || '')}&product=${encodeURIComponent(productName)}`
    );
  };

  const canAddToCart = product.isStoreProduct
    ? product.variants?.length > 0
    : !!storeEntry;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: (index % 8) * 0.05 }}
      className="group rounded-[1.5rem] overflow-hidden bg-white border border-border shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col"
    >
      <Link to={productPath} className="block relative">
        <ProtectedProductImage
          src={product.image}
          alt={productName}
          className="w-full border-b border-border/60"
          imgClassName="transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex gap-2 z-10 pointer-events-none">
          {product.customizable && (
            <span className="bg-gold text-primary text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Customizable
            </span>
          )}
        </div>
        <span className="absolute bottom-3 left-3 z-10 bg-primary/90 text-primary-foreground text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full pointer-events-none">
          MOQ: {MOQ} pcs
        </span>
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-xl text-primary mb-1.5">{productName}</h3>
        <p className="text-muted-foreground text-sm font-light mb-3 line-clamp-2">
          {product.shortDescription}
        </p>

        {displayPrice != null && (
          <div className="mb-4">
            <p className="text-primary font-display text-lg">
              From {formatINR(displayPrice)}{' '}
              <span className="text-xs text-muted-foreground font-sans">/ piece</span>
            </p>
            <p className="text-[11px] text-muted-foreground font-light mt-0.5">
              Bulk quantity discounts available. Contact us for a custom quotation.
            </p>
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm py-2.5 hover:bg-[hsl(133_23%_33%)] transition-colors disabled:opacity-40"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
          </button>
          <button
            type="button"
            onClick={handleBulkQuote}
            className="inline-flex items-center justify-center rounded-full border border-primary text-primary text-xs sm:text-sm py-2.5 hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Request Bulk Quote
          </button>
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#25D366] text-[#128C7E] text-xs sm:text-sm py-2.5 hover:bg-[#25D366] hover:text-white transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Enquire on WhatsApp
        </a>
      </div>
    </motion.div>
  );
};

export default ProductCard;
