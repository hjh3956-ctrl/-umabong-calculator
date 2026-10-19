import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {recognizePhotoBalance} from '../dist/photo-balance.mjs';
import {screenshotGeometry} from '../dist/photo-parser.mjs';
// Optional screenshot check. Input photos are never bundled with the app.
for(const file of process.argv.slice(2)){
 const size=spawnSync('identify',['-format','%w %h',file],{encoding:'utf8'});if(size.status)throw new Error(size.stderr);
 const [width,height]=size.stdout.split(' ').map(Number),pixels=spawnSync('convert',[file,'-depth','8','rgba:-'],{maxBuffer:32e6});if(pixels.status)throw new Error(String(pixels.stderr));
 const image={width,height,data:pixels.stdout},geometry=screenshotGeometry(image.data,width,height),balance=await recognizePhotoBalance(image,null,null,geometry);
 if(process.env.EXPECTED_BANK)assert.equal(balance.text,process.env.EXPECTED_BANK);
 console.log(JSON.stringify({file:file.split('/').at(-1),text:balance.text,value:balance.value,quality:balance.quality}));
}
