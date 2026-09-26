const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const postalCodeRe = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;

const TOKEN_URL = "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token";
const RATING_URL = "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/rates";

function origin(req: Request) {
  return req.headers.get("origin") || "";
}

function allowed(originValue: string) {
  return !originValue || allowedOrigins.has(originValue) || localOriginPattern.test(originValue);
}

function headers(req: Request) {
  const requestOrigin = origin(req);
  return {
    ...(requestOrigin && allowed(requestOrigin) ? { "Access-Control-Allow-Origin": requestOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function postalCode(value: unknown) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return postalCodeRe.test(compact) ? compact : "";
}

function positive(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

function rateRows(payload: any) {
  const candidates = payload?.rates || payload?.services || payload?.priceQuotes || payload?.items || payload?.data || [];
  const rows = Array.isArray(candidates) ? candidates : [];
  return rows.map((row: any) => {
    const price = money(
      row?.price ?? row?.totalPrice ?? row?.total ?? row?.due ?? row?.priceDetails?.due ?? row?.pricing?.total,
    );
    return {
      serviceCode: String(row?.serviceCode || row?.service_code || row?.code || ""),
      serviceName: String(row?.serviceName || row?.service_name || row?.name || row?.serviceCode || "Canada Post"),
      price,
      expectedDeliveryDate: row?.expectedDeliveryDate || row?.expected_delivery_date || row?.deliveryDate || null,
      transitDays: Number(row?.transitDays ?? row?.transit_days ?? row?.deliveryDays ?? 0) || null,
    };
  }).filter((row: any) => row.price != null);
}

async function accessToken(key: string, secret: string) {
  const body = new URLSearchParams({ scope: "merchant", grant_type: "client_credentials" });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "X-IBM-Client-Id": key,
      "X-IBM-Client-Secret": secret,
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    console.error("Canada Post OAuth failed", response.status, payload?.code || payload?.error || "unknown");
    throw new Error("Canada Post authentication is temporarily unavailable.");
  }
  return String(payload.access_token);
}

Deno.serve(async (req: Request) => {
  const requestOrigin = origin(req);
  if (!allowed(requestOrigin)) return respond(req, { error: true, message: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  try {
    const key = Deno.env.get("CANADA_POST_API_KEY") || "";
    const secret = Deno.env.get("CANADA_POST_API_SECRET") || "";
    const customerNumber = Deno.env.get("CANADA_POST_CUSTOMER_NUMBER") || "";
    const originPostalCode = postalCode(Deno.env.get("CANADA_POST_ORIGIN_POSTAL_CODE"));

    // Fail closed without exposing credentials or silently inventing an origin.
    if (!key || !secret || !customerNumber || !originPostalCode) {
      return respond(req, {
        configured: false,
        rates: [],
        message: "Canada Post live rating is not fully configured.",
      }, 503);
    }

    const body = await req.json();
    const destinationPostalCode = postalCode(body?.destinationPostalCode || body?.postalCode);
    if (!destinationPostalCode) {
      return respond(req, { error: true, message: "Enter a valid Canadian postal code." }, 400);
    }

    // Conservative defaults keep the integration testable before per-SKU package metadata is complete.
    // Checkout will later pass calculated parcel characteristics from the cart.
    const weight = positive(body?.weightKg, 0.5, 0.05, 30);
    const length = positive(body?.lengthCm, 30, 1, 200);
    const width = positive(body?.widthCm, 25, 1, 200);
    const height = positive(body?.heightCm, 5, 1, 200);

    const token = await accessToken(key, secret);
    const ratingResponse = await fetch(RATING_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Language": "en-CA",
      },
      body: JSON.stringify({
        customerNumber,
        originPostalCode,
        parcelCharacteristics: {
          weight,
          dimensions: { length, width, height },
        },
        destination: {
          domestic: { postalCode: destinationPostalCode },
        },
      }),
    });

    const payload = await ratingResponse.json().catch(() => ({}));
    if (!ratingResponse.ok) {
      console.error("Canada Post Rating failed", ratingResponse.status, payload?.code || payload?.error?.code || "unknown");
      return respond(req, {
        configured: true,
        available: false,
        rates: [],
        fallbackRecommended: true,
        message: "Live Canada Post rates are temporarily unavailable.",
      }, 502);
    }

    const rates = rateRows(payload).sort((a: any, b: any) => Number(a.price) - Number(b.price));
    return respond(req, {
      configured: true,
      available: rates.length > 0,
      rates,
      fallbackRecommended: rates.length === 0,
      source: "canada_post",
    });
  } catch (error) {
    console.error("canada-post-rates", error instanceof Error ? error.message : error);
    return respond(req, {
      configured: true,
      available: false,
      rates: [],
      fallbackRecommended: true,
      message: "Live Canada Post rates are temporarily unavailable.",
    }, 502);
  }
});
