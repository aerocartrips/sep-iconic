/**
 * Helpers for reading product size/weight from Hostinger store data
 * and building shipment package info for Delhivery B2B rate checks.
 *
 * Size/dimensions are stored as the variant title / SIZE option value
 * (e.g. "8*8*3", "10x10x4"). Weight comes from variant.weight when set.
 * Nothing is invented — missing values stay null.
 */

/** Parse "8*8*3" / "8x8x3" / "10*10" style dimension strings. Units: inches (as entered in store). */
export function parseDimensions(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  // Reject pure product-name titles that are not dimension strings.
  if (!/^\d+(\.\d+)?\s*[x×*]\s*\d+/i.test(text)) return null;
  const parts = text
    .split(/[x×*]/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number(p.replace(/[^0-9.]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length < 2) return null;
  return {
    length: parts[0],
    breadth: parts[1],
    height: parts[2] != null ? parts[2] : null,
    raw: text,
    unit: 'in',
  };
}

/** Prefer variant title, then SIZE option value, then any option value that looks like dims. */
export function getVariantDimensions(product, variant) {
  if (!variant && !product) return null;
  const candidates = [];
  if (variant?.title) candidates.push(variant.title);
  if (variant?.options?.length) {
    for (const opt of variant.options) {
      if (opt?.value) candidates.push(opt.value);
    }
  }
  if (product?.options?.length) {
    for (const opt of product.options) {
      const title = String(opt.title || '');
      if (/size|dimension|dim/i.test(title)) {
        const match = (opt.values || []).find((v) => v.variant_id === variant?.id);
        if (match?.value) candidates.push(match.value);
        else if (opt.values?.[0]?.value) candidates.push(opt.values[0].value);
      }
    }
  }
  for (const c of candidates) {
    const dims = parseDimensions(c);
    if (dims) return dims;
  }
  return null;
}

/** Format dimensions for display, e.g. "8 × 8 × 3 in". */
export function formatDimensions(dims) {
  if (!dims) return null;
  const parts = [dims.length, dims.breadth];
  if (dims.height != null) parts.push(dims.height);
  return `${parts.join(' × ')} ${dims.unit || 'in'}`;
}

/** Format weight for display. Accepts grams or kg number + optional unit hint. */
export function formatWeight(weight, unitHint) {
  if (weight == null || weight === '' || Number(weight) <= 0) return null;
  const n = Number(weight);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = String(unitHint || '').toLowerCase();
  // Hostinger variant.weight is typically grams when present; values < 20 are likely kg.
  if (unit === 'kg' || unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') {
    return `${n} kg`;
  }
  if (unit === 'g' || unit === 'gm' || unit === 'gms' || unit === 'gram' || unit === 'grams') {
    return n >= 1000 ? `${+(n / 1000).toFixed(3)} kg` : `${n} g`;
  }
  // Heuristic: small numbers are kg, larger are grams.
  if (n < 50) return `${n} kg`;
  return n >= 1000 ? `${+(n / 1000).toFixed(3)} kg` : `${n} g`;
}

/** Convert a single unit weight into grams. */
export function weightToGrams(weight, unitHint) {
  if (weight == null || weight === '' || Number(weight) <= 0) return null;
  const n = Number(weight);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = String(unitHint || '').toLowerCase();
  if (unit === 'kg' || unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') {
    return Math.round(n * 1000);
  }
  if (unit === 'g' || unit === 'gm' || unit === 'gms' || unit === 'gram' || unit === 'grams') {
    return Math.round(n);
  }
  // Heuristic: values under 50 treated as kg (common for product weight entry).
  if (n < 50) return Math.round(n * 1000);
  return Math.round(n);
}

const IN_TO_CM = 2.54;

/** Convert inch dimensions to cm integers (ceil). */
export function dimensionsToCm(dims) {
  if (!dims) return null;
  const l = dims.length * IN_TO_CM;
  const b = dims.breadth * IN_TO_CM;
  const h = (dims.height != null ? dims.height : null);
  if (!l || !b) return null;
  return {
    length_cm: Math.max(1, Math.ceil(l)),
    breadth_cm: Math.max(1, Math.ceil(b)),
    height_cm: h != null ? Math.max(1, Math.ceil(h * IN_TO_CM)) : null,
  };
}

/**
 * Volumetric weight in grams from cm dims (L×B×H / 5000 kg → grams).
 * Only used for shipping rate when dead weight is missing — never shown as product weight.
 */
export function volumetricWeightGrams(cm) {
  if (!cm || !cm.length_cm || !cm.breadth_cm || !cm.height_cm) return null;
  const kg = (cm.length_cm * cm.breadth_cm * cm.height_cm) / 5000;
  return Math.max(1, Math.round(kg * 1000));
}

/**
 * Build per-line shipping metadata from a product + selected variant.
 * weight_gm / dims come only from real backend values (or volumetric from real dims).
 */
export function buildLineShippingMeta(product, variant) {
  const dims = getVariantDimensions(product, variant);
  const cm = dimensionsToCm(dims);
  const rawWeight = variant?.weight ?? product?.weight ?? null;
  let weight_gm = weightToGrams(rawWeight, variant?.weight_unit || product?.weight_unit);

  // For rate calculation only: fall back to volumetric from real dimensions.
  let weight_source = weight_gm ? 'dead' : null;
  if (!weight_gm && cm?.height_cm) {
    weight_gm = volumetricWeightGrams(cm);
    weight_source = weight_gm ? 'volumetric' : null;
  }

  return {
    length_cm: cm?.length_cm || null,
    breadth_cm: cm?.breadth_cm || null,
    height_cm: cm?.height_cm || null,
    weight_gm: weight_gm || null,
    weight_source,
    size_label: formatDimensions(dims),
    weight_label: formatWeight(rawWeight, variant?.weight_unit || product?.weight_unit),
    dimensions_raw: dims?.raw || null,
  };
}

/**
 * Aggregate cart lines into a single package for Delhivery B2B rate check.
 * Combined weight = sum(unit_weight × qty). Package dims = max L/B and stacked H.
 */
export function aggregatePackage(items) {
  let totalWeightGm = 0;
  let maxL = 0;
  let maxB = 0;
  let maxH = 0;
  let missing = [];

  for (const item of items || []) {
    const qty = Number(item.quantity) || 0;
    const meta = item.shipping || {};
    const w = Number(meta.weight_gm) || 0;
    const l = Number(meta.length_cm) || 0;
    const b = Number(meta.breadth_cm) || 0;
    const h = Number(meta.height_cm) || 0;

    if (!w || w <= 0) missing.push(`${item.product?.title || 'Item'}: weight`);
    if (!l || !b || !h) missing.push(`${item.product?.title || 'Item'}: dimensions`);

    // Combined shipment weight = Σ (unit weight × quantity)
    totalWeightGm += w * qty;
    // Package outer dims = largest unit dims across the order
    if (l > maxL) maxL = l;
    if (b > maxB) maxB = b;
    if (h > maxH) maxH = h;
  }

  return {
    package_weight_gm: totalWeightGm,
    package_weight_kg: totalWeightGm > 0 ? +(totalWeightGm / 1000).toFixed(3) : 0,
    package_length_cm: maxL || null,
    package_breadth_cm: maxB || null,
    package_height_cm: maxH || null,
    missing,
    // Weight alone is enough to rate-check; dims improve accuracy when present.
    ok: totalWeightGm > 0,
  };
}
