import assert from 'node:assert/strict';
import {gradesToRow,exactDistribution,allocationMetrics} from '../dist/engine.mjs';
import {bestFullAllocations,compareSameFlags,boostCountDistribution,probabilityText,exactExpectedUpperBound} from '../dist/strategy.mjs';
import {settleForecast,validateOrder,validateHistoryImport,saveForecast} from '../dist/history.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const grades=[[2,4,1,1,2,3],[2,1,4,5,5,1],[3,4,4,2,5,5],[4,5,2,1,3,3],[3,4,1,5,4,3],[4,5,3,1,3,1]];
const traits=['HARD_WORKER','SMART_PLAYER','PHYSICAL_CONTROL','SPEED_CONTROL','COPPYCAT','SUDDEN_START'];
const roster=grades.map((g,i)=>gradesToRow(g,traits[i])),cache=new Map(),get=p=>{if(!cache.has(p))cache.set(p,exactDistribution(roster,p));return cache.get(p);};
const best=bestFullAllocations(get,600,true),h=compareSameFlags(roster,best[1],best[2],true);
assert.deepEqual(best[1].lanes,[3]);assert.deepEqual(best[2].lanes,[3,4]);assert.deepEqual(best[3].lanes,[3,4,5]);
close(best[1].expected_final/600,2.507652744654004);close(best[2].expected_final/600,1.8663322057297598);
close(h.first_more,.71451233411);close(h.second_more,.251252819601);close(h.equal,.034234846289);
close(h.first_more+h.second_more+h.equal,1);close(h.first_mean,best[1].expected_final/600);close(h.second_mean,best[2].expected_final/600);
close(h.conditional.reduce((s,x)=>s+x.probability,0),1);h.conditional.forEach(x=>close(x.ranks.reduce((s,p)=>s+p,0),1));
const q=get(0).boost_probabilities[2];close(h.conditional[0].probability,(1-q)**3);
for(const q of [0,.1,.2,.5,.6,1]){const d=boostCountDistribution(q);close(d.reduce((s,p)=>s+p,0),1);close(d[0],(1-q)**3);close(d[3],q**3);}
assert.equal(probabilityText(.0000001),'<0.01%');assert.equal(probabilityText(0),'모델상 0%');
assert.ok(exactExpectedUpperBound(get,true).factor>=best[1].expected_final/600-1e-9);
const f={input:{bank:600,stakes:best[1].stakes,double:true}};
close(settleForecast(f,[5,3,4,6,2,1],true),900);close(settleForecast({input:{bank:600,stakes:best[2].stakes}},[5,3,4,6,2,1],true),750);
close(settleForecast({input:{bank:600,stakes:[300,300,0,0,0,0]}},[1,2,3,4,5,6],false),1050);
assert.throws(()=>validateOrder([1,1,2,3,4,5]));assert.throws(()=>validateOrder([0,1,2,3,4,5]));
const pair=allocationMetrics({outcomes:[{order:[0,2,3,1,4,5],probability:1}]},[300,300,0,0,0,0],600,true);
assert.equal(pair.loss_probability,0);assert.equal(pair.all_selected_podium_probability,0); // One stake lost despite net profit.
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const snapshot=saveForecast({input:{...f.input,names:[],grades,traits},result:best[1],distribution:get(best[1].pressure)});
f.input.stakes[2]=1;assert.equal(snapshot.input.stakes[2],600); // Frozen before subsequent edits.
assert.equal(validateHistoryImport({schema:'umabong-history-v2',records:[snapshot]}).length,1);
assert.throws(()=>validateHistoryImport({schema:'umabong-history-v2',records:[{...snapshot,id:'" onclick="alert(1)'}]}));
assert.throws(()=>validateHistoryImport({schema:'umabong-history-v2',records:[snapshot,snapshot]}));
// At least two retained physical-control traits use the joint simulator, not separable trajectories.
const joint=Array.from({length:6},(_,i)=>gradesToRow([3,3,3,3,1,3],i%2===0?'PHYSICAL_CONTROL':'DISRUPTER'));
const jget=p=>exactDistribution(joint,p),jbest=bestFullAllocations(jget,600,false),jh=compareSameFlags(joint,jbest[1],jbest[2],false);
close(jh.first_mean,jbest[1].expected_final/600);close(jh.second_mean,jbest[2].expected_final/600);close(jh.first_more+jh.second_more+jh.equal,1);
console.log('Strategies: exact race 36, same-flags comparisons, no-boost cases, shared-counter fallback, payouts and frozen history passed.');
