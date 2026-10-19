import {allocationMetrics,effectiveTraits,trajectory,flagsFor,simulate} from './engine.mjs';

export function probabilityText(value){
 if(!Number.isFinite(value))return '—';
 if(value<=0)return '모델상 0%';
 if(value>=1-1e-12)return '모델상 100%';
 if(value<.0001)return '<0.01%';
 return (value*100).toFixed(2)+'%';
}
export function boostCountDistribution(q){
 return [(1-q)**3,3*q*(1-q)**2,3*q*q*(1-q),q**3];
}
export function bestFullAllocations(get,bank,double,cutoff=0){
 const best={};
 for(let mask=1;mask<64;mask++){
  const lanes=[0,1,2,3,4,5].filter(i=>mask&(1<<i));
  const stakes=Array.from({length:6},(_,i)=>lanes.includes(i)?bank/lanes.length:0);
  const pressure=lanes.length===1?lanes[0]+1:0;
  const m={...allocationMetrics(get(pressure),stakes,bank,double,cutoff),lanes:lanes.map(i=>i+1),label:lanes.map(i=>i+1).join('·')+'번'+(lanes.length===1?' 단독':' 동액')};
  if(!best[lanes.length]||m.expected_final>best[lanes.length].expected_final)best[lanes.length]=m;
 }
 return best;
}
export function exactExpectedUpperBound(get,double){
 let best={factor:-Infinity};
 for(let p=0;p<7;p++){
  const coeff=get(p).rank_probabilities.map(x=>(double?4:2)*x[0]+1.5*x[1]+x[2]);
  for(let mask=1;mask<64;mask++){
   const lanes=[0,1,2,3,4,5].filter(i=>mask&(1<<i));
   if(p===0&&lanes.length<2||p>0&&!lanes.includes(p-1))continue;
   const factor=lanes.reduce((s,i)=>s+coeff[i],0)/lanes.length;
   if(factor>best.factor)best={pressure:p,lanes:lanes.map(i=>i+1),factor};
  }
 }
 return {...best,method:'최대 투자 패널티가 고정된 영역의 선형 기대값 상계. 단독 영역의 동률 경계는 실제로 달성되지 않을 수 있음.',attained:best.pressure===0||best.lanes.length===1};
}
function payoff(order,stakes,multipliers,bank){
 return Math.max(0,1-stakes.reduce((a,b)=>a+b,0)/bank)+order.reduce((s,i,r)=>s+stakes[i]/bank*multipliers[r],0);
}
export function compareSameFlags(roster,first,second,double){
 const traits=effectiveTraits(roster),q=roster.map((r,i)=>Math.min(1,Math.max(0,r[4]+(traits[i]==='SMART_PLAYER'?.1:0))));
 const weights=q.map(p=>Array.from({length:8},(_,k)=>flagsFor(k).reduce((s,b)=>s*(b?p:1-p),1)));
 const ps=[...new Set([first.pressure,second.pressure])],fast=traits.filter(t=>t==='PHYSICAL_CONTROL').length<=1;
 const options=new Map(ps.map(p=>[p,fast?roster.map((r,i)=>Array.from({length:8},(_,k)=>trajectory(r,traits[i],flagsFor(k),p===i+1).crossing_tick)):null]));
 const multipliers=[double?4:2,1.5,1,0,0,0],conditional=Array.from({length:8},()=>({mass:0,rank_mass:Array(6).fill(0)}));
 const focus=first.lanes?.length===1?first.lanes[0]-1:null;
 let more=0,less=0,equal=0,total=0,firstMean=0,secondMean=0;
 for(let code=0;code<262144;code++){
  let x=code,w=1;const ks=Array(6);
  for(let i=5;i>=0;i--){ks[i]=x&7;x>>=3;w*=weights[i][ks[i]];}
  if(!w)continue;
  const orders=new Map(ps.map(p=>{
   const a=options.get(p);
   return [p,fast?[0,1,2,3,4,5].sort((i,j)=>a[i][ks[i]]-a[j][ks[j]]||i-j):simulate(roster,ks.map(flagsFor),p).order];
  }));
  const a=payoff(orders.get(first.pressure),first.stakes,multipliers,first.bank),b=payoff(orders.get(second.pressure),second.stakes,multipliers,second.bank);
  total+=w;firstMean+=w*a;secondMean+=w*b;
  if(a>b+1e-10)more+=w;else if(b>a+1e-10)less+=w;else equal+=w;
  if(focus!==null){const c=conditional[ks[focus]];c.mass+=w;c.rank_mass[orders.get(first.pressure).indexOf(focus)]+=w;}
 }
 return {first_more:more/total,second_more:less/total,equal:equal/total,total:1,first_mean:firstMean/total,second_mean:secondMean/total,
  conditional:focus===null?[]:conditional.map((c,k)=>({flags:flagsFor(k),probability:c.mass/total,ranks:c.mass?c.rank_mass.map(x=>x/c.mass):Array(6).fill(0)})),focus_lane:focus===null?null:focus+1};
}
