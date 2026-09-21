import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2 } from 'lucide-react';
import { COLLECTIONS } from '@/lib/collections';
import { getAllStoreProducts } from '@/hooks/useStoreCategoryProducts';

const formatINR = (cents) => `\u20b9${(cents / 100).toFixed(2)}`;

function normalizeKey(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/choclate/g, 'chocolate')
    .replace(/fruits/g, 'fruit')
    .replace(/[^a-z0-9]/g, '');
}

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Map each backend category id → the site sub-category + parent collection it
// belongs to, so search can match by category / sub-category name too.
function buildCategoryIndex(categories) {
  const idx = {};
  COLLECTIONS.forEach((col) => {
    (col.categories || []).forEach((sub) => {
      if (!sub.storeCategory) return;
      const target = normalizeKey(sub.storeCategory);
      if (!target) return;
      const cat =
        categories.find((c) => normalizeKey(c.title) === target) ||
        categories.find((c) => {
          const k = normalizeKey(c.title);
          return k.includes(target) || target.includes(k);
        });
      if (cat) {
        idx[cat.id] = {
          subTitle: sub.title,
          collectionTitle: col.title,
          collectionSlug: col.slug,
          categorySlug: sub.slug,
        };
      }
    });
  });
  return idx;
}

const SearchDialog = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [catIndex, setCatIndex] = useState({});
  const inputRef = useRef(null);

  // Load the full live catalog once when first opened.
  useEffect(() => {
    if (!open || allProducts.length) return;
    setLoading(true);
    getAllStoreProducts()
      .then(({ products, categories }) => {
        setAllProducts(products);
        setCatIndex(buildCategoryIndex(categories));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, allProducts.length]);

  // Focus input + lock scroll when open; reset on close.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      document.body.style.overflow = 'hidden';
      return () => clearTimeout(t);
    }
    document.body.style.overflow = '';
    setQuery('');
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const matched = [];
    for (const p of allProducts) {
      const cat = (p.collections || [])
        .map((c) => catIndex[c.collection_id])
        .find(Boolean);
      const text = [
        p.title,
        p.subtitle,
        stripHtml(p.description),
        cat?.subTitle,
        cat?.collectionTitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (terms.every((t) => text.includes(t))) {
        matched.push({ ...p, _cat: cat });
      }
      if (matched.length >= 12) break;
    }
    return matched;
  }, [query, allProducts, catIndex]);

  const go = (p) => {
    onOpenChange(false);
    navigate(`/product/${p.id}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full bg-[hsl(var(--background))] shadow-2xl border-b border-border"
          >
            <div className="mx-auto max-w-[90rem] px-6 py-5">
              <div className="flex items-center gap-4">
                <Search className="h-5 w-5 text-primary flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, categories, sub-categories…"
                  className="flex-1 bg-transparent text-lg font-light text-foreground placeholder:text-muted-foreground/70 outline-none"
                />
                <button
                  onClick={() => onOpenChange(false)}
                  aria-label="Close search"
                  className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>

          <div className="relative flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[90rem] px-6 py-8">
              {loading ? (
                <div className="flex items-center justify-center gap-3 text-muted-foreground py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="font-light">Loading products…</span>
                </div>
              ) : query.trim() === '' ? (
                <div className="text-center py-20">
                  <p className="font-display text-2xl text-primary mb-2">Search the Iconic Handicraft catalog</p>
                  <p className="text-muted-foreground font-light">
                    Type a product name, category or sub-category to see live results.
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-20">
                  <p className="font-display text-2xl text-primary mb-2">No products match “{query}”</p>
                  <p className="text-muted-foreground font-light">Try a different keyword, or request a custom quote.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-5">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {results.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => go(p)}
                        className="group flex items-center gap-4 rounded-2xl bg-white border border-border p-3 text-left hover:shadow-lg hover:border-gold transition-all"
                      >
                        <div className="h-16 w-16 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                          <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-base text-primary truncate">{p.title}</p>
                          {p._cat?.subTitle && (
                            <p className="text-xs text-muted-foreground font-light truncate">
                              {p._cat.collectionTitle} · {p._cat.subTitle}
                            </p>
                          )}
                          {p.price_in_cents > 0 && (
                            <p className="text-sm text-primary mt-1">From {formatINR(p.price_in_cents)}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchDialog;
