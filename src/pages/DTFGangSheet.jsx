import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileCheck,
  Layers3,
  Maximize2,
  Move,
  Ruler,
  Scissors,
  ShoppingBag,
  Sparkles,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useCart } from "@/lib/CartContext";
import {
  artworkOverlaps,
  autoArrangeArtwork,
  calculateDtfPrice,
  calculateUtilization,
  createDtfConfigId,
  fitLengthToArtwork,
  getArtworkQuality,
  normalizeDtfSettings,
  usedArtworkLength,
} from "@/lib/dtfGangSheet";
import { dtfGangSheetApi } from "@/lib/dtfGangSheetApi";
import { advancedNestArtwork } from "@/lib/dtfNesting";

const round = (value, decimals = 2) => {
  const power = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * power) / power;
};

const createArtworkId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `art-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatFileSize = (bytes = 0) => {
  const size = Math.max(0, Number(bytes || 0));
  if (size >= 1024 * 1024) return `${round(size / (1024 * 1024), 2)} MB`;
  if (size >= 1024) return `${round(size / 1024, 1)} KB`;
  return `${Math.round(size)} B`;
};

function sourceDefaultPrintSize(metadata, settings, sheetWidth, sheetLength) {
  const minimum = 0.1;
  const maxWidth = Math.max(minimum, sheetWidth - settings.spacing * 2);
  const maxHeight = Math.max(minimum, sheetLength - settings.spacing * 2);
  const sourceDpi = Math.max(1, Number(settings.recommendedDpi || 300));

  let width = metadata.pixelWidth > 0 ? metadata.pixelWidth / sourceDpi : Math.min(10, maxWidth);
  let height = metadata.pixelHeight > 0
    ? metadata.pixelHeight / sourceDpi
    : width / Math.max(0.01, metadata.aspectRatio || 1);

  width = Math.max(minimum, width);
  height = Math.max(minimum, height);
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  return {
    width: width * scale,
    height: height * scale,
    sourceDpi,
  };
}

async function imageMetadata(file) {
  if (!file || !String(file.type || "").startsWith("image/") || file.type === "image/svg+xml") {
    return {
      pixelWidth: 0,
      pixelHeight: 0,
      originalPixelWidth: 0,
      originalPixelHeight: 0,
      aspectRatio: 1,
      previewUrl: "",
      cropBounds: null,
      transparentTrimmed: false,
    };
  }

  const sourceUrl = URL.createObjectURL(file);

  return new Promise((resolve) => {
    const image = new Image();

    image.onload = async () => {
      const originalPixelWidth = Number(image.naturalWidth || 0);
      const originalPixelHeight = Number(image.naturalHeight || 0);
      let pixelWidth = originalPixelWidth;
      let pixelHeight = originalPixelHeight;
      let aspectRatio = originalPixelHeight > 0 ? originalPixelWidth / originalPixelHeight : 1;
      let previewUrl = sourceUrl;
      let cropBounds = null;
      let transparentTrimmed = false;

      try {
        if (
          file.type === "image/png" &&
          originalPixelWidth > 0 &&
          originalPixelHeight > 0
        ) {
          const maxSampleSide = 900;
          const sampleScale = Math.min(
            1,
            maxSampleSide / Math.max(originalPixelWidth, originalPixelHeight)
          );
          const sampleWidth = Math.max(1, Math.round(originalPixelWidth * sampleScale));
          const sampleHeight = Math.max(1, Math.round(originalPixelHeight * sampleScale));
          const sampleCanvas = document.createElement("canvas");
          sampleCanvas.width = sampleWidth;
          sampleCanvas.height = sampleHeight;
          const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });

          if (sampleContext) {
            sampleContext.clearRect(0, 0, sampleWidth, sampleHeight);
            sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);
            const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
            let minX = sampleWidth;
            let minY = sampleHeight;
            let maxX = -1;
            let maxY = -1;
            let hasTransparency = false;

            for (let y = 0; y < sampleHeight; y += 1) {
              for (let x = 0; x < sampleWidth; x += 1) {
                const alpha = pixels[(y * sampleWidth + x) * 4 + 3];
                if (alpha < 250) hasTransparency = true;
                if (alpha > 8) {
                  minX = Math.min(minX, x);
                  minY = Math.min(minY, y);
                  maxX = Math.max(maxX, x);
                  maxY = Math.max(maxY, y);
                }
              }
            }

            if (hasTransparency && maxX >= minX && maxY >= minY) {
              const pad = 1;
              minX = Math.max(0, minX - pad);
              minY = Math.max(0, minY - pad);
              maxX = Math.min(sampleWidth - 1, maxX + pad);
              maxY = Math.min(sampleHeight - 1, maxY + pad);

              const left = minX / sampleWidth;
              const top = minY / sampleHeight;
              const right = (maxX + 1) / sampleWidth;
              const bottom = (maxY + 1) / sampleHeight;
              const visibleWidthRatio = Math.max(0.001, right - left);
              const visibleHeightRatio = Math.max(0.001, bottom - top);
              const trimRatio = 1 - visibleWidthRatio * visibleHeightRatio;

              if (trimRatio >= 0.01) {
                cropBounds = { left, top, right, bottom };
                transparentTrimmed = true;
                pixelWidth = Math.max(1, Math.round(originalPixelWidth * visibleWidthRatio));
                pixelHeight = Math.max(1, Math.round(originalPixelHeight * visibleHeightRatio));
                aspectRatio = pixelWidth / Math.max(1, pixelHeight);

                const maxPreviewSide = 1200;
                const previewScale = Math.min(1, maxPreviewSide / Math.max(pixelWidth, pixelHeight));
                const previewWidth = Math.max(1, Math.round(pixelWidth * previewScale));
                const previewHeight = Math.max(1, Math.round(pixelHeight * previewScale));
                const previewCanvas = document.createElement("canvas");
                previewCanvas.width = previewWidth;
                previewCanvas.height = previewHeight;
                const previewContext = previewCanvas.getContext("2d");

                if (previewContext) {
                  previewContext.clearRect(0, 0, previewWidth, previewHeight);
                  previewContext.drawImage(
                    image,
                    left * originalPixelWidth,
                    top * originalPixelHeight,
                    visibleWidthRatio * originalPixelWidth,
                    visibleHeightRatio * originalPixelHeight,
                    0,
                    0,
                    previewWidth,
                    previewHeight
                  );

                  const previewBlob = await new Promise((blobResolve) =>
                    previewCanvas.toBlob(blobResolve, "image/png")
                  );
                  if (previewBlob) {
                    previewUrl = URL.createObjectURL(previewBlob);
                    URL.revokeObjectURL(sourceUrl);
                  }
                }
              }
            }
          }
        }
      } catch (analysisError) {
        console.debug("Transparent PNG analysis fallback:", analysisError);
      }

      resolve({
        pixelWidth,
        pixelHeight,
        originalPixelWidth,
        originalPixelHeight,
        aspectRatio,
        previewUrl,
        cropBounds,
        transparentTrimmed,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      resolve({
        pixelWidth: 0,
        pixelHeight: 0,
        originalPixelWidth: 0,
        originalPixelHeight: 0,
        aspectRatio: 1,
        previewUrl: "",
        cropBounds: null,
        transparentTrimmed: false,
      });
    };

    image.src = sourceUrl;
  });
}
async function removeLightBackground(file, threshold = 245) {
  if (!file || !String(file.type || "").startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Background cleanup is available for PNG, JPG and WEBP artwork.");
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Could not read this artwork for background cleanup."));
      nextImage.src = sourceUrl;
    });

    const width = Number(image.naturalWidth || 0);
    const height = Number(image.naturalHeight || 0);
    if (!width || !height) throw new Error("Artwork dimensions could not be detected.");

    const sampleScale = Math.min(1, 1200 / Math.max(width, height));
    const sampleWidth = Math.max(1, Math.round(width * sampleScale));
    const sampleHeight = Math.max(1, Math.round(height * sampleScale));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) throw new Error("Background cleanup is not supported by this browser.");
    sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const samplePixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;

    const isLightSample = (pixelIndex) => {
      const offset = pixelIndex * 4;
      return samplePixels[offset + 3] > 8 &&
        samplePixels[offset] >= threshold &&
        samplePixels[offset + 1] >= threshold &&
        samplePixels[offset + 2] >= threshold;
    };

    const mask = new Uint8Array(sampleWidth * sampleHeight);
    const queue = new Uint32Array(sampleWidth * sampleHeight);
    let head = 0;
    let tail = 0;
    const enqueue = (index) => {
      if (index < 0 || index >= mask.length || mask[index] || !isLightSample(index)) return;
      mask[index] = 1;
      queue[tail] = index;
      tail += 1;
    };

    for (let x = 0; x < sampleWidth; x += 1) {
      enqueue(x);
      enqueue((sampleHeight - 1) * sampleWidth + x);
    }
    for (let y = 0; y < sampleHeight; y += 1) {
      enqueue(y * sampleWidth);
      enqueue(y * sampleWidth + sampleWidth - 1);
    }

    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % sampleWidth;
      const y = Math.floor(index / sampleWidth);
      if (x > 0) enqueue(index - 1);
      if (x + 1 < sampleWidth) enqueue(index + 1);
      if (y > 0) enqueue(index - sampleWidth);
      if (y + 1 < sampleHeight) enqueue(index + sampleWidth);
    }

    if (!tail) {
      throw new Error("No light background connected to the artwork edges was detected.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Background cleanup is not supported by this browser.");
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const edgeThreshold = Math.max(200, threshold - 8);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      const sampleY = Math.min(sampleHeight - 1, Math.floor((y / height) * sampleHeight));
      for (let x = 0; x < width; x += 1) {
        const sampleX = Math.min(sampleWidth - 1, Math.floor((x / width) * sampleWidth));
        const offset = (y * width + x) * 4;
        if (
          mask[sampleY * sampleWidth + sampleX] &&
          pixels[offset] >= edgeThreshold &&
          pixels[offset + 1] >= edgeThreshold &&
          pixels[offset + 2] >= edgeThreshold
        ) {
          pixels[offset + 3] = 0;
        }

        if (pixels[offset + 3] > 8) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      throw new Error("Background cleanup removed the entire image. Try a more conservative setting.");
    }

    context.putImageData(imageData, 0, 0);
    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) throw new Error("Could not create the cleaned artwork.");
    outputContext.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    const blob = await new Promise((resolve) => outputCanvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not create the cleaned artwork.");
    const cleanName = String(file.name || "artwork").replace(/\.[^.]+$/, "") + "-background-removed.png";
    return new File([blob], cleanName, { type: "image/png", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function checkerboardStyle() {
  return {
    backgroundColor: "#f7f7f7",
    backgroundImage:
      "linear-gradient(45deg,#e8e8e8 25%,transparent 25%),linear-gradient(-45deg,#e8e8e8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e8e8e8 75%),linear-gradient(-45deg,transparent 75%,#e8e8e8 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0,0 10px,10px -10px,-10px 0px",
  };
}

export default function DTFGangSheet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem } = useCart();
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const selectedPanelRef = useRef(null);
  const [settings, setSettings] = useState(() => normalizeDtfSettings({}));
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [mode, setMode] = useState(() => (searchParams.get("mode") === "upload" ? "upload" : "build"));
  const [sheetWidth, setSheetWidth] = useState(34);
  const [sheetLength, setSheetLength] = useState(36);
  const [artworks, setArtworks] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [approval, setApproval] = useState(false);
  const [artworkReviewRequested, setArtworkReviewRequested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [backgroundThreshold, setBackgroundThreshold] = useState(245);
  const [editingArtwork, setEditingArtwork] = useState(false);

  useEffect(() => {
    let active = true;
    dtfGangSheetApi
      .load()
      .then(({ settings: nextSettings, product: nextProduct }) => {
        if (!active) return;
        setSettings(nextSettings);
        setSheetWidth(nextSettings.defaultWidth);
        setSheetLength(nextSettings.standardMaxLength || 36);
        setProduct(nextProduct);
      })
      .catch((error) => {
        if (active) setPageError(error?.message || "DTF ordering is temporarily unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const runNesting = (items, currentLength = sheetLength) => {
    if (!settings.advancedNestingEnabled) {
      const arranged = autoArrangeArtwork(items, sheetWidth, currentLength, settings.spacing);
      return {
        items: arranged,
        usedLength: usedArtworkLength(arranged, settings.spacing),
        recommendedLength: Math.max(
          settings.minLength,
          Math.ceil(usedArtworkLength(arranged, settings.spacing) * 4) / 4
        ),
        efficiency: calculateUtilization(arranged, sheetWidth, Math.max(currentLength, 0.01)),
        rotatedCount: 0,
        unpacked: [],
        passes: 1,
        algorithm: "row-pack-fallback",
      };
    }

    return advancedNestArtwork(
      items,
      sheetWidth,
      currentLength,
      settings.spacing,
      {
        allowRotation: settings.autoRotateEnabled !== false,
        minLength: settings.minLength,
      }
    );
  };

  const hasArtwork = artworks.length > 0;
  const price = useMemo(
    () => calculateDtfPrice(hasArtwork ? sheetWidth : 0, hasArtwork ? sheetLength : 0, settings),
    [hasArtwork, sheetWidth, sheetLength, settings]
  );
  const selectedArtwork = artworks.find((item) => item.id === selectedId) || null;
  const selectedQuality = getArtworkQuality(selectedArtwork, settings);
  const overlaps = artworkOverlaps(artworks);
  const utilization = calculateUtilization(artworks, sheetWidth, sheetLength);
  const usedLength = usedArtworkLength(artworks, settings.spacing);
  const fitLength = fitLengthToArtwork(artworks, settings);
  const displayHeight = Math.min(1600, Math.max(520, (sheetLength / Math.max(1, sheetWidth)) * 500));

  const validation = useMemo(() => {
    const errors = [];
    const warnings = [];
    if (!artworks.length) errors.push("Upload at least one artwork file.");
    if (sheetWidth <= 0 || sheetWidth > settings.maxWidth) {
      errors.push(`Film width must be between 1" and ${settings.maxWidth}".`);
    }
    if (sheetLength < settings.minLength) {
      errors.push(`Film length must be at least ${settings.minLength}".`);
    }
    if (usedLength > sheetLength + 0.01) {
      errors.push("Artwork extends beyond the selected film length.");
    }
    if (overlaps.length) {
      errors.push("Two or more artwork items overlap. Move or auto-arrange them before checkout.");
    }

    artworks.forEach((item) => {
      const quality = getArtworkQuality(item, settings);
      if (quality.tone === "bad") warnings.push(`${item.name} is below ${settings.minimumDpi} DPI at its current print size.`);
      if (item.type === "image/jpeg") warnings.push(`${item.name} is a JPEG and may include a background.`);
    });

    return { errors, warnings };
  }, [artworks, sheetWidth, sheetLength, settings, usedLength, overlaps.length]);

  const setWidth = (value) => {
    const next = Math.max(1, Math.min(settings.maxWidth, Number(value || 1)));
    setSheetWidth(next);
    setArtworks((current) =>
      current.map((item) => ({
        ...item,
        width: Math.min(item.width, Math.max(0.5, next - settings.spacing * 2)),
        x: Math.min(item.x, Math.max(0, next - item.width)),
      }))
    );
  };

  const changeMode = (nextMode) => {
    artworks.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    setMode(nextMode);
    setArtworks([]);
    setSelectedId("");
    setApproval(false);
    setNotice("");
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setPageError("");
    setNotice("");

    const accepted = files.filter((file) => {
      if (!settings.acceptedMimeTypes.includes(String(file.type || ""))) return false;
      if (Number(file.size || 0) > settings.maxUploadMb * 1024 * 1024) return false;
      return true;
    });

    if (!accepted.length) {
      setPageError(`Use PNG, JPG, WEBP, SVG or PDF files up to ${settings.maxUploadMb} MB each.`);
      return;
    }

    const chosen = mode === "upload" ? accepted.slice(0, 1) : accepted.slice(0, 30);
    const nextItems = [];

    for (const file of chosen) {
      const metadata = await imageMetadata(file);
      const isVector = file.type === "image/svg+xml" || file.type === "application/pdf";
      const sourceSize = sourceDefaultPrintSize(metadata, settings, sheetWidth, sheetLength);
      const defaultWidth = isVector
        ? mode === "upload"
          ? Math.max(0.1, sheetWidth - settings.spacing * 2)
          : Math.min(10, Math.max(0.1, sheetWidth - settings.spacing * 2))
        : sourceSize.width;
      const height = isVector
        ? Math.max(0.1, defaultWidth / Math.max(0.01, metadata.aspectRatio || 1))
        : sourceSize.height;

      nextItems.push({
        id: createArtworkId(),
        file,
        originalFile: file,
        originalName: file.name,
        originalType: file.type,
        backgroundRemoved: false,
        storagePath: "",
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl:
          metadata.previewUrl ||
          (String(file.type || "").startsWith("image/") ? URL.createObjectURL(file) : ""),
        pixelWidth: metadata.pixelWidth,
        pixelHeight: metadata.pixelHeight,
        originalPixelWidth: metadata.originalPixelWidth || metadata.pixelWidth,
        originalPixelHeight: metadata.originalPixelHeight || metadata.pixelHeight,
        cropBounds: metadata.cropBounds,
        transparentTrimmed: metadata.transparentTrimmed === true,
        aspectRatio: metadata.aspectRatio || 1,
        isVector,
        x: settings.spacing,
        y: settings.spacing,
        width: defaultWidth,
        height,
        defaultWidth,
        defaultHeight: height,
        sourceDpi: isVector ? null : sourceSize.sourceDpi,
        rotation: 0,
      });
    }

    const merged = mode === "upload" ? nextItems : [...artworks, ...nextItems];
    const nested = runNesting(merged, sheetLength);
    const nextLength = Math.max(sheetLength, nested.recommendedLength);
    setSheetLength(nextLength);
    setArtworks(nested.items);
    setSelectedId(nested.items[nested.items.length - 1]?.id || "");
    setApproval(false);
  };

  const updateSelected = (patch) => {
    if (!selectedId) return;
    const minimum = 0.1;
    setArtworks((current) =>
      current.map((item) => {
        if (item.id !== selectedId) return item;
        const next = { ...item, ...patch };
        const rotated = Math.abs(Number(item.rotation || 0)) % 180 === 90;
        const ratio = Math.max(0.01, item.aspectRatio || 1);
        const maxWidth = Math.max(minimum, sheetWidth - item.x);
        const maxHeight = Math.max(minimum, sheetLength - item.y);

        if (patch.width != null) {
          let width = Math.max(minimum, Math.min(Number(patch.width || minimum), maxWidth));
          let height = rotated ? width * ratio : width / ratio;
          if (height > maxHeight) {
            height = maxHeight;
            width = rotated ? height / ratio : height * ratio;
          }
          next.width = Math.max(minimum, width);
          next.height = Math.max(minimum, height);
        } else if (patch.height != null) {
          let height = Math.max(minimum, Math.min(Number(patch.height || minimum), maxHeight));
          let width = rotated ? height / ratio : height * ratio;
          if (width > maxWidth) {
            width = maxWidth;
            height = rotated ? width * ratio : width / ratio;
          }
          next.width = Math.max(minimum, width);
          next.height = Math.max(minimum, height);
        }

        next.x = Math.max(0, Math.min(next.x, sheetWidth - next.width));
        next.y = Math.max(0, Math.min(next.y, sheetLength - next.height));
        return next;
      })
    );
    setApproval(false);
    setPageError("");
  };

  const commitSelectedDimension = (axis, rawValue, input) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) {
      if (input && selectedArtwork) {
        input.value = String(round(axis === "height" ? selectedArtwork.height : selectedArtwork.width, 2));
      }
      return;
    }
    updateSelected({ [axis]: value });
  };

  const resetSelectedArtworkSize = () => {
    if (!selectedArtwork) return;
    const minimum = 0.1;
    const ratio = Math.max(0.01, selectedArtwork.aspectRatio || 1);
    let width = Math.max(minimum, Number(selectedArtwork.defaultWidth || selectedArtwork.width));
    let height = Math.max(minimum, Number(selectedArtwork.defaultHeight || width / ratio));
    const maxWidth = Math.max(minimum, sheetWidth - selectedArtwork.x);
    const maxHeight = Math.max(minimum, sheetLength - selectedArtwork.y);
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    width *= scale;
    height *= scale;

    setArtworks((current) =>
      current.map((item) =>
        item.id === selectedArtwork.id
          ? { ...item, width, height, rotation: 0 }
          : item
      )
    );
    setApproval(false);
    setPageError("");
    setNotice(`Artwork size reset to ${round(width, 2)}" × ${round(height, 2)}".`);
  };

  const replaceSelectedArtworkFile = async (file, backgroundRemoved, message) => {
    if (!selectedArtwork || !file) return;
    const targetId = selectedArtwork.id;
    const metadata = await imageMetadata(file);
    const sourceSize = sourceDefaultPrintSize(metadata, settings, sheetWidth, sheetLength);
    const maxWidth = Math.max(0.1, sheetWidth - selectedArtwork.x);
    const maxHeight = Math.max(0.1, sheetLength - selectedArtwork.y);
    const scale = Math.min(1, maxWidth / sourceSize.width, maxHeight / sourceSize.height);
    const width = Math.max(0.1, sourceSize.width * scale);
    const height = Math.max(0.1, sourceSize.height * scale);
    const previousPreviewUrl = selectedArtwork.previewUrl;

    setArtworks((current) =>
      current.map((item) =>
        item.id === targetId
          ? {
              ...item,
              file,
              name: item.originalName || item.name,
              type: file.type,
              size: file.size,
              previewUrl: metadata.previewUrl || URL.createObjectURL(file),
              pixelWidth: metadata.pixelWidth,
              pixelHeight: metadata.pixelHeight,
              originalPixelWidth: metadata.originalPixelWidth || metadata.pixelWidth,
              originalPixelHeight: metadata.originalPixelHeight || metadata.pixelHeight,
              cropBounds: metadata.cropBounds,
              transparentTrimmed: metadata.transparentTrimmed === true,
              aspectRatio: metadata.aspectRatio || 1,
              isVector: false,
              width,
              height,
              defaultWidth: sourceSize.width,
              defaultHeight: sourceSize.height,
              sourceDpi: sourceSize.sourceDpi,
              rotation: 0,
              backgroundRemoved,
            }
          : item
      )
    );

    const previewIsShared = artworks.some(
      (item) => item.id !== targetId && item.previewUrl === previousPreviewUrl
    );
    if (previousPreviewUrl && previousPreviewUrl !== metadata.previewUrl && !previewIsShared) {
      URL.revokeObjectURL(previousPreviewUrl);
    }
    setApproval(false);
    setPageError("");
    setNotice(message);
  };

  const removeSelectedBackground = async () => {
    if (!selectedArtwork || mode !== "build" || selectedArtwork.isVector) return;
    setEditingArtwork(true);
    setPageError("");
    try {
      const sourceFile = selectedArtwork.originalFile || selectedArtwork.file;
      const cleaned = await removeLightBackground(sourceFile, backgroundThreshold);
      await replaceSelectedArtworkFile(
        cleaned,
        true,
        `Background removed. Print size recalculated from the cleaned artwork at ${settings.recommendedDpi} DPI.`
      );
    } catch (error) {
      setPageError(error?.message || "Could not remove this artwork background.");
    } finally {
      setEditingArtwork(false);
    }
  };

  const restoreSelectedBackground = async () => {
    if (!selectedArtwork?.originalFile) return;
    setEditingArtwork(true);
    setPageError("");
    try {
      await replaceSelectedArtworkFile(selectedArtwork.originalFile, false, "Original artwork background restored.");
    } catch (error) {
      setPageError(error?.message || "Could not restore the original artwork.");
    } finally {
      setEditingArtwork(false);
    }
  };

  const duplicateSelected = () => {
    if (!selectedArtwork || mode === "upload") return;
    const copy = {
      ...selectedArtwork,
      id: createArtworkId(),
      x: Math.min(sheetWidth - selectedArtwork.width, selectedArtwork.x + settings.spacing * 2),
      y: Math.min(sheetLength - selectedArtwork.height, selectedArtwork.y + settings.spacing * 2),
    };
    const nested = runNesting([...artworks, copy], sheetLength);
    setSheetLength(Math.max(sheetLength, nested.recommendedLength));
    setArtworks(nested.items);
    setSelectedId(copy.id);
    setApproval(false);
  };

  const removeArtwork = (artworkId) => {
    const target = artworks.find((item) => item.id === artworkId);
    if (!target) return;

    const next = artworks.filter((item) => item.id !== artworkId);
    if (target.previewUrl && !next.some((item) => item.previewUrl === target.previewUrl)) {
      URL.revokeObjectURL(target.previewUrl);
    }

    setArtworks(next);
    setSelectedId((current) => (current === artworkId ? next[0]?.id || "" : current));
    setApproval(false);
    setPageError("");
    if (!next.length) {
      setArtworkReviewRequested(false);
      setNotice("");
    }
  };

  const removeSelected = () => {
    if (!selectedArtwork) return;
    removeArtwork(selectedArtwork.id);
  };

  const resetWorkspace = () => {
    const hasWorkspaceChanges =
      artworks.length > 0 ||
      sheetWidth !== settings.defaultWidth ||
      sheetLength !== (settings.standardMaxLength || 36) ||
      approval ||
      artworkReviewRequested;

    if (
      hasWorkspaceChanges &&
      typeof window !== "undefined" &&
      !window.confirm("Reset this DTF workspace? All uploaded artwork and layout changes will be cleared.")
    ) {
      return;
    }

    artworks.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });

    dragRef.current = null;
    setSheetWidth(settings.defaultWidth);
    setSheetLength(settings.standardMaxLength || 36);
    setArtworks([]);
    setSelectedId("");
    setApproval(false);
    setArtworkReviewRequested(false);
    setPageError("");
    setNotice("Workspace reset. Upload artwork to start a new gang sheet.");
  };

  const autoArrange = () => {
    if (artworks.length < 2) {
      setNotice("Advanced Nest needs at least 2 designs. Move or resize a single design manually.");
      return;
    }

    const nested = settings.advancedNestingEnabled
      ? advancedNestArtwork(
          artworks,
          sheetWidth,
          sheetLength,
          settings.spacing,
          {
            allowRotation: settings.autoRotateEnabled !== false,
            minLength: settings.minLength,
            maxLength: sheetLength,
          }
        )
      : runNesting(artworks, sheetLength);

    if (nested.unpacked.length) {
      setPageError(
        `${nested.unpacked.length} artwork item${nested.unpacked.length === 1 ? "" : "s"} could not fit inside the current ${sheetWidth}" × ${sheetLength}" film. Increase the film length or reduce the artwork size.`
      );
      return;
    }

    setArtworks(nested.items);
    setApproval(false);
    setPageError("");

    const potentialLength = Math.max(settings.minLength, nested.recommendedLength);
    const potentialSaving = Math.max(0, sheetLength - potentialLength);
    const detail = [
      `${nested.passes} packing passes`,
      `${nested.rotatedCount} auto-rotated`,
      `${nested.efficiency.toFixed(1)}% packing efficiency`,
    ].join(" · ");

    setNotice(
      potentialSaving >= 0.25
        ? `Advanced Nest rearranged the designs without changing your ${sheetLength}" film length. The packed layout uses about ${potentialLength}". Use “Fit sheet to artwork” if you want to reduce the film length. ${detail}.`
        : `Advanced Nest optimized the design positions without changing film size or price. ${detail}.`
    );
  };

  const fitSheet = () => {
    const nextLength = Math.max(settings.minLength, fitLength);
    setSheetLength(nextLength);
    setApproval(false);
    setNotice(`Film length fitted to ${nextLength}".`);
  };

  const rotateSelected = () => {
    if (!selectedArtwork || mode === "upload") return;

    const nextRotation = (Number(selectedArtwork.rotation || 0) + 90) % 180;
    const nextWidth = selectedArtwork.height;
    const nextHeight = selectedArtwork.width;

    if (nextWidth > sheetWidth - settings.spacing * 2) {
      setPageError(`This design is too wide to rotate inside the ${sheetWidth}" film.`);
      return;
    }

    setArtworks((current) =>
      current.map((item) =>
        item.id === selectedArtwork.id
          ? {
              ...item,
              rotation: nextRotation,
              width: nextWidth,
              height: nextHeight,
              x: Math.min(item.x, Math.max(0, sheetWidth - nextWidth)),
              y: Math.min(item.y, Math.max(0, sheetLength - nextHeight)),
            }
          : item
      )
    );
    setApproval(false);
    setPageError("");
  };

  const onPointerDown = (event, item) => {
    if (!canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedId(item.id);
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      type: "move",
      id: item.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left - (item.x / sheetWidth) * rect.width,
      offsetY: event.clientY - rect.top - (item.y / sheetLength) * rect.height,
    };
  };

  const onResizePointerDown = (event, item) => {
    if (!canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedId(item.id);
    dragRef.current = {
      type: "resize",
      id: item.id,
      pointerId: event.pointerId,
    };
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;

    event.preventDefault();
    const item = artworks.find((entry) => entry.id === drag.id);
    if (!item) return;
    const rect = canvas.getBoundingClientRect();

    if (drag.type === "resize") {
      const pointerX = ((event.clientX - rect.left) / rect.width) * sheetWidth;
      const minimum = 0.1;
      const rotated = Math.abs(Number(item.rotation || 0)) % 180 === 90;
      const ratio = Math.max(0.01, item.aspectRatio || 1);
      const maxWidthByFilm = Math.max(minimum, sheetWidth - item.x);
      const maxHeightByFilm = Math.max(minimum, sheetLength - item.y);
      const maxWidthByHeight = rotated ? maxHeightByFilm / ratio : maxHeightByFilm * ratio;
      const width = Math.max(minimum, Math.min(pointerX - item.x, maxWidthByFilm, maxWidthByHeight));
      const height = rotated ? width * ratio : width / ratio;

      setArtworks((current) =>
        current.map((entry) =>
          entry.id === drag.id ? { ...entry, width, height } : entry
        )
      );
      setApproval(false);
      setPageError("");
      return;
    }

    const x = ((event.clientX - rect.left - drag.offsetX) / rect.width) * sheetWidth;
    const y = ((event.clientY - rect.top - drag.offsetY) / rect.height) * sheetLength;
    const clampedX = Math.max(0, Math.min(sheetWidth - item.width, x));
    const clampedY = Math.max(0, Math.min(sheetLength - item.height, y));

    setArtworks((current) =>
      current.map((entry) => (entry.id === drag.id ? { ...entry, x: clampedX, y: clampedY } : entry))
    );
    setApproval(false);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const addToCart = async () => {
    setPageError("");
    setNotice("");
    if (!product?.id) {
      setPageError("The DTF product is not active yet.");
      return;
    }
    if (validation.errors.length) {
      setPageError(validation.errors[0]);
      return;
    }
    if (!approval) {
      setPageError("Review the film preview and confirm artwork approval before adding it to the cart.");
      return;
    }

    setSaving(true);
    try {
      const uniqueFiles = [...new Set(artworks.map((item) => item.file).filter(Boolean))];
      const uploaded = await dtfGangSheetApi.uploadArtwork(uniqueFiles);
      const pathByFile = new Map();
      uniqueFiles.forEach((file, index) => pathByFile.set(file, uploaded[index]?.path || ""));

      const approvalTimestamp = new Date().toISOString();
      const layout = artworks.map((item) => ({
        name: item.name,
        type: item.type,
        storagePath: item.storagePath || pathByFile.get(item.file) || "",
        x: round(item.x, 3),
        y: round(item.y, 3),
        width: round(item.width, 3),
        height: round(item.height, 3),
        rotation: Number(item.rotation || 0),
        pixelWidth: Number(item.pixelWidth || 0),
        pixelHeight: Number(item.pixelHeight || 0),
        originalPixelWidth: Number(item.originalPixelWidth || item.pixelWidth || 0),
        originalPixelHeight: Number(item.originalPixelHeight || item.pixelHeight || 0),
        cropBounds: item.cropBounds || null,
        transparentTrimmed: item.transparentTrimmed === true,
        defaultWidth: round(item.defaultWidth || item.width, 3),
        defaultHeight: round(item.defaultHeight || item.height, 3),
        sourceDpi: item.sourceDpi || null,
      }));

      const reviewFee = artworkReviewRequested && settings.artworkReviewEnabled
        ? Number(settings.artworkReviewPrice || 0)
        : 0;
      const linePrice = round(price.price + reviewFee, 2);

      addItem({
        productId: product.id,
        variantId: null,
        name: product.name || "Custom DTF Gang Sheet",
        image: product.images?.[0] || "/images/dtf-gang-sheet.svg",
        variant: mode === "upload" ? "Upload Print-Ready Gang Sheet" : "Build My Gang Sheet",
        size: `${round(sheetWidth, 2)}" × ${round(sheetLength, 2)}"`,
        color: "DTF Film",
        quantity: 1,
        price: linePrice,
        fulfillmentMode: product.fulfillment_mode || "in_house",
        isCustom: false,
        isDtf: true,
        discountExempt: true,
        dtfSpec: {
          configId: createDtfConfigId(),
          mode,
          width: round(sheetWidth, 3),
          length: round(sheetLength, 3),
          area: round(price.area, 3),
          pricingMode: price.pricingMode,
          standardArea: round(price.standardArea, 3),
          volumeArea: round(price.volumeArea, 3),
          standardRate: price.standardRate,
          volumeRate: price.volumeRate,
          utilization: round(utilization, 2),
          usedLength: round(usedLength, 3),
          artworkReviewRequested,
          approvalAcknowledged: true,
          approvalTimestamp,
          layout,
        },
      });

      navigate("/cart");
    } catch (error) {
      console.error("DTF artwork upload failed:", error);
      setPageError(error?.message || "Could not upload the DTF artwork. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-[#f7f6f1] px-4 py-16 text-black">
        <div className="mx-auto max-w-[1500px] animate-pulse">
          <div className="h-5 w-48 bg-black/10" />
          <div className="mt-4 h-16 w-3/4 bg-black/10" />
          <div className="mt-10 grid gap-6 lg:grid-cols-[330px_1fr_330px]">
            <div className="h-[620px] bg-black/10" />
            <div className="h-[720px] bg-black/10" />
            <div className="h-[620px] bg-black/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!settings.enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-5xl">DTF FILM ORDERING IS PAUSED</h1>
        <p className="mt-4 text-muted-foreground">Please contact GDP Clothing for DTF gang sheet orders.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#f4f2ec] text-[#111]">
      <section className="border-b border-black/10 bg-[#111] text-white">
        <div className="mx-auto max-w-[1500px] px-4 py-9 sm:px-6 lg:px-8 lg:py-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">GDP Clothing / DTF Transfers</div>
          <div className="mt-4 grid items-end gap-6 lg:grid-cols-[1fr_auto]">
            <div>
              <h1 className="max-w-4xl font-display text-5xl leading-[0.9] sm:text-6xl lg:text-7xl">
                CUSTOM DTF GANG SHEET
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-white/70">
                Upload your artwork, arrange it on film up to <strong className="text-white">{settings.maxWidth}" wide</strong>,
                choose any length and approve the exact layout before checkout.
              </p>
            </div>
            <div className="border border-white/20 bg-white/5 px-5 py-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">Live film price</div>
              <div className="mt-1 font-mono text-3xl font-black">{hasArtwork ? `${price.price.toFixed(2)}` : "—"}</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
                {hasArtwork ? `${round(price.area, 1)} in² · CAD` : "Upload artwork to calculate"}
              </div>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-white/65">
            <span className="border border-white/20 px-3 py-2">Up to {settings.maxWidth}" wide</span>
            <span className="border border-white/20 px-3 py-2">Custom length</span>
            <span className="border border-white/20 px-3 py-2">Live preview</span>
            <span className="border border-white/20 px-3 py-2">Automatic DPI check</span>
            <span className="border border-white/20 px-3 py-2">Transfer film only</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        {pageError && (
          <div className="mb-5 flex items-start gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <div>{pageError}</div>
          </div>
        )}
        {notice && (
          <div className="mb-5 flex items-center gap-3 border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 size={17} className="shrink-0" /> {notice}
          </div>
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => changeMode("build")}
            className={`border p-5 text-left transition ${mode === "build" ? "border-black bg-black text-white" : "border-black/15 bg-white hover:border-black"}`}
          >
            <div className="flex items-center gap-3">
              <Layers3 size={20} />
              <div>
                <div className="font-black uppercase tracking-[0.08em]">Build My Gang Sheet</div>
                <div className={`mt-1 text-xs ${mode === "build" ? "text-white/65" : "text-black/55"}`}>
                  Upload separate designs, resize, duplicate and auto-arrange them.
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => changeMode("upload")}
            className={`border p-5 text-left transition ${mode === "upload" ? "border-black bg-black text-white" : "border-black/15 bg-white hover:border-black"}`}
          >
            <div className="flex items-center gap-3">
              <FileCheck size={20} />
              <div>
                <div className="font-black uppercase tracking-[0.08em]">Upload Print-Ready Gang Sheet</div>
                <div className={`mt-1 text-xs ${mode === "upload" ? "text-white/65" : "text-black/55"}`}>
                  Already built your complete film? Upload one finished sheet and verify the size.
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_330px]">
          <aside className="space-y-4">
            <Panel title="1 / Film size" icon={Ruler}>
              <Field label="Width">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={settings.maxWidth}
                    step="0.25"
                    value={sheetWidth}
                    disabled={!settings.allowCustomWidth}
                    onChange={(event) => setWidth(event.target.value)}
                    className="w-full border border-black/20 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-black disabled:bg-black/5"
                  />
                  <span className="font-mono text-xs">in</span>
                </div>
                <div className="mt-1.5 text-[11px] text-black/45">Maximum width: {settings.maxWidth}"</div>
              </Field>

              <Field label="Length">
                <div className="grid grid-cols-4 gap-1.5">
                  {settings.popularLengths.slice(0, 8).map((length) => (
                    <button
                      key={length}
                      type="button"
                      onClick={() => {
                        setSheetLength(length);
                        setApproval(false);
                      }}
                      className={`min-h-9 border px-1 font-mono text-[10px] ${Number(sheetLength) === Number(length) ? "border-black bg-black text-white" : "border-black/15 bg-white hover:border-black"}`}
                    >
                      {length}"
                    </button>
                  ))}
                </div>
                {settings.allowCustomLength && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={settings.minLength}
                      step="1"
                      value={sheetLength}
                      onChange={(event) => {
                        setSheetLength(Math.max(settings.minLength, Number(event.target.value || settings.minLength)));
                        setApproval(false);
                      }}
                      className="w-full border border-black/20 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-black"
                    />
                    <span className="font-mono text-xs">in</span>
                  </div>
                )}
              </Field>

              <div className="border-t border-black/10 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-black/50">Film area</span>
                  <span className="font-mono">{round(price.area, 1)} in²</span>
                </div>
                <div className="mt-1.5 flex justify-between text-xs">
                  <span className="text-black/50">Standard portion</span>
                  <span className="font-mono">{round(price.standardArea, 1)} in² × ${settings.standardRate}</span>
                </div>
                {price.volumeArea > 0 && (
                  <div className="mt-1.5 flex justify-between text-xs">
                    <span className="text-black/50">Volume portion</span>
                    <span className="font-mono">{round(price.volumeArea, 1)} in² × ${settings.volumeRate}</span>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="2 / Artwork" icon={Upload}>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-black/25 bg-white px-4 text-center transition hover:border-black hover:bg-black/[0.02]">
                <Upload size={21} />
                <span className="mt-2 text-xs font-black uppercase tracking-[0.08em]">
                  {mode === "upload" ? "Upload gang sheet" : "Add artwork"}
                </span>
                <span className="mt-1 text-[10px] leading-4 text-black/45">PNG · JPG · WEBP · SVG · PDF</span>
                <input
                  type="file"
                  multiple={mode === "build"}
                  accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>

              {artworks.length > 0 && (
                <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
                  {artworks.map((item, index) => {
                    const quality = getArtworkQuality(item, settings);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`flex w-full items-center gap-2 border p-2 text-left ${selectedId === item.id ? "border-black bg-black text-white" : "border-black/10 bg-white"}`}
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden bg-black/5">
                          {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-contain" /> : <FileCheck className="m-2.5" size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-semibold">{index + 1}. {item.name}</div>
                          <div className={`mt-0.5 font-mono text-[9px] ${selectedId === item.id ? "text-white/60" : "text-black/45"}`}>
                            {item.pixelWidth > 0 && item.pixelHeight > 0 ? `${item.pixelWidth} × ${item.pixelHeight}px · ` : ""}{formatFileSize(item.size)}
                          </div>
                          <div className={`mt-0.5 font-mono text-[9px] ${selectedId === item.id ? "text-white/60" : "text-black/45"}`}>
                            Print {round(item.width, 2)}" × {round(item.height, 2)}" · {quality.dpi ? `${Math.round(quality.dpi)} DPI` : quality.label}
                            {item.transparentTrimmed ? " · transparent edges ignored" : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>


          </aside>

          <main className="min-w-0">
            <div className="border border-black/15 bg-[#1b1b1b]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Live film preview</div>
                  <div className="mt-0.5 text-sm font-semibold">{round(sheetWidth, 2)}" × {round(sheetLength, 2)}"</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mode === "build" && (
                    <button type="button" onClick={autoArrange} disabled={artworks.length < 2} title={artworks.length < 2 ? "Add at least 2 designs to use Advanced Nest" : "Automatically arrange designs within the current film size"} className="border border-white/20 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-white disabled:opacity-30">
                      {settings.advancedNestingEnabled ? "Advanced Nest" : "Auto Arrange"}
                    </button>
                  )}
                  <button type="button" onClick={fitSheet} disabled={!artworks.length} className="border border-white/20 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-white disabled:opacity-30">
                    Fit sheet to artwork
                  </button>
                  <button
                    type="button"
                    onClick={resetWorkspace}
                    className="flex items-center gap-1.5 border border-white/20 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-white transition hover:border-red-400 hover:text-red-300"
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                </div>
              </div>

              <div className="max-h-[820px] overflow-auto bg-[#262626] p-4 sm:p-7">
                <div className="mx-auto w-full max-w-[540px]">
                  <div className="mb-2 flex justify-between font-mono text-[8px] uppercase tracking-[0.1em] text-white/40">
                    <span>0"</span><span>{round(sheetWidth / 2, 1)}"</span><span>{round(sheetWidth, 1)}"</span>
                  </div>
                  <div
                    ref={canvasRef}
                    className="relative w-full touch-none overflow-hidden border border-white/35 shadow-2xl"
                    style={{ ...checkerboardStyle(), height: `${displayHeight}px` }}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerLeave={endDrag}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-between bg-black/70 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-white">
                      <span>{round(sheetWidth, 1)}" wide DTF film</span>
                      <span>{round(sheetLength, 1)}" length</span>
                    </div>
                    {artworks.map((item) => {
                      const selected = item.id === selectedId;
                      const quality = getArtworkQuality(item, settings);
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          key={item.id}
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                          onPointerDown={(event) => onPointerDown(event, item)}
                          onClick={() => setSelectedId(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedId(item.id);
                            }
                            if ((event.key === "Delete" || event.key === "Backspace") && selected) {
                              event.preventDefault();
                              removeArtwork(item.id);
                            }
                          }}
                          className={`absolute cursor-grab select-none overflow-visible bg-transparent text-left outline-none active:cursor-grabbing ${selected ? "z-20" : "z-10"}`}
                          style={{
                            left: `${(item.x / sheetWidth) * 100}%`,
                            top: `${(item.y / sheetLength) * 100}%`,
                            width: `${(item.width / sheetWidth) * 100}%`,
                            height: `${(item.height / sheetLength) * 100}%`,
                          }}
                          title={item.name}
                        >
                          {item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={item.name}
                              draggable="false"
                              onDragStart={(event) => event.preventDefault()}
                              className="pointer-events-none absolute left-1/2 top-1/2 select-none object-contain"
                              style={
                                Math.abs(Number(item.rotation || 0)) % 180 === 90
                                  ? {
                                      width: `${(item.height / Math.max(0.01, item.width)) * 100}%`,
                                      height: `${(item.width / Math.max(0.01, item.height)) * 100}%`,
                                      transform: "translate(-50%, -50%) rotate(90deg)",
                                    }
                                  : {
                                      width: "100%",
                                      height: "100%",
                                      transform: "translate(-50%, -50%)",
                                    }
                              }
                            />
                          ) : (
                            <div className="flex h-full min-h-10 items-center justify-center bg-white/85 px-2 text-center font-mono text-[8px] font-bold uppercase">
                              PDF artwork
                            </div>
                          )}
                          {selected && (
                            <>
                              <span className="pointer-events-none absolute -left-0.5 -top-5 bg-black px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.06em] text-white">
                                {round(item.width, 1)}" × {round(item.height, 1)}"
                              </span>
                              <button
                                type="button"
                                aria-label={`Delete ${item.name}`}
                                title="Delete selected artwork"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  removeArtwork(item.id);
                                }}
                                className="absolute -right-3 -top-3 z-30 grid h-7 w-7 place-items-center rounded-full border border-white bg-red-600 text-white shadow-lg transition hover:bg-red-700"
                              >
                                <Trash2 size={13} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Resize ${item.name}`}
                                title="Drag to resize artwork"
                                onPointerDown={(event) => onResizePointerDown(event, item)}
                                className="absolute -bottom-3 -right-3 z-30 grid h-7 w-7 cursor-nwse-resize place-items-center rounded-full border border-black/20 bg-white text-black shadow-lg"
                              >
                                <Maximize2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {!artworks.length && (
                      <div className="absolute inset-0 grid place-items-center px-8 text-center">
                        <div>
                          <Upload size={28} className="mx-auto text-black/35" />
                          <div className="mt-3 text-sm font-black uppercase tracking-[0.1em]">Your film starts here</div>
                          <div className="mt-1 text-xs leading-5 text-black/45">
                            Upload artwork from the left panel, then drag designs directly on the film.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[8px] uppercase tracking-[0.1em] text-white/40">
                    <span>Film preview scales long orders to the workspace</span>
                    <span>{round(sheetLength, 1)}"</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Film used" value={`${round(utilization, 1)}%`} helper="Artwork area / film area" />
              <Metric label="Artwork length" value={`${round(usedLength, 1)}"`} helper={usedLength && usedLength < sheetLength ? `${round(sheetLength - usedLength, 1)}" remaining` : "Current layout"} />
              <Metric label="Production segments" value={String(hasArtwork ? Math.max(1, Math.ceil(sheetLength / settings.productionSegmentLength)) : 0)} helper={hasArtwork ? `Internally split at ${settings.productionSegmentLength}" when needed` : "No artwork loaded"} />
            </div>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-[110px] xl:self-start xl:max-h-[calc(100vh-130px)] xl:overflow-y-auto xl:pr-1">
            {selectedArtwork && (
              <div ref={selectedPanelRef}>
                <Panel title="3 / Selected design" icon={Move}>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Print width">
                    <div className="flex items-center gap-2">
                      <input
                        key={`width-${selectedArtwork.id}-${round(selectedArtwork.width, 3)}`}
                        type="number"
                        min="0.1"
                        step="0.1"
                        defaultValue={round(selectedArtwork.width, 2)}
                        onBlur={(event) => commitSelectedDimension("width", event.target.value, event.target)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        className="w-full border border-black/20 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-black"
                      />
                      <span className="font-mono text-xs">in</span>
                    </div>
                  </Field>
                  <Field label="Print height">
                    <div className="flex items-center gap-2">
                      <input
                        key={`height-${selectedArtwork.id}-${round(selectedArtwork.height, 3)}`}
                        type="number"
                        min="0.1"
                        step="0.1"
                        defaultValue={round(selectedArtwork.height, 2)}
                        onBlur={(event) => commitSelectedDimension("height", event.target.value, event.target)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        className="w-full border border-black/20 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-black"
                      />
                      <span className="font-mono text-xs">in</span>
                    </div>
                  </Field>
                </div>
                <div className="mb-3 text-[10px] leading-4 text-black/45">
                  Aspect ratio is locked so the artwork cannot be stretched or distorted.
                </div>
                <div className="mb-3 border border-black/10 bg-white p-3 font-mono text-[9px] leading-5 text-black/55">
                  <div>Source: {selectedArtwork.originalPixelWidth > 0 ? `${selectedArtwork.originalPixelWidth} × ${selectedArtwork.originalPixelHeight}px` : "Vector / PDF"}</div>
                  {selectedArtwork.transparentTrimmed && selectedArtwork.pixelWidth > 0 && (
                    <div>Visible artwork: {selectedArtwork.pixelWidth} × {selectedArtwork.pixelHeight}px</div>
                  )}
                  <div>File: {formatFileSize(selectedArtwork.size)}{selectedArtwork.sourceDpi ? ` · default print size based on ${selectedArtwork.sourceDpi} DPI` : ""}</div>
                  <div>Default: {round(selectedArtwork.defaultWidth, 2)}" × {round(selectedArtwork.defaultHeight, 2)}"</div>
                </div>
                <div className={`border p-3 text-xs ${selectedQuality.tone === "bad" ? "border-red-200 bg-red-50" : selectedQuality.tone === "warning" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <div className="font-semibold">{selectedQuality.label}</div>
                  <div className="mt-1 text-[11px] opacity-70">
                    {selectedQuality.dpi
                      ? `${Math.round(selectedQuality.dpi)} DPI at ${round(selectedArtwork.width, 2)}" wide`
                      : "Vector/PDF artwork is not limited by raster DPI in this preview."}
                  </div>
                </div>
                <div className="mt-3 border-t border-black/10 pt-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
                    <Scissors size={14} /> Edit artwork
                  </div>
                  {mode !== "build" ? (
                    <div className="mt-2 text-[10px] leading-4 text-black/45">
                      Print-ready sheets should already be fully edited. Switch to Build My Gang Sheet to edit individual artwork.
                    </div>
                  ) : selectedArtwork.isVector ? (
                    <div className="mt-2 text-[10px] leading-4 text-black/45">
                      Background cleanup is intended for raster PNG, JPG and WEBP artwork. Vector/PDF files should be edited before upload.
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
                        <span className="font-semibold">Background cleanup</span>
                        <span className="font-mono text-black/45">{backgroundThreshold}</span>
                      </div>
                      <input
                        type="range"
                        min="220"
                        max="254"
                        step="1"
                        value={backgroundThreshold}
                        onChange={(event) => setBackgroundThreshold(Number(event.target.value))}
                        className="mt-2 w-full"
                        aria-label="Background removal strength"
                      />
                      <div className="mt-1 flex justify-between text-[8px] uppercase tracking-[0.08em] text-black/35">
                        <span>More aggressive</span><span>More conservative</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={removeSelectedBackground}
                          disabled={editingArtwork}
                          className="min-h-10 border border-black bg-black px-3 text-[9px] font-black uppercase text-white disabled:opacity-40"
                        >
                          {editingArtwork ? "Processing…" : "Remove background"}
                        </button>
                        <button
                          type="button"
                          onClick={restoreSelectedBackground}
                          disabled={editingArtwork || !selectedArtwork.backgroundRemoved}
                          className="min-h-10 border border-black/15 bg-white px-3 text-[9px] font-black uppercase disabled:opacity-35"
                        >
                          Restore original
                        </button>
                      </div>
                      <div className="mt-2 text-[9px] leading-4 text-black/40">
                        Best for white or light solid backgrounds. Only background connected to the image edges is removed; inspect the preview before ordering.
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={resetSelectedArtworkSize} className="flex min-h-10 items-center justify-center gap-1.5 border border-black/15 bg-white text-[9px] font-black uppercase">
                    <RotateCcw size={13} /> Reset size
                  </button>
                  <button type="button" onClick={rotateSelected} disabled={mode === "upload"} className="flex min-h-10 items-center justify-center gap-1.5 border border-black/15 bg-white text-[9px] font-black uppercase disabled:opacity-35">
                    <RotateCw size={13} /> Rotate
                  </button>
                  <button type="button" onClick={duplicateSelected} disabled={mode === "upload"} className="flex min-h-10 items-center justify-center gap-1.5 border border-black/15 bg-white text-[9px] font-black uppercase disabled:opacity-35">
                    <Copy size={13} /> Duplicate
                  </button>
                  <button type="button" onClick={removeSelected} className="flex min-h-10 items-center justify-center gap-1.5 border border-black/15 bg-white text-[9px] font-black uppercase hover:border-red-400 hover:text-red-700">
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
                </Panel>
              </div>
            )}
            <Panel title="Order summary" icon={ShoppingBag}>
              <SummaryRow label="Order type" value={mode === "upload" ? "Print-ready upload" : "Gang sheet builder"} />
              <SummaryRow label="Film size" value={`${round(sheetWidth, 2)}" × ${round(sheetLength, 2)}"`} />
              <SummaryRow label="Area" value={hasArtwork ? `${round(price.area, 1)} in²` : "—"} />
              <SummaryRow label="Standard rate" value={`$${settings.standardRate.toFixed(3)}/in²`} />
              <SummaryRow label="Volume rate" value={`$${settings.volumeRate.toFixed(3)}/in²`} />
              <SummaryRow label="Designs" value={String(artworks.length)} />
              <div className="mt-4 border-t border-black/10 pt-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-black/45">Film price</div>
                    <div className="mt-1 font-mono text-3xl font-black">{hasArtwork ? `$${price.price.toFixed(2)}` : "—"}</div>
                  </div>
                  <div className="pb-1 font-mono text-[9px] uppercase text-black/40">{hasArtwork ? "CAD" : "Upload artwork"}</div>
                </div>
                {settings.pricingMode === "graduated" && price.volumeArea > 0 && (
                  <div className="mt-2 text-[11px] leading-5 text-black/50">
                    The first {round(settings.breakpointArea, 0)} in² is billed at ${settings.standardRate.toFixed(3)}/in².
                    Additional film is ${settings.volumeRate.toFixed(3)}/in².
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Artwork preflight" icon={CheckCircle2}>
              <StatusLine good={artworks.length > 0} text={artworks.length ? `${artworks.length} artwork item${artworks.length === 1 ? "" : "s"} loaded` : "Artwork required"} />
              <StatusLine good={sheetWidth <= settings.maxWidth} text={`Width within ${settings.maxWidth}" maximum`} />
              <StatusLine good={usedLength <= sheetLength + 0.01} text={usedLength <= sheetLength + 0.01 ? "Artwork fits selected length" : "Artwork extends past film"} />
              <StatusLine good={!overlaps.length} text={!overlaps.length ? "No artwork overlaps detected" : `${overlaps.length} overlap${overlaps.length === 1 ? "" : "s"} must be fixed`} />
              {validation.warnings.slice(0, 4).map((warning) => (
                <div key={warning} className="mt-2 flex items-start gap-2 text-[11px] leading-4 text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {warning}
                </div>
              ))}
            </Panel>



            {settings.artworkReviewEnabled && (
              <label className="flex cursor-pointer items-start gap-3 border border-black/15 bg-white p-4">
                <input
                  type="checkbox"
                  checked={artworkReviewRequested}
                  onChange={(event) => setArtworkReviewRequested(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block text-xs font-black uppercase tracking-[0.07em]">Professional artwork review</span>
                  <span className="mt-1 block text-[11px] leading-4 text-black/48">
                    GDP checks placement and print readiness before production
                    {settings.artworkReviewPrice > 0 ? ` (+$${settings.artworkReviewPrice.toFixed(2)})` : " (included)"}.
                  </span>
                </span>
              </label>
            )}

            <label className="flex cursor-pointer items-start gap-3 border border-black/15 bg-white p-4">
              <input
                type="checkbox"
                checked={approval}
                onChange={(event) => setApproval(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.07em]">I approve this film layout</span>
                <span className="mt-1 block text-[11px] leading-4 text-black/48">
                  I reviewed the artwork placement, dimensions and warnings and understand GDP will produce from this submitted layout.
                </span>
              </span>
            </label>

            {artworks.length > 0 && fitLength + 0.5 < sheetLength && (
              <button type="button" onClick={fitSheet} className="w-full border border-emerald-300 bg-emerald-50 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.07em] text-emerald-900">
                  <Sparkles size={15} /> Save film space
                </div>
                <div className="mt-1 text-[11px] leading-4 text-emerald-800">
                  Your current layout fits in about {fitLength}". Reduce the selected length before checkout.
                </div>
              </button>
            )}

            <button
              type="button"
              disabled={saving || !approval || Boolean(validation.errors.length)}
              onClick={addToCart}
              className="flex min-h-14 w-full items-center justify-center gap-3 bg-black px-5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#e11d2e] disabled:cursor-not-allowed disabled:bg-black/25"
            >
              <ShoppingBag size={17} />
              {saving
                ? "Uploading artwork…"
                : hasArtwork
                  ? `Add to cart · $${round(price.price + (artworkReviewRequested ? settings.artworkReviewPrice : 0), 2).toFixed(2)}`
                  : "Upload artwork to continue"}
            </button>

            <div className="border border-black/10 bg-white p-4 text-[10px] leading-5 text-black/46">
              <strong className="text-black">Transfer film only.</strong> Garments are not included. Transparent PNG, vector SVG or print-ready PDF files provide the most predictable results.
            </div>
          </aside>
        </div>
        {selectedArtwork && (
          <div className="fixed inset-x-3 bottom-3 z-40 border border-black/20 bg-white p-3 shadow-2xl xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[10px] font-black uppercase tracking-[0.08em]">{selectedArtwork.name}</div>
                <div className="mt-0.5 font-mono text-[9px] text-black/45">{round(selectedArtwork.width, 2)}" × {round(selectedArtwork.height, 2)}"</div>
              </div>
              <button
                type="button"
                onClick={() => selectedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="shrink-0 border border-black/15 px-3 py-2 text-[9px] font-black uppercase"
              >
                Full edit
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center border border-black/15 bg-white px-2">
                <span className="mr-1 font-mono text-[9px] text-black/40">W</span>
                <input
                  key={`mobile-width-${selectedArtwork.id}-${round(selectedArtwork.width, 3)}`}
                  type="number"
                  min="0.1"
                  step="0.1"
                  defaultValue={round(selectedArtwork.width, 2)}
                  onBlur={(event) => commitSelectedDimension("width", event.target.value, event.target)}
                  className="min-w-0 flex-1 py-2 font-mono text-xs outline-none"
                />
                <span className="font-mono text-[9px]">in</span>
              </div>
              <button type="button" onClick={resetSelectedArtworkSize} className="border border-black/15 px-2.5 py-2 text-[8px] font-black uppercase">Reset</button>
              <button
                type="button"
                onClick={removeSelectedBackground}
                disabled={editingArtwork || mode !== "build" || selectedArtwork.isVector}
                className="border border-black/15 px-2.5 py-2 text-[8px] font-black uppercase disabled:opacity-30"
              >
                BG
              </button>
              <button type="button" onClick={removeSelected} className="border border-red-200 px-2.5 py-2 text-red-700">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="border border-black/15 bg-[#faf9f5]">
      <div className="flex min-h-11 items-center gap-2 border-b border-black/10 px-4 py-3">
        <Icon size={15} />
        <h2 className="text-[10px] font-black uppercase tracking-[0.12em]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="mb-2 block font-mono text-[9px] font-black uppercase tracking-[0.12em] text-black/52">{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/8 py-2.5 text-xs last:border-0">
      <span className="text-black/48">{label}</span>
      <span className="text-right font-mono font-semibold">{value}</span>
    </div>
  );
}

function StatusLine({ good, text }) {
  return (
    <div className={`flex items-start gap-2 py-1.5 text-[11px] ${good ? "text-emerald-800" : "text-red-700"}`}>
      {good ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

function Metric({ label, value, helper }) {
  return (
    <div className="border border-black/15 bg-white p-4">
      <div className="font-mono text-[8px] uppercase tracking-[0.13em] text-black/42">{label}</div>
      <div className="mt-1 font-mono text-xl font-black">{value}</div>
      <div className="mt-1 text-[10px] text-black/42">{helper}</div>
    </div>
  );
}
