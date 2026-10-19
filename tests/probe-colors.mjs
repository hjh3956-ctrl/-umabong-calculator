import fs from 'node:fs';
import {readGradeColors} from '../dist/photo-color.mjs';
import {screenshotGeometry} from '../dist/photo-parser.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('./ocr-raw/color-manifest.json',import.meta.url),'utf8'));
let correct=0,wrong=0,missing=0,lanes=0;
for(const item of manifest){
 const data=fs.readFileSync(item.path),geometry=screenshotGeometry(data,item.width,item.height),values=readGradeColors(data,item.width,item.height,geometry);
 if(geometry.lane===item.lane)lanes++;
 values.forEach((v,j)=>{if(!v)missing++;else if(v.value===item.grades[j])correct++;else wrong++;});
 if(values.some((v,j)=>!v||v.value!==item.grades[j])||geometry.lane!==item.lane)console.log(JSON.stringify({file:item.name,lane:geometry.lane,top:geometry.contentTop,expected:item.grades,actual:values.map(v=>v?.value??null)}));
}
console.log(JSON.stringify({photos:manifest.length,correct,wrong,missing,lane_matches:lanes}));
