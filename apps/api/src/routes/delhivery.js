/**
 * Delhivery B2B routes.
 * Docs: https://one.delhivery.com/developer-portal/documents/b2b/
 *
 * Credentials stay in apps/api/.env. Shipping state lives on `orders`.
 * A Delhivery failure never deletes a paid order.
 */
import pocketbaseClient from "../utils/pocketbaseClient.js";

import {
  canBook,
  canQuote,
  DELHIVERY_ENV,
  isConfigured,
  PICKUP,
  SERVICEABILITY_BASE,
  warehouseCreatePayload,
} from "../delhivery/config.js";

import {
  cancelLrn,
  checkServiceability,
  createWarehouse,
  fetchManifestJob,
  fetchPackingSlip,
  fetchPod,
  getFreightQuote,
  manifestShipment,
  requestPickup,
  trackShipment,
} from "../delhivery/api.js";

import {
  isApiSuccess,
  pickMessage,
  sanitize,
} from "../delhivery/http.js";

import {
  requireAdmin,
} from "../delhivery/auth.js";

import {
  assertPickupSchedule,
  buildManifestPayload,
  buildPickupPayload,
  buildQuotePayload,
  extractShipmentIds,
  extractQuote,
  extractTrack,
  extractUrl,
  hasBookedLr,
  isCancellable,
  normalizeBoxDimensions,
  orderItems,
  packageFromItems,
  validateOrderForShipment,
  validatePickupLocation,
} from "../delhivery/shipment.js";

const sleep = (ms) =>
  new Promise((r) => setTimeout(r, ms));

function getRecordValue(
  record,
  key,
  fallback = "",
) {
  if (!record) return fallback;

  try {
    if (
      typeof record.get === "function"
    ) {
      const value = record.get(key);
      return value ?? fallback;
    }

    const value = record[key];

    return value ?? fallback;
  } catch {
    return fallback;
  }
}

async function findOrder(
  pb,
  orderId,
) {
  if (!orderId) return null;

  try {
    return await pb
      .collection("orders")
      .getOne(orderId);
  } catch (_) {
    return null;
  }
}

async function pushHistory(
  pb,
  order,
  entry,
) {
  let history = [];

  try {
    const raw = getRecordValue(
      order,
      "delhivery_history",
    );

    if (raw) {
      history =
        JSON.parse(
          JSON.stringify(raw),
        ) || [];
    }
  } catch (_) {}

  if (!Array.isArray(history)) {
    history = [];
  }

  history.push({
    ...entry,
    ts: new Date().toISOString(),
  });

  if (history.length > 50) {
    history = history.slice(-50);
  }

  return pb
    .collection("orders")
    .update(order.id, {
      delhivery_history: history,
    });
}

function failRate(
  res,
  status,
  error,
  reason,
  extra = {},
) {
  const text = sanitize(
    String(error || "").trim(),
  );

  return res
    .status(status === 200 ? 200 : status)
    .json({
      calculable: false,

      error:
        !text || /^\d{3}$/.test(text)
          ? "Unable to calculate shipping for this address. Please check your pincode."
          : text,

      reason,

      pickup_pincode:
        PICKUP.pin_code,

      ...extra,
    });
}

async function persistFail(
  pb,
  order,
  fields,
  history,
) {
  await pb
    .collection("orders")
    .update(order.id, fields);

  if (history) {
    await pushHistory(
      pb,
      order,
      history,
    );
  }
}

async function resolveLrn(result) {
  let ids =
    extractShipmentIds(
      result.data,
    );

  if (ids.lrn || !ids.job_id) {
    return {
      result,
      ids,
    };
  }

  for (let i = 0; i < 6; i++) {
    await sleep(500);

    const polled =
      await fetchManifestJob(
        ids.job_id,
      );

    const next =
      extractShipmentIds(
        polled.data,
      );

    if (next.lrn) {
      return {
        result: polled,
        ids: {
          ...ids,
          ...next,
        },
      };
    }

    if (
      !isApiSuccess(polled) &&
      polled.status >= 500
    ) {
      break;
    }
  }

  return {
    result,
    ids,
  };
}

/**
 * Start a background poll for a manifest job to wait for LRN asynchronously.
 * This is fire-and-forget: it updates the order record when LRN appears.
 */
