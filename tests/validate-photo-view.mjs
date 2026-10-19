import assert from 'node:assert/strict';
import {photoApplication} from '../dist/photo-recognizer.mjs';
// Run the actual UI module and its actual markup function without a browser.
const elements=new Map();
globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,{addEventListener(){},classList:{toggle(){}}});return elements.get(id);}};
globalThis.window={addEventListener(){}};
const {photoCardsMarkup}=await import('../dist/photo-ui.mjs');
const record={fileName:'photo.png',url:'blob:local-test',lane:2,name:'테스트 봉',fields:Array.from({length:6},(_,i)=>({value:i===5?null:3,quality:i===5?'missing':'exact',raw:i===5?'':'보통'})),trait:{value:'SMART_PLAYER',quality:'exact',raw:'스마트 플레이어'},raw:'스피드 보통'};
const html=photoCardsMarkup([record]);
for(const name of ['스피드','스테미너','파워','근성','지능','컨디션','성향'])assert.ok(html.includes(name),name+' must render');
assert.equal((html.match(/data-photo-field=/g)||[]).length,7);
assert.ok(html.includes('data-photo-field="0,5"'));
assert.ok(html.includes('직접 선택하세요'));
assert.throws(()=>photoApplication([record]),/2번: 컨디션/);
const hostile=photoCardsMarkup([{...record,name:'<img src=x onerror=alert(1)>',fileName:'<script>bad</script>'}]);
assert.ok(!hostile.includes('<script>'));assert.ok(!hostile.includes('<img src=x'));
assert.equal((photoCardsMarkup(Array(6).fill(record)).match(/data-photo-field=/g)||[]).length,42);
console.log('Photo review markup: all seven fields and six cards render; missing field named; text escaped.');
