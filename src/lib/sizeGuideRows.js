// Product-scoped size guide data. Values are printable text, including fractional inches.
export const SIZE_GUIDE_FIELDS = Object.freeze([
  { key: 'length', label: 'Body Length' },
  { key: 'lengthTolerance', label: 'Body Length Tolerance' },
  { key: 'chestTolerance', label: 'Chest Tolerance' },
  { key: 'width', label: 'Chest Width (Laid Flat)' },
  { key: 'sleeve', label: 'Sleeve Length (From Center Back)' },
  { key: 'sleeveTolerance', label: 'Sleeve Tolerance' },
  { key: 'numericalSizes', label: 'Numerical Sizes' },
]);

const clean = (value) => String(value ?? '').trim();

export function parseSizeGuideRows(value) {
  if (value == null || value === '') return [];
  let rows = value;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      // Backwards-compatible legacy format: Size | Width | Length | Sleeve.
      rows = rows.split(/\r?\n/).map((line) => {
        const [size, width, length, sleeve] = line.split('|').map(clean);
        return { size, width, length, sleeve };
      });
    }
  }
  if (rows && !Array.isArray(rows) && Array.isArray(rows.rows)) rows = rows.rows;
  if (!Array.isArray(rows)) return [];

  return rows.filter((row) => row && typeof row === 'object').map((row) => ({
    ...row,
    size: clean(row.size || row.label),
    width: clean(row.width ?? row.chest ?? row.chestWidth),
    length: clean(row.length ?? row.bodyLength),
    sleeve: clean(row.sleeve ?? row.sleeveLength),
    lengthTolerance: clean(row.lengthTolerance ?? row.bodyLengthTolerance),
    chestTolerance: clean(row.chestTolerance),
    sleeveTolerance: clean(row.sleeveTolerance),
    numericalSizes: clean(row.numericalSizes ?? row.numericSize),
  })).filter((row) => row.size);
}

export function sizeGuideIsDetailed(rows) {
  return rows.some((row) => Boolean(row.lengthTolerance || row.chestTolerance || row.sleeveTolerance || row.numericalSizes));
}

export function sizeGuideVisibleFields(rows) {
  return SIZE_GUIDE_FIELDS.filter(({ key }) => rows.some((row) => Boolean(clean(row?.[key]))));
}