function startBackgroundLrnPoll(
  jobId,
  orderId,
  pb,
  { maxRetries = 5, initialDelay = 2000, factor = 2 } = {},
) {
  if (!jobId || !orderId) return;

  // fire-and-forget async loop
  (async () => {
    let delay = Number(initialDelay) || 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await sleep(delay);

        const polled = await fetchManifestJob(jobId);
        const next = extractShipmentIds(polled.data);

        if (next.lrn) {
          const fields = {
            delhivery_lrn: next.lrn,
            delhivery_awb: next.awb,
            delhivery_status:
              next.status || "manifested",
            delhivery_request_status: "created",
            delhivery_error: "",
            delhivery_label: next.label,
          };

          // update order and push history
          try {
            const order = await findOrder(pb, orderId);
            if (order) {
              await pb.collection("orders").update(orderId, fields);
              await pushHistory(pb, order, {
                action: "create",
                request_status: "created",
                delhivery_job_id: jobId,
                delhivery_lrn: next.lrn,
              });
            }
          } catch (_) {}

          return;
        }

        if (!isApiSuccess(polled) && polled.status >= 500) {
          // upstream server error — stop retrying
          break;
        }
      } catch (_) {
        // ignore individual errors and continue retrying
      }

      delay = Math.round(delay * factor);
    }

    // exhausted retries — mark pending and leave a note
    try {
      const order = await findOrder(pb, orderId);
      if (!order) return;

      const msg = `LRN not returned after ${maxRetries} retries for job ${jobId}.`;

      await pb.collection("orders").update(orderId, {
        delhivery_request_status: "pending_lrn",
        delhivery_error: msg,
      });

      await pushHistory(pb, order, {
        action: "create",
        request_status: "pending_lrn",
        delhivery_job_id: jobId,
        remarks: msg,
      });
    } catch (_) {}
  })();
}

export function status(
  _req,
  res,
) {
  res.json({
    configured: isConfigured(),
    can_quote: canQuote(),
    can_book: canBook(),
    env: DELHIVERY_ENV,

    hosts: {
      ltl: SERVICEABILITY_BASE,
    },

    pickupLocation:
      PICKUP.name,

    pickupPincode:
      PICKUP.pin_code,

    carrier: "Delhivery B2B",
  });
}

export async function registerWarehouse(
  req,
  res,
) {
  const auth =
    await requireAdmin(req);

  if (!auth.ok) {
    return res
      .status(auth.status)
      .json({
        error: auth.error,
      });
  }

  if (
    !canBook() &&
    !canQuote()
  ) {
    return res
      .status(503)
      .json({
        error:
          "Delhivery shipping is not configured yet.",
      });
  }

  const loc =
    validatePickupLocation();

  if (loc.length) {
    return res
      .status(422)
      .json({
        error: loc[0],
        details: loc,
      });
  }

  try {
    const payload =
      warehouseCreatePayload();

    const result =
      await createWarehouse(
        payload,
      );

    if (
      !isApiSuccess(result)
    ) {
      return res
        .status(
          result.status || 502,
        )
        .json({
          error: sanitize(
            pickMessage(
              result.data,
            ) ||
              "Warehouse registration failed.",
          ),
        });
    }

    return res.json({
      success: true,
      warehouse: payload.name,
    });
  } catch (err) {
    return res
      .status(err.status || 502)
      .json({
        error: sanitize(
          err.message ||
            "Warehouse registration failed",
        ),
      });
  }
}

