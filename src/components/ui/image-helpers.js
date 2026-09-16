const WIX_MEDIA_HOSTS = {
  "static.wixstatic.com": "/media/",
}

const SUPABASE_PUBLIC_IMAGE_PREFIX = "/storage/v1/object/public/"
const SUPABASE_RENDER_IMAGE_PREFIX = "/storage/v1/render/image/public/"
const SUPABASE_TRANSFORM_BUCKETS = new Set(["product-images"])

export const DEFAULT_TRANSFORM_WIDTH = 1024
export const SUPABASE_STOREFRONT_QUALITY = 82
export const IMAGE_LOAD_MODE = {
  OPTIMIZED: "optimized",
  ORIGINAL: "original",
  FALLBACK: "fallback",
}

const DEVICE_PIXEL_RATIOS = [1, 2, 3]
const SUPABASE_DEVICE_PIXEL_RATIOS = [1, 2]
const MAX_DIMENSION = 6000
const MAX_SUPABASE_DIMENSION = 2500
const SUPABASE_WIDTH_BUCKETS = [320, 480, 640, 768, 960, 1200, 1400, 1600, 1920, 2500]

/** Returns transform metadata only for canonical public Wix image URLs. */
export function parseWixMediaUrl(src) {
  try {
    const url = new URL(src)
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      return null
    }

    const pathPrefix = WIX_MEDIA_HOSTS[url.hostname]
    if (!pathPrefix) return null

    const transformed = url.pathname.match(/^(.*)\/v1\/(?:fill|fit)\/[^/]+\/[^/]+$/i)
    const basePath = transformed ? transformed[1] : url.pathname
    const filename = basePath.split("/").pop()
    if (
      !basePath.startsWith(pathPrefix) ||
      !filename ||
      !/\.[a-z0-9]+$/i.test(filename) ||
      /\.svg$/i.test(filename)
    ) {
      return null
    }

    return { baseUrl: `${url.origin}${basePath}`, filename }
  } catch {
    return null
  }
}

/**
 * Returns transform metadata only for GDP's public Supabase storefront image
 * bucket. It accepts both canonical Storage object URLs and an already resized
 * render URL so generic storefront mappers can provide a safe display-sized
 * default while the shared Image component still refines that default to the
 * actual rendered card/detail dimensions.
 *
 * Private customer/production buckets deliberately stay out of this path so
 * responsive storefront rendering cannot weaken their access model or
 * unexpectedly increase transformed origin usage.
 */
export function parseSupabasePublicImageUrl(src) {
  try {
    const url = new URL(src)
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !url.hostname.endsWith(".supabase.co")
    ) {
      return null
    }

    let storagePath = ""
    if (url.pathname.startsWith(SUPABASE_PUBLIC_IMAGE_PREFIX)) {
      storagePath = url.pathname.slice(SUPABASE_PUBLIC_IMAGE_PREFIX.length)
    } else if (url.pathname.startsWith(SUPABASE_RENDER_IMAGE_PREFIX)) {
      storagePath = url.pathname.slice(SUPABASE_RENDER_IMAGE_PREFIX.length)
    } else {
      return null
    }

    const slashIndex = storagePath.indexOf("/")
    if (slashIndex <= 0) return null

    const bucket = storagePath.slice(0, slashIndex)
    const objectPath = storagePath.slice(slashIndex + 1)
    if (
      !SUPABASE_TRANSFORM_BUCKETS.has(bucket) ||
      !objectPath ||
      /\.svg$/i.test(objectPath)
    ) {
      return null
    }

    return { origin: url.origin, bucket, objectPath }
  } catch {
    return null
  }
}

const clampDim = (n) => Math.min(Math.max(Math.round(n), 1), MAX_DIMENSION)
const clampSupabaseDim = (n) => Math.min(Math.max(Math.round(n), 1), MAX_SUPABASE_DIMENSION)
const clamp01 = (n) => Math.min(1, Math.max(0, n))
const clampQuality = (n) => Math.min(100, Math.max(20, Math.round(Number(n) || 80)))

