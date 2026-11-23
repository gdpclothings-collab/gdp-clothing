// Quick Design realistic studio garment visualizer: 3 garment types × 2 colors × 2 sides.
// All fabric and artwork are composed locally with no paid image service or network call.
// These are studio illustrations, not certified manufacturer photos or a size-specific print guide.
export const QUICK_DESIGN_GARMENTS = Object.freeze([
  { id: 'tshirt', label: 'T-shirt', description: 'Short sleeves' },
  { id: 'sweatshirt', label: 'Sweatshirt', description: 'Crewneck' },
  { id: 'hoodie', label: 'Hoodie', description: 'Pullover hood' },
]);
export const QUICK_DESIGN_COLORS = Object.freeze([
  { id: 'black', label: 'Black', hex: '#191a1f' },
  { id: 'white', label: 'White', hex: '#f5f5f4' },
]);
export const QUICK_DESIGN_SIDES = Object.freeze([
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
]);

const WIDTH = 600;
const HEIGHT = 720;
const OUTPUT_SCALE = 2; // High-density 1200 × 1440 customer mockup for mobile and desktop.

// Approved BLANK front/back garment sheet, created for GDP Quick Design.
// Realistic-looking generated reference, not a manufacturer-certified photo.
// The art is composited at runtime; the source templates stay unprinted.
export const QUICK_DESIGN_BLANK_ATLAS_URL = '/images/quick-design/gdp-blank-garment-atlas.webp';
export const QUICK_DESIGN_BLANK_ATLAS_SIZE = Object.freeze({ width: 1536, height: 720, cellWidth: 256, cellHeight: 360 });
const APPROVED_GARMENT_INDEX = Object.freeze({ tshirt: 0, sweatshirt: 1, hoodie: 2 });
let approvedAtlasPromise = null;

export function getQuickDesignBlankGarmentCrop(garment, color, side) {
  const g = Object.hasOwn(APPROVED_GARMENT_INDEX, garment) ? garment : 'tshirt';
  const column = APPROVED_GARMENT_INDEX[g] * 2 + (side === 'back' ? 1 : 0);
  const row = color === 'white' ? 1 : 0;
  return Object.freeze({
    sx: column * QUICK_DESIGN_BLANK_ATLAS_SIZE.cellWidth,
    sy: row * QUICK_DESIGN_BLANK_ATLAS_SIZE.cellHeight,
    sw: QUICK_DESIGN_BLANK_ATLAS_SIZE.cellWidth,
    sh: QUICK_DESIGN_BLANK_ATLAS_SIZE.cellHeight,
    dx: 65, dy: 10, dw: 470, dh: 660,
  });
}

function loadApprovedBlankGarments() {
  if (!approvedAtlasPromise) {
    approvedAtlasPromise = imageFromSource(QUICK_DESIGN_BLANK_ATLAS_URL)
      .catch(() => { approvedAtlasPromise = null; return null; });
  }
  return approvedAtlasPromise;
}

// Reuse Custom Studio's EXISTING local Black/White Gildan crewneck templates.
// No remote asset, third-party service, subscription, or new customer upload.
export function getQuickDesignStudioFabricAsset(garment, side, color) {
  if (garment !== 'sweatshirt') return null;
  const safeSide = side === 'back' ? 'back' : 'front';
  const safeColor = color === 'white' ? 'white' : 'black';
  return '/images/custom-studio/gildan-crewneck-' + safeSide + '-colors.svg#' + safeColor;
}

// Conservative, centered chest/back zones: source art remains transparent and
// aspect-ratio preserved. No second side is ever implied or rendered.
export const QUICK_DESIGN_PRINT_PLACEMENTS = Object.freeze({
  tshirt: Object.freeze({ front: Object.freeze([203, 195, 194, 245]), back: Object.freeze([203, 195, 194, 245]) }),
  sweatshirt: Object.freeze({ front: Object.freeze([208, 205, 184, 240]), back: Object.freeze([208, 205, 184, 240]) }),
  hoodie: Object.freeze({ front: Object.freeze([209, 212, 182, 202]), back: Object.freeze([209, 212, 182, 202]) }),
});

function imageFromSource(source) {
  if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Selected sample could not be drawn on the garment.'));
    image.src = source;
  });
}

