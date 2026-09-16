const MOCKUP_WIDTH = 1200;
const MOCKUP_HEIGHT = 1500;

function loadImage(source, { crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Preview image could not be loaded.'));
    image.src = source;
  });
}

function drawContained(ctx, image, x, y, width, height) {
  const sourceWidth = Number(image.naturalWidth || image.width || 1);
  const sourceHeight = Number(image.naturalHeight || image.height || 1);
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawNeutralGarment(ctx) {
  ctx.save();
  ctx.fillStyle = '#f4f4f5';
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(MOCKUP_WIDTH * 0.17, MOCKUP_HEIGHT * 0.09, MOCKUP_WIDTH * 0.66, MOCKUP_HEIGHT * 0.82, 90);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Customer mockup could not be generated.'));
    }, 'image/png', 0.96);
  });
}

/**
 * Build a customer-facing garment mockup from the already-approved production PNG.
 * This never changes the production file. It only creates a separate preview asset
 * for cart, checkout and order-confirmation surfaces.
 */
export async function renderStudioV2CustomerMockup({ garmentUrl = '', productionBlob }) {
  if (!productionBlob) throw new Error('Approved artwork is missing from the customer preview.');

  const canvas = document.createElement('canvas');
  canvas.width = MOCKUP_WIDTH;
  canvas.height = MOCKUP_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Customer mockup canvas is unavailable.');

  ctx.fillStyle = '#f8f7f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let garmentDrawn = false;
  if (garmentUrl) {
    try {
      const garment = await loadImage(garmentUrl, { crossOrigin: true });
      drawContained(ctx, garment, 0, 0, canvas.width, canvas.height);
      garmentDrawn = true;
    } catch {
      garmentDrawn = false;
    }
  }
  if (!garmentDrawn) drawNeutralGarment(ctx);

  const artworkUrl = URL.createObjectURL(productionBlob);
  try {
    const artwork = await loadImage(artworkUrl);
    // Mirrors the V2 garment workspace: centered print area, 42% garment width,
    // starting 24% from the top, with a 4:5 printable box.
    const printWidth = canvas.width * 0.42;
    const printHeight = printWidth * 1.25;
    const printX = (canvas.width - printWidth) / 2;
    const printY = canvas.height * 0.24;
    drawContained(ctx, artwork, printX, printY, printWidth, printHeight);
  } finally {
    URL.revokeObjectURL(artworkUrl);
  }

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    widthPx: canvas.width,
    heightPx: canvas.height,
    mimeType: 'image/png',
  };
}