export async function getRate(
  req,
  res,
) {
  const body = req.body || {};

  const deliveryPincode =
    String(
      body.delivery_pincode || "",
    )
      .replace(/\D/g, "")
      .slice(0, 6);

  if (
    !/^\d{6}$/.test(
      deliveryPincode,
    )
  ) {
    return failRate(
      res,
      422,
      "A valid 6-digit delivery pincode is required.",
      "invalid_pincode",
    );
  }

  let weightKg =
    Number(body.weight_kg);

  if (
    !(weightKg > 0) &&
    body.weight_gm
  ) {
    weightKg =
      Number(body.weight_gm) /
      1000;
  }

  if (
    !(weightKg > 0) ||
    !Number.isFinite(weightKg)
  ) {
    return failRate(
      res,
      422,
      "Shipping rate could not be calculated. Please check the package weight.",
      "missing_weight",
    );
  }

  if (!canQuote()) {
    return failRate(
      res,
      503,
      "Delhivery shipping is not configured yet.",
      "not_configured",
    );
  }

  const orderValue =
    Number(
      body.total_order_value,
    );

  const invoiceValue =
    Number.isFinite(orderValue) &&
    orderValue > 0
      ? orderValue
      : 0;

  const boxCount =
    Math.max(
      1,
      Math.round(
        Number(
          body.box_count,
        ),
      ) || 1,
    );

  const pl =
    Number(
      body.package_length_cm,
    ) || 0;

  const pb =
    Number(
      body.package_breadth_cm,
    ) || 0;

  const ph =
    Number(
      body.package_height_cm,
    ) || 0;

  const rawDimensions =
    Array.isArray(
      body.dimensions,
    ) &&
    body.dimensions.length
      ? body.dimensions
      : pl && pb && ph
        ? [
            {
              length_cm: pl,
              width_cm: pb,
              height_cm: ph,
              box_count:
                boxCount,
            },
          ]
        : null;

  const dimensions =
    rawDimensions
      ? normalizeBoxDimensions(
          rawDimensions,
          boxCount,
        )
      : null;

  try {
    const svc =
      await checkServiceability(
        deliveryPincode,
        weightKg,
      );

    if (!svc.serviceable) {
      return failRate(
        res,
        200,
        "Unable to calculate shipping for this address. Please check your pincode.",
        "unserviceable",
        {
          delivery_pincode:
            deliveryPincode,
        },
      );
    }

    const result =
      await getFreightQuote(
        buildQuotePayload({
          pin: deliveryPincode,
          weightKg,
          invoiceValue,
          dimensions,
          boxCount,
        }),
      );

    const quote =
      extractQuote(
        result.data,
      );

    if (
      !isApiSuccess(result) ||
      !(quote.total > 0)
    ) {
      const msg =
        sanitize(
          pickMessage(
            result.data,
          ),
        ) ||
        "Unable to calculate shipping for this address. Please check your pincode.";

      return failRate(
        res,
        200,
        msg,
        "quote_failed",
        {
          delivery_pincode:
            deliveryPincode,
        },
      );
    }

    const freightPaise =
      Math.round(
        quote.total * 100,
      );

    return res.json({
      calculable: true,

      free:
        freightPaise === 0,

      shipping_charges_in_paise:
        freightPaise,

      shipping_charges_inr:
        +quote.total.toFixed(2),

      courier: {
        code: "DELHIVERY-B2B",
        name: "Delhivery B2B",
        parent: "Delhivery",
        mode:
          quote.mode ||
          "Surface",
        edd: quote.edd,
      },

      carrier:
        "Delhivery B2B",

      chargeable_weight_kg:
        quote.charged_weight ||
        +weightKg.toFixed(3),

      pickup_pincode:
        PICKUP.pin_code,

      delivery_pincode:
        deliveryPincode,

      weight_kg:
        quote.charged_weight ||
        +weightKg.toFixed(3),

      oda: Boolean(svc.oda),
    });
  } catch (err) {
    return failRate(
      res,
      err.notConfigured
        ? 503
        : err.status || 502,

      sanitize(
        err.message ||
          "Delhivery rate request failed",
      ),

      err.notConfigured
        ? "not_configured"
        : "upstream_error",
    );
  }
}