function drawContained(ctx, image, x, y, w, h) {
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  if (!(sw > 0 && sh > 0)) return;
  const ratio = Math.min(w / sw, h / sh);
  ctx.drawImage(image, x + (w - sw * ratio) / 2, y + (h - sh * ratio) / 2, sw * ratio, sh * ratio);
}

function fillGarment(ctx, shape, color) {
  const white = color === 'white';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.82)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 19;
  const fabric = ctx.createLinearGradient(70, 260, 510, 410);
  fabric.addColorStop(0, white ? '#f8f9fa' : '#0c0d11');
  fabric.addColorStop(0.16, white ? '#ffffff' : '#303136');
  fabric.addColorStop(0.34, white ? '#ebedf1' : '#17181c');
  fabric.addColorStop(0.64, white ? '#d9dce2' : '#101115');
  fabric.addColorStop(0.87, white ? '#f9f9fb' : '#292a2f');
  fabric.addColorStop(1, white ? '#d0d3d8' : '#101115');
  ctx.fillStyle = fabric;
  ctx.fill(shape);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = white ? 'rgba(79,84,99,0.30)' : 'rgba(233,233,240,0.15)';
  ctx.lineWidth = 2.5;
  ctx.stroke(shape);
  ctx.clip(shape);
  const bodyLight = ctx.createLinearGradient(160, 170, 450, 650);
  bodyLight.addColorStop(0, white ? 'rgba(255,255,255,.58)' : 'rgba(255,255,255,0.08)');
  bodyLight.addColorStop(0.38, 'rgba(255,255,255,0)');
  bodyLight.addColorStop(0.7, white ? 'rgba(88,94,110,.12)' : 'rgba(0,0,0,0.24)');
  bodyLight.addColorStop(1, white ? 'rgba(255,255,255,.20)' : 'rgba(255,255,255,0.035)');
  ctx.fillStyle = bodyLight;
  ctx.fillRect(60, 80, 480, 610);

  // Fine jersey/fleece grain breaks up the vector-flat surface without remote
  // stock photos or claims of manufacturer-certified imagery. Deterministic
  // tiny highlights/shadows stay clipped within the exact garment silhouette.
  let seed = 937;
  const pseudo = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 4200; i += 1) {
    const x = 115 + pseudo() * 385;
    const y = 130 + pseudo() * 520;
    const light = pseudo() > 0.56;
    ctx.fillStyle = white ? (light ? 'rgba(255,255,255,.42)' : 'rgba(80,83,94,.055)') : (light ? 'rgba(245,246,249,0.035)' : 'rgba(0,0,0,0.13)');
    ctx.fillRect(x, y, 0.65 + pseudo() * 1.3, 0.4 + pseudo() * 1.5);
  }

  // Subtle soft-edge cloth drape and micro-weave. This reuses the existing
  // locally generated high-resolution garment set rather than fetching
  // unlicensed mockup photos or introducing a paid image generator.
  ctx.save();
  const weave = white ? 'rgba(59,61,68,.025)' : 'rgba(241,242,244,.018)';
  ctx.strokeStyle = weave;
  ctx.lineWidth = 0.52;
  for (let y = 165; y < 652; y += 3.7) {
    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.quadraticCurveTo(302, y + Math.sin(y * .034) * 1.5, 450, y);
    ctx.stroke();
  }
  const drape = [
    { x: 192, y: 205, cx: 215, cy: 335, ex: 185, ey: 590, w: 13 },
    { x: 407, y: 206, cx: 385, cy: 350, ex: 421, ey: 591, w: 13 },
    { x: 241, y: 432, cx: 252, cy: 512, ex: 212, ey: 657, w: 9 },
    { x: 360, y: 437, cx: 352, cy: 518, ex: 388, ey: 657, w: 9 },
  ];
  for (const fold of drape) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fold.x, fold.y);
    ctx.quadraticCurveTo(fold.cx, fold.cy, fold.ex, fold.ey);
    ctx.strokeStyle = white ? 'rgba(73,76,84,.17)' : 'rgba(0,0,0,.25)';
    ctx.lineWidth = fold.w;
    ctx.shadowBlur = 12;
    ctx.shadowColor = white ? 'rgba(69,74,86,.09)' : 'rgba(0,0,0,.21)';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = white ? 'rgba(255,255,255,.65)' : 'rgba(247,247,251,.065)';
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Localized diagonal fold shading and fine seam glints approximate cloth
  // drape, rather than a flat fill (still a clearly labelled illustration).
  const centerFold = ctx.createLinearGradient(175, 255, 418, 624);
  centerFold.addColorStop(0, white ? 'rgba(255,255,255,.40)' : 'rgba(255,255,255,.035)');
  centerFold.addColorStop(.34, white ? 'rgba(71,76,90,.06)' : 'rgba(0,0,0,.05)');
  centerFold.addColorStop(.59, white ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.045)');
  centerFold.addColorStop(1, white ? 'rgba(74,76,89,.11)' : 'rgba(0,0,0,.16)');
  ctx.fillStyle = centerFold;
  ctx.fillRect(143, 220, 327, 446);

  const folds = [
    [174, 294, 212, 445], [426, 298, 388, 455],
    [180, 555, 222, 657], [421, 551, 387, 657],
    [131, 150, 177, 255], [466, 160, 430, 264],
  ];

  ctx.save();
  ctx.strokeStyle = white ? 'rgba(73,76,92,.19)' : 'rgba(225,225,235,.075)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(190, 132); ctx.quadraticCurveTo(172, 225, 174, 318);
  ctx.moveTo(410, 132); ctx.quadraticCurveTo(428, 221, 426, 318);
  ctx.moveTo(183, 340); ctx.quadraticCurveTo(183, 506, 181, 635);
  ctx.moveTo(418, 340); ctx.quadraticCurveTo(418, 508, 420, 635);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.strokeStyle = white ? 'rgba(94,98,112,.085)' : 'rgba(228,229,238,0.04)';
  ctx.lineWidth = 4;
  folds.forEach(([ax, ay, bx, by]) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 + 10, (ay + by) / 2, bx, by);
    ctx.stroke();
  });
  ctx.restore();
}

