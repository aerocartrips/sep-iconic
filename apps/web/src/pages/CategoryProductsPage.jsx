import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Loader2 } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductCard from '@/components/ProductCard';
import { getCategory } from '@/lib/collections';
import { useStoreCategoryProducts } from '@/hooks/useStoreCategoryProducts';

// Number of product cards revealed at a time. The full filtered list is kept
// in memory; we simply reveal more of it as the customer scrolls, so the page
// behaves like ONE continuous list (no Page 1 / Page 2 / Next buttons).
const REVEAL_STEP = 12;
const INITIAL_REVEAL = 12;

const CategoryProductsPage = () => {
  const { collectionSlug, categorySlug } = useParams();
  const { collection, category } = getCategory(collectionSlug, categorySlug);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [customOnly, setCustomOnly] = useState(false);
  const [revealCount, setRevealCount] = useState(INITIAL_REVEAL);

  // Fetch live store products when storeCategory is mapped.
  // productIds (optional) reassigns specific backend products into this sub-category.
  const { products: storeProducts, loading } = useStoreCategoryProducts(
    category?.storeCategory || null,
    category?.productIds,
  );

  // Always use live store products from the Hostinger Ecommerce catalog.
  // Never fall back to hard-coded sample products (per spec: no mock products).
  const products = storeProducts;

  const filtered = useMemo(() => {
    let list = [...products];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) =>
        (p.name || p.title || '').toLowerCase().includes(q) ||
        (p.shortDescription || '').toLowerCase().includes(q)
      );
    }
    if (customOnly) list = list.filter((p) => p.customizable);
    if (sort === 'name-asc') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sort === 'name-desc') list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    return list;
  }, [products, query, sort, customOnly]);

  // Reset the reveal window whenever the filtered set changes so the customer
  // starts from the top of the new result set.
  useEffect(() => {
    setRevealCount(INITIAL_REVEAL);
  }, [filtered]);

  const visibleItems = filtered.slice(0, revealCount);
  const hasMore = revealCount < filtered.length;

  // Infinite-scroll sentinel: when it scrolls into view, reveal the next batch.
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRevealCount((c) => Math.min(c + REVEAL_STEP, filtered.length));
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  if (!collection || !category) return <Navigate to="/collections" replace />;

  return (
    <>
      <Helmet>
        <title>{category.title} — {collection.title} — Iconic Handicraft</title>
        <meta name="description" content={category.description} />
      </Helmet>

      <section className="relative h-[46vh] min-h-[320px] w-full overflow-hidden">
        <img src={category.image} alt={category.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/45" />
        <div className="relative z-10 h-full flex items-end pb-12">
          <div className="mx-auto max-w-[90rem] w-full px-6">
            <Breadcrumbs
              items={[
                { label: 'Collections', to: '/collections' },
                { label: collection.title, to: `/collections/${collection.slug}` },
                { label: category.title },
              ]}
            />
            <h1 className="font-display text-white text-3xl md:text-5xl leading-tight max-w-2xl mt-5">
              {category.title}
            </h1>
            <p className="text-white/85 font-light max-w-xl mt-3">{category.description}</p>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 mb-10 bg-white border border-border rounded-2xl p-4 md:p-5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products in this category"
                className="w-full pl-11 pr-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-gold bg-[hsl(var(--background))]"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
              <SlidersHorizontal className="h-4 w-4" />
              <input type="checkbox" checked={customOnly} onChange={(e) => setCustomOnly(e.target.checked)} className="accent-primary" />
              Customizable only
            </label>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-full border border-border text-sm px-4 py-2.5 focus:outline-none focus:border-gold bg-[hsl(var(--background))]"
            >
              <option value="featured">Sort: Featured</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="font-light">Loading products…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="font-display text-2xl text-primary mb-3">No products match your search</p>
              <p className="text-muted-foreground font-light">Try clearing filters, or request a custom quote for a bespoke item.</p>
              <Link to={`/request-quote?category=${encodeURIComponent(collection.title)}`} className="inline-block mt-6 px-7 py-3 rounded-full bg-primary text-primary-foreground text-sm">
                Request a Custom Quote
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Showing all {filtered.length} product{filtered.length !== 1 ? 's' : ''}
                {visibleItems.length < filtered.length ? ` · ${visibleItems.length} loaded` : ''}
              </p>
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleItems.map((p, i) => (
                  <ProductCard
                    key={p.id || p.slug}
                    product={p}
                    index={i}
                    to={p.isStoreProduct ? `/product/${p.id}` : `/collections/${collection.slug}/${category.slug}/${p.slug}`}
                    collectionSlug={collection.slug}
                    collectionTitle={collection.title}
                  />
                ))}
              </div>

              {/* Infinite-scroll sentinel: reveals the next batch automatically
                  as the customer scrolls. No page numbers, no Next button. */}
              {hasMore && (
                <div ref={sentinelRef} className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-light text-sm">Loading more products…</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
};

export default CategoryProductsPage;
