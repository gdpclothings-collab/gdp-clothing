// Quick Design realistic studio garment visualizer: 3 garment types × 2 colors × 2 sides.
// All fabric and artwork are composed locally with no paid image service or network call.
// These are studio illustrations, NOT manufacturer-certified photos or a size-specific print guide.
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

// Conservative, centered chest/back zones: source art remains transparent and
// aspect-ratio preserved. No second side is ever implied or rendered.
export const QUICK_DESIGN_PRINT_PLACEMENTS = Object.freeze({
  tshirt: Object.freeze({ front: Object.freeze([204, 203, 192, 256]), back: Object.freeze([204, 199, 192, 256]) }),
  sweatshirt: Object.freeze({ front: Object.freeze([207, 219, 186, 248]), back: Object.freeze([207, 215, 186, 248]) }),
  hoodie: Object.freeze({ front: Object.freeze([208, 255, 184, 242]), back: Object.freeze([210, 231, 180, 242]) }),
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
  drawBackdrop(ctx);

  if (selectedGarment === 'hoodie') drawHood(ctx, selectedSide, selectedColor);
  const outline = selectedGarment === 'tshirt'
    ? new Path2D('M191 89 Q216 68 244 43 Q300 87 356 43 Q383 68 410 89 Q477 111 547 175 Q554 181 547 194 L493 312 Q489 321 478 316 L427 292 L421 657 Q300 679 180 657 L173 292 L122 316 Q112 321 107 312 L53 194 Q46 181 54 175 Q124 111 191 89 Z')
    : new Path2D('M191 114 Q222 99 246 87 Q300 123 354 87 Q379 99 409 114 Q470 136 540 193 Q546 199 540 209 L499 317 Q496 328 485 325 L429 299 L421 658 Q302 679 180 658 L172 299 L115 325 Q105 328 102 317 L60 209 Q54 199 61 193 Q132 136 191 114 Z');

  fillGarment(ctx, outline, selectedColor);
  if (selectedGarment === 'hoodie') drawHoodSurface(ctx, selectedSide, selectedColor);
  else drawNeck(ctx, selectedGarment, selectedSide, selectedColor);
  drawRibbing(ctx, selectedGarment, selectedColor);
  drawSeamDetails(ctx, selectedGarment, selectedColor);

  // Only the currently selected FRONT or BACK is printed in this illustrative
  // preview. We do not imply the customer requested a two-sided print.
  drawArtwork(ctx, artwork, selectedGarment, selectedSide, selectedColor);

  ctx.fillStyle = 'rgba(255,255,255,0.83)';
  ctx.textAlign = 'center';
  ctx.font = '700 15px Arial, sans-serif';
  const typeLabel = QUICK_DESIGN_GARMENTS.find((item) => item.id === selectedGarment)?.label || 'T-shirt';
  ctx.fillText(selectedColor.toUpperCase() + ' ' + typeLabel.toUpperCase() + ' • ' + selectedSide.toUpperCase(), WIDTH / 2, 692);
  return canvas;
}
