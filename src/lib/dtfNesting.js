const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const rectArea = (rect) => Math.max(0, rect.width) * Math.max(0, rect.height);

function intersects(a, b) {
  return !(
    b.x >= a.x + a.width ||
    b.x + b.width <= a.x ||
    b.y >= a.y + a.height ||
    b.y + b.height <= a.y
  );
}

function contains(a, b) {
  return (
    b.x >= a.x &&
    b.y >= a.y &&
    b.x + b.width <= a.x + a.width &&
    b.y + b.height <= a.y + a.height
  );
}

function splitFreeRect(free, used) {
  if (!intersects(free, used)) return [free];

  const next = [];
  const freeRight = free.x + free.width;
  const freeBottom = free.y + free.height;
  const usedRight = used.x + used.width;
  const usedBottom = used.y + used.height;

  if (used.x > free.x) {
    next.push({
      x: free.x,
      y: free.y,
      width: used.x - free.x,
      height: free.height,
    });
  }

  if (usedRight < freeRight) {
    next.push({
      x: usedRight,
      y: free.y,
      width: freeRight - usedRight,
      height: free.height,
    });
  }

  if (used.y > free.y) {
    next.push({
      x: free.x,
      y: free.y,
      width: free.width,
      height: used.y - free.y,
    });
  }

  if (usedBottom < freeBottom) {
    next.push({
      x: free.x,
      y: usedBottom,
      width: free.width,
      height: freeBottom - usedBottom,
    });
  }

  return next.filter((rect) => rect.width > 0.001 && rect.height > 0.001);
}

function pruneFreeRects(rects) {
  const unique = [];
  for (let i = 0; i < rects.length; i += 1) {
    let contained = false;
    for (let j = 0; j < rects.length; j += 1) {
      if (i === j) continue;
      if (contains(rects[j], rects[i])) {
        contained = true;
        break;
      }
    }
    if (!contained) unique.push(rects[i]);
  }

  return unique.filter((rect, index, arr) => {
    return !arr.some((other, otherIndex) =>
      otherIndex < index &&
      Math.abs(other.x - rect.x) < 0.001 &&
      Math.abs(other.y - rect.y) < 0.001 &&
      Math.abs(other.width - rect.width) < 0.001 &&
      Math.abs(other.height - rect.height) < 0.001
    );
  });
}

function contactScore(rect, usedRects, binWidth) {
  let score = 0;
  if (Math.abs(rect.x) < 0.001 || Math.abs(rect.x + rect.width - binWidth) < 0.001) {
    score += rect.height;
  }
  if (Math.abs(rect.y) < 0.001) score += rect.width;

  for (const used of usedRects) {
    if (
      Math.abs(used.x + used.width - rect.x) < 0.001 ||
      Math.abs(rect.x + rect.width - used.x) < 0.001
    ) {
      const overlap = Math.max(
        0,
        Math.min(used.y + used.height, rect.y + rect.height) - Math.max(used.y, rect.y)
      );
      score += overlap;
    }
    if (
      Math.abs(used.y + used.height - rect.y) < 0.001 ||
      Math.abs(rect.y + rect.height - used.y) < 0.001
    ) {
      const overlap = Math.max(
        0,
        Math.min(used.x + used.width, rect.x + rect.width) - Math.max(used.x, rect.x)
      );
      score += overlap;
    }
  }
  return score;
}

function scoreCandidate(rect, freeRect, heuristic, usedRects, binWidth) {
  const leftoverW = freeRect.width - rect.width;
  const leftoverH = freeRect.height - rect.height;
  const shortSide = Math.min(leftoverW, leftoverH);
  const longSide = Math.max(leftoverW, leftoverH);
  const areaFit = rectArea(freeRect) - rectArea(rect);
  const bottom = rect.y + rect.height;

  switch (heuristic) {
    case "area":
      return [areaFit, shortSide, bottom, rect.x];
    case "bottom-left":
      return [bottom, rect.x, shortSide, areaFit];
    case "contact":
      return [-contactScore(rect, usedRects, binWidth), bottom, shortSide, rect.x];
    case "long-side":
      return [longSide, shortSide, bottom, rect.x];
    case "short-side":
    default:
      return [shortSide, longSide, bottom, rect.x];
  }
}

function scoreLess(a, b) {
  if (!b) return true;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (Math.abs(av - bv) < 0.000001) continue;
    return av < bv;
  }
  return false;
}

