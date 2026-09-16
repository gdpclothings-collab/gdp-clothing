import * as React from "react"
import { useSize } from "@/hooks/use-size"
import { cn } from "@/lib/utils"
import {
  buildSrcSet,
  buildSupabaseSrcSet,
  buildSupabaseTransformUrl,
  buildTransformUrl,
  DEFAULT_TRANSFORM_WIDTH,
  getOriginalImageUrl,
  IMAGE_LOAD_MODE,
  nextImageLoadMode,
  parseSupabasePublicImageUrl,
  parseWixMediaUrl,
} from "./image-helpers"

const FALLBACK_IMAGE_URL =
  "https://static.wixstatic.com/media/12d367_4f26ccd17f8f4e3a8958306ea08c2332~mv2.png"

/** @typedef {React.HTMLAttributes<HTMLSpanElement> & { aspectRatio?: string | number }} ImageWrapperProps */
/** @type {React.ForwardRefExoticComponent<ImageWrapperProps & React.RefAttributes<HTMLSpanElement>>} */
const ImageWrapper = React.forwardRef(({ aspectRatio, className, style, children }, ref) => (
  <span
    ref={ref}
    className={cn("inline-block relative", className)}
    style={{ aspectRatio, ...style }}
  >
    {children}
  </span>
))
ImageWrapper.displayName = "ImageWrapper"

/**
 * Shared responsive renderer for image providers that can resize at the edge.
 * The network request is withheld until the rendered container is measured, so
 * cards do not download a large guess and immediately replace it with another
 * image after layout.
 */
const ResponsiveTransformedImage = React.forwardRef(
  (
    {
      parsed,
      fittingType,
      focalPoint,
      quality,
      className,
      style,
      aspectRatio,
      onLoad,
      buildUrl,
      buildSet,
      sourceKey,
      ...props
    },
    parentRef
  ) => {
    const wrapperRef = React.useRef(null)
    const imgRef = React.useRef(null)
    const size = useSize(wrapperRef)
    const [loaded, setLoaded] = React.useState(false)

    React.useImperativeHandle(parentRef, () => imgRef.current)

    React.useEffect(() => {
      setLoaded(false)
    }, [sourceKey])

    const crop = fittingType !== "fit"
    const options = size && {
      width: size.width || DEFAULT_TRANSFORM_WIDTH,
      height: size.height ? size.height : undefined,
      crop,
      focalPoint: crop ? focalPoint : undefined,
      quality,
    }

    return (
      <ImageWrapper ref={wrapperRef} aspectRatio={aspectRatio} className={className} style={style}>
        {options && !loaded && (
          <img
            src={buildUrl(parsed, {
              ...options,
              width: 20,
              height: options.height
                ? Math.max(1, Math.round((20 * options.height) / options.width))
                : undefined,
              quality: 20,
            })}
            alt=""
            aria-hidden="true"
            className="w-full h-full inset-0 absolute"
            style={{
              objectFit: fittingType === "fit" ? "contain" : "cover",
              filter: "blur(10px)",
              transform: "scale(1.1)",
            }}
          />
        )}
        {options && (
          <img
            ref={imgRef}
            src={buildUrl(parsed, options)}
            srcSet={buildSet(parsed, options)}
            loading="lazy"
            decoding="async"
            className={cn(
              "w-full h-full inset-0 absolute",
              fittingType === "fit" ? "object-contain" : "object-cover"
            )}
            onLoad={(event) => {
              setLoaded(true)
              onLoad?.(event)
            }}
            {...props}
          />
        )}
      </ImageWrapper>
    )
  }
)
ResponsiveTransformedImage.displayName = "ResponsiveTransformedImage"

/** @typedef {React.ImgHTMLAttributes<HTMLImageElement> & {
 * parsed: any,
 * fittingType?: string,
 * focalPoint?: { x: number, y: number },
 * quality?: number,
 * aspectRatio?: string | number
 * }} ResponsiveImageProps */