/**
 * Keep Supabase transform URLs on a small, stable set of widths. ResizeObserver
 * measurements often vary by a few pixels as layout settles; using those raw
 * values would create many effectively equivalent CDN cache keys. Bucketed
 * dimensions improve Smart CDN reuse while always rounding up to avoid blur.
 */
export function normalizeSupabaseTransformDimensions(width, height) {
  const requestedWidth = clampSupabaseDim(width)
  const bucketedWidth =
    SUPABASE_WIDTH_BUCKETS.find((candidate) => candidate >= requestedWidth) || MAX_SUPABASE_DIMENSION
  const ratio = bucketedWidth / requestedWidth
  const bucketedHeight = height
    ? clampSupabaseDim(Math.max(1, Math.round(Number(height) * ratio)))
    : undefined

  return { width: bucketedWidth, height: bucketedHeight }
}

export function buildTransformUrl(
  { baseUrl, filename },
  { width, height, crop, focalPoint, quality }
) {
  const params = [`w_${clampDim(width)}`, `h_${clampDim(height || width)}`]
  if (crop) {
    params.push(
      focalPoint
        ? `fp_${clamp01(focalPoint.x).toFixed(2)}_${clamp01(focalPoint.y).toFixed(2)}`
        : "al_c"
    )
  }
  params.push(`q_${quality}`, "usm_0.66_1.00_0.01", "enc_webp", "quality_auto")
  const outputName = /\.gif$/i.test(filename)
    ? filename
    : filename.replace(/\.[a-z0-9]+$/i, "") + ".webp"
  return `${baseUrl}/v1/${crop ? "fill" : "fit"}/${params.join(",")}/${outputName}`
}

export function buildSrcSet(parsed, options) {
  return DEVICE_PIXEL_RATIOS.map(
    (dpr) =>
      `${buildTransformUrl(parsed, {
        ...options,
        width: options.width * dpr,
        height: options.height ? options.height * dpr : undefined,
      })} ${dpr}x`
  ).join(", ")
}

export function buildSupabaseTransformUrl(
  { origin, bucket, objectPath },
  { width, height, crop, quality }
) {
  const dimensions = normalizeSupabaseTransformDimensions(width, height)
  const params = new URLSearchParams()
  params.set("width", String(dimensions.width))
  if (dimensions.height) params.set("height", String(dimensions.height))
  params.set("resize", crop ? "cover" : "contain")
  params.set("quality", String(Math.min(SUPABASE_STOREFRONT_QUALITY, clampQuality(quality))))

  return `${origin}${SUPABASE_RENDER_IMAGE_PREFIX}${bucket}/${objectPath}?${params.toString()}`
}

export function buildSupabaseSrcSet(parsed, options) {
  const seen = new Set()
  return SUPABASE_DEVICE_PIXEL_RATIOS.flatMap((dpr) => {
    const dimensions = normalizeSupabaseTransformDimensions(
      options.width * dpr,
      options.height ? options.height * dpr : undefined
    )
    const key = `${dimensions.width}x${dimensions.height || "auto"}`
    if (seen.has(key)) return []
    seen.add(key)
    return [
      `${buildSupabaseTransformUrl(parsed, {
        ...options,
        width: dimensions.width,
        height: dimensions.height,
      })} ${dpr}x`,
    ]
  }).join(", ")
}

export function getOriginalImageUrl(src, parsed) {
  if (parsed?.baseUrl) return parsed.baseUrl
  if (parsed?.origin && parsed?.bucket && parsed?.objectPath) {
    return `${parsed.origin}${SUPABASE_PUBLIC_IMAGE_PREFIX}${parsed.bucket}/${parsed.objectPath}`
  }
  return src
}

export function nextImageLoadMode(mode) {
  return mode === IMAGE_LOAD_MODE.OPTIMIZED
    ? IMAGE_LOAD_MODE.ORIGINAL
    : IMAGE_LOAD_MODE.FALLBACK
}
