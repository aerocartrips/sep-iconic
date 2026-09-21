import { useState, useEffect } from 'react';
import { getProducts, getCategories } from '@/api/EcommerceApi';

// Module-level cache so data is fetched once per session
let _allProducts = null;
let _allCategories = null;
let _fetchPromise = null;

/** Normalize titles for fuzzy match (backend titles have typos/spaces/& vs and). */
function normalizeCategoryKey(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/choclate/g, 'chocolate') // backend typo
    .replace(/fruits/g, 'fruit')
    .replace(/[^a-z0-9]/g, '');
}

async function fetchAll() {
  if (_allProducts && _allCategories) return { products: _allProducts, categories: _allCategories };
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    const [catResult] = await Promise.all([getCategories()]);
    _allCategories = catResult.categories;

    const allProds = [];
    const seenIds = new Set();
    let offset = 0;
    const limit = 100;
    // Paginate through the ENTIRE catalog. offset/limit must be numbers so
    // getProducts() appends them to the query (it ignores string offsets).
    while (true) {
      const result = await getProducts({ limit, offset });
      const batch = result.products || [];
      // Dedup by product id — guards against any API repetition across pages.
      for (const p of batch) {
        if (p && p.id && !seenIds.has(p.id)) {
          seenIds.add(p.id);
          allProds.push(p);
        }
      }
      offset += batch.length;
      // Stop when a page is short (last page) or we've consumed the total count.
      if (batch.length < limit || offset >= result.count) break;
    }
    _allProducts = allProds;
    return { products: _allProducts, categories: _allCategories };
  })().catch((err) => {
    _fetchPromise = null;
    throw err;
  });

  return _fetchPromise;
}

function findMatchingCategory(allCats, storeCategoryTitle) {
  if (!storeCategoryTitle || !allCats?.length) return null;
  const target = normalizeCategoryKey(storeCategoryTitle);
  if (!target) return null;

  // Exact normalized match
  let cat = allCats.find((c) => normalizeCategoryKey(c.title) === target);
  if (cat) return cat;

  // Contains either way (handles extra words / jar variants)
  cat = allCats.find((c) => {
    const key = normalizeCategoryKey(c.title);
    return key.includes(target) || target.includes(key);
  });
  return cat || null;
}

/**
 * Returns live store products for a given store category title.
 *
 * When `productIds` is a non-empty array, products are selected by their real
 * backend product ids (used to reassign products from a legacy backend
 * category into a new sub-category without duplicating or deleting them).
 * Otherwise products are matched by Store Manager category title.
 *
 * Falls back to empty array if no matching category / ids found.
 */
export function useStoreCategoryProducts(storeCategoryTitle, productIds) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!storeCategoryTitle && (!productIds || productIds.length === 0)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAll()
      .then(({ products: allProds, categories: allCats }) => {
        if (cancelled) return;

        let filtered;
        if (Array.isArray(productIds)) {
          // Reassignment by explicit backend product ids (empty array = no
          // products assigned to this sub-category yet; do NOT fall back to
          // the whole legacy category).
          const idSet = new Set(productIds);
          filtered = allProds.filter((p) => idSet.has(p.id));
        } else {
          const cat = findMatchingCategory(allCats, storeCategoryTitle);
          if (!cat) {
            setProducts([]);
            setLoading(false);
            return;
          }
          filtered = allProds.filter((p) =>
            (p.collections || []).some((col) => col.collection_id === cat.id)
          );
        }

        const normalized = filtered.map((p) => ({
          id: p.id,
          name: p.title,
          shortDescription:
            p.subtitle ||
            (typeof p.description === 'string'
              ? p.description.replace(/<[^>]+>/g, '').substring(0, 140)
              : ''),
          image: p.image,
          moq: 100,
          customizable: true,
          price_in_cents: p.price_in_cents,
          currency: p.currency,
          variants: p.variants || [],
          isStoreProduct: true,
          sku: p.handle || p.id,
        }));

        setProducts(normalized);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('useStoreCategoryProducts error:', err);
        setError(err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeCategoryTitle, productIds]);

  return { products, loading, error };
}

/**
 * Returns the full live store catalog (all products + all categories) using
 * the same module cache as useStoreCategoryProducts. Used by global search.
 */
export async function getAllStoreProducts() {
  const { products, categories } = await fetchAll();
  return { products, categories };
}

/** Clears the module cache (useful after store updates in dev) */
export function clearStoreProductsCache() {
  _allProducts = null;
  _allCategories = null;
  _fetchPromise = null;
}