// Local studio fallback for T-shirts and hoodies: subtly differentiated
// jersey vs fleece, retaining all existing shoulder seams and silhouette.
function paintTailoredFabric(ctx, shape, color, garment) {
  const white = color === 'white';
  ctx.save();
  ctx.clip(shape);
  const panelGlow = ctx.createLinearGradient(155, 110, 454, 657);
  panelGlow.addColorStop(0, white ? 'rgba(255,255,255,.31)' : 'rgba(255,255,255,.072)');
  panelGlow.addColorStop(.24, white ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.012)');
  panelGlow.addColorStop(.72, white ? 'rgba(63,66,73,.065)' : 'rgba(0,0,0,.19)');
  panelGlow.addColorStop(1, white ? 'rgba(255,255,255,.17)' : 'rgba(246,246,252,.023)');
  ctx.fillStyle = panelGlow;
  ctx.fillRect(109, 116, 382, 555);

  // Ribbed fleece has a slightly broader weave than smooth jersey cotton.
  // Draw all thread flecks deterministically so switching variants cannot
  // cause flickering or a changing/random texture.
  const threads = garment === 'hoodie' ? 2100 : 1450;
  let seed = garment === 'hoodie' ? 31567 : 41019;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  ctx.lineWidth = garment === 'hoodie' ? 1 : .5;
  for (let i = 0; i < threads; i += 1) {
    const x = 127 + random() * 346;
    const y = 140 + random() * 511;
    const dy = garment === 'hoodie' ? 2.7 : 1.1;
    ctx.strokeStyle = white
      ? (random() > .5 ? 'rgba(72,79,91,.05)' : 'rgba(255,255,255,.26)')
      : (random() > .5 ? 'rgba(230,234,241,.048)' : 'rgba(0,0,0,.14)');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - .5) * 2, y + dy);
    ctx.stroke();
  }

  for (const centerX of [183, 418]) {
    const sideFold = ctx.createRadialGradient(centerX, 385, 6, centerX, 405, 95);
    sideFold.addColorStop(0, white ? 'rgba(49,54,66,.07)' : 'rgba(0,0,0,.20)');
    sideFold.addColorStop(.64, white ? 'rgba(72,79,87,.022)' : 'rgba(0,0,0,.07)');
    sideFold.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sideFold;
    ctx.fillRect(centerX - 100, 175, 200, 400);
  }
  ctx.restore();
}

