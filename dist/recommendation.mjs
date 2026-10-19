export const RECOMMEND_MODES={growth:'복리 성장 중심',gain:'이번 판 기대수익 중심',protect:'이번 판 잔액 방어'};
export function candidateAllocations(bank,current=[]){
 if(!(bank>0&&Number.isFinite(bank)))throw new Error('보유 코인을 확인하세요.');
 const rows=[],seen=new Set();
 const add=(stakes,label)=>{const key=stakes.join(',');if(seen.has(key))return;seen.add(key);rows.push({stakes,label});};
 add(Array(6).fill(0),'투자 보류');
 for(const fraction of [.05,.1,.15,.2,.25,.3,.35,.4,.45,.5,.6,.7,.75,.8,.9,1]){
  for(let mask=1;mask<64;mask++){
   const lanes=[0,1,2,3,4,5].filter(i=>mask&(1<<i)),per=Math.floor(bank*fraction/lanes.length);
   if(per<1)continue;
   const stakes=Array.from({length:6},(_,i)=>lanes.includes(i)?per:0);
   add(stakes,`${lanes.map(i=>i+1).join('·')}번 · 총 ${Math.round(fraction*100)}%${lanes.length>1?' 동률':''}`);
  }
 }
 if(current.length===6&&current.every(x=>Number.isFinite(x)&&x>=0)&&current.reduce((a,b)=>a+b,0)<=bank*(1+1e-12))add(current,'현재 입력 배분');
 return rows;
}
export function chooseRecommendation(candidates,{bank,mode='growth',maxLossPercent=50,cutoff=0}){
 if(!Object.hasOwn(RECOMMEND_MODES,mode))throw new Error('추천 기준을 확인하세요.');
 if(!(bank>0)||!Number.isFinite(maxLossPercent)||maxLossPercent<0||maxLossPercent>100)throw new Error('보유액·손실 한도를 확인하세요.');
 const cap=bank*maxLossPercent/100,epsilon=bank*1e-12;
 const eligible=candidates.filter(c=>Math.abs(c.bank-bank)<=epsilon&&Math.max(0,c.max_loss)<=cap+epsilon);
 const positive=eligible.filter(c=>c.expected_gain>epsilon);
 const list=positive.length?positive:eligible.filter(c=>c.invested===0);
 const score=(a,b)=>{
  if(mode==='growth')return b.geometric_factor-a.geometric_factor||(b.expected_gain-a.expected_gain)/bank;
  if(mode==='gain')return (b.expected_gain-a.expected_gain)/bank||a.loss_probability-b.loss_probability;
  return (cutoff>0?a.below_cutoff_probability-b.below_cutoff_probability:0)||a.loss_probability-b.loss_probability||Math.max(0,a.max_loss)/bank-Math.max(0,b.max_loss)/bank||(b.expected_gain-a.expected_gain)/bank;
 };
 list.sort((a,b)=>score(a,b)||Math.max(0,a.max_loss)-Math.max(0,b.max_loss));
 return {choice:list[0]||null,mode,mode_label:RECOMMEND_MODES[mode],eligible_count:eligible.length,total_candidates:candidates.length,max_loss_percent:maxLossPercent,max_loss_amount:cap,
  explanation:mode==='growth'?'손실 한도 안에서 로그 성장 기준 배율이 가장 높은 후보입니다.':mode==='gain'?'손실 한도 안에서 이번 판의 기대 순이익이 가장 높은 후보입니다.':cutoff>0?'설정한 최소 잔액 미달 확률을 먼저 줄이고 원금 손실 위험을 비교한 후보입니다.':'원금 손실 확률과 최악 손실을 먼저 줄인 후보입니다.'};
}
