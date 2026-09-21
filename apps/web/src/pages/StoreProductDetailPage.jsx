import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MessageCircle, ShieldCheck, Package, Sparkles, Minus, Plus, ShoppingCart, Loader2, ChevronLeft } from 'lucide-react';
import { getProduct } from '@/api/EcommerceApi';
import { useCart } from '@/context/CartContext';
import { toast } from '@/hooks/use-toast';
import { getProductWhatsAppUrl } from '@/lib/site';
import ProtectedProductImage from '@/components/ProtectedProductImage';
import {
  buildLineShippingMeta,
  formatDimensions,
  formatWeight,
  getVariantDimensions,
} from '@/lib/productShipping';

const MOQ = 100;
const formatINR = (cents) => `\u20b9${(cents / 100).toFixed(2)}`;

const StoreProductDetailPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(MOQ);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    setLoading(true);
    getProduct(productId)
      .then((p) => {
        setProduct(p);
        setSelectedVariantId(p.variants?.[0]?.id || null);
        setActiveImage(p.image || p.images?.[0]?.url);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [productId]);

  const selectedVariant = useMemo(
    () => product?.variants?.find((v) => v.id === selectedVariantId) || product?.variants?.[0] || null,
    [product, selectedVariantId]
  );

  // Size/weight from live backend product data (variant title / SIZE option / weight field)
  const dims = useMemo(
    () => (product ? getVariantDimensions(product, selectedVariant) : null),
    [product, selectedVariant]
  );
  const sizeLabel = formatDimensions(dims);
  const weightLabel = formatWeight(
    selectedVariant?.weight ?? product?.weight ?? null,
    selectedVariant?.weight_unit || product?.weight_unit
  );
  const shippingMeta = useMemo(
    () => (product ? buildLineShippingMeta(product, selectedVariant) : null),
    [product, selectedVariant]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="font-display text-2xl text-primary">Product not found</p>
        <Link to="/collections" className="text-sm text-muted-foreground underline">Browse Collections</Link>
      </div>
    );
  }

  const price = selectedVariant?.price_in_cents || product.price_in_cents;
  const belowMoq = quantity < MOQ;

  const handleAddToCart = () => {
    if (!selectedVariant || belowMoq) return;
    addItem(
      {
        productId: product.id,
        variantId: selectedVariant.id,
        title: product.title,
        image: product.image,
        price_in_cents: selectedVariant.price_in_cents,
        currency: selectedVariant.currency || 'inr',
        variantTitle: selectedVariant.title || null,
        sku: selectedVariant.sku || product.handle || product.id,
        weight: selectedVariant.weight ?? null,
        shipping: shippingMeta,
      },
      quantity
    );
    toast({ title: 'Added to cart', description: `${product.title} × ${quantity} pieces` });
  };

  const allImages = [product.image, ...(product.images || []).map((i) => i.url).filter(Boolean)].filter(Boolean);

  return (
    <>
      <Helmet>
        <title>{product.title} — Iconic Handicraft</title>
        <meta name="description" content={product.subtitle || product.title} />
      </Helmet>

      <div className="pt-28 md:pt-36 pb-20 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
            {/* Image gallery */}
            <div>
              <ProtectedProductImage
                src={activeImage || product.image}
                alt={product.title}
                className="rounded-2xl bg-white border border-border"
              />
              {allImages.length > 1 && (
                <div className="flex gap-3 mt-4 flex-wrap">
                  {allImages.slice(0, 6).map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImage(url)}
                      className={`h-16 w-16 rounded-xl overflow-hidden border-2 transition-colors ${activeImage === url ? 'border-primary' : 'border-border'}`}
                    >
                      <ProtectedProductImage src={url} alt="" className="h-full w-full rounded-none" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex gap-2 mb-3">
                  <span className="bg-gold text-primary text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Customizable
                  </span>
                  <span className="bg-primary/10 text-primary text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full">
                    MOQ: {MOQ} pcs
                  </span>
                </div>
                <h1 className="font-display text-3xl md:text-4xl text-primary mb-2">{product.title}</h1>
                {product.subtitle && <p className="text-muted-foreground font-light">{product.subtitle}</p>}
              </div>

              {price > 0 && (
                <div>
                  <p className="font-display text-2xl text-primary">From {formatINR(price)} <span className="text-sm text-muted-foreground font-sans">/ piece</span></p>
                  <p className="text-sm text-muted-foreground font-light mt-1">Bulk discounts available — contact us for a custom quote.</p>
                </div>
              )}

              {/* Size & Weight from backend product data — only show when a real value exists */}
              {(sizeLabel || weightLabel) && (
                <div className="space-y-1.5 text-sm border border-border rounded-xl bg-white px-4 py-3">
                  {sizeLabel && (
                    <p>
                      <span className="text-primary font-medium">Size/Dimensions: </span>
                      <span className="text-muted-foreground font-light">{sizeLabel}</span>
                    </p>
                  )}
                  {weightLabel && (
                    <p>
                      <span className="text-primary font-medium">Weight: </span>
                      <span className="text-muted-foreground font-light">{weightLabel}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Variants */}
              {product.variants?.length > 1 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Select Option</p>
                  <div className="flex gap-2 flex-wrap">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                          selectedVariantId === v.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary text-foreground'
                        }`}
                      >
                        {v.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Quantity (Min. {MOQ} pieces)</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity((q) => Math.max(MOQ, q - 10))} className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:border-primary transition-colors">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    min={MOQ}
                    onChange={(e) => setQuantity(Math.max(MOQ, parseInt(e.target.value) || MOQ))}
                    className="w-20 text-center border border-border rounded-xl py-2 text-sm focus:outline-none focus:border-primary bg-white"
                  />
                  <button onClick={() => setQuantity((q) => q + 10)} className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:border-primary transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {belowMoq && <p className="text-xs text-destructive mt-1.5">Minimum order quantity is {MOQ} pieces.</p>}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={belowMoq || !selectedVariant}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 text-sm font-medium hover:bg-[hsl(133_23%_33%)] transition-colors disabled:opacity-40"
                >
                  <ShoppingCart className="h-4 w-4" /> Add to Cart
                </button>
                <Link
                  to={`/request-quote?product=${encodeURIComponent(product.title)}`}
                  className="flex-1 inline-flex items-center justify-center rounded-full border border-primary text-primary py-3.5 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Request Bulk Quote
                </Link>
              </div>

              <a
                href={getProductWhatsAppUrl({
                  name: product.title,
                  id: product.id,
                  sku: product.handle || product.id,
                  url: typeof window !== 'undefined' ? window.location.href : `/product/${product.id}`,
                })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#25D366] border border-[#25D366] rounded-full px-5 py-2.5 hover:bg-[#25D366] hover:text-white transition-colors w-fit"
              >
                <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
              </a>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" /> 100% Customizable
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-4 w-4 text-primary" /> Pan-India Shipping
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="prose prose-sm max-w-none text-muted-foreground font-light pt-2 border-t border-border"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}

              {/* Additional info sections */}
              {product.additional_info?.map((info) => (
                <div key={info.id} className="pt-2 border-t border-border">
                  <h4 className="font-medium text-foreground mb-2">{info.title}</h4>
                  <div className="prose prose-sm max-w-none text-muted-foreground font-light"
                    dangerouslySetInnerHTML={{ __html: info.description }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreProductDetailPage;
