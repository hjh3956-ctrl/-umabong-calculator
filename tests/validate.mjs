import fs from 'node:fs';
import assert from 'node:assert/strict';
import {simulate,exactDistribution,allocationMetrics,parseAmount,goalMath,pressureTarget,amountInput} from '../dist/engine.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url),'utf8'));
const close=(a,b,epsilon=1e-10)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
let traceLogs=0,maxError=0;
for(const c of fixture.traces){
 const result=simulate(c.roster,c.flags,c.pressure,true);
 assert.deepEqual(result.final_rank,c.ranks,c.name);
 assert.deepEqual(result.logs,c.logs,c.name+' complete trace');traceLogs+=c.logs.length;
}
for(const c of fixture.distributions){
 const result=exactDistribution(c.roster,c.pressure),expected=c.expected;
 assert.deepEqual(result.effective_traits,expected.effective_traits,c.name+' traits');
 const got=new Map(result.outcomes.map(o=>[o.order.map(i=>i+1).join(','),o.probability]));
 assert.equal(got.size,expected.orders.length,c.name+' order count');
 for(let i=0;i<expected.orders.length;i++){
  const actual=got.get(expected.orders[i].join(','));assert.notEqual(actual,undefined,c.name);
  maxError=Math.max(maxError,Math.abs(actual-expected.probabilities[i]));close(actual,expected.probabilities[i]);
 }
 for(let i=0;i<6;i++)for(let r=0;r<6;r++)close(result.rank_probabilities[i][r],expected.rank_probabilities[i][r]);
}
assert.equal(traceLogs,fixture.native_log_count);
assert.equal(parseAmount('200D'),200e12);assert.equal(parseAmount('6.75A'),6750);assert.equal(parseAmount('1e15'),1e15);
assert.equal(parseAmount('1,000'),1000);assert.equal(parseAmount('1F'),1e18);
for(const value of ['-1','NaN','0x99','Infinity','200DD','x'])assert.throws(()=>parseAmount(value));
for(const v of [0,2375,1e18,200e12])close(parseAmount(amountInput(v))/Math.max(1,v),v/Math.max(1,v));
assert.equal(pressureTarget([200,200,0,0,0,0]),0);assert.equal(pressureTarget([200,200,200,0,0,0]),0);assert.equal(pressureTarget([201,200,0,0,0,0]),1);
for(const [order,payout] of [[[0,2,3,4,5,1],800],[[2,0,3,4,5,1],300],[[2,3,0,4,5,1],200],[[2,3,4,0,1,5],0]]){
 const d={outcomes:[{order,probability:1}]};
 const result=allocationMetrics(d,[200e12,200e12,0,0,0,0],766.6e12,true,766.6e12);
 close(result.expected_final/1e12,366.6+payout,1e-9);
}
const r26=fixture.distributions.find(c=>c.name==='race26_p0');
const distribution=exactDistribution(r26.roster,0);
const metric=allocationMetrics(distribution,[1000,0,0,1000,0,0],4750,true,0);
close(metric.expected_final,5997.36325,.001);close(metric.loss_probability,.33889870812425493);
const scaled=allocationMetrics(distribution,[200e12,0,0,200e12,0,0],950e12,true,0);
close(scaled.loss_probability,metric.loss_probability);close(scaled.expected_final/scaled.bank,metric.expected_final/metric.bank);
assert.throws(()=>allocationMetrics(distribution,[200,200,0,0,0,0],100));
const goal=goalMath(6750,15e12,19);close(goal.required_factor,3.104103428484184);assert.equal(goal.perfect_wins,16);
// Exercise the actual Worker handler under Node, including all comparison candidates.
const messages=[];globalThis.self={postMessage:x=>messages.push(x)};
await import('../dist/worker.mjs');
self.onmessage({data:{id:1,roster:r26.roster,stakes:[1000,0,0,1000,0,0],bank:4750,double:true,cutoff:4000,compare:true,limit:50}});
const response=messages.find(x=>x.type==='result');assert.ok(response);assert.ok(response.candidates.length>=1000);
close(response.result.expected_final,metric.expected_final);
const report={model_version:'2026-10-18.1',passed:true,distribution_cases:fixture.distributions.length,trace_cases:fixture.traces.length,complete_trace_logs:traceLogs,maximum_order_probability_error:maxError,worker_comparison_candidates:response.candidates.length,browser_qa:false,browser_qa_reason:'control-browser capability unavailable in managed environment',checked_at:new Date().toISOString()};
fs.writeFileSync(new URL('../dist/validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
