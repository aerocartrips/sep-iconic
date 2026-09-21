import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle, Loader2 } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProductCard from '@/components/ProductCard';
import { getCollection } from '@/lib/collections';
import { WHATSAPP_URL } from '@/lib/site';
import { useStoreCategoryProducts } from '@/hooks/useStoreCategoryProducts';

const CollectionPage = () => {
  const { collectionSlug } = useParams();
  const collection = getCollection(collectionSlug);

  if (!collection) return <Navigate to="/collections" replace />;

  return (
    <>
      <Helmet>
        <title>{collection.title} — Iconic Handicraft</title>
        <meta name="description" content={collection.description} />
      </Helmet>

      <section className="relative h-[65vh] min-h-[420px] w-full overflow-hidden">
        <img src={collection.heroImage} alt={collection.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/40" />
        <div className="relative z-10 h-full flex items-end pb-16">
          <div className="mx-auto max-w-[90rem] w-full px-6">
            <Breadcrumbs
              items={[{ label: 'Collections', to: '/collections' }, { label: collection.title }]}
            />
            <span className="inline-block text-gold tracking-[0.35em] uppercase text-xs mt-6 mb-4">
              {collection.eyebrow}
            </span>
            <h1 className="font-display text-white text-4xl md:text-6xl leading-tight max-w-2xl">
              {collection.title}
            </h1>
            <p className="text-white/85 text-lg font-light max-w-xl mt-4">{collection.description}</p>

            {collection.external && (
              <div className="flex flex-wrap gap-4 mt-8">
                <a
                  href={collection.external}
                  target="_blank"
                  rel="noreferrer"
                  className="px-7 py-3.5 rounded-full bg-gold text-primary text-sm tracking-wide hover:brightness-105 transition-all inline-flex items-center gap-2"
                >
                  Visit Crafty Carry <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {collection.external && (
        <section className="py-14 bg-secondary/60 text-center">
          <p className="text-primary font-display text-2xl md:text-3xl max-w-2xl mx-auto px-6">
            Explore the complete eco-friendly collection on Crafty Carry
          </p>
        </section>
      )}

      {!collection.external &&
        (collection.directProducts ? (
          <EcoProducts collection={collection} />
        ) : (
          <section className="py-24 md:py-32 bg-[hsl(var(--background))]">
          <div className="mx-auto max-w-[90rem] px-6">
            <h2 className="font-display text-primary text-3xl md:text-4xl mb-12">Categories</h2>
            <div className={`grid gap-7 sm:grid-cols-2 ${collection.categories.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
              {collection.categories.map((cat, i) => (
                <motion.div
                  key={cat.slug}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
                >
                  {cat.external ? (
                    <a
                      href={cat.external}
                      target="_blank"
                      rel="noreferrer"
                      className="group block rounded-[1.75rem] overflow-hidden bg-white border border-border shadow-sm hover:shadow-2xl transition-all duration-500"
                    >
                      <CategoryCard cat={cat} external />
                    </a>
                  ) : (
                    <Link
                      to={`/collections/${collection.slug}/${cat.slug}`}
                      className="group block rounded-[1.75rem] overflow-hidden bg-white border border-border shadow-sm hover:shadow-2xl transition-all duration-500"
                    >
                      <CategoryCard cat={cat} />
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="pb-24 md:pb-32">
        <div className="mx-auto max-w-[90rem] px-6 rounded-[2rem] bg-primary text-primary-foreground py-14 px-8 md:px-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="font-display text-3xl md:text-4xl mb-2">Need this in bulk for your brand?</h3>
            <p className="text-white/80 font-light">Minimum order 50 pieces, fully customized branding available.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to={`/request-quote?category=${encodeURIComponent(collection.title)}`} className="px-7 py-3.5 rounded-full bg-gold text-primary text-sm tracking-wide hover:brightness-105 transition-all">
              Request a Custom Quote
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="px-7 py-3.5 rounded-full border border-white/60 text-white text-sm tracking-wide hover:bg-white/10 transition-all inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

const CategoryCard = ({ cat, external }) => (
  <>
    <div className="relative h-60 overflow-hidden">
      <img src={cat.image} alt={cat.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent opacity-70" />
    </div>
    <div className="p-6">
      <h3 className="font-display text-xl text-primary mb-2">{cat.title}</h3>
      <p className="text-muted-foreground text-sm font-light mb-4">{cat.description}</p>
      <span className="inline-flex items-center gap-2 text-sm text-primary group-hover:text-gold transition-colors">
        {external ? 'Visit Crafty Carry' : 'Explore Products'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  </>
);

const EcoProducts = ({ collection }) => {
  const { products, loading } = useStoreCategoryProducts(collection.storeCategory);

  return (
    <section className="py-24 md:py-32 bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-[90rem] px-6">
        <h2 className="font-display text-primary text-3xl md:text-4xl mb-3">Eco Products</h2>
        <p className="text-muted-foreground font-light mb-12 max-w-2xl">
          Sustainable jute, cotton and eco-friendly bags — crafted for conscious gifting and branding.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="font-light">Loading products…</span>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-display text-2xl text-primary mb-3">No products available right now</p>
            <p className="text-muted-foreground font-light">Request a custom eco-friendly quote for your brand.</p>
            <Link to={`/request-quote?category=${encodeURIComponent(collection.title)}`} className="inline-block mt-6 px-7 py-3 rounded-full bg-primary text-primary-foreground text-sm">
              Request a Custom Quote
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">{products.length} product{products.length !== 1 ? 's' : ''} found</p>
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard
                  key={p.id || p.slug}
                  product={p}
                  index={i}
                  to={`/product/${p.id}`}
                  collectionSlug={collection.slug}
                  collectionTitle={collection.title}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default CollectionPage;
