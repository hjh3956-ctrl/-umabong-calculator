import assert from 'node:assert/strict';
import {applyPhotoFields,missingInputs,requireCompleteInputs} from '../dist/input-state.mjs';
import {photoApplication} from '../dist/photo-recognizer.mjs';
const elements=new Map();
const select=value=>({value,options:[1,2,3,4,5].map(v=>({value:String(v)})),prepend(option){this.options.unshift(option);}});
for(let i=0;i<6;i++){
 for(let j=0;j<6;j++)elements.set(`[data-grade="${i},${j}"]`,select('5'));
 elements.set(`[data-trait="${i}"]`,select('NONE'));elements.set(`[data-name="${i}"]`,{value:'old'});
}
const doc={querySelector:key=>elements.get(key),createElement:()=>({value:'',textContent:''})};
const record={lane:2,name:'테스트',fields:[3,3,2,1,4,null].map(value=>({value})),trait:{value:null}};
const partial=photoApplication([record],{allowPartial:true});
assert.equal(partial[0].grades[5],null);assert.equal(partial[0].trait,null);
applyPhotoFields(partial,doc);
assert.equal(elements.get('[data-grade="1,0"]').value,'3');
assert.equal(elements.get('[data-grade="1,5"]').value,'','old condition must be cleared');
assert.equal(elements.get('[data-trait="1"]').value,'','old trait must be cleared');
assert.equal(elements.get('[data-grade="0,0"]').value,'5','other lanes preserved');
const read=()=>({grades:Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>{const v=elements.get(`[data-grade="${i},${j}"]`).value;return v===''?null:Number(v);})),traits:Array.from({length:6},(_,i)=>elements.get(`[data-trait="${i}"]`).value)});
let snapshot=read();assert.equal(missingInputs(snapshot.grades,snapshot.traits).length,2);
assert.throws(()=>requireCompleteInputs(snapshot.grades,snapshot.traits),/2번 컨디션, 2번 성향/);
elements.get('[data-grade="1,5"]').value='1';elements.get('[data-trait="1"]').value='SMART_PLAYER';
snapshot=read();assert.doesNotThrow(()=>requireCompleteInputs(snapshot.grades,snapshot.traits));
assert.equal(missingInputs(snapshot.grades,snapshot.traits).length,0);
console.log('Partial apply: recognized values filled; unknown values blanked; calculation blocked until completed.');
