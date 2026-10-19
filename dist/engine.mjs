// Web mirror of the independently verified float32 Android race model.
// Normal fresh-race start; not a live seed reader or server implementation.
export const MODEL_VERSION = '2026-10-18.1';
export const TRAITS = {
  NONE:'없음', SUDDEN_START:'급가속', PHYSICAL_CONTROL:'체력조절',
  SPEED_CONTROL:'완급조절', COPPYCAT:'흉내쟁이', 'SUPER_ GRIT':'초근성',
  HIGH_SPEED:'하이스피드', SMART_PLAYER:'스마트 플레이어', DISRUPTER:'훼방꾼',
  HARD_WORKER:'대기만성', PRESSURE_IMMUNITY:'압박 면역 (고급 입력)'
};
export const LABELS = [
 ['느림','조금 느림','보통','빠름','매우 빠름'],
 ['서있기 힘듦','조금 약함','보통','강함','매우 강함'],
 ['매우 허약함','허약함','보통','조금 강함','힘이 넘침'],
 ['포기했음','포기가 빠름','보통','포기가 늦음','포기를 모름'],
 ['예능 적합','머리는 좋으나 노력하지 않음','보통','영리함','매우 영리함'],
 ['매우 나쁨','나쁨','보통','좋음','매우 좋음']
];
export function gradesToRow(grades,trait='NONE') {
  return [grades[0]+4,grades[1],.5+.5*grades[2],grades[3]-8,
    grades[4]/10,(grades[5]-3)/2,trait];
}
export function effectiveTraits(roster) {
 const original=roster.map(r=>r[6]);
 return original.map((tr,i)=>{
  if([i-1,i+1].some(j=>j>=0&&j<6&&original[j]!=='DISRUPTER')) tr='';
  if(tr==='COPPYCAT')tr=original[(i+5)%6];
  return tr;
 });
}
export const flagsFor = k => [(k>>2)&1,(k>>1)&1,k&1];
const F=Math.fround;
export function trajectory(row,trait,flags,pressure=false) {
 let [s,a,p,g,,c]=row;
 c=F(c-(pressure&&trait!=='PRESSURE_IMMUNITY'?.5:0));
 a=F(a+c);p=F(p+c);g=F(g+c);
 if(trait==='SUPER_ GRIT')g=F(g+1);
 if(trait==='SUDDEN_START')a=F(a-2);
 let position=0,activated=false,counter=1;const logs=[];
 for(let tick=1;tick<=100;tick++) {
  const cap=F(s+c),phase=position<33?0:position<66?1:2;
  let raw=F(F(tick*p)+4);const atCap=cap<=raw;
  if(atCap){raw=cap;if(trait==='HIGH_SPEED'&&!activated){s++;activated=true;}}
  if(trait==='SUDDEN_START')raw=F(raw+4);
  let remaining;
  if(trait==='PHYSICAL_CONTROL'){remaining=atCap?F(a-counter):0;if(atCap)counter++;}
  else remaining=F(a-F(tick));
  remaining=Math.max(0,remaining);
  if(remaining<=0)raw=F(cap+g);
  const speed=F(Math.max(4,raw)+2*flags[phase]);position=F(position+speed);
  logs.push({idx:0,tick,speed,stamina:remaining,position});
  if(position>=100)return {crossing_tick:tick,crossing_distance:position,logs};
 }
 throw new Error('주행 계산 상한 초과');
}
export function simulate(roster,flags,pressure=0,trace=false) {
 const tr=effectiveTraits(roster),condition=roster.map((r,i)=>F(r[5]-(pressure===i+1&&tr[i]!=='PRESSURE_IMMUNITY'?.5:0)));
 const speed=roster.map(r=>r[0]);
 const stamina=roster.map((r,i)=>F(r[1]+condition[i]-(tr[i]==='SUDDEN_START'?2:0)));
 const power=roster.map((r,i)=>F(r[2]+condition[i]));
 const guts=roster.map((r,i)=>F(r[3]+condition[i]+(tr[i]==='SUPER_ GRIT'?1:0)));
 const position=new Float32Array(6),ranks=new Uint8Array(6),activated=new Uint8Array(6);
 let nextRank=1,counter=1;const logs=[];
 for(let tick=1;tick<=100;tick++) {
  if(ranks.every(x=>x>0))return {order:[0,1,2,3,4,5].sort((a,b)=>ranks[a]-ranks[b]),final_rank:[...ranks],position:[...position],logs,effective_traits:tr};
  for(let i=0;i<6;i++) {
   if(ranks[i])continue;
   if(nextRank===6){ranks[i]=6;continue;}
   if(position[i]>=100)ranks[i]=nextRank++;
   const cap=F(speed[i]+condition[i]);let raw=F(F(tick*power[i])+4);const atCap=cap<=raw;
   raw=Math.min(cap,raw);
   if(tr[i]==='HIGH_SPEED'&&atCap&&!activated[i]){speed[i]++;activated[i]=1;}
   if(tr[i]==='SUDDEN_START')raw=F(raw+4);
   let remaining;
   if(tr[i]==='PHYSICAL_CONTROL'){remaining=atCap?F(stamina[i]-counter):0;if(atCap)counter++;}
   else remaining=F(stamina[i]-F(tick));
   remaining=Math.max(0,remaining);
   if(remaining<=0)raw=F(cap+guts[i]);
   const phase=position[i]<33?0:position[i]<66?1:2;
   const velocity=F(Math.max(4,raw)+2*flags[i][phase]);
   position[i]=F(position[i]+velocity);
   if(trace)logs.push({idx:i+1,tick,speed:velocity,stamina:remaining,position:position[i]});
  }
 }
 throw new Error('주행 계산 상한 초과');
}
export function exactDistribution(roster,pressure=0) {
 const traits=effectiveTraits(roster),wisdom=roster.map((r,i)=>Math.min(1,Math.max(0,r[4]+(traits[i]==='SMART_PLAYER'?.1:0))));
 const weights=wisdom.map(q=>Array.from({length:8},(_,k)=>flagsFor(k).reduce((w,b)=>w*(b?q:1-q),1)));
 const separate=traits.filter(t=>t==='PHYSICAL_CONTROL').length<=1;
 const options=separate?roster.map((row,i)=>Array.from({length:8},(_,k)=>trajectory(row,traits[i],flagsFor(k),pressure===i+1).crossing_tick)):null;
 const combinations=new Map();
 const ks=new Uint8Array(6),order=new Uint8Array(6),ticks=new Uint8Array(6);
 for(let code=0;code<262144;code++) {
  let left=code,probability=1;
  for(let i=5;i>=0;i--){ks[i]=left&7;left>>=3;probability*=weights[i][ks[i]];}
  if(!probability)continue;
  if(separate) {
   for(let i=0;i<6;i++)ticks[i]=options[i][ks[i]];
   for(let i=0;i<6;i++){
    let j=i;while(j>0&&ticks[order[j-1]]>ticks[i]){order[j]=order[j-1];j--;}
    order[j]=i;
   }
  } else order.set(simulate(roster,[...ks].map(flagsFor),pressure).order);
  let key=0;for(let i=5;i>=0;i--)key=key*6+order[i];
  const old=combinations.get(key);
  if(old)old.probability+=probability;
  else combinations.set(key,{order:[...order],probability});
 }
 const outcomes=[...combinations.values()];
 const rankProbabilities=Array.from({length:6},()=>Array(6).fill(0));
 for(const o of outcomes)o.order.forEach((lane,rank)=>rankProbabilities[lane][rank]+=o.probability);
 return {pressure,effective_traits:traits,boost_probabilities:wisdom,rank_probabilities:rankProbabilities,outcomes,enumerated:262144};
}
export function pressureTarget(stakes) {
 const top=Math.max(...stakes);if(top<=0)return 0;
 const ix=stakes.map((v,i)=>v===top?i+1:0).filter(Boolean);
 return ix.length===1?ix[0]:0;
}
export function allocationMetrics(distribution,stakes,bank,double=true,cutoff=0) {
 if(!(bank>0)||stakes.some(v=>!Number.isFinite(v)||v<0))throw new Error('금액을 확인하세요.');
 let invested=stakes.reduce((a,b)=>a+b,0);
 if(invested>bank*(1+1e-12))throw new Error('투자 합계가 보유 코인을 초과해요.');
 const frac=stakes.map(x=>x/bank),held=Math.max(0,1-invested/bank),mult=[double?4:2,1.5,1,0,0,0];
 const selected=stakes.map((s,i)=>s>0?i:-1).filter(i=>i>=0);
 let expected=0,loss=0,shortfall=0,half=0,minimum=Infinity,maximum=-Infinity,allPodium=0,bothOut=0,below=0,highestWin=0,allInWin=0,logGrowth=0;
 const payoutBins=new Map(),top=Math.max(...stakes);
 for(const {order,probability:p} of distribution.outcomes) {
  const end=held+order.reduce((s,lane,r)=>s+frac[lane]*mult[r],0),delta=end-1;
  expected+=p*end;minimum=Math.min(minimum,end);maximum=Math.max(maximum,end);
  if(delta< -1e-12){loss+=p;shortfall-=p*delta;}
  if(end<=.5+1e-12)half+=p;
  if(end<cutoff/bank-1e-12)below+=p;
  if(selected.length&&selected.every(i=>order.indexOf(i)<3))allPodium+=p;
  if(selected.length&&selected.every(i=>order.indexOf(i)>=3))bothOut+=p;
  if(top>0&&stakes[order[0]]===top)highestWin+=p;
  if(selected.length===1&&held<=1e-12&&order[0]===selected[0])allInWin+=p;
  if(end<=0)logGrowth=-Infinity;else if(logGrowth!==-Infinity)logGrowth+=p*Math.log(end);
  const key=end.toFixed(12);const old=payoutBins.get(key);
  if(old)old.probability+=p;else payoutBins.set(key,{multiple:end,probability:p});
 }
 return {stakes,bank,held:held*bank,invested,pressure:pressureTarget(stakes),expected_final:expected*bank,expected_gain:(expected-1)*bank,
  loss_probability:loss,expected_shortfall:shortfall*bank,conditional_loss:loss>0?shortfall*bank/loss:0,
  half_bank_loss_probability:half,minimum:minimum*bank,maximum:maximum*bank,max_loss:(1-minimum)*bank,
  all_selected_podium_probability:allPodium,all_selected_outside_probability:bothOut,below_cutoff_probability:below,
  highest_investment_win_probability:highestWin,all_in_win_probability:allInWin,geometric_factor:logGrowth===-Infinity?0:Math.exp(logGrowth),
  payout_bins:[...payoutBins.values()].sort((a,b)=>a.multiple-b.multiple)};
}
export function parseAmount(raw) {
 const s=String(raw).trim().replace(/,/g,'');
 if(!s)return 0;
 const m=s.match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([A-Z])?$/i);
 if(!m)throw new Error('금액은 6750, 6.75A, 200D처럼 입력하세요.');
 const value=Number(m[1])*(m[2]?1000**(m[2].toUpperCase().charCodeAt(0)-64):1);
 if(!Number.isFinite(value)||value<0)throw new Error('금액 범위를 확인하세요.');
 return value;
}
export function formatAmount(value) {
 if(!Number.isFinite(value))return '—';
 const sign=value<0?'−':'';let x=Math.abs(value),level=0;
 while(x>=1000&&level<26){x/=1000;level++;}
 return sign+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:3}).format(x)+(level?String.fromCharCode(64+level):'');
}
export function amountInput(value) {
 if(!Number.isFinite(value)||value<0)throw new Error('잘못된 금액');
 return value.toPrecision(15).replace(/(?:\.0+|(?:(\.[0-9]*?)0+))(?=e|$)/,'$1');
}
export function goalMath(bank,target,rounds) {
 if(!(bank>0&&target>0&&Number.isInteger(rounds)&&rounds>=1))throw new Error('현재 코인·목표 코인·남은 경기 수를 확인하세요.');
 return {ratio:target/bank,required_factor:Math.exp(Math.log(target/bank)/rounds),maximum:bank*4**rounds,
  perfect_wins:Math.max(0,Math.ceil(Math.log(target/bank)/Math.log(4))),two_way_maximum:bank*2.75**rounds};
}
