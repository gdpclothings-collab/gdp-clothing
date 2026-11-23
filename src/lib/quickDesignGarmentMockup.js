// Quick Design garment visualizer. All six combinations render in the browser.
// These are enhanced studio-rendered black garments, not an assertion about Gildan product
// photography or a guarantee of actual printable area. No network calls.
export const QUICK_DESIGN_GARMENTS = Object.freeze([
  { id: 'tshirt', label: 'T-shirt', description: 'Short sleeves' },
  { id: 'sweatshirt', label: 'Sweatshirt', description: 'Crewneck' },
  { id: 'hoodie', label: 'Hoodie', description: 'Pullover hood' },
]);
export const QUICK_DESIGN_SIDES = Object.freeze([
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
]);

const WIDTH = 600;
const HEIGHT = 720;

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
  const ratio = Math.min(w / sw, h / sh);
  ctx.drawImage(image, x + (w - sw * ratio) / 2, y + (h - sh * ratio) / 2, sw * ratio, sh * ratio);
}

function fillGarment(ctx, shape) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.82)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 19;
  const fabric = ctx.createLinearGradient(70, 260, 510, 410);
  fabric.addColorStop(0, '#0c0d11');
  fabric.addColorStop(0.16, '#303136');
  fabric.addColorStop(0.34, '#17181c');
  fabric.addColorStop(0.64, '#101115');
  fabric.addColorStop(0.87, '#292a2f');
  fabric.addColorStop(1, '#101115');
  ctx.fillStyle = fabric;
  ctx.fill(shape);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(233,233,240,0.15)';
  ctx.lineWidth = 2.5;
  ctx.stroke(shape);
  ctx.clip(shape);
  const bodyLight = ctx.createLinearGradient(160, 170, 450, 650);
  bodyLight.addColorStop(0, 'rgba(255,255,255,0.08)');
  bodyLight.addColorStop(0.38, 'rgba(255,255,255,0)');
  bodyLight.addColorStop(0.7, 'rgba(0,0,0,0.24)');
  bodyLight.addColorStop(1, 'rgba(255,255,255,0.035)');
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
  for (let i = 0; i < 1250; i += 1) {
    const x = 115 + pseudo() * 385;
    const y = 130 + pseudo() * 520;
    const light = pseudo() > 0.56;
    ctx.fillStyle = light ? 'rgba(245,246,249,0.035)' : 'rgba(0,0,0,0.13)';
    ctx.fillRect(x, y, 0.65 + pseudo() * 1.3, 0.4 + pseudo() * 1.5);
  }

  // Localized diagonal fold shading and fine seam glints approximate cloth
  // drape, rather than a flat fill (still a clearly labelled illustration).
  const centerFold = ctx.createLinearGradient(175, 255, 418, 624);
  centerFold.addColorStop(0, 'rgba(255,255,255,.035)');
  centerFold.addColorStop(.34, 'rgba(0,0,0,.05)');
  centerFold.addColorStop(.59, 'rgba(255,255,255,.045)');
  centerFold.addColorStop(1, 'rgba(0,0,0,.16)');
  ctx.fillStyle = centerFold;
  ctx.fillRect(143, 220, 327, 446);

  const folds = [
    [174, 294, 212, 445], [426, 298, 388, 455],
    [180, 555, 222, 657], [421, 551, 387, 657],
    [131, 150, 177, 255], [466, 160, 430, 264],
  ];

  ctx.save();
  ctx.strokeStyle = 'rgba(225,225,235,.075)';
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
  ctx.strokeStyle = 'rgba(228,229,238,0.04)';
  ctx.lineWidth = 4;
  folds.forEach(([ax, ay, bx, by]) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 + 10, (ay + by) / 2, bx, by);
    ctx.stroke();
  });
  ctx.restore();
}

function drawNeck(ctx, mode, side) {
  ctx.save();
  if (mode === 'tshirt') {
    ctx.beginPath();
    ctx.ellipse(300, 72, 55, 30, 0, 0, Math.PI * 2);
  } else {
    ctx.beginPath();
    ctx.ellipse(300, 104, 51, 27, 0, 0, Math.PI * 2);
  }
  ctx.fillStyle = '#313238';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#43444a';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(300, mode === 'tshirt' ? 68 : 100, mode === 'tshirt' ? 44 : 40, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#101116';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.stroke();
  if (side === 'back') {
    ctx.fillStyle = 'rgba(210,214,220,0.2)';
    ctx.fillRect(276, mode === 'tshirt' ? 98 : 131, 48, 3);
  }
  ctx.restore();
}

