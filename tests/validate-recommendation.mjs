import fs from 'node:fs';
import assert from 'node:assert/strict';
import {candidateAllocations,chooseRecommendation} from '../dist/recommendation.mjs';
import {allocationMetrics} from '../dist/engine.mjs';
import {normalizeTraitReview,requireTraitReviews,traitReviewMarkup} from '../dist/trait-review.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url),'utf8'));
const race=fixture.distributions.find(c=>c.name==='race26_p0');
const messages=[];globalThis.self={postMessage:x=>messages.push(x)};await import('../dist/worker.mjs');
self.onmessage({data:{id:1,roster:race.roster,stakes:[1000,0,0,1000,0,0],bank:4750,double:true,cutoff:4000,compare:true,limit:50}});
const result=messages.find(x=>x.type==='result');assert.ok(result);assert.ok(result.candidates.length>=1000);
for(const mode of ['growth','gain','protect'])for(const cap of [0,10,25,50,100]){
 const selection=chooseRecommendation(result.candidates,{bank:4750,mode,maxLossPercent:cap,cutoff:4000}),c=selection.choice;
 assert.ok(c,mode+cap);assert.ok(c.max_loss<=4750*cap/100+1e-8);assert.ok(c.invested<=4750);assert.ok(c.expected_gain>0);
}
const protect=chooseRecommendation(result.candidates,{bank:4750,mode:'protect',maxLossPercent:0,cutoff:4000}).choice;
assert.equal(protect.loss_probability,0);assert.ok(protect.minimum>=4750-1e-8);
const allSix=result.candidates.find(c=>c.stakes.every(s=>s===Math.floor(4750/6)));
assert.ok(allSix);assert.equal(allSix.pressure,0);assert.equal(allSix.loss_probability,0);
assert.ok(Math.abs(allSix.expected_final-(Math.floor(4750/6)*6.5+4))<1e-7);
const distinct=candidateAllocations(6751);assert.ok(distinct.every(c=>c.stakes.reduce((a,b)=>a+b,0)<=6751));
assert.ok(distinct.every(c=>c.stakes.every(Number.isInteger)));
const conditional=allocationMetrics({outcomes:[{order:[0,1,2,3,4,5],probability:1}]},Array(6).fill(100),600,false);
assert.ok(Math.abs(conditional.expected_final-450)<1e-9);
const pending=normalizeTraitReview({lane:2,raw:'허방꾼',confirmed:false,preview:'javascript:alert(1)'});
assert.equal(pending.preview,'');assert.throws(()=>requireTraitReviews([pending]),/2번/);
assert.doesNotThrow(()=>requireTraitReviews([{...pending,confirmed:true}]));
const markup=traitReviewMarkup(pending);assert.ok(markup.includes('성향 확인 필요'));assert.ok(markup.includes('data-confirm-trait="2"'));assert.ok(!markup.includes('javascript:'));
console.log(JSON.stringify({recommendation_candidates:result.candidates.length,zero_loss_choice:protect.label,growth:chooseRecommendation(result.candidates,{bank:4750,mode:'growth',maxLossPercent:50,cutoff:4000}).choice.label,trait_confirmation_checked:true}));
