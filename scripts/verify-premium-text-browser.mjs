// Chromium pixel-parity guard. CI installs Playwright and the browser first.
// Paint the very same lettering recipe at 80 and 300 pixels/inch, then compare
// the downsampled 300-DPI image with the interactive preview resolution.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync(new URL('../src/lib/customStudioV2PremiumTextStyles.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('about:blank');
  const results = await page.evaluate(async (url) => {
    const { PREMIUM_TEXT_STYLES, applyPremiumTextPreset, paintPremiumTextLayout } = await import(url);
    const render = (presetId, width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const ratio = width / 320;
      const style = applyPremiumTextPreset({ fontScale: 100 }, presetId);
      const layout = {
        centerX: 160 * ratio,
        horizontalFit: 0.9,
        headline: { kind: 'straight', text: 'STORM', x: 160 * ratio, y: 164 * ratio, fontSize: 58 * ratio, rotation: 0 },
      };
      paintPremiumTextLayout(context, layout, style);
      return canvas;
    };
    const measurements = [];
    for (const preset of PREMIUM_TEXT_STYLES) {
      const preview = render(preset.id, 320, 384);
      const production = render(preset.id, 1200, 1440);
      const reduced = document.createElement('canvas');
      reduced.width = preview.width;
      reduced.height = preview.height;
      const reducedContext = reduced.getContext('2d', { willReadFrequently: true });
      reducedContext.imageSmoothingEnabled = true;
      reducedContext.imageSmoothingQuality = 'high';
      reducedContext.drawImage(production, 0, 0, reduced.width, reduced.height);
      const a = preview.getContext('2d').getImageData(0, 0, 320, 384).data;
      const b = reducedContext.getImageData(0, 0, 320, 384).data;
      let alphaDifference = 0;
      let colorDifference = 0;
      let foreground = 0;
      let overlap = 0;
      for (let index = 0; index < a.length; index += 4) {
        if (a[index + 3] < 12 && b[index + 3] < 12) continue;
        foreground += 1;
        if (a[index + 3] > 32 && b[index + 3] > 32) overlap += 1;
        alphaDifference += Math.abs(a[index + 3] - b[index + 3]);
        colorDifference += (Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2])) / 3;
      }
      measurements.push({ id: preset.id, foreground, overlap: overlap / Math.max(1, foreground), alphaMean: alphaDifference / Math.max(1, foreground), colorMean: colorDifference / Math.max(1, foreground) });
    }
    return measurements;
  }, moduleUrl);
  for (const sample of results) {
    assert.ok(sample.foreground > 200, `${sample.id}: visible lettering`);
    assert.ok(sample.overlap > 0.75, `${sample.id}: 300 DPI placement/outline matches preview: ${JSON.stringify(sample)}`);
    assert.ok(sample.alphaMean < 47, `${sample.id}: coverage differs at preview/300 DPI: ${JSON.stringify(sample)}`);
    assert.ok(sample.colorMean < 52, `${sample.id}: gradient differs at preview/300 DPI: ${JSON.stringify(sample)}`);
  }
  console.log(`PASS: Chromium preview ↔ 300-DPI pixel parity for all ${results.length} premium text styles.`);
} finally {
  await browser.close();
}
