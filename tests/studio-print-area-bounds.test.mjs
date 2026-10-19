import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { constrainFreePhotoTransform, constrainStickerTransform, constrainTemplateTransform } from '../src/lib/customStudioV2PrintBounds.js';
import { constrainUploadArtworkTransform, resolveUploadArtworkPlacement } from '../src/lib/customStudioV2ArtworkMetrics.js';
import { constrainSeasonalArtworkLayer, fitSeasonalArtwork } from '../src/lib/seasonalArtwork.js';

const eps = 0.0001;
function between(value, min, max) { assert.ok(value >= min - eps && value <= max + eps, `${value} is outside [${min}, ${max}]`); }
function rotatedSize(width, height, angle, aspect = 1) {
  const cos = Math.abs(Math.cos(angle * Math.PI / 180));
  const sin = Math.abs(Math.sin(angle * Math.PI / 180));
  return { w: cos * width + sin * height / aspect, h: cos * height + sin * width * aspect };
}

test('free photos stay entirely within print area at edges and at arbitrary rotation', () => {
  for (const rotation of [-180,-90,-45,0,33,90,137,180]) {
    const zone = { x: 18, y: 14, width: 65, height: 70 };
    const aspect = 0.75;
    const bounded = constrainFreePhotoTransform({scale:220,rotation,canvasX:999,canvasY:-999}, zone, aspect);
    const projected = rotatedSize(zone.width * bounded.scale/100, zone.height * bounded.scale/100, rotation, aspect);
    between(bounded.canvasX - projected.w / 2, 0, 100);
    between(bounded.canvasX + projected.w / 2, 0, 100);
    between(bounded.canvasY - projected.h / 2, 0, 100);
    between(bounded.canvasY + projected.h / 2, 0, 100);
  }
});
test('stickers remain inside print area at 45 and 90 degrees', () => {
  for (const rotation of [-170,-45,0,45,90,170]) {
    const aspect = .75, layer = constrainStickerTransform({scale:85,rotation,x:49,y:-49},aspect);
    const projected = rotatedSize(layer.scale,layer.scale*aspect,rotation,aspect);
    between(50+layer.x-projected.w/2,0,100);
    between(50+layer.x+projected.w/2,0,100);
    between(50+layer.y-projected.h/2,0,100);
    between(50+layer.y+projected.h/2,0,100);
  }
});
test('template respects transparent bounds and never crosses print area when rotated', () => {
  const bounds = {x:18,y:17,width:64,height:69};
  for (const rotation of [-180,-45,0,30,90,135]) {
    const aspect=.75;
    const layer = constrainTemplateTransform({scale:400,rotation,x:-50,y:50},bounds,aspect);
    const theta=rotation*Math.PI/180;
    for (const x of [bounds.x,bounds.x+bounds.width]) for (const y of [bounds.y,bounds.y+bounds.height]) {
      const vx=(x-50)*Math.cos(theta)-(y-50)*Math.sin(theta)/aspect;
      const vy=(x-50)*Math.sin(theta)*aspect+(y-50)*Math.cos(theta);
      between(50+layer.x+vx*layer.scale/100,0,100);
      between(50+layer.y+vy*layer.scale/100,0,100);
    }
  }
});
test('upload artwork clamps physical size, transparent padding, rotation and placement', () => {
  const profile = {widthIn:12,heightIn:16};
  const artwork = {pixelWidth:3600,pixelHeight:4200,sourceWidthIn:24,sourceHeightIn:28,sourceDpi:300,contentBounds:{left:.12,right:.94,top:.08,bottom:.93}};
  for (const rotation of [-180,-60,0,37,90,135]) {
    const safe = constrainUploadArtworkTransform(artwork, profile, {scale:180,x:42,y:-42,rotation});
    const placement = resolveUploadArtworkPlacement(artwork,profile,safe);
    assert.equal(placement.outsideRecommendedArea,false,JSON.stringify({rotation,safe,overflow:placement.overflow}));
    between(safe.scale,1,180);
  }
});
test('seasonal rotated artwork and max width respect the print rectangle', () => {
  const artwork={aspect_ratio:1.2,max_width_in:12,max_height_in:10};
  const area={width:12,height:16};
  for (const rotation of [-135,-45,0,45,90,135]) {
    const safe=constrainSeasonalArtworkLayer({rotation,requested:12,position:{x:10,y:10}},artwork,area);
    const fitted=fitSeasonalArtwork(artwork,area,safe.requested,safe.position.x,safe.position.y);
    const w=fitted.width,h=fitted.height;
    const rad=rotation*Math.PI/180;
    const boundW=Math.abs(w*Math.cos(rad))+Math.abs(h*Math.sin(rad));
    const boundH=Math.abs(w*Math.sin(rad))+Math.abs(h*Math.cos(rad));
    between(fitted.x+w/2-boundW/2,0,area.width);
    between(fitted.x+w/2+boundW/2,0,area.width);
    between(fitted.y+h/2-boundH/2,0,area.height);
    between(fitted.y+h/2+boundH/2,0,area.height);
    assert.ok(fitted.effectiveDpi>=200);
  }
});
test('photo zone placeholders removed; all editors clip preview at garment print boundary', () => {
  const protectedEditor=readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx','utf8');
  assert.doesNotMatch(protectedEditor,/>Photo zone</);
  assert.match(protectedEditor,/constrainFreePhotoTransform/);
  assert.match(protectedEditor,/constrainTemplateTransform/);
  const upload=readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx','utf8');
  assert.match(upload,/constrainUploadArtworkTransform/);
  assert.match(upload,/overflow-hidden rounded-lg border-2 border-dashed/);
  const seasonal=readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx','utf8');
  assert.match(seasonal,/constrainSeasonalArtworkLayer/);
  const production=readFileSync('src/lib/customStudioV2ProtectedProduction.js','utf8');
  assert.match(production,/drawFreePhoto/);
});
