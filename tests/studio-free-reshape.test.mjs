import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { constrainFreePhotoTransform, constrainStickerTransform, constrainTemplateTransform } from '../src/lib/customStudioV2PrintBounds.js';
import { resolveUploadArtworkPlacement, constrainUploadArtworkTransform } from '../src/lib/customStudioV2ArtworkMetrics.js';
import { constrainSeasonalArtworkLayer, resolveSeasonalReshapedLayout } from '../src/lib/seasonalArtwork.js';

const near = (value, min, max) => assert.ok(value >= min - 0.0005 && value <= max + 0.0005, `${value} outside [${min},${max}]`);
const bounds = (w,h,deg,aspect=1) => {
  const c=Math.abs(Math.cos(deg*Math.PI/180)),s=Math.abs(Math.sin(deg*Math.PI/180));
  return {w:w*c+h*s/aspect,h:h*c+w*s*aspect};
};
test('independent photo width and height stay inside printed rectangle at any rotation', () => {
  for(const rot of [-180,-135,-90,-45,0,30,72,125,180]) {
    const z={x:20,y:17,width:56,height:62}, aspect=.75;
    const t=constrainFreePhotoTransform({scale:800,widthScale:710,heightScale:45,rotation:rot,canvasX:97,canvasY:3},z,aspect);
    const b=bounds(z.width*t.scale*t.widthScale/10000,z.height*t.scale*t.heightScale/10000,rot,aspect);
    near(t.canvasX-b.w/2,0,100);near(t.canvasX+b.w/2,0,100);
    near(t.canvasY-b.h/2,0,100);near(t.canvasY+b.h/2,0,100);
    near(t.widthScale,1,1000);near(t.heightScale,1,1000);
  }
});
test('non-uniform template silhouette never exits print area at rotation', () => {
  const a={x:21,y:18,width:58,height:60}, aspect=.75;
  for(const rot of [-135,-45,0,35,90,153]) {
    const t=constrainTemplateTransform({scale:810,widthScale:430,heightScale:38,rotation:rot,x:-48,y:49},a,aspect);
    const c=Math.cos(rot*Math.PI/180),s=Math.sin(rot*Math.PI/180);
    for(const x of [a.x,a.x+a.width])for(const y of [a.y,a.y+a.height]){
      const px=(x-50)*t.scale*t.widthScale/10000,py=(y-50)*t.scale*t.heightScale/10000;
      near(50+t.x+c*px-s*py/aspect,0,100);near(50+t.y+s*px*aspect+c*py,0,100);
    }
  }
});
test('independent sticker axes remain safe', () => {
  for(const rot of [-120,-40,0,60,145]) {
    const t=constrainStickerTransform({scale:380,widthScale:260,heightScale:60,rotation:rot,x:49,y:-49},.8);
    const b=bounds(t.scale*t.widthScale/100,t.scale*.8*t.heightScale/100,rot,.8);
    near(50+t.x-b.w/2,0,100);near(50+t.x+b.w/2,0,100);
    near(50+t.y-b.h/2,0,100);near(50+t.y+b.h/2,0,100);
  }
});
test('upload path tracks reshaped physical inches and effective resolution', () => {
  const profile={widthIn:12,heightIn:16};
  const artwork={pixelWidth:3600,pixelHeight:4800,sourceDpi:300,sourceWidthIn:12,sourceHeightIn:16,
    contentBounds:{left:0.05,right:0.95,top:0.05,bottom:0.95}};
  const base=resolveUploadArtworkPlacement(artwork,profile,{scale:50,rotation:0,x:0,y:0});
  const reshaped=resolveUploadArtworkPlacement(artwork,profile,{scale:50,widthScale:150,heightScale:40,rotation:0,x:0,y:0});
  assert.ok(reshaped.widthIn>base.widthIn && reshaped.heightIn<base.heightIn);
  for(const rot of [-90,-45,0,37,90,180]) {
    const t=constrainUploadArtworkTransform(artwork,profile,{scale:930,widthScale:810,heightScale:75,rotation:rot,x:42,y:-42});
    const placement=resolveUploadArtworkPlacement(artwork,profile,t);
    assert.equal(placement.outsideRecommendedArea,false,`rotation ${rot}: ${JSON.stringify(placement.overflow)}`);
  }
});
test('seasonal independent height respects print bounds and 200 PPI source floor', () => {
  const artwork={aspect_ratio:1.2,max_width_in:10,max_height_in:8.333333};
  const area={width:12,height:16};
  for(const rot of [-90,-45,0,45,90]) {
    const t=constrainSeasonalArtworkLayer({rotation:rot,requested:12,heightScale:1000,position:{x:10,y:10}},artwork,area);
    const d=resolveSeasonalReshapedLayout(artwork,area,t);
    const b=bounds(d.width,d.height,rot);
    near(d.x+d.width/2-b.w/2,0,area.width);
    near(d.x+d.width/2+b.w/2,0,area.width);
    near(d.y+d.height/2-b.h/2,0,area.height);
    near(d.y+d.height/2+b.h/2,0,area.height);
    assert.ok(d.effectiveDpi>=200,`height source PPI ${d.effectiveDpi} below minimum`);
  }
});
test('all print exporters preserve width-height transforms and preexisting defaults', () => {
  const editor=readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx','utf8');
  const output=readFileSync('src/lib/customStudioV2ProtectedProduction.js','utf8');
  const upload=readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx','utf8');
  const seasonal=readFileSync('src/lib/customStudioV2Production.js','utf8');
  const seasonalEditor=readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx','utf8');
  for(const marker of ['data-gdp-template-free-reshape','data-gdp-photo-free-reshape','Template width','Template height','Photo width','Photo height','Sticker width','Sticker height']) assert.ok(editor.includes(marker),marker);
  assert.match(output,/context\.scale\(userScaleX, userScaleY\)/);
  assert.match(output,/context\.scale\(scaleX, scaleY\)/);
  assert.match(upload,/data-gdp-upload-free-reshape/);
  assert.match(seasonalEditor,/data-gdp-seasonal-free-reshape/);
  assert.match(seasonal,/resolveSeasonalReshapedLayout/);
  const t=constrainTemplateTransform({scale:100,x:0,y:0,rotation:0},{x:20,y:20,width:50,height:60});
  assert.equal(t.widthScale,100);assert.equal(t.heightScale,100);
});
