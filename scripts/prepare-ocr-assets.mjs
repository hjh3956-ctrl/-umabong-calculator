// Vendor the pinned browser OCR runtime and models onto this same Site.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'dist/ocr');
fs.mkdirSync(path.join(out,'core'),{recursive:true});fs.mkdirSync(path.join(out,'lang'),{recursive:true});
for(const f of ['tesseract.esm.min.js','worker.min.js','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])fs.copyFileSync(path.join(root,'node_modules/tesseract.js/dist',f),path.join(out,f));
fs.copyFileSync(path.join(root,'node_modules/tesseract.js/LICENSE.md'),path.join(out,'LICENSE-tesseract.txt'));
for(const f of fs.readdirSync(path.join(root,'node_modules/tesseract.js-core'))){
 if(f.endsWith('.wasm.js')||f==='LICENSE')fs.copyFileSync(path.join(root,'node_modules/tesseract.js-core',f),path.join(out,'core',f));
}
for(const lang of ['kor','eng'])fs.copyFileSync(path.join(root,`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`),path.join(out,'lang',lang+'.traineddata.gz'));
console.log('Pinned OCR browser runtime, four core variants and Korean/English models prepared.');
