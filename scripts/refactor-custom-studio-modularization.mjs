import fs from 'node:fs';

const corePath = 'src/pages/CustomStudio.jsx';
const garmentPath = 'src/components/storefront/custom-studio/GarmentStep.jsx';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    if (source.includes(to)) return source;
    throw new Error(`Missing patch anchor: ${label}`);
  }
  return source.replace(from, to);
}

let core = fs.readFileSync(corePath, 'utf8');
let garment = fs.readFileSync(garmentPath, 'utf8');

garment = replaceOnce(
  garment,
  '    setSize,\n    qty,',
  '    setSize,\n    size,\n    qty,',
  'GarmentStep selected size prop'
);

core = replaceOnce(
  core,
  'availableColors, color, chooseColor, swatchFor, availableSizes, variantFor, variantAvailable, setSize, qty, setQty,',
  'availableColors, color, chooseColor, swatchFor, availableSizes, variantFor, variantAvailable, setSize, size, qty, setQty,',
  'GarmentStep selected size model wiring'
);

fs.writeFileSync(corePath, core);
fs.writeFileSync(garmentPath, garment);
console.log('Patched GarmentStep selected size wiring.');