export async function createShipmentCore(
  pb,
  orderId,
) {
  const order =
    await findOrder(
      pb,
      orderId,
    );

  if (!order) {
    return {
      ok: false,
      status: 404,
      error:
        "Website order not found.",
    };
  }

  const statusVal =
    String(
      getRecordValue(
        order,
        "status",
        "",
      ) || "",
    );

  if (
    ![
      "paid",
      "processing",
      "shipped",
    ].includes(statusVal)
  ) {
    return {
      ok: false,
      status: 422,
      error:
        "A shipment can only be created for a paid order.",
    };
  }

  if (hasBookedLr(order)) {
    return {
      ok: true,
      alreadyExists: true,
      order_id: order.id,

      delhivery_job_id:
        getRecordValue(
          order,
          "delhivery_job_id",
          "",
        ) || "",

      delhivery_lrn:
        getRecordValue(
          order,
          "delhivery_lrn",
          "",
        ) || "",

      delhivery_awb:
        getRecordValue(
          order,
          "delhivery_awb",
          "",
        ) || "",

      delhivery_status:
        getRecordValue(
          order,
          "delhivery_status",
          "",
        ) || "",
    };
  }

  if (!canBook()) {
    return {
      ok: false,
      status: 503,
      error:
        "DELHIVERY_USERNAME and DELHIVERY_PASSWORD are required to create an LR.",
    };
  }

  const pendingJob =
    String(
      getRecordValue(
        order,
        "delhivery_job_id",
        "",
      ) || "",
    ).trim();

  if (
    pendingJob &&
    String(
      getRecordValue(
        order,
        "delhivery_request_status",
        "",
      ) || "",
    ) === "pending_lrn"
  ) {
    try {
      const polled =
        await fetchManifestJob(
          pendingJob,
        );

      const ids =
        extractShipmentIds(
          polled.data,
        );

      if (ids.lrn) {
        const fields = {
          delhivery_lrn:
            ids.lrn,

          delhivery_awb:
            ids.awb,

          delhivery_status:
            ids.status ||
            "manifested",

          delhivery_request_status:
            "created",

          delhivery_error:
            "",

          delhivery_label:
            ids.label,
        };

        await pb
          .collection("orders")
          .update(
            order.id,
            fields,
          );

        await pushHistory(
          pb,
          order,
          {
            action: "create",
            request_status:
              "created",
            ...fields,
          },
        );

        return {
          ok: true,
          success: true,
          order_id: order.id,
          ...fields,
          delhivery_job_id:
            pendingJob,
          delhivery_courier:
            "Delhivery B2B",
        };
      }
    } catch (err) {
     return {
        ok: false,
        status: 500,
        error: err,
      }
    }
  }

  if (
    String(
      getRecordValue(
        order,
        "delhivery_request_status",
        "",
      ) || "",
    ) === "creating"
  ) {
    const started =
      Date.parse(
        getRecordValue(
          order,
          "delhivery_created_at",
          "",
        ) || "",
      ) || 0;

    if (
      Date.now() - started <
      120_000
    ) {
      return {
        ok: false,
        status: 409,
        error:
          "Shipment create is already in progress.",
      };
    }
  }

  const v =
    validateOrderForShipment(
      order,
    );

  if (!v.ok) {
    await persistFail(
      pb,
      order,
      {
        delhivery_request_status:
          "validation_failed",

        delhivery_error:
          sanitize(
            v.errors.join(" "),
          ),
      },
    );

    return {
      ok: false,
      status: 422,
      error:
        "Order is missing required shipping data.",
      details: v.errors,
    };
  }

  const dropPin =
    (
      getRecordValue(
        order,
        "shipping_pincode",
        "",
      ) || ""
    ).replace(/\D/g, "");

  const payload =
    buildManifestPayload(
      order,
      v.pkg,
    );

  try {
    await pb
      .collection("orders")
      .update(
        order.id,
        {
          delhivery_request_status:
            "creating",

          delhivery_created_at:
            new Date().toISOString(),

          delhivery_error: "",
        },
      );

    const svc =
      await checkServiceability(
        dropPin,
        v.pkg.weight_kg,
      );

    if (!svc.serviceable) {
      const msg =
        "Delivery pincode is not serviceable for Delhivery B2B.";

      await persistFail(
        pb,
        order,
        {
          delhivery_request_status:
            "failed",
          delhivery_error: msg,
        },
      );

      return {
        ok: false,
        status: 422,
        error: msg,
      };
    }

    const created =
      await manifestShipment(
        payload,
      );

    if (
      !isApiSuccess(created)
    ) {
      const msg =
        sanitize(
          pickMessage(
            created.data,
          ) ||
            `Delhivery create failed: ${created.status} ${created.statusText}`,
        );

      await persistFail(
        pb,
        order,
        {
          delhivery_request_status:
            "failed",

          delhivery_error: msg,
        },
        {
          action: "create",
          request_status:
            "failed",
          remarks: msg,
        },
      );

      return {
        ok: false,
        status: 502,
        error: msg,
      };
    }

    const { ids } =
      await resolveLrn(
        created,
      );

    const booked =
      Boolean(ids.lrn);

    const updateFields = {
      delhivery_job_id:
        ids.job_id,

      delhivery_lrn:
        ids.lrn,

      delhivery_awb:
        ids.awb,

      delhivery_courier:
        "Delhivery B2B",

      delhivery_status:
        ids.status ||
        (booked
          ? "manifested"
          : "pending"),

      delhivery_request_status:
        booked
          ? "created"
          : "pending_lrn",

      delhivery_error:
        booked
          ? ""
          : "LRN not returned yet. Retry create to poll the job.",

      delhivery_created_at:
        new Date().toISOString(),

      delhivery_label:
        ids.label,
    };

    await pb
      .collection("orders")
      .update(
        order.id,
        updateFields,
      );

    await pushHistory(
      pb,
      order,
      {
        action: "create",

        request_status:
          updateFields.delhivery_request_status,

        delhivery_job_id:
          updateFields.delhivery_job_id,

        delhivery_lrn:
          updateFields.delhivery_lrn,
      },
    );

    // If LRN not yet returned, start a background poller to fetch it
    if (!ids.lrn && ids.job_id) {
      startBackgroundLrnPoll(ids.job_id, order.id, pb, {
        maxRetries: 6,
        initialDelay: 2000,
        factor: 2,
      });
    }

    return {
      ok: true,
      success: booked,
      pending: !booked,
      order_id: order.id,
      ...updateFields,
    };
  } catch (err) {
    const msg = sanitize(
      err.message ||
        "Delhivery request failed",
    );

    await persistFail(
      pb,
      order,
      {
        delhivery_request_status:
          "error",

        delhivery_error: msg,
      },
    );

    return {
      ok: false,
      status:
        err.status || 502,
      error: msg,
    };
  }
}

