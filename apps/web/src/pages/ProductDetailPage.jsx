import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Navigate, Link } from 'react-router-dom';
import { MessageCircle, ShieldCheck, Package, Sparkles, Minus, Plus, ShoppingCart } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductCard from '@/components/ProductCard';
import { getProduct } from '@/lib/collections';
import { getProductWhatsAppUrl } from '@/lib/site';
import ProtectedProductImage from '@/components/ProtectedProductImage';
import { useCart } from '@/context/CartContext';
import { getStoreEntry, MOQ } from '@/lib/storeMap';
import { toast } from '@/hooks/use-toast';

const formatINR = (cents) => `\u20b9${(cents / 100).toFixed(2)}`;

const ProductDetailPage = () => {
  const { collectionSlug, categorySlug, productSlug } = useParams();
  const { collection, category, product } = getProduct(collectionSlug, categorySlug, productSlug);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(MOQ);

  if (!collection || !category || !product) return <Navigate to="/collections" replace />;

  const storeEntry = getStoreEntry(collection.slug);
  const related = category.products.filter((p) => p.slug !== product.slug).slice(0, 4);
  const belowMoq = quantity < MOQ;

  const handleAddToCart = () => {
    if (!storeEntry || belowMoq) return;
    addItem(
      {
        productId: storeEntry.productId,
        variantId: storeEntry.variantId,
        title: product.name,
        image: product.image,
        price_in_cents: storeEntry.price_in_cents,
        currency: storeEntry.currency,
      },
      quantity
    );
    toast({ title: 'Added to cart', description: `${product.name} × ${quantity} pieces` });
  };

  return (
    <>
      <Helmet>
        <title>{product.name} — Iconic Handicraft</title>
        <meta name="description" content={product.shortDescription} />
      </Helmet>

      <section className="pt-32 md:pt-40 pb-16 md:pb-24 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <Breadcrumbs
            items={[
              { label: 'Collections', to: '/collections' },
              { label: collection.title, to: `/collections/${collection.slug}` },
              { label: category.title, to: `/collections/${collection.slug}/${category.slug}` },
              { label: product.name },
            ]}
          />

          <div className="grid lg:grid-cols-2 gap-12 mt-8">
            <ProtectedProductImage
              src={product.image}
              alt={product.name}
              className="rounded-[2rem] bg-white border border-border shadow-sm"
            />

            <div className="flex flex-col justify-center">
              <span className="text-gold tracking-[0.35em] uppercase text-xs mb-4">{collection.title}</span>
              <h1 className="font-display text-primary text-4xl md:text-5xl leading-tight mb-5">{product.name}</h1>
              <p className="text-muted-foreground text-lg font-light mb-6">{product.shortDescription}</p>

              <div className="flex flex-wrap gap-3 mb-6">
                {product.customizable && (
                  <span className="inline-flex items-center gap-2 bg-gold/15 text-primary text-xs tracking-wide uppercase px-4 py-2 rounded-full">
                    <Sparkles className="h-3.5 w-3.5" /> Customizable
                  </span>
                )}
                <span className="inline-flex items-center gap-2 bg-secondary text-primary text-xs tracking-wide uppercase px-4 py-2 rounded-full">
                  <Package className="h-3.5 w-3.5" /> MOQ: {MOQ} pcs
                </span>
                <span className="inline-flex items-center gap-2 bg-secondary text-primary text-xs tracking-wide uppercase px-4 py-2 rounded-full">
                  <ShieldCheck className="h-3.5 w-3.5" /> OEM & Private Label
                </span>
              </div>

              {/* Specifications */}
              <div className="mb-7 space-y-2 text-sm">
                {product.dimensions && (
                  <p><span className="text-primary font-medium">Dimensions: </span><span className="text-muted-foreground font-light">{product.dimensions}</span></p>
                )}
                {product.material && (
                  <p><span className="text-primary font-medium">Material: </span><span className="text-muted-foreground font-light">{product.material}</span></p>
                )}
                {product.variants?.length > 0 && (
                  <p><span className="text-primary font-medium">Available Variants: </span><span className="text-muted-foreground font-light">{product.variants.join(', ')}</span></p>
                )}
                {product.specifications?.length > 0 && (
                  <ul className="list-disc list-inside text-muted-foreground font-light">
                    {product.specifications.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                )}
              </div>

              {storeEntry && (
                <div className="mb-7 p-6 rounded-2xl bg-white border border-border">
                  <p className="font-display text-3xl text-primary mb-1">
                    {formatINR(storeEntry.price_in_cents)} <span className="text-sm text-muted-foreground font-sans">/ piece</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-light mb-5">
                    Bulk quantity discounts available. Contact us for a custom quotation.
                  </p>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center border border-border rounded-full overflow-hidden">
                      <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-10 w-10 flex items-center justify-center hover:bg-secondary">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                        className="w-20 text-center text-sm outline-none"
                      />
                      <button onClick={() => setQuantity((q) => q + 1)} className="h-10 w-10 flex items-center justify-center hover:bg-secondary">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="font-display text-xl text-primary">{formatINR(storeEntry.price_in_cents * quantity)}</p>
                  </div>

                  {belowMoq && (
                    <p className="text-destructive text-sm mb-4">
                      Minimum Order Quantity is {MOQ} Pieces. Please increase your quantity to continue.
                    </p>
                  )}

                  <button
                    onClick={handleAddToCart}
                    disabled={belowMoq}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="h-4 w-4" /> Add to Cart
                  </button>
                </div>
              )}

              <div className="mb-7 p-5 rounded-2xl bg-gold/10 text-sm text-primary">
                Buying in Bulk? Get special pricing for larger quantities. Request a custom quotation for the best wholesale price.
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  to={`/request-quote?category=${encodeURIComponent(collection.title)}&product=${encodeURIComponent(product.name)}`}
                  className="px-8 py-4 rounded-full bg-gold text-primary text-sm tracking-wide hover:brightness-105 transition-all hover:-translate-y-0.5 font-medium"
                >
                  Request Bulk Quote
                </Link>
                <a
                  href={getProductWhatsAppUrl({
                    name: product.name,
                    id: product.slug,
                    url: typeof window !== 'undefined' ? window.location.href : undefined,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="px-8 py-3.5 rounded-full border border-primary text-primary text-sm tracking-wide hover:bg-primary hover:text-primary-foreground transition-all inline-flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="pb-24 md:pb-32">
          <div className="mx-auto max-w-[90rem] px-6">
            <h2 className="font-display text-primary text-3xl md:text-4xl mb-10">More in {category.title}</h2>
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard
                  key={p.slug}
                  product={p}
                  index={i}
                  to={`/collections/${collection.slug}/${category.slug}/${p.slug}`}
                  collectionSlug={collection.slug}
                  collectionTitle={collection.title}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default ProductDetailPage;
