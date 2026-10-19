import fs from 'node:fs';
import {createWorker} from 'tesseract.js';
import {preparePixels,prepareFieldPixels,parsePhotoText,parseFieldText} from '../dist/photo-parser.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./ocr-raw/manifest.json',import.meta.url),'utf8'));
const worker=await createWorker('kor',1,{langPath:new URL('../dist/ocr/lang',import.meta.url).pathname,cacheMethod:'none'});
await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
for(const fixture of fixtures){
 const prepared=preparePixels(fs.readFileSync(fixture.path),fixture.width,fixture.height);
 // Leptonica accepts PPM; use the exact same pixel transform as the browser.
 const rgb=Buffer.alloc(prepared.width*prepared.height*3);
 for(let i=0,j=0;i<prepared.data.length;i+=4){rgb[j++]=prepared.data[i];rgb[j++]=prepared.data[i+1];rgb[j++]=prepared.data[i+2];}
 const ppm=Buffer.concat([Buffer.from(`P6\n${prepared.width} ${prepared.height}\n255\n`),rgb]);
 await worker.setParameters({tessedit_pageseg_mode:'6'});
 const {data}=await worker.recognize(ppm);
 const parsed=parsePhotoText(data.text);
 const fields=[];
 if(prepared.geometry.lane){
  await worker.setParameters({tessedit_pageseg_mode:'7'});
  for(let index=0;index<7;index++){
   const p=prepareFieldPixels(fs.readFileSync(fixture.path),fixture.width,fixture.height,index),rgb=Buffer.alloc(p.width*p.height*3);
   for(let i=0,j=0;i<p.data.length;i+=4){rgb[j++]=p.data[i];rgb[j++]=p.data[i+1];rgb[j++]=p.data[i+2];}
   const {data:d}=await worker.recognize(Buffer.concat([Buffer.from(`P6\n${p.width} ${p.height}\n255\n`),rgb]));
   fields.push(parseFieldText(d.text,index));
  }
 }
 console.log(JSON.stringify({name:fixture.name,geometry:prepared.geometry,fields,parsed,text:data.text}));
}
await worker.terminate();
