import {
  EWB_THRESHOLD_INR,
  PICKUP,
  SELLER,
  SELLER_GSTIN,
  SELLER_PAN,
  VOLUMETRIC_DIVISOR,
  pinCode,
} from "./config.js";

/**
 * Delhivery B2B/LTL shipment helpers.
 *
 * Important:
 * - pickup_location_name = registered Delhivery warehouse
 * - dropoff_location = customer / consignee
 * - billing_address = seller / consignor billing identity
 * - shipment_details = JS array internally; buildManifestForm()
 *   serializes it to JSON because /manifest is multipart/form-data.
 */

function getRecordValue(record, key, fallback = "") {
  if (!record) return fallback;

  try {
    if (typeof record.get === "function") {
      const value = record.get(key);
      return value ?? fallback;
    }

    const value = record[key];
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

const GSTIN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

const PAN =
  /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

const MOBILE = /^[6-9]\d{9}$/;
const EWB = /^\d{12}$/;

const CANCELLABLE = new Set([
  "",
  "manifested",
  "created",
  "undelivered",
  "pending_lrn",
  "pickup_scheduled",
  "in transit",
  "in-transit",
  "pending",
  "open",
  "scheduled",
]);

/* -------------------------------------------------------------------------- */
/* ORDER HELPERS                                                              */
/* -------------------------------------------------------------------------- */

export function orderItems(order) {
  try {
    const items = JSON.parse(
      JSON.stringify(
        getRecordValue(order, "items_json", []) || [],
      ),
    ) || [];

    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function num(value) {
  const n = Number(value);

  return Number.isFinite(n) && n > 0
    ? n
    : 0;
}

function round3(value) {
  return +Number(value).toFixed(3);
}

/* -------------------------------------------------------------------------- */
/* PACKAGE CALCULATION                                                        */
/* -------------------------------------------------------------------------- */

export function packageFromItems(items) {
  let deadKg = 0;
  let boxCount = 0;

  const groups = new Map();

  for (const item of items || []) {
    const qty = Math.max(
      0,
      Math.round(Number(item.quantity) || 0),
    );

    if (!qty) continue;

    const weightGm = num(
      item.weight_gm ||
      item.shipping?.weight_gm,
    );

    const length = num(
      item.length_cm ||
      item.shipping?.length_cm,
    );

    const breadth = num(
      item.breadth_cm ||
      item.shipping?.breadth_cm,
    );

    const height = num(
      item.height_cm ||
      item.shipping?.height_cm,
    );

    deadKg +=
      (weightGm / 1000) * qty;

    boxCount += qty;

    /*
     * Keep dimensions grouped.
     * Example:
     * 3x3x3 x 100 pieces
     */
    if (
      length &&
      breadth &&
      height
    ) {
      const key =
        `${length}x${breadth}x${height}`;

      const previous = groups.get(key);

      if (previous) {
        previous.box_count += qty;
      } else {
        groups.set(key, {
          length_cm: length,
          width_cm: breadth,
          height_cm: height,
          box_count: qty,
        });
      }
    }
  }

  const dimensions = [
    ...groups.values(),
  ];

  /*
   * Volumetric weight:
   *
   * L x W x H x box_count / 5000
   */
  const volumetricKg =
    dimensions.reduce(
      (sum, dimension) =>
        sum +
        (
          dimension.length_cm *
          dimension.width_cm *
          dimension.height_cm *
          dimension.box_count
        ) /
          VOLUMETRIC_DIVISOR,
      0,
    );

  const primary =
    dimensions[0] || {
      length_cm: 0,
      width_cm: 0,
      height_cm: 0,
    };

  return {
    weight_kg: round3(deadKg),

    chargeable_kg: round3(
      Math.max(
        deadKg,
        volumetricKg,
      ) || deadKg,
    ),

    length_cm:
      primary.length_cm,

    breadth_cm:
      primary.width_cm,

    height_cm:
      primary.height_cm,

    box_count:
      Math.max(1, boxCount),

    dimensions,
  };
}

/* -------------------------------------------------------------------------- */
/* GENERIC RESPONSE HELPERS                                                   */
/* -------------------------------------------------------------------------- */

function firstValue(obj, keys) {
  if (
    !obj ||
    typeof obj !== "object"
  ) {
    return "";
  }

  for (const key of keys) {
    const value = obj[key];

    if (
      value != null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function flatten(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return {};
  }

  const root =
    data.data &&
    typeof data.data === "object"
      ? {
          ...data,
          ...data.data,
        }
      : {
          ...data,
        };

  const nested =
    root.job ||
    root.shipment ||
    root.result ||
    root.payload ||
    {};

  const list =
    Array.isArray(root.packages)
      ? root.packages[0]
      : Array.isArray(root.shipments)
        ? root.shipments[0]
        : nested;

  return {
    ...root,
    ...(list &&
    typeof list === "object"
      ? list
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* SHIPMENT RESPONSE PARSING                                                  */
/* -------------------------------------------------------------------------- */

export function extractShipmentIds(data) {
  const source = flatten(data);

  const awbRaw = firstValue(
    source,
    [
      "master_waybill",
      "master_awb",
      "waybill",
      "awb",
      "wbns",
    ],
  );

  return {
    job_id: String(
      firstValue(
        source,
        [
          "job_id",
          "jobId",
          "pickup_id",
          "pickupId",
          "request_id",
        ],
      ) || "",
    ),

    lrn: String(
      firstValue(
        source,
        [
          "lrn",
          "lrnum",
          "lr_number",
          "lrNumber",
        ],
      ) || "",
    ),

    awb: String(
      Array.isArray(awbRaw)
        ? awbRaw[0]
        : awbRaw || "",
    ),

    status: String(
      firstValue(
        source,
        [
          "status",
          "shipment_status",
          "job_status",
        ],
      ) || "",
    ),

    label: String(
      firstValue(
        source,
        [
          "label_url",
          "packing_slip",
          "pdf_url",
          "url",
          "label",
        ],
      ) || "",
    ),
  };
}

export function extractQuote(data) {
  const source =
    data?.data &&
    typeof data.data === "object"
      ? data.data
      : data &&
          typeof data === "object"
        ? data
        : {};

  const total = Number(
    source.total || 0,
  );

  return {
    total:
      Number.isFinite(total)
        ? total
        : 0,

    charged_weight:
      Number(
        source.charged_wt || 0,
      ) || null,

    edd: null,

    mode: "Surface",
  };
}

export function extractTrack(data) {
  const source = flatten(data);

  const statusObj =
    source.Status &&
    typeof source.Status === "object"
      ? source.Status
      : source;

  return {
    status: String(
      firstValue(
        statusObj,
        [
          "Status",
          "status",
          "shipment_status",
          "Instructions",
        ],
      ) || "",
    ),

    location: String(
      firstValue(
        statusObj,
        [
          "StatusLocation",
          "location",
          "city",
        ],
      ) || "",
    ),

    scanned_at:
      firstValue(
        statusObj,
        [
          "StatusDateTime",
          "scan_datetime",
          "timestamp",
        ],
      ) || "",

    lrn: String(
      firstValue(
        source,
        [
          "lrn",
          "LRN",
          "lrnum",
        ],
      ) || "",
    ),
  };
}

export function extractUrl(
  data,
  extraKeys = [],
) {
  const source = flatten(data);

  const list =
    source.urls ||
    source.links ||
    (
      Array.isArray(source.data)
        ? source.data
        : null
    );

  if (
    Array.isArray(list) &&
    list[0]
  ) {
    const first = list[0];

    return String(
      typeof first === "string"
        ? first
        : first.url ||
            first.label_url ||
            "",
    );
  }

  return String(
    firstValue(
      source,
      [
        "label_url",
        "pdf_url",
        "url",
        "pod_url",
        "pod",
        "image_url",
        ...extraKeys,
      ],
    ) || "",
  );
}

/* -------------------------------------------------------------------------- */
/* ORDER VALUE / EWAY BILL                                                    */
/* -------------------------------------------------------------------------- */

export function invoiceValueInr(order) {
  return +(
    (
      Number(
        getRecordValue(
          order,
          "amount_in_paise",
          0,
        ) || 0,
      ) / 100
    ).toFixed(2)
  );
}

export function ewayBillOf(order) {
  return String(
    getRecordValue(
      order,
      "eway_bill",
      "",
    ) ||
      getRecordValue(
        order,
        "ewb",
        "",
      ) ||
      "",
  ).replace(/\D/g, "");
}

export function hasBookedLr(order) {
  return Boolean(
    String(
      getRecordValue(
        order,
        "delhivery_lrn",
        "",
      ) || "",
    ).trim(),
  );
}

export function isCancellable(status) {
  return CANCELLABLE.has(
    String(status || "")
      .toLowerCase(),
  );
}

/* -------------------------------------------------------------------------- */
/* SELLER / BILLING VALIDATION                                                */
/* -------------------------------------------------------------------------- */

export function validateSellerBillingAddress() {
  const errors = [];

  if (
    !SELLER.name ||
    SELLER.name.length < 2
  ) {
    errors.push(
      "DELHIVERY_SELLER_NAME is required.",
    );
  }

  if (
    !SELLER.company ||
    SELLER.company.length < 2
  ) {
    errors.push(
      "DELHIVERY_SELLER_COMPANY is required.",
    );
  }

  if (
    !SELLER.address ||
    SELLER.address.length < 5
  ) {
    errors.push(
      "DELHIVERY_SELLER_ADDRESS is required.",
    );
  }

  if (!SELLER.city) {
    errors.push(
      "DELHIVERY_SELLER_CITY is required.",
    );
  }

  if (!SELLER.state) {
    errors.push(
      "DELHIVERY_SELLER_STATE is required.",
    );
  }

  if (
    !/^\d{6}$/.test(
      SELLER.pin_code,
    )
  ) {
    errors.push(
      "DELHIVERY_SELLER_PINCODE must be a valid 6-digit pincode.",
    );
  }

  if (
    !MOBILE.test(SELLER.phone)
  ) {
    errors.push(
      "DELHIVERY_SELLER_PHONE must be a valid 10-digit mobile.",
    );
  }

  /*
   * Delhivery requires either:
   * - valid PAN
   * OR
   * - valid GSTIN
   *
   * Do not send empty strings for these fields.
   */
  const hasGst =
    Boolean(SELLER_GSTIN);

  const hasPan =
    Boolean(SELLER_PAN);

  if (!hasGst && !hasPan) {
    errors.push(
      "For FoD/FoP, seller PAN or GSTIN is required in billing_address.",
    );
  }

  if (
    hasGst &&
    !GSTIN.test(SELLER_GSTIN)
  ) {
    errors.push(
      "DELHIVERY_SELLER_GSTIN is invalid.",
    );
  }

  if (
    hasPan &&
    !PAN.test(SELLER_PAN)
  ) {
    errors.push(
      "DELHIVERY_SELLER_PAN is invalid.",
    );
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* PICKUP VALIDATION                                                          */
/* -------------------------------------------------------------------------- */

export function validatePickupLocation() {
  const errors = [];

  if (!PICKUP.name) {
    errors.push(
      "DELHIVERY_PICKUP_NAME is required.",
    );
  }

  if (
    !/^\d{6}$/.test(
      PICKUP.pin_code,
    )
  ) {
    errors.push(
      "DELHIVERY_PICKUP_PINCODE must be a valid 6-digit pincode.",
    );
  }

  if (!PICKUP.city) {
    errors.push(
      "DELHIVERY_PICKUP_CITY is required.",
    );
  }

  if (!PICKUP.state) {
    errors.push(
      "DELHIVERY_PICKUP_STATE is required.",
    );
  }

  if (
    !PICKUP.address ||
    PICKUP.address.length < 10
  ) {
    errors.push(
      "DELHIVERY_PICKUP_ADDRESS must be a complete street address.",
    );
  }

  if (
    !MOBILE.test(PICKUP.phone)
  ) {
    errors.push(
      "DELHIVERY_PICKUP_PHONE must be a valid 10-digit mobile.",
    );
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* ORDER VALIDATION                                                           */
/* -------------------------------------------------------------------------- */

export function validateOrderForShipment(order) {
  const errors = [];

  const name = (
    getRecordValue(
      order,
      "customer_name",
      "",
    ) || ""
  ).trim();

  if (name.length < 3) {
    errors.push(
      "Customer name is required (min 3 chars).",
    );
  }

  const phone = (
    getRecordValue(
      order,
      "customer_phone",
      "",
    ) || ""
  )
    .replace(/\D/g, "")
    .slice(-10);

  if (!MOBILE.test(phone)) {
    errors.push(
      "A valid 10-digit customer mobile is required.",
    );
  }

  const address = (
    getRecordValue(
      order,
      "shipping_address",
      "",
    ) || ""
  ).trim();

  if (address.length < 3) {
    errors.push(
      "Shipping address is required.",
    );
  }

  const city = (
    getRecordValue(
      order,
      "shipping_city",
      "",
    ) || ""
  ).trim();

  if (!city) {
    errors.push(
      "Shipping city is required.",
    );
  }

  const state = (
    getRecordValue(
      order,
      "shipping_state",
      "",
    ) || ""
  ).trim();

  if (!state) {
    errors.push(
      "Shipping state is required.",
    );
  }

  const pincode = (
    getRecordValue(
      order,
      "shipping_pincode",
      "",
    ) || ""
  ).replace(/\D/g, "");

  if (!/^\d{6}$/.test(pincode)) {
    errors.push(
      "A valid 6-digit customer pincode is required.",
    );
  }

  const amount =
    invoiceValueInr(order);

  if (!(amount > 0)) {
    errors.push(
      "Invoice value must be positive.",
    );
  }

  const items =
    orderItems(order);

  if (!items.length) {
    errors.push(
      "Order has no item lines.",
    );
  } else {
    items.forEach(
      (item, index) => {
        const itemNumber =
          index + 1;

        if (
          !(num(item.quantity) > 0)
        ) {
          errors.push(
            `Item ${itemNumber}: quantity must be positive.`,
          );
        }

        if (
          !(
            num(
              item.weight_gm ||
                item.shipping?.weight_gm,
            ) > 0
          )
        ) {
          errors.push(
            `Item ${itemNumber}: weight (gm) is required.`,
          );
        }

        const length =
          num(
            item.length_cm ||
              item.shipping?.length_cm,
          );

        const breadth =
          num(
            item.breadth_cm ||
              item.shipping?.breadth_cm,
          );

        const height =
          num(
            item.height_cm ||
              item.shipping?.height_cm,
          );

        if (
          !(length > 0) ||
          !(breadth > 0) ||
          !(height > 0)
        ) {
          errors.push(
            `Item ${itemNumber}: dimensions (cm) are required.`,
          );
        }
      },
    );
  }

  const pkg =
    packageFromItems(items);

  if (!(pkg.weight_kg > 0)) {
    errors.push(
      "Shipment weight must be positive.",
    );
  }

  if (
    !pkg.dimensions.length
  ) {
    errors.push(
      "Package length, breadth and height (cm) are required.",
    );
  }

  /*
   * Seller billing identity is mandatory
   * for FoD / FoP.
   */
  const freightMode =
    String(
      PICKUP.freight_mode || "",
    )
      .trim()
      .toLowerCase();

  if (
    freightMode === "fod" ||
    freightMode === "fop"
  ) {
    errors.push(
      ...validateSellerBillingAddress(),
    );
  }

  const consigneeGst = (
    getRecordValue(
      order,
      "gst_number",
      "",
    ) || ""
  ).trim();

  if (
    consigneeGst &&
    !GSTIN.test(consigneeGst)
  ) {
    errors.push(
      "Consignee GSTIN is invalid.",
    );
  }

  /*
   * E-way bill requirement for
   * invoice values above threshold.
   */
  if (
    amount > EWB_THRESHOLD_INR &&
    !EWB.test(
      ewayBillOf(order),
    )
  ) {
    errors.push(
      `E-way bill (12 digits) is required for invoices above ₹${EWB_THRESHOLD_INR.toLocaleString(
        "en-IN",
      )}.`,
    );
  }

  errors.push(
    ...validatePickupLocation(),
  );

  return {
    ok: errors.length === 0,
    errors,
    pkg,
    amount,
  };
}

/* -------------------------------------------------------------------------- */
/* DIMENSIONS                                                                 */
/* -------------------------------------------------------------------------- */

export function normalizeBoxDimensions(
  input,
  fallbackBoxCount = 1,
) {
  const fallback =
    Math.max(
      1,
      Math.round(
        Number(
          fallbackBoxCount,
        ),
      ) || 1,
    );

  const list =
    Array.isArray(input)
      ? input
      : input
        ? [input]
        : [];

  const output = [];

  for (const dimension of list) {
    if (
      !dimension ||
      typeof dimension !== "object"
    ) {
      continue;
    }

    const length =
      Number(
        dimension.length_cm ??
          dimension.length,
      ) || 0;

    const width =
      Number(
        dimension.width_cm ??
          dimension.width ??
          dimension.breadth_cm ??
          dimension.breadth,
      ) || 0;

    const height =
      Number(
        dimension.height_cm ??
          dimension.height,
      ) || 0;

    if (
      !(length > 0) ||
      !(width > 0) ||
      !(height > 0)
    ) {
      continue;
    }

    const rawCount =
      Number(
        dimension.box_count ??
          dimension.count,
      );

    const count =
      Number.isFinite(rawCount) &&
      rawCount > 0
        ? Math.max(
            1,
            Math.round(rawCount),
          )
        : list.length === 1
          ? fallback
          : 1;

    output.push({
      length_cm: length,
      width_cm: width,
      height_cm: height,
      box_count: count,
    });
  }

  return output;
}

/* -------------------------------------------------------------------------- */
/* QUOTE PAYLOAD                                                              */
/* -------------------------------------------------------------------------- */

export function buildQuotePayload({
  pin,
  weightKg,
  invoiceValue,
  dimensions,
  boxCount,
}) {
  const payload = {
    weight_g: Math.round(
      Number(weightKg) * 1000,
    ),

    cheque_payment: false,

    source_pin: pinCode(
      PICKUP.pin_code,
    ),

    consignee_pin: pinCode(pin),

    /*
     * Customer product payment is prepaid
     * in current checkout flow.
     */
    payment_mode: "prepaid",

    inv_amount:
      invoiceValue || 0,

    freight_mode:
      PICKUP.freight_mode,

    rov_insurance: false,
  };

  const boxes =
    normalizeBoxDimensions(
      dimensions,
      boxCount,
    );

  if (boxes.length) {
    payload.dimensions =
      boxes;
  }

  return payload;
}

/* -------------------------------------------------------------------------- */
/* MANIFEST FORM                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Delhivery /manifest expects multipart/form-data.
 *
 * Important:
 *
 * shipment_details must NOT be appended as:
 *
 *   form.append("shipment_details", array)
 *
 * Instead:
 *
 *   form.append(
 *     "shipment_details",
 *     JSON.stringify(array)
 *   )
 *
 * Same applies to nested objects/arrays:
 * dropoff_location
 * invoices
 * shipment_details
 * dimensions
 * billing_address
 */
export function buildManifestForm(
  fields = {},
) {
  const form = new FormData();

  for (
    const [key, value] of Object.entries(
      fields || {},
    )
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      form.append(
        key,
        String(value),
      );

      continue;
    }

    form.append(
      key,
      JSON.stringify(value),
    );
  }

  return form;
}

/* -------------------------------------------------------------------------- */
/* SELLER BILLING ADDRESS                                                    */
/* -------------------------------------------------------------------------- */

function buildBillingAddress() {
  const billingAddress = {
    name: SELLER.name,
    company: SELLER.company,
    consignor: SELLER.name,
    address: SELLER.address,
    city: SELLER.city,
    state: SELLER.state,
    pin: String(
      SELLER.pin_code || "",
    ),
    phone: String(
      SELLER.phone || "",
    ),
  };

  /*
   * Delhivery requires either PAN
   * or GSTIN.
   *
   * IMPORTANT:
   * Never send:
   *
   * pan_number: ""
   * gst_number: ""
   *
   * because Delhivery validates empty
   * values against regex and rejects them.
   */
  if (SELLER_GSTIN) {
    billingAddress.gst_number =
      SELLER_GSTIN;
  } else if (SELLER_PAN) {
    billingAddress.pan_number =
      SELLER_PAN;
  }

  return billingAddress;
}

/* -------------------------------------------------------------------------- */
/* MANIFEST PAYLOAD                                                           */
/* -------------------------------------------------------------------------- */

export function buildManifestPayload(
  order,
  pkg,
) {
  const items =
    orderItems(order);

  const ident = String(
    getRecordValue(
      order,
      "order_number",
      "",
    ) || order.id,
  ).trim();

  const invoiceValue =
    invoiceValueInr(order);

  const ewb =
    ewayBillOf(order);

  const description =
    items
      .map(
        (item) =>
          item.title ||
          item.product_title ||
          "Product",
      )
      .filter(Boolean)
      .slice(0, 3)
      .join(", ")
      .slice(0, 200) ||
    "Handicraft goods";

  const weightGm =
    Math.round(
      Number(
        pkg.weight_kg,
      ) * 1000,
    );

  /*
   * Product payment mode.
   *
   * Existing application flow uses
   * Razorpay prepaid payment.
   */
  const paymentMode =
    String(
      getRecordValue(
        order,
        "payment_mode",
        getRecordValue(
          order,
          "payment_method",
          "prepaid",
        ),
      ) || "prepaid",
    )
      .trim()
      .toLowerCase();

  const codAmount =
    Number(
      getRecordValue(
        order,
        "cod_amount",
        invoiceValue,
      ) ?? invoiceValue,
    );

  /*
   * Freight payment mode is independent
   * from payment_mode.
   *
   * Current .env:
   *
   * FREIGHT_MODE=fod
   */
  const freightMode =
    String(
      PICKUP.freight_mode || "",
    )
      .trim()
      .toLowerCase();

  /*
   * Internal dimensions:
   *
   * length_cm
   * width_cm
   * height_cm
   * box_count
   */
  const dimensions =
    normalizeBoxDimensions(
      pkg.dimensions?.length
        ? pkg.dimensions
        : [
            {
              length_cm:
                pkg.length_cm,

              width_cm:
                pkg.breadth_cm,

              height_cm:
                pkg.height_cm,

              box_count:
                pkg.box_count || 1,
            },
          ],
      pkg.box_count || 1,
    );

  /*
   * Manifest dimensions:
   *
   * length
   * width
   * height
   * box_count
   */
  const manifestDimensions =
    dimensions.map(
      (dimension) => ({
        length:
          dimension.length_cm,

        width:
          dimension.width_cm,

        height:
          dimension.height_cm,

        box_count:
          dimension.box_count,
      }),
    );

  /*
   * SELLER / CONSIGNOR BILLING ADDRESS
   *
   * NOT customer address.
   */
  const billingAddress =
    buildBillingAddress();

  return {
    /*
     * Registered Delhivery warehouse
     */
    pickup_location_name:
      PICKUP.name,

    /*
     * Customer payment mode
     */
    payment_mode:
      paymentMode,

    /*
     * COD amount only for COD orders.
     */
    ...(paymentMode === "cod"
      ? {
          cod_amount:
            codAmount ||
            invoiceValue ||
            "0",
        }
      : {
          cod_amount: "0",
        }),

    /*
     * Total dead weight in grams.
     */
    weight: weightGm,

    /*
     * CUSTOMER / CONSIGNEE
     */
    dropoff_location: {
      consignee_name: (
        getRecordValue(
          order,
          "customer_name",
          "",
        ) || ""
      ).trim(),

      phone: (
        getRecordValue(
          order,
          "customer_phone",
          "",
        ) || ""
      )
        .replace(/\D/g, "")
        .slice(-10),

      address: (
        getRecordValue(
          order,
          "shipping_address",
          "",
        ) || ""
      ).trim(),

      city: (
        getRecordValue(
          order,
          "shipping_city",
          "",
        ) || ""
      ).trim(),

      state: (
        getRecordValue(
          order,
          "shipping_state",
          "",
        ) || ""
      ).trim(),

      zip: pinCode(
        getRecordValue(
          order,
          "shipping_pincode",
          "",
        ),
      ),

      email:
        getRecordValue(
          order,
          "customer_email",
          "",
        ) || "",
    },

    /*
     * INVOICE
     */
    invoices: [
      {
        ewaybill:
          ewb || "",

        inv_num:
          ident,

        inv_amt:
          invoiceValue,

        inv_qr_code:
          "",
      },
    ],

    /*
     * SHIPMENT DETAILS
     *
     * Keep this as an ARRAY here.
     *
     * buildManifestForm() converts it
     * to JSON string for multipart/form-data.
     */
    shipment_details: [
      {
        order_id:
          ident,

        box_count:
          pkg.box_count,

        description,

        weight:
          weightGm,

        waybills: [],

        /*
         * Delhivery example uses boolean-like
         * string in multipart payload.
         */
        master: "False",
      },
    ],

    /*
     * MANIFEST DIMENSIONS
     */
    dimensions:
      manifestDimensions,

    /*
     * ROV insurance.
     */
    rov_insurance: "False",

    /*
     * Freight payment mode:
     *
     * fod / fop
     */
    freight_mode:
      freightMode,

    /*
     * SELLER BILLING ADDRESS
     */
    billing_address:
      billingAddress,

    /*
     * Pickup scheduling flag.
     */
    fm_pickup: "False",
  };
}

/* -------------------------------------------------------------------------- */
/* PICKUP PAYLOAD                                                             */
/* -------------------------------------------------------------------------- */

export function buildPickupPayload(
  _order,
  {
    date,
    slot,
    boxCount,
  },
) {
  return {
    client_warehouse:
      PICKUP.name,

    pickup_date:
      date,

    start_time:
      slot,

    expected_package_count:
      boxCount,
  };
}

/* -------------------------------------------------------------------------- */
/* PICKUP DATE VALIDATION                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Same-day B2B pickup must be requested
 * before 14:00 IST.
 */
export function assertPickupSchedule(
  date,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      date || "",
    )
  ) {
    return (
      "date must be YYYY-MM-DD."
    );
  }

  const [
    year,
    month,
    day,
  ] =
    date
      .split("-")
      .map(Number);

  /*
   * Convert current time to IST.
   */
  const istNow =
    new Date(
      Date.now() +
        330 * 60 * 1000,
    );

  const today =
    `${istNow.getUTCFullYear()}-${String(
      istNow.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(
      istNow.getUTCDate(),
    ).padStart(2, "0")}`;

  const chosen =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  const startToday =
    new Date(
      Date.UTC(
        istNow.getUTCFullYear(),
        istNow.getUTCMonth(),
        istNow.getUTCDate(),
      ),
    );

  if (
    chosen < startToday
  ) {
    return (
      "Pickup date cannot be in the past."
    );
  }

  if (
    date === today &&
    istNow.getUTCHours() >= 14
  ) {
    return (
      "Same-day pickup must be requested before 2:00 PM IST."
    );
  }

  return "";
}