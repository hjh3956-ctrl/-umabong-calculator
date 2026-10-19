import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readGradeColors} from '../dist/photo-color.mjs';
import {screenshotGeometry,parseFieldText} from '../dist/photo-parser.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('./ocr-raw/color-manifest.json',import.meta.url),'utf8'));
let correct=0,wrong=0,missing=0,lanes=0;
for(const item of manifest){
 const pixels=fs.readFileSync(item.path),g=screenshotGeometry(pixels,item.width,item.height),values=readGradeColors(pixels,item.width,item.height,g);
 if(g.lane===item.lane)lanes++;
 values.forEach((v,j)=>{if(!v)missing++;else if(v.value===item.grades[j])correct++;else{wrong++;console.log('WRONG',item.name,j,v.value,item.grades[j]);}});
}
assert.equal(wrong,0,'recognized color must never contradict known grades in test set');
assert.equal(missing,0,'all original and test-transformed colors detected');
assert.equal(lanes,manifest.length);
assert.equal(parseFieldText('보통',3).value,3);assert.equal(parseFieldText('포기가 늦음',3).value,4);
const report={passed:true,photos:manifest.length,original_photos:66,test_transformed_photos:manifest.length-66,correct,wrong,missing,lane_matches:lanes,browser_qa:false,checked_at:new Date().toISOString()};
fs.writeFileSync(new URL('../dist/color-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
