import {exactDistribution,allocationMetrics,pressureTarget} from './engine.mjs';
import {candidateAllocations} from './recommendation.mjs';
import {bestFullAllocations,compareSameFlags,exactExpectedUpperBound,boostCountDistribution} from './strategy.mjs';
let cachedKey='',cache=new Map();
self.onmessage=({data})=>{
 try {
  const {id,roster,stakes,bank,double,cutoff,compare,limit}=data;
  const key=JSON.stringify(roster);if(key!==cachedKey){cachedKey=key;cache=new Map();}
  const get=p=>{
   if(!cache.has(p)){self.postMessage({id,type:'progress',message:`투자 패널티 ${p?`${p}번`:'없음'} · 262,144조합 계산 중`});cache.set(p,exactDistribution(roster,p));}
   return cache.get(p);
  };
  const pressure=pressureTarget(stakes),distribution=get(pressure);
  const result=allocationMetrics(distribution,stakes,bank,double,cutoff);
  const candidates=[];
  if(compare) {
   for(const {stakes:s,label} of candidateAllocations(bank,stakes)){
    const d=get(pressureTarget(s));candidates.push({...allocationMetrics(d,s,bank,double,cutoff),label});
   }
  }
  self.postMessage({id,type:'progress',message:'단독·반반·세 명 동액의 같은 부스트 조건을 비교 중'});
  const strategies=bestFullAllocations(get,bank,double,cutoff);
  const head_to_head=compareSameFlags(roster,strategies[1],strategies[2],double);
  self.postMessage({id,type:'result',result,distribution:{...distribution,outcomes:undefined},
   candidates,total_candidates:candidates.length,strategies,head_to_head,
   strategy_distributions:Object.fromEntries([1,2,3].map(n=>[n,{...get(strategies[n].pressure),outcomes:undefined}])),
   boost_counts:distribution.boost_probabilities.map(boostCountDistribution),
   expected_upper_bound:exactExpectedUpperBound(get,double)});
 }catch(error){self.postMessage({id:data.id,type:'error',message:error.message});}
};
