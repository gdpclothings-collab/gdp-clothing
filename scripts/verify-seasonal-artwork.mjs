import assert from 'node:assert/strict';
import {fitSeasonalArtwork,seasonalSelection} from '../src/lib/seasonalArtwork.js';
let checks=0;
const check=(test)=>{assert.ok(test);checks++;};
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
console.log(`${checks} seasonal sizing and snapshot checks passed`);
