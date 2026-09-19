import { studioV2GarmentPreview } from '../src/lib/customStudioV2Preview.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(`Custom Studio garment preview verification failed: ${message}`);
};

const product = {
  images: [
    'https://example.test/render/Adult-Long-Sleeve-Tee-Black.png',
    'https://example.test/render/Adult-Long-Sleeve-Tee-black.png',
  ],
  customization: {
    preview: {
      colorMockups: {
        Black: {
          frontUrl: 'https://example.test/object/adult-long-sleeve-black-front.png',
          backUrl: 'https://example.test/object/adult-long-sleeve-black-back.png',
        },
        'Sport Grey': {
          frontUrl: 'https://example.test/object/adult-long-sleeve-grey-front.png',
          backUrl: 'https://example.test/object/adult-long-sleeve-grey-back.png',
        },
      },
    },
    media: {
      'https://example.test/object/media-blue-front.png': { view: 'front', color: 'Blue' },
      'https://example.test/object/media-blue-rear.png': { view: 'back', color: 'Blue' },
    },
  },
};

assert(
  studioV2GarmentPreview(product, 'Black', 'front') === 'https://example.test/object/adult-long-sleeve-black-front.png',
  'Black front must use the authoritative colorMockups frontUrl.',
);
assert(
  studioV2GarmentPreview(product, 'Black', 'back') === 'https://example.test/object/adult-long-sleeve-black-back.png',
  'Black back must use the authoritative colorMockups backUrl instead of a silhouette.',
);
assert(
  studioV2GarmentPreview(product, 'Sport Grey', 'back') === 'https://example.test/object/adult-long-sleeve-grey-back.png',
  'Grey/gray normalization must preserve exact back-side mapping.',
);
assert(
  studioV2GarmentPreview(product, 'Blue', 'back') === 'https://example.test/object/media-blue-rear.png',
  'media metadata must resolve a back image even when filenames are not the primary mapping source.',
);

const frontOnly = {
  images: ['https://example.test/Adult-Tee-Black.png'],
  customization: { media: {} },
};
assert(studioV2GarmentPreview(frontOnly, 'Black', 'back') === '', 'A known front-only product must not fake a back preview.');

console.log('PASS Custom Studio color-specific front/back garment preview verification');