function drawHood(ctx, side) {
  ctx.save();
  const hood = new Path2D('M206 120 Q211 42 264 28 Q302 13 341 29 Q387 56 394 123 L367 174 Q302 193 234 172 Z');
  const fill = ctx.createLinearGradient(215, 40, 395, 175);
  fill.addColorStop(0, '#101115');
  fill.addColorStop(0.5, '#35363b');
  fill.addColorStop(1, '#101116');
  ctx.fillStyle = fill;
  ctx.fill(hood);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#37383e';
  ctx.stroke(hood);
  if (side === 'front') {
    const inner = new Path2D('M248 127 Q247 71 300 61 Q349 71 353 127 Q305 151 248 127 Z');
    ctx.fillStyle = '#101015';
    ctx.fill(inner);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#44454c';
    ctx.stroke(inner);
  }
  ctx.restore();
}

function drawHoodSurface(ctx, side) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  if (side === 'front') {
    ctx.beginPath();
    ctx.moveTo(249, 145);
    ctx.quadraticCurveTo(275, 183, 299, 198);
    ctx.moveTo(351, 145);
    ctx.quadraticCurveTo(324, 184, 301, 198);
    ctx.stroke();
    ctx.strokeStyle = '#9b9ba5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(277, 169);
    ctx.lineTo(272, 293);
    ctx.moveTo(323, 169);
    ctx.lineTo(328, 293);
    ctx.stroke();
    ctx.fillStyle = '#d9d9df';
    ctx.fillRect(269, 283, 6, 12);
    ctx.fillRect(325, 283, 6, 12);

    // The front pouch is deliberately below the printable display area.
    ctx.beginPath();
    ctx.moveTo(221, 514);
    ctx.quadraticCurveTo(302, 505, 380, 514);
    ctx.lineTo(396, 628);
    ctx.quadraticCurveTo(305, 648, 205, 628);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.19)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
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

function drawRibbing(ctx, garment) {
  if (garment === 'tshirt') return;
  ctx.save();
  ctx.fillStyle = '#25262a';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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

function drawArtwork(ctx, artwork, garment, side) {
  const position = garment === 'hoodie'
    ? (side === 'front' ? [194, 235, 212, 260] : [188, 214, 224, 296])
    : garment === 'sweatshirt'
      ? [189, 213, 222, 291]
      : [182, 183, 236, 323];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 2;
  drawContained(ctx, artwork, ...position);
  ctx.restore();
}

/**
 * @param {{
 *   artworkSource?: string | HTMLCanvasElement | HTMLImageElement,
 *   garment?: string,
 *   side?: string,
 * }} options
 */
export async function renderQuickDesignGarmentMockup({
  artworkSource,
  garment = 'tshirt',
  side = 'front',
} = {}) {
  if (!artworkSource) throw new Error('Choose a sample before previewing garments.');
  const selectedGarment = QUICK_DESIGN_GARMENTS.some((item) => item.id === garment) ? garment : 'tshirt';
  const selectedSide = side === 'back' ? 'back' : 'front';
  const artwork = await imageFromSource(artworkSource);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('The garment preview is unavailable on this device.');
  drawBackdrop(ctx);

  if (selectedGarment === 'hoodie') drawHood(ctx, selectedSide);
  const outline = selectedGarment === 'tshirt'
    ? new Path2D('M192 78 L244 42 Q301 87 357 42 L409 78 Q488 108 552 172 L475 317 L422 292 L418 659 Q300 680 181 659 L177 292 L124 317 L48 172 Q109 107 192 78 Z')
    : new Path2D('M191 116 L246 87 Q300 123 354 87 L409 116 Q470 133 538 192 L496 320 L429 300 L420 661 Q300 684 181 661 L172 300 L105 320 L62 192 Q125 131 191 116 Z');

  fillGarment(ctx, outline);
  if (selectedGarment === 'hoodie') drawHoodSurface(ctx, selectedSide);
  else drawNeck(ctx, selectedGarment, selectedSide);
  drawRibbing(ctx, selectedGarment);

  // Only the currently selected FRONT or BACK is printed in this illustrative
  // preview. We do not imply the customer requested a two-sided print.
  drawArtwork(ctx, artwork, selectedGarment, selectedSide);

  ctx.fillStyle = 'rgba(255,255,255,0.83)';
  ctx.textAlign = 'center';
  ctx.font = '700 15px Arial, sans-serif';
  const typeLabel = QUICK_DESIGN_GARMENTS.find((item) => item.id === selectedGarment)?.label || 'T-shirt';
  ctx.fillText(typeLabel.toUpperCase() + ' • ' + selectedSide.toUpperCase(), WIDTH / 2, 692);
  return canvas;
}