export async function createShipment(
  req,
  res,
) {
  const auth =
    await requireAdmin(req);

  if (!auth.ok) {
    return res
      .status(auth.status)
      .json({
        error: auth.error,
      });
  }

  const { order_id } =
    req.body || {};

  if (!order_id) {
    return res
      .status(422)
      .json({
        error:
          "order_id is required.",
      });
  }

  const result =
    await createShipmentCore(
      pocketbaseClient,
      order_id,
    );

  if (!result.ok) {
    return res
      .status(result.status)
      .json({
        error: result.error,
        details:
          result.details,
      });
  }

  res.json(result);
}

export async function getLabel(
  req,
  res,
) {
  const auth =
    await requireAdmin(req);

  if (!auth.ok) {
    return res
      .status(auth.status)
      .json({
        error: auth.error,
      });
  }

  const { order_id } =
    req.body || {};

  if (!order_id) {
    return res
      .status(422)
      .json({
        error:
          "order_id is required.",
      });
  }

  const pb =
    pocketbaseClient;

  const order =
    await findOrder(
      pb,
      order_id,
    );

  if (!order) {
    return res
      .status(404)
      .json({
        error:
          "Website order not found.",
      });
  }

  const lrn =
    getRecordValue(
      order,
      "delhivery_lrn",
      "",
    );

  if (!lrn) {
    return res
      .status(422)
      .json({
        error:
          "No LRN exists for this order.",
      });
  }

  try {
    const result =
      await fetchPackingSlip(
        lrn,
      );

    const labelUrl =
      extractUrl(
        result.data,
      );

    if (
      !labelUrl &&
      !isApiSuccess(result)
    ) {
      const msg =
        sanitize(
          pickMessage(
            result.data,
          ) ||
            `Label failed: ${result.status}`,
        );

      await persistFail(
        pb,
        order,
        {
          delhivery_error: msg,
        },
        {
          action: "label",
          request_status:
            "failed",
          remarks: msg,
        },
      );

      return res
        .status(502)
        .json({
          error: msg,
        });
    }

    await pb
      .collection("orders")
      .update(
        order.id,
        {
          delhivery_label:
            labelUrl,
          delhivery_error:
            "",
        },
      );

    await pushHistory(
      pb,
      order,
      {
        action: "label",
        request_status:
          "success",
      },
    );

    return res.json({
      success: true,
      label_url: labelUrl,
    });
  } catch (err) {
    return res
      .status(err.status || 502)
      .json({
        error: sanitize(
          err.message ||
            "Label request failed",
        ),
      });
  }
}

