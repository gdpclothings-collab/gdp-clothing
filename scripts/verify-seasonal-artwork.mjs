import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {fitSeasonalArtwork,seasonalSelection} from '../src/lib/seasonalArtwork.js';
let checks=0;
const check=(test,message='Seasonal verification failed')=>{assert.ok(test,message);checks++;};
const art={id:'fixture',source_sha256:'version1',aspect_ratio:2,max_width_in:8,max_height_in:4,customizable:true};
for(const area of [{width:4,height:5},{width:10,height:11},{width:6,height:7}]){
 for(const width of [0,.1,2,100,-1]){
  const box=fitSeasonalArtwork(art,area,width,999,-50);
  check(box.width<=art.max_width_in&&box.height<=art.max_height_in);
  check(box.x>=0&&box.y>=0&&box.x+box.width<=area.width+.0001&&box.y+box.height<=area.height+.0001);
  check(Math.abs(box.width/box.height-art.aspect_ratio)<.0001);
 }
}
check(fitSeasonalArtwork(null,{width:10,height:10},5)===null);
check(fitSeasonalArtwork({...art,aspect_ratio:NaN},{width:10,height:10},5)===null);
const layout=fitSeasonalArtwork(art,{width:10,height:10},5);
const configured=seasonalSelection(art,layout,{name:'Sam',message:'Hello',color:'#ffffff'},{width:10,height:10});
check(configured.name==='Sam'&&configured.source_sha256==='version1'&&configured.width===5);
check(seasonalSelection({...art,customizable:false},layout,{name:'Sam',message:'Hello'},{width:10,height:10}).name==='');
check(seasonalSelection(art,layout,{name:'a'.repeat(100),message:'b'.repeat(100),color:'red'},{width:10,height:10}).name.length===32);
check(seasonalSelection(art,layout,{name:'',message:'b'.repeat(100),color:'red'},{width:10,height:10}).text_color==='#111111');

// Protect the customer-visible Cart -> Edit design -> restore -> replace flow.
const studioSource = readFileSync(new URL('../src/components/storefront/SeasonalStudio.jsx', import.meta.url), 'utf8');
const cartSource = readFileSync(new URL('../src/pages/Cart.jsx', import.meta.url), 'utf8');
const sourceCheck = (source, fragment, message) => check(source.includes(fragment), message);

sourceCheck(studioSource, "initialDraft?.artworkId", 'Seasonal Studio must consume the saved artwork id.');
sourceCheck(studioSource, "setRequested(Number(initialDraft.width || 0))", 'Seasonal Studio must restore saved artwork sizing.');
sourceCheck(studioSource, "setPosition(initialDraft.position || { x: 0, y: 0 })", 'Seasonal Studio must restore saved artwork position.');
sourceCheck(studioSource, "setRotation(Number(initialDraft.rotation || 0))", 'Seasonal Studio must restore saved artwork rotation.');
sourceCheck(studioSource, "setText(initialDraft.text ||", 'Seasonal Studio must restore saved personalization.');
sourceCheck(studioSource, "if (editCartKey) replaceItem(editCartKey, cartItem)", 'Editing a saved design must replace the same cart item.');
sourceCheck(studioSource, "approvedPreviewRef", 'Seasonal Studio must keep a dedicated approved mockup capture frame.');
sourceCheck(studioSource, "seasonalSummary", 'Seasonal cart items must retain structured production details.');
sourceCheck(cartSource, "state={{ seasonalDraft: item.seasonalDraft, editCartKey: item.key }}", 'Cart Edit design must pass the exact saved seasonal draft and cart key.');
sourceCheck(cartSource, 'fittingType="contain"', 'Custom cart previews must remain uncropped.');

// Protect the refined personalization UX without changing production payload limits.
sourceCheck(studioSource, 'Personalize this design', 'Personalization controls must keep the guided editing card.');
sourceCheck(studioSource, 'maxLength={32}', 'Name input must preserve the 32-character production limit.');
sourceCheck(studioSource, 'maxLength={60}', 'Message input must preserve the 60-character production limit.');
sourceCheck(studioSource, '<textarea id="seasonal-personalization-message"', 'Personalization message should remain a multi-line editing control.');
sourceCheck(studioSource, 'Clear personalization', 'Customers must be able to clear optional personalization in one action.');
sourceCheck(studioSource, 'Recommended', 'Personalization text colours must surface a recommended contrast choice.');
sourceCheck(studioSource, 'hasLowContrast', 'Personalization controls must warn when the chosen text colour may have weak garment contrast.');
sourceCheck(studioSource, 'Applied to garment preview', 'Personalization controls must confirm live preview application.');
check(!studioSource.includes('<select value={text.color}'), 'Text colour should use visual choices instead of the old native select.');

console.log(`${checks} seasonal sizing, snapshot, edit-design, and personalization regression checks passed`);
