function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function positive(value, fallback = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, number);
}

function glyphWeight(character) {
  if (character === ' ') return 0.34;
  if (/[ilI1|!.,:'`]/.test(character)) return 0.34;
  if (/[mwMW@%&]/.test(character)) return 0.92;
  if (/[A-Z0-9]/.test(character)) return 0.66;
  return 0.58;
}

function glyphAdvance(character, fontSize) {
  return Math.max(fontSize * 0.2, fontSize * glyphWeight(character));
}

function lineAdvance(text, fontSize) {
  return [...String(text || '')].reduce((sum, character) => sum + glyphAdvance(character, fontSize), 0);
}

function rotatePoint(x, y, centerX, centerY, angleDegrees) {
  const radians = Number(angleDegrees || 0) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x: centerX + dx * cosine - dy * sine,
    y: centerY + dx * sine + dy * cosine,
  };
}

function rotatedRectBounds(centerX, centerY, width, height, angleDegrees) {
  const halfWidth = Math.max(0, width) / 2;
  const halfHeight = Math.max(0, height) / 2;
  const corners = [
    rotatePoint(centerX - halfWidth, centerY - halfHeight, centerX, centerY, angleDegrees),
    rotatePoint(centerX + halfWidth, centerY - halfHeight, centerX, centerY, angleDegrees),
    rotatePoint(centerX + halfWidth, centerY + halfHeight, centerX, centerY, angleDegrees),
    rotatePoint(centerX - halfWidth, centerY + halfHeight, centerX, centerY, angleDegrees),
  ];
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function rotateBoundsAround(bounds, centerX, centerY, angleDegrees) {
  if (!angleDegrees) return { ...bounds };
  const corners = [
    rotatePoint(bounds.minX, bounds.minY, centerX, centerY, angleDegrees),
    rotatePoint(bounds.maxX, bounds.minY, centerX, centerY, angleDegrees),
    rotatePoint(bounds.maxX, bounds.maxY, centerX, centerY, angleDegrees),
    rotatePoint(bounds.minX, bounds.maxY, centerX, centerY, angleDegrees),
  ];
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function mergeBounds(items) {
  const valid = items.filter(Boolean);
  if (!valid.length) return null;
  return {
    minX: Math.min(...valid.map((item) => item.minX)),
    maxX: Math.max(...valid.map((item) => item.maxX)),
    minY: Math.min(...valid.map((item) => item.minY)),
    maxY: Math.max(...valid.map((item) => item.maxY)),
  };
}

function padBounds(bounds, padding) {
  if (!bounds) return null;
  return {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minY: bounds.minY - padding,
    maxY: bounds.maxY + padding,
  };
}

function curveGlyphs(text, fontSize, centerX, centerY, curve, curveAmount) {
  const characters = [...String(text || '')];
  if (!characters.length) return [];
  const advances = characters.map((character) => glyphAdvance(character, fontSize));
  const totalAdvance = Math.max(fontSize, advances.reduce((sum, advance) => sum + advance, 0));
  const halfSpan = Math.max(fontSize * 0.5, totalAdvance / 2);
  const amount = clamp(curveAmount ?? 45, 0, 100) / 100;
  const arcHeight = fontSize * (0.16 + amount * 0.82);
  const waveAmplitude = fontSize * (0.08 + amount * 0.46);
  let cursor = -totalAdvance / 2;

  return characters.map((character, index) => {
    const advance = advances[index];
    const localX = cursor + advance / 2;
    cursor += advance;
    const normalizedX = clamp(localX / halfSpan, -1, 1);
    let localY = 0;
    let slope = 0;

    if (curve === 'arc-up' || curve === 'arc-down') {
      const direction = curve === 'arc-up' ? 1 : -1;
      localY = direction * arcHeight * (normalizedX * normalizedX - 0.5);
      slope = direction * (2 * arcHeight * normalizedX / Math.max(1, halfSpan));
    } else if (curve === 'wave') {
      const t = characters.length <= 1 ? 0.5 : (index + 0.5) / characters.length;
      const phase = (t - 0.5) * Math.PI * 2;
      localY = Math.sin(phase) * waveAmplitude;
      slope = Math.cos(phase) * waveAmplitude * Math.PI * 2 / Math.max(1, totalAdvance);
    }

    return {
      character,
      x: centerX + localX,
      y: centerY + localY,
      rotation: Math.atan(slope) * 180 / Math.PI,
      advance,
      fontSize,
    };
  });
}

function layoutLine(text, fontSize, centerX, centerY, weight = 700) {
  const value = String(text || '');
  if (!value) return null;
  return {
    text: value,
    x: centerX,
    y: centerY,
    fontSize,
    width: Math.max(fontSize * 0.4, lineAdvance(value, fontSize)),
    weight,
  };
}

export function resolveBootlegTextLayout({ text = {}, zone = {}, style = {}, width, height, anchorX, anchorY }) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const zoneHeight = Math.max(1, clamp(zone?.height ?? 16, 1, 100) / 100 * safeHeight);
  const scale = positive(style.fontScale, 100);
  const centerX = Number.isFinite(Number(anchorX)) ? Number(anchorX) : clamp(style.canvasX ?? 50, 0, 100) / 100 * safeWidth;
  const centerY = Number.isFinite(Number(anchorY)) ? Number(anchorY) : clamp(style.canvasY ?? 50, 0, 100) / 100 * safeHeight;
  const groupRotation = clamp(style.rotation || 0, -180, 180);
  const curve = style.curve || 'straight';
  const headlineText = String(text.headline || '').trim().toUpperCase();
  const sublineText = String(text.subline || '').trim();
  const messageText = String(text.message || '').trim();
  const headlineFontSize = Math.max(12, zoneHeight * 0.24 * scale / 100);
  const sublineFontSize = Math.max(10, zoneHeight * 0.14 * scale / 100);
  const messageFontSize = Math.max(9, zoneHeight * 0.1 * scale / 100);
  const headlineCenterY = centerY - zoneHeight * 0.2;
  const sublineCenterY = centerY + zoneHeight * 0.12;
  const messageCenterY = centerY + zoneHeight * 0.34;

  let headline = null;
  let headlineBounds = null;
  if (headlineText) {
    if (curve === 'straight') {
      const widthEstimate = Math.max(headlineFontSize * 0.4, lineAdvance(headlineText, headlineFontSize));
      headline = {
        kind: 'straight',
        text: headlineText,
        x: centerX,
        y: headlineCenterY,
        fontSize: headlineFontSize,
        weight: 900,
      };
      headlineBounds = rotatedRectBounds(centerX, headlineCenterY, widthEstimate, headlineFontSize * 1.08, 0);
    } else {
      const glyphs = curveGlyphs(headlineText, headlineFontSize, centerX, headlineCenterY, curve, style.curveAmount);
      headline = { kind: 'glyphs', glyphs, fontSize: headlineFontSize, weight: 900 };
      headlineBounds = mergeBounds(glyphs.map((glyph) => rotatedRectBounds(glyph.x, glyph.y, Math.max(glyph.advance * 0.94, headlineFontSize * 0.2), headlineFontSize * 1.08, glyph.rotation)));
    }
  }

  const subline = layoutLine(sublineText, sublineFontSize, centerX, sublineCenterY, 700);
  const message = layoutLine(messageText, messageFontSize, centerX, messageCenterY, 600);
  const sublineBounds = subline ? rotatedRectBounds(subline.x, subline.y, subline.width, subline.fontSize * 1.08, 0) : null;
  const messageBounds = message ? rotatedRectBounds(message.x, message.y, message.width, message.fontSize * 1.08, 0) : null;

  const unrotatedBounds = mergeBounds([headlineBounds, sublineBounds, messageBounds]);
  const rotatedBounds = unrotatedBounds ? rotateBoundsAround(unrotatedBounds, centerX, centerY, groupRotation) : null;
  const effectPadding = Math.max(headlineFontSize, sublineFontSize, messageFontSize) * 0.08;
  const bounds = padBounds(rotatedBounds, effectPadding);

  const rotateItem = (item) => {
    if (!item) return null;
    const point = rotatePoint(item.x, item.y, centerX, centerY, groupRotation);
    return { ...item, x: point.x, y: point.y, rotation: Number(item.rotation || 0) + groupRotation };
  };

  const rotatedHeadline = headline?.kind === 'glyphs'
    ? { ...headline, glyphs: headline.glyphs.map(rotateItem) }
    : rotateItem(headline);
  const rotatedSubline = rotateItem(subline);
  const rotatedMessage = rotateItem(message);

  const relativeBounds = bounds ? {
    minX: bounds.minX - centerX,
    maxX: bounds.maxX - centerX,
    minY: bounds.minY - centerY,
    maxY: bounds.maxY - centerY,
  } : { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  return {
    width: safeWidth,
    height: safeHeight,
    centerX,
    centerY,
    rotation: groupRotation,
    fontScale: scale,
    headline: rotatedHeadline,
    subline: rotatedSubline,
    message: rotatedMessage,
    bounds,
    relativeBounds,
    overflow: bounds ? {
      left: bounds.minX < 0,
      right: bounds.maxX > safeWidth,
      top: bounds.minY < 0,
      bottom: bounds.maxY > safeHeight,
      any: bounds.minX < 0 || bounds.maxX > safeWidth || bounds.minY < 0 || bounds.maxY > safeHeight,
    } : { left: false, right: false, top: false, bottom: false, any: false },
  };
}

export function resolveBootlegAnchorRanges(layout) {
  const relative = layout?.relativeBounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return {
    x: {
      start: -relative.minX,
      end: Number(layout?.width || 1) - relative.maxX,
    },
    y: {
      start: -relative.minY,
      end: Number(layout?.height || 1) - relative.maxY,
    },
  };
}

export function bootlegSliderToAnchor(percent, range) {
  const value = clamp(percent, 0, 100) / 100;
  return Number(range?.start || 0) + (Number(range?.end || 0) - Number(range?.start || 0)) * value;
}

export function bootlegAnchorToSlider(anchor, range) {
  const start = Number(range?.start || 0);
  const end = Number(range?.end || 0);
  const span = end - start;
  if (Math.abs(span) < 0.0001) return 50;
  return clamp(((Number(anchor || 0) - start) / span) * 100, 0, 100);
}

export function bootlegGestureLimits(layout) {
  const ranges = resolveBootlegAnchorRanges(layout);
  const width = Math.max(1, Number(layout?.width || 1));
  const height = Math.max(1, Number(layout?.height || 1));
  const xValues = [ranges.x.start / width * 100 - 50, ranges.x.end / width * 100 - 50];
  const yValues = [ranges.y.start / height * 100 - 50, ranges.y.end / height * 100 - 50];
  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues),
  };
}