function drawNeck(ctx, mode, side, color) {
  const white = color === 'white';
  ctx.save();
  if (mode === 'tshirt') {
    ctx.beginPath();
    ctx.ellipse(300, 72, 55, 30, 0, 0, Math.PI * 2);
  } else {
    ctx.beginPath();
    ctx.ellipse(300, 104, 51, 27, 0, 0, Math.PI * 2);
  }
  ctx.fillStyle = white ? '#e5e7eb' : '#313238';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = white ? '#b9bdc6' : '#43444a';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(300, mode === 'tshirt' ? 68 : 100, mode === 'tshirt' ? 44 : 40, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = white ? '#cfd2d8' : '#101116';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = white ? 'rgba(80,87,97,.18)' : 'rgba(255,255,255,0.1)';
  ctx.stroke();
  if (side === 'back') {
    ctx.fillStyle = white ? 'rgba(89,94,112,.24)' : 'rgba(210,214,220,0.2)';
    ctx.fillRect(276, mode === 'tshirt' ? 98 : 131, 48, 3);
  }
  ctx.restore();
}

function drawHood(ctx, side, color) {
  const white = color === 'white';
  ctx.save();
  const hood = new Path2D('M206 120 Q211 42 264 28 Q302 13 341 29 Q387 56 394 123 L367 174 Q302 193 234 172 Z');
  const fill = ctx.createLinearGradient(215, 40, 395, 175);
  fill.addColorStop(0, white ? '#d8dbe1' : '#101115');
  fill.addColorStop(0.5, white ? '#fafbfc' : '#35363b');
  fill.addColorStop(1, white ? '#c8ccd4' : '#101116');
  ctx.fillStyle = fill;
  ctx.fill(hood);
  ctx.lineWidth = 4;
  ctx.strokeStyle = white ? '#b8bdc7' : '#37383e';
  ctx.stroke(hood);
  if (side === 'front') {
    const inner = new Path2D('M248 127 Q247 71 300 61 Q349 71 353 127 Q305 151 248 127 Z');
    ctx.fillStyle = white ? '#e5e7ed' : '#101015';
    ctx.fill(inner);
    ctx.lineWidth = 5;
    ctx.strokeStyle = white ? '#b8bec7' : '#44454c';
    ctx.stroke(inner);
  }
  ctx.restore();
}

function drawHoodSurface(ctx, side, color) {
  const white = color === 'white';
  ctx.save();
  ctx.strokeStyle = white ? 'rgba(65,69,86,.24)' : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  if (side === 'front') {
    ctx.beginPath();
    ctx.moveTo(249, 145);
    ctx.quadraticCurveTo(275, 183, 299, 198);
    ctx.moveTo(351, 145);
    ctx.quadraticCurveTo(324, 184, 301, 198);
    ctx.stroke();
    ctx.strokeStyle = white ? '#b7bcc5' : '#9b9ba5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(277, 169);
    ctx.lineTo(272, 293);
    ctx.moveTo(323, 169);
    ctx.lineTo(328, 293);
    ctx.stroke();
    ctx.fillStyle = white ? '#a3a6af' : '#d9d9df';
    ctx.fillRect(269, 283, 6, 12);
    ctx.fillRect(325, 283, 6, 12);

    // The front pouch is deliberately below the printable display area.
    ctx.beginPath();
    ctx.moveTo(221, 514);
    ctx.quadraticCurveTo(302, 505, 380, 514);
    ctx.lineTo(396, 628);
    ctx.quadraticCurveTo(305, 648, 205, 628);
    ctx.closePath();
    ctx.fillStyle = white ? 'rgba(91,96,114,.09)' : 'rgba(0,0,0,0.19)';
    ctx.fill();
    ctx.strokeStyle = white ? 'rgba(77,82,99,.15)' : 'rgba(255,255,255,0.08)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(226, 526);
    ctx.lineTo(246, 568);
    ctx.moveTo(375, 526);
    ctx.lineTo(353, 568);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(238, 155);
    ctx.quadraticCurveTo(302, 204, 361, 155);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRibbing(ctx, garment, color) {
  if (garment === 'tshirt') return;
  const white = color === 'white';
  ctx.save();
  ctx.fillStyle = white ? '#e7e8eb' : '#25262a';
  ctx.strokeStyle = white ? 'rgba(89,94,112,.24)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.fillRect(177, 641, 246, 17);
  ctx.strokeRect(177, 641, 246, 17);
  for (let x = 188; x < 420; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 643);
    ctx.lineTo(x, 656);
    ctx.stroke();
  }
  for (const x of [55, 493]) {
    ctx.fillRect(x, 298, 52, 22);
    ctx.strokeRect(x, 298, 52, 22);
  }
  ctx.restore();
}

function drawSeamDetails(ctx, garment, color) {
  const white = color === 'white';
  const seam = white ? 'rgba(83,87,103,0.17)' : 'rgba(230,231,238,0.095)';
  const highlight = white ? 'rgba(255,255,255,0.67)' : 'rgba(255,255,255,0.04)';
  ctx.save();
  ctx.lineWidth = 1.45;
  ctx.strokeStyle = seam;
  // Soft shoulder, underarm and hem construction stitches.
  for (const mirror of [-1, 1]) {
    ctx.save();
    ctx.translate(300, 0);
    ctx.scale(mirror, 1);
    ctx.translate(-300, 0);
    ctx.beginPath();
    ctx.moveTo(243, garment === 'tshirt' ? 78 : 104);
    ctx.quadraticCurveTo(212, garment === 'tshirt' ? 89 : 116, 188, garment === 'tshirt' ? 109 : 146);
    ctx.moveTo(174, 290);
    ctx.quadraticCurveTo(189, 321, 189, 373);
    ctx.moveTo(185, 643);
    ctx.quadraticCurveTo(216, 650, 245, 651);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = highlight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(187, 649);
  ctx.quadraticCurveTo(302, 668, 416, 649);
  ctx.stroke();
  ctx.restore();
}

// Add gentle local weave to the existing, color-matched Custom Studio SVG
// garment silhouette without affecting the neutral showroom backdrop.
function renderStudioCrewneckFabric(ctx, source, color) {
  const fabricLayer = document.createElement('canvas');
  fabricLayer.width = WIDTH;
  fabricLayer.height = HEIGHT;
  const fc = fabricLayer.getContext('2d', { alpha: true });
  if (!fc) return false;
  fc.drawImage(source, 0, 0, WIDTH, HEIGHT);
  fc.save();
  fc.globalCompositeOperation = 'source-atop';
  const white = color === 'white';
  const glow = fc.createLinearGradient(150, 180, 465, 570);
  glow.addColorStop(0, white ? 'rgba(255,255,255,.20)' : 'rgba(255,255,255,.055)');
  glow.addColorStop(.42, 'rgba(255,255,255,0)');
  glow.addColorStop(1, white ? 'rgba(60,68,81,.045)' : 'rgba(0,0,0,.12)');
  fc.fillStyle = glow;
  fc.fillRect(50, 100, 500, 560);
  fc.strokeStyle = white ? 'rgba(72,77,88,.033)' : 'rgba(235,236,241,.026)';
  fc.lineWidth = 0.7;
  for (let y = 155; y < 592; y += 4) {
    fc.beginPath();
    fc.moveTo(120, y);
    fc.quadraticCurveTo(300, y + Math.sin(y / 43) * 2, 480, y);
    fc.stroke();
  }
  fc.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = 23;
  ctx.shadowOffsetY = 13;
  ctx.drawImage(fabricLayer, 0, 0);
  ctx.restore();
  return true;
}

function drawBackdrop(ctx) {
  const grad = ctx.createRadialGradient(300, 250, 40, 300, 370, 620);
  grad.addColorStop(0, '#52545b');
  grad.addColorStop(0.62, '#222329');
  grad.addColorStop(1, '#0b0c11');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(12, 12, WIDTH - 24, HEIGHT - 24);
}

function drawArtwork(ctx, artwork, garment, side, color) {
  const position = QUICK_DESIGN_PRINT_PLACEMENTS[garment][side];
  ctx.save();
  // White mockups need a slight silhouette shadow for translucent edges.
  // Never alter the original customer artwork itself.
  ctx.shadowColor = color === 'white' ? 'rgba(45,45,60,.22)' : 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = color === 'white' ? 3 : 2;
  drawContained(ctx, artwork, ...position);
  ctx.restore();
}

/**
 * @param {{
 *   artworkSource?: string | HTMLCanvasElement | HTMLImageElement,
 *   garment?: string,
 *   side?: string,
 *   color?: string,
 * }} options
 */
export async function renderQuickDesignGarmentMockup({
  artworkSource,
  garment = 'tshirt',
  side = 'front',
  color = 'black',
} = {}) {
  if (!artworkSource) throw new Error('Choose a sample before previewing garments.');
  const selectedGarment = QUICK_DESIGN_GARMENTS.some((item) => item.id === garment) ? garment : 'tshirt';
  const selectedSide = side === 'back' ? 'back' : 'front';
  const selectedColor = QUICK_DESIGN_COLORS.some((item) => item.id === color) ? color : 'black';
  const artwork = await imageFromSource(artworkSource);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * OUTPUT_SCALE;
  canvas.height = HEIGHT * OUTPUT_SCALE;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('The garment preview is unavailable on this device.');
  ctx.scale(OUTPUT_SCALE, OUTPUT_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // The customer-approved blank garment sheet is the PRIMARY visual.
  // It is local, contains exactly 12 blank front/back views and no branding,
  // and never gets changed when customer artwork is applied to this canvas.
  const approvedAtlas = await loadApprovedBlankGarments();
  const usingApprovedBlankGarment = Boolean(
    approvedAtlas &&
    approvedAtlas.naturalWidth === QUICK_DESIGN_BLANK_ATLAS_SIZE.width &&
    approvedAtlas.naturalHeight === QUICK_DESIGN_BLANK_ATLAS_SIZE.height
  );
  if (usingApprovedBlankGarment) {
    ctx.fillStyle = '#b5b5b7';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const crop = getQuickDesignBlankGarmentCrop(selectedGarment, selectedColor, selectedSide);
    ctx.drawImage(approvedAtlas, crop.sx, crop.sy, crop.sw, crop.sh,
      crop.dx, crop.dy, crop.dw, crop.dh);
  } else {
    // If a browser cannot decode WebP or the asset is offline, retain the
    // existing free Custom Studio crewneck/local T-shirt/hoodie fallback.
    drawBackdrop(ctx);
    const fabricAssetUrl = getQuickDesignStudioFabricAsset(selectedGarment, selectedSide, selectedColor);
    let studioGarment = null;
    if (fabricAssetUrl) {
      try { studioGarment = await imageFromSource(fabricAssetUrl); }
      catch { /* Keep the free on-device fallback. */ }
    }
    const usedStudioFabric = studioGarment
      ? renderStudioCrewneckFabric(ctx, studioGarment, selectedColor) : false;
    if (!usedStudioFabric) {
      if (selectedGarment === 'hoodie') drawHood(ctx, selectedSide, selectedColor);
  const outline = selectedGarment === 'tshirt'
    ? new Path2D('M191 89 Q216 68 244 43 Q300 87 356 43 Q383 68 410 89 Q477 111 547 175 Q554 181 547 194 L493 312 Q489 321 478 316 L427 292 L421 657 Q300 679 180 657 L173 292 L122 316 Q112 321 107 312 L53 194 Q46 181 54 175 Q124 111 191 89 Z')
    : new Path2D('M191 114 Q222 99 246 87 Q300 123 354 87 Q379 99 409 114 Q470 136 540 193 Q546 199 540 209 L499 317 Q496 328 485 325 L429 299 L421 658 Q302 679 180 658 L172 299 L115 325 Q105 328 102 317 L60 209 Q54 199 61 193 Q132 136 191 114 Z');

  fillGarment(ctx, outline, selectedColor);
  paintTailoredFabric(ctx, outline, selectedColor, selectedGarment);
  if (selectedGarment === 'hoodie') drawHoodSurface(ctx, selectedSide, selectedColor);
  else drawNeck(ctx, selectedGarment, selectedSide, selectedColor);
  drawRibbing(ctx, selectedGarment, selectedColor);
  drawSeamDetails(ctx, selectedGarment, selectedColor);
    }
  }

  // Only the currently selected FRONT or BACK is printed in this illustrative
  // preview. We do not imply the customer requested a two-sided print.
  drawArtwork(ctx, artwork, selectedGarment, selectedSide, selectedColor);

  // Readable customer choice on both grey image-backed and dark fallback stages.
  ctx.save();
  ctx.fillStyle = 'rgba(12,13,17,0.86)';
  ctx.beginPath();
  ctx.roundRect(103, 675, 394, 34, 13);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 15px Arial, sans-serif';
  const typeLabel = QUICK_DESIGN_GARMENTS.find((item) => item.id === selectedGarment)?.label || 'T-shirt';
  ctx.fillText(selectedColor.toUpperCase() + ' ' + typeLabel.toUpperCase() + ' • ' + selectedSide.toUpperCase(), WIDTH / 2, 693);
  ctx.restore();
  return canvas;
}