/** @type {React.ForwardRefExoticComponent<ResponsiveImageProps & React.RefAttributes<HTMLImageElement>>} */
const ResponsiveImage = React.forwardRef(
  ({ parsed, ...props }, ref) => (
    <ResponsiveTransformedImage
      ref={ref}
      parsed={parsed}
      buildUrl={buildTransformUrl}
      buildSet={buildSrcSet}
      sourceKey={parsed.baseUrl}
      {...props}
    />
  )
)
ResponsiveImage.displayName = "ResponsiveImage"

const ResponsiveSupabaseImage = React.forwardRef(
  ({ parsed, ...props }, ref) => (
    <ResponsiveTransformedImage
      ref={ref}
      parsed={parsed}
      buildUrl={buildSupabaseTransformUrl}
      buildSet={buildSupabaseSrcSet}
      sourceKey={`${parsed.origin}/${parsed.bucket}/${parsed.objectPath}`}
      {...props}
    />
  )
)
ResponsiveSupabaseImage.displayName = "ResponsiveSupabaseImage"

/**
 * Image with responsive optimization for GDP's supported storefront media.
 * Wix media keeps its existing transform path. Public Supabase `product-images`
 * are now delivered through Supabase Image Transformations, which resizes to
 * the rendered container and automatically negotiates WebP. Private customer
 * and production assets intentionally remain untouched. Any failed transform
 * retries the original URL before falling back to the generic placeholder.
 */
/** @typedef {React.ImgHTMLAttributes<HTMLImageElement> & {
 * fittingType?: string,
 * originWidth?: number,
 * originHeight?: number,
 * focalPointX?: number,
 * focalPointY?: number,
 * quality?: number
 * }} ImageProps */
/** @type {React.ForwardRefExoticComponent<ImageProps & React.RefAttributes<HTMLImageElement>>} */
const Image = React.forwardRef(
  (
    {
      src,
      fittingType = "fill",
      originWidth,
      originHeight,
      focalPointX,
      focalPointY,
      quality = 90,
      onError,
      ...props
    },
    ref
  ) => {
    const wixSource = src && src !== FALLBACK_IMAGE_URL ? parseWixMediaUrl(src) : null
    const supabaseSource = src && src !== FALLBACK_IMAGE_URL ? parseSupabasePublicImageUrl(src) : null
    const parsedSource = wixSource || supabaseSource
    const initialMode = parsedSource ? IMAGE_LOAD_MODE.OPTIMIZED : IMAGE_LOAD_MODE.ORIGINAL
    const [loadState, setLoadState] = React.useState({ src, mode: initialMode })
    const mode = loadState.src === src ? loadState.mode : initialMode

    React.useEffect(() => {
      setLoadState({ src, mode: initialMode })
    }, [src, initialMode])

    const handleError = (event) => {
      if (mode === IMAGE_LOAD_MODE.FALLBACK) return
      const nextMode = nextImageLoadMode(mode)
      setLoadState({ src, mode: nextMode })
      if (nextMode === IMAGE_LOAD_MODE.FALLBACK) onError?.(event)
    }

    const imageProps = {
      ...props,
      onError: handleError,
    }

    if (!src) {
      return <img ref={ref} src={FALLBACK_IMAGE_URL} {...imageProps} data-empty-image />
    }

    if (mode !== IMAGE_LOAD_MODE.OPTIMIZED || !parsedSource) {
      const isErrorMode = mode === IMAGE_LOAD_MODE.FALLBACK
      const imageSrc = isErrorMode
        ? FALLBACK_IMAGE_URL
        : getOriginalImageUrl(src, wixSource)
      return (
        <img
          ref={ref}
          src={imageSrc}
          decoding="async"
          {...imageProps}
          data-error-image={isErrorMode || undefined}
        />
      )
    }

    const focalPoint =
      typeof focalPointX === "number" && typeof focalPointY === "number"
        ? { x: focalPointX, y: focalPointY }
        : undefined
    const aspectRatio =
      originWidth && originHeight ? `${originWidth} / ${originHeight}` : undefined

    const responsiveProps = {
      ref,
      fittingType,
      focalPoint,
      quality,
      aspectRatio,
      ...imageProps,
    }

    if (supabaseSource) {
      return <ResponsiveSupabaseImage parsed={supabaseSource} {...responsiveProps} />
    }

    return <ResponsiveImage parsed={wixSource} {...responsiveProps} />
  }
)
Image.displayName = "Image"

export { Image }
