import { useEffect } from "react";

const REVIEW_SELECTOR = 'section[aria-label="Review seasonal design"]';
const REVIEW_FRAME_SELECTOR = `${REVIEW_SELECTOR} .gdp-seasonal-preview-frame`;
const APPROVED_PREVIEW_SELECTOR = '[data-seasonal-approved-preview]';

function imageReady(image) {
  return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

function waitForImage(image, timeoutMs = 15000) {
  if (!(image instanceof HTMLImageElement)) return Promise.reject(new Error("Seasonal artwork image is unavailable."));

  const decodeLoadedImage = async () => {
    if (!imageReady(image)) throw new Error("Seasonal artwork image failed to load.");
    if (typeof image.decode === "function") {
      try {
        await image.decode();
      } catch {
        if (!imageReady(image)) throw new Error("Seasonal artwork image could not be decoded.");
      }
    }
    return image;
  };

  if (imageReady(image)) return decodeLoadedImage();

  return new Promise((resolve, reject) => {
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      decodeLoadedImage().then(resolve).catch(reject);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Seasonal artwork image failed to load."));
    };
    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Seasonal artwork is still loading. Please retry."));
    }, timeoutMs);
  });
}

function nextPaint() {
  return new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
}

function markPreparedPreviewState() {
  const preview = document.querySelector(APPROVED_PREVIEW_SELECTOR);
  if (!(preview instanceof HTMLElement)) return;
  const image = preview.querySelector("img");
  if (!(image instanceof HTMLImageElement)) {
    preview.dataset.seasonalPreviewState = "missing";
    return;
  }

  image.loading = "eager";
  image.decoding = "async";
  try {
    image.fetchPriority = "high";
  } catch {
    // Older browsers can ignore fetchPriority safely.
  }

  const update = () => {
    preview.dataset.seasonalPreviewState = imageReady(image)
      ? "ready"
      : image.complete
        ? "error"
        : "loading";
  };

  update();
  if (image.dataset.seasonalGuardBound === "true") return;
  image.dataset.seasonalGuardBound = "true";
  image.addEventListener("load", update);
  image.addEventListener("error", update);
}

export default function SeasonalStudioRuntimeGuard() {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return undefined;

    const replaying = new WeakSet();
    let mutationFrame = 0;

    const refresh = () => {
      if (mutationFrame) window.cancelAnimationFrame(mutationFrame);
      mutationFrame = window.requestAnimationFrame(() => {
        markPreparedPreviewState();
        const review = document.querySelector(REVIEW_SELECTOR);
        if (review instanceof HTMLElement && !review.dataset.seasonalRenderState) {
          review.dataset.seasonalRenderState = "idle";
        }
      });
    };

    const handleClick = async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      const review = button.closest(REVIEW_SELECTOR);
      if (!(review instanceof HTMLElement)) return;

      const label = String(button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      const isPrepareAction = label.includes("continue to timing") || label.includes("retry continue");
      if (!isPrepareAction || replaying.has(button)) {
        replaying.delete(button);
        return;
      }

      const frame = review.querySelector(".gdp-seasonal-preview-frame");
      const images = frame ? Array.from(frame.querySelectorAll("img")) : [];
      if (!frame || !images.length) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        review.dataset.seasonalRenderState = "error";
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const originalDisabled = button.disabled;
      button.disabled = true;
      review.dataset.seasonalRenderState = "rendering";

      try {
        await Promise.all(images.map((image) => waitForImage(image)));
        if (document.fonts?.ready) await document.fonts.ready;
        await nextPaint();
        if (!images.every(imageReady)) throw new Error("Seasonal preview did not finish rendering.");
        review.dataset.seasonalRenderState = "ready";
        replaying.add(button);
        button.disabled = originalDisabled;
        button.click();
      } catch {
        review.dataset.seasonalRenderState = "error";
        button.disabled = originalDisabled;
      }
    };

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    document.addEventListener("click", handleClick, true);
    refresh();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
      if (mutationFrame) window.cancelAnimationFrame(mutationFrame);
    };
  }, []);

  return null;
}