export async function bookPickup(
  req,
  res,
) {
  const auth =
    await requireAdmin(req);

  if (!auth.ok) {
    return res
      .status(auth.status)
      .json({
        error: auth.error,
      });
  }

  if (!canBook()) {
    return res
      .status(503)
      .json({
        error:
          "DELHIVERY_USERNAME and DELHIVERY_PASSWORD are required.",
      });
  }

  const {
    order_id,
    date,
    pickup_time,
    start_time,
    expected_package_count,
  } = req.body || {};

  if (!order_id) {
    return res
      .status(422)
      .json({
        error:
          "order_id is required.",
      });
  }

  let pickupDate =
    date || "";

  if (
    /^\d{2}-\d{2}-\d{4}$/.test(
      pickupDate,
    )
  ) {
    const [
      dd,
      mm,
      yyyy,
    ] =
      pickupDate.split("-");

    pickupDate =
      `${yyyy}-${mm}-${dd}`;
  }

  const scheduleErr =
    assertPickupSchedule(
      pickupDate,
    );

  if (scheduleErr) {
    return res
      .status(422)
      .json({
        error: scheduleErr,
      });
  }

  const pb =
    pocketbaseClient;

  const order =
    await findOrder(
      pb,
      order_id,
    );

  if (!order) {
    return res
      .status(404)
      .json({
        error:
          "Website order not found.",
      });
  }

  if (!hasBookedLr(order)) {
    return res
      .status(422)
      .json({
        error:
          "No LRN exists for this order.",
      });
  }

  const slot =
    /^\d{2}:\d{2}:\d{2}$/.test(
      pickup_time ||
        start_time ||
        "",
    )
      ? pickup_time ||
        start_time
      : "14:00:00";

  const pkg =
    packageFromItems(
      orderItems(order),
    );

  try {
    const result =
      await requestPickup(
        buildPickupPayload(
          order,
          {
            date: pickupDate,
            slot,
            boxCount:
              Number(
                expected_package_count ||
                  pkg.box_count ||
                  1,
              ),
          },
        ),
      );

    if (
      !isApiSuccess(result)
    ) {
      const msg =
        sanitize(
          pickMessage(
            result.data,
          ) ||
            `Pickup failed: ${result.status}`,
        );

      await persistFail(
        pb,
        order,
        {
          delhivery_error: msg,
        },
        {
          action: "pickup",
          request_status:
            "failed",
          remarks: msg,
        },
      );

      return res
        .status(502)
        .json({
          error: msg,
        });
    }

    const pickup = {
      pickup_id:
        extractShipmentIds(
          result.data,
        ).job_id || null,

      pickup_date:
        pickupDate,

      pickup_time:
        slot,

      booked_at:
        new Date().toISOString(),
    };

    await pb
      .collection("orders")
      .update(
        order.id,
        {
          delhivery_pickup:
            pickup,

          delhivery_status:
            "pickup_scheduled",

          delhivery_error: "",
        },
      );

    await pushHistory(
      pb,
      order,
      {
        action: "pickup",
        request_status:
          "success",
        pickup,
      },
    );

    return res.json({
      success: true,
      pickup,
    });
  } catch (err) {
    return res
      .status(err.status || 502)
      .json({
        error: sanitize(
          err.message ||
            "Pickup request failed",
        ),
      });
  }
}

export async function cancelShipment(
  req,
  res,
) {
  const auth =
    await requireAdmin(req);

  if (!auth.ok) {
    return res
      .status(auth.status)
      .json({
        error: auth.error,
      });
  }

  const { order_id } =
    req.body || {};

  if (!order_id) {
    return res
      .status(422)
      .json({
        error:
          "order_id is required.",
      });
  }

  const pb =
    pocketbaseClient;

  const order =
    await findOrder(
      pb,
      order_id,
    );

  if (!order) {
    return res
      .status(404)
      .json({
        error:
          "Website order not found.",
      });
  }

  const lrn =
    getRecordValue(
      order,
      "delhivery_lrn",
      "",
    );

  if (!lrn) {
    return res
      .status(422)
      .json({
        error:
          "No LRN exists for this order.",
      });
  }

  const curStatus =
    String(
      getRecordValue(
        order,
        "delhivery_status",
        "",
      ) || "",
    ).toLowerCase();

  if (
    curStatus === "cancelled" ||
    curStatus === "canceled"
  ) {
    return res.json({
      alreadyCancelled:
        true,

      delhivery_status:
        getRecordValue(
          order,
          "delhivery_status",
          "",
        ),
    });
  }

  if (
    !isCancellable(
      curStatus,
    )
  ) {
    return res
      .status(422)
      .json({
        error:
          "This shipment can only be cancelled while it is still manifested.",
      });
  }

  try {
    const result =
      await cancelLrn(lrn);

    if (
      !isApiSuccess(result)
    ) {
      const msg =
        sanitize(
          pickMessage(
            result.data,
          ) ||
            `Cancel failed: ${result.status}`,
        );

      await persistFail(
        pb,
        order,
        {
          delhivery_error:
            msg,
        },
        {
          action: "cancel",
          request_status:
            "failed",
          remarks: msg,
        },
      );

      return res
        .status(502)
        .json({
          error: msg,
        });
    }

    await pb
      .collection("orders")
      .update(
        order.id,
        {
          delhivery_status:
            "cancelled",

          delhivery_error: "",
        },
      );

    await pushHistory(
      pb,
      order,
      {
        action: "cancel",
        request_status:
          "success",
      },
    );

    return res.json({
      success: true,
      delhivery_status:
        "cancelled",
    });
  } catch (err) {
    return res
      .status(err.status || 502)
      .json({
        error: sanitize(
          err.message ||
            "Cancel request failed",
        ),
      });
  }
}

