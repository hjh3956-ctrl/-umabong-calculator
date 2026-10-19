import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createWorker} from 'tesseract.js';
import {recognizeGamePhoto,photoApplication} from '../dist/photo-recognizer.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./ocr-raw/manifest.json',import.meta.url),'utf8'));
const expected=[
 [1,1,2,1,3,5,'HARD_WORKER'],[3,3,2,1,4,1,'DISRUPTER'],[3,3,1,2,4,1,'SMART_PLAYER'],
 [5,4,1,1,3,4,'PHYSICAL_CONTROL'],[4,5,2,5,2,2,'SPEED_CONTROL'],[1,3,5,2,4,1,'COPPYCAT']
];
const encode=p=>{
 const rgb=Buffer.alloc(p.width*p.height*3);
 for(let i=0,j=0;i<p.data.length;i+=4){rgb[j++]=p.data[i];rgb[j++]=p.data[i+1];rgb[j++]=p.data[i+2];}
 return Buffer.concat([Buffer.from(`P6\n${p.width} ${p.height}\n255\n`),rgb]);
};
const worker=await createWorker('kor',1,{langPath:new URL('../dist/ocr/lang',import.meta.url).pathname,cacheMethod:'none'});
await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'150'});
let correct=0,missing=0,wrong=0;const results=[];
try{
 for(let i=0;i<fixtures.length;i++){
  const fixture=fixtures[i],result=await recognizeGamePhoto({...fixture,data:fs.readFileSync(fixture.path)},worker,encode);
  if(i<6){
   assert.equal(result.lane,i+1,'lane '+fixture.name);
   [...result.fields,result.trait].forEach((f,j)=>{
    if(f.value===null)missing++;
    else if(f.value===expected[i][j])correct++;
    else wrong++;
   });
   results.push(result);
  }else {
   assert.equal(result.lane,null,'mission screen must not select a lane');
   assert.equal(result.fields.filter(f=>f.value!==null).length,0,'non-stat screen');
  }
  console.log(fixture.name+': '+JSON.stringify({lane:result.lane,values:[...result.fields,result.trait].map(f=>f.value)}));
 }
 assert.equal(wrong,0,'no incorrect recognized values in supplied six-photo fixture');
 assert.ok(correct>=40);
 if(missing)assert.throws(()=>photoApplication(results),'missing fields must block strict application');
 else assert.equal(photoApplication(results).length,6);
 const completed=structuredClone(results);completed.forEach((r,i)=>r.fields.forEach((f,j)=>{if(f.value===null)f.value=expected[i][j];}));
 assert.equal(photoApplication(completed).length,6);
 assert.throws(()=>photoApplication([completed[0],completed[0]]),'duplicate lanes must block application');
 const report={passed:true,sample_photos:6,fields_total:42,recognized_correct:correct,missing_requires_manual_input:missing,recognized_incorrect:wrong,lane_matches:6,non_stat_screen_rejected:true,browser_qa:false,checked_at:new Date().toISOString()};
 fs.writeFileSync(new URL('../dist/photo-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await worker.terminate();}