function placeRect(freeRects, usedRects, item, heuristic, binWidth, allowRotation) {
  let best = null;
  let bestScore = null;
  const orientations = [{ rotated: false, width: item.packWidth, height: item.packHeight }];

  if (
    allowRotation &&
    Math.abs(item.packWidth - item.packHeight) > 0.001
  ) {
    orientations.push({
      rotated: true,
      width: item.packHeight,
      height: item.packWidth,
    });
  }

  for (const free of freeRects) {
    for (const orientation of orientations) {
      if (
        orientation.width > free.width + 0.001 ||
        orientation.height > free.height + 0.001
      ) {
        continue;
      }

      const candidate = {
        x: free.x,
        y: free.y,
        width: orientation.width,
        height: orientation.height,
        rotated: orientation.rotated,
      };
      const score = scoreCandidate(candidate, free, heuristic, usedRects, binWidth);

      if (scoreLess(score, bestScore)) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  return best;
}

function updateFreeRects(freeRects, placed) {
  const split = [];
  for (const free of freeRects) {
    split.push(...splitFreeRect(free, placed));
  }
  return pruneFreeRects(split);
}

function layoutMetric(result, binWidth) {
  const usedLength = result.usedLength;
  const usedArea = result.placements.reduce((sum, item) => sum + item.artArea, 0);
  const boundingArea = Math.max(0.001, binWidth * usedLength);
  const efficiency = Math.min(100, (usedArea / boundingArea) * 100);
  const rotatedCount = result.placements.filter((item) => item.rotated).length;
  return {
    usedLength,
    efficiency,
    rotatedCount,
    score: [
      usedLength,
      -efficiency,
      rotatedCount * 0.001,
    ],
  };
}

function packPass(items, binWidth, binHeight, spacing, heuristic, sorter, allowRotation) {
  const gap = Math.max(0, n(spacing, 0.25));
  const safeWidth = Math.max(1, n(binWidth, 34));
  const safeHeight = Math.max(1, n(binHeight, 36));
  const contentWidth = Math.max(0.5, safeWidth - gap * 2);
  const contentHeight = Math.max(0.5, safeHeight - gap * 2);

  const normalized = items.map((item, index) => {
    const width = Math.max(0.5, n(item.width, 1));
    const height = Math.max(0.5, n(item.height, 1));
    return {
      source: item,
      index,
      width,
      height,
      packWidth: width + gap,
      packHeight: height + gap,
      area: width * height,
      maxSide: Math.max(width, height),
      minSide: Math.min(width, height),
    };
  });

  normalized.sort(sorter);

  let freeRects = [{ x: 0, y: 0, width: contentWidth + gap, height: contentHeight + gap }];
  const usedRects = [];
  const placements = [];
  const unpacked = [];

  for (const item of normalized) {
    const placed = placeRect(
      freeRects,
      usedRects,
      item,
      heuristic,
      contentWidth + gap,
      allowRotation
    );

    if (!placed) {
      unpacked.push(item.source);
      continue;
    }

    freeRects = updateFreeRects(freeRects, placed);
    usedRects.push(placed);

    const artWidth = placed.rotated ? item.height : item.width;
    const artHeight = placed.rotated ? item.width : item.height;
    placements.push({
      ...item.source,
      x: gap + placed.x,
      y: gap + placed.y,
      width: artWidth,
      height: artHeight,
      rotation: placed.rotated
        ? ((n(item.source.rotation, 0) + 90) % 180)
        : (n(item.source.rotation, 0) % 180),
      rotated: placed.rotated,
      artArea: item.area,
    });
  }

  const usedLength = placements.length
    ? Math.max(...placements.map((item) => item.y + item.height)) + gap
    : gap * 2;

  return {
    placements,
    unpacked,
    usedLength,
    heuristic,
  };
}

const sorters = {
  area: (a, b) => b.area - a.area || b.maxSide - a.maxSide || b.minSide - a.minSide,
  maxSide: (a, b) => b.maxSide - a.maxSide || b.area - a.area || b.minSide - a.minSide,
  height: (a, b) => b.height - a.height || b.width - a.width || b.area - a.area,
  width: (a, b) => b.width - a.width || b.height - a.height || b.area - a.area,
  perimeter: (a, b) => (b.width + b.height) - (a.width + a.height) || b.area - a.area,
};

const heuristics = ["short-side", "area", "bottom-left", "contact", "long-side"];

export function advancedNestArtwork(
  items = [],
  sheetWidth = 34,
  currentLength = 36,
  spacing = 0.25,
  options = {}
) {
  if (!items.length) {
    return {
      items: [],
      usedLength: 0,
      recommendedLength: Math.max(1, n(currentLength, 36)),
      efficiency: 0,
      rotatedCount: 0,
      unpacked: [],
      algorithm: "maxrects-multiheuristic-v1",
    };
  }

  const safeWidth = Math.max(1, n(sheetWidth, 34));
  const current = Math.max(1, n(currentLength, 36));
  const gap = Math.max(0, n(spacing, 0.25));
  const allowRotation = options.allowRotation !== false;

  const totalHeight = items.reduce(
    (sum, item) => sum + Math.max(0.5, n(item.height, 1)) + gap,
    gap * 2
  );
  const generousHeight = Math.max(current, totalHeight, 120);

  let best = null;
  let bestMetric = null;

  for (const [sortName, sorter] of Object.entries(sorters)) {
    for (const heuristic of heuristics) {
      const pass = packPass(
        items,
        safeWidth,
        generousHeight,
        gap,
        heuristic,
        sorter,
        allowRotation
      );

      const metric = layoutMetric(pass, safeWidth);
      const candidate = {
        ...pass,
        sortName,
        ...metric,
      };

      if (
        !best ||
        candidate.unpacked.length < best.unpacked.length ||
        (
          candidate.unpacked.length === best.unpacked.length &&
          scoreLess(candidate.score, bestMetric.score)
        )
      ) {
        best = candidate;
        bestMetric = metric;
      }
    }
  }

  const recommendedLength = Math.max(
    n(options.minLength, 1),
    Math.ceil(best.usedLength * 4) / 4
  );

  const packedById = new Map(best.placements.map((item) => [item.id, item]));
  const ordered = items
    .map((item) => packedById.get(item.id))
    .filter(Boolean);

  return {
    items: ordered,
    usedLength: best.usedLength,
    recommendedLength,
    efficiency: best.efficiency,
    rotatedCount: best.rotatedCount,
    unpacked: best.unpacked,
    heuristic: best.heuristic,
    sort: best.sortName,
    algorithm: "maxrects-multiheuristic-v1",
    passes: Object.keys(sorters).length * heuristics.length,
  };
}