export async function trackOrder(
  req,
  res,
) {
  const { order_id } =
    req.body || {};

  if (!order_id) {
    return res
      .status(422)
      .json({
        error:
          "order_id is required.",
      });
  }

  const pb =
    pocketbaseClient;

  const order =
    await findOrder(
      pb,
      order_id,
    );

  if (!order) {
    return res
      .status(404)
      .json({
        error:
          "Website order not found.",
      });
  }

  const lrn =
    getRecordValue(
      order,
      "delhivery_lrn",
      "",
    );

  if (!lrn) {
    return res
      .status(422)
      .json({
        error:
          "No LRN exists for this order.",
      });
  }

  try {
    const result =
      await trackShipment(lrn);

    if (
      !isApiSuccess(result)
    ) {
      return res
        .status(502)
        .json({
          error: sanitize(
            pickMessage(
              result.data,
            ) ||
              "Tracking is unavailable right now.",
          ),
        });
    }

    const track =
      extractTrack(
        result.data,
      );

    if (track.status) {
      await pb
        .collection("orders")
        .update(
          order.id,
          {
            delhivery_status:
              track.status,

            delhivery_error:
              "",
          },
        );
    }

    return res.json({
      success: true,
      lrn,

      awb:
        getRecordValue(
          order,
          "delhivery_awb",
          "",
        ) || "",

      status:
        track.status ||
        getRecordValue(
          order,
          "delhivery_status",
          "",
        ) ||
        "",

      location:
        track.location,

      scanned_at:
        track.scanned_at,

      track_url:
        `https://www.delhivery.com/track/package/${lrn}`,
    });
  } catch (err) {
    return res
      .status(err.status || 502)
      .json({
        error: sanitize(
          err.message ||
            "Track request failed",
        ),
      });
  }
}

export async function getPod(
  req,
  res,
) {
  const auth =
    await requireAdmin(req);

  if (!auth.ok) {
    return res
      .status(auth.status)
      .json({
        error: auth.error,
      });
  }

  const { order_id } =
    req.body || {};

  if (!order_id) {
    return res
      .status(422)
      .json({
        error:
          "order_id is required.",
      });
  }

  const pb =
    pocketbaseClient;

  const order =
    await findOrder(
      pb,
      order_id,
    );

  if (!order) {
    return res
      .status(404)
      .json({
        error:
          "Website order not found.",
      });
  }

  const lrn =
    getRecordValue(
      order,
      "delhivery_lrn",
      "",
    );

  if (!lrn) {
    return res
      .status(422)
      .json({
        error:
          "No LRN exists for this order.",
      });
  }

  try {
    const result =
      await fetchPod(lrn);

    const podUrl =
      extractUrl(
        result.data,
        [
          "pod",
          "pod_url",
        ],
      );

    if (
      !podUrl &&
      !isApiSuccess(result)
    ) {
      return res
        .status(502)
        .json({
          error: sanitize(
            pickMessage(
              result.data,
            ) ||
              "POD is not available yet.",
          ),
        });
    }

    return res.json({
      success: true,
      pod_url:
        podUrl || "",
    });
  } catch (err) {
    return res
      .status(err.status || 502)
      .json({
        error: sanitize(
          err.message ||
            "POD request failed",
        ),
      });
  }
}