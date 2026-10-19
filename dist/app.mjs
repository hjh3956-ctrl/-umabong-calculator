import {MODEL_VERSION,TRAITS,LABELS,gradesToRow,parseAmount,formatAmount,amountInput,pressureTarget,goalMath} from './engine.mjs?v=color-4';
import {missingInputs,requireCompleteInputs,setMissingSelection,applyPhotoFields} from './input-state.mjs';
import {chooseRecommendation} from './recommendation.mjs';
import {traitReviewMarkup,normalizeTraitReview,requireTraitReviews} from './trait-review.mjs?v=auto-trait-6';
import {renderDashboard} from './dashboard.mjs';
import {renderHistory,saveForecast} from './history.mjs';
import {applyPhotoBalance} from './photo-balance.mjs';
const $=id=>document.getElementById(id),pct=n=>(n*100).toFixed(2)+'%',fmt=formatAmount;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PRESETS={
 race26:{names:['훈련봉','역전의 용사 봉식','권왕 봉식','프로즌 프린세스.봉','드래곤 나이트 [블루]','천계의 기사'],
  grades:[[1,1,2,1,3,5],[3,3,2,1,4,1],[3,3,1,2,4,1],[5,4,1,1,3,4],[4,5,2,5,2,2],[1,3,5,2,4,1]],
  traits:['HARD_WORKER','DISRUPTER','SMART_PLAYER','PHYSICAL_CONTROL','SPEED_CONTROL','COPPYCAT'],bank:4750,stakes:[1000,0,0,1000,0,0]},
 race25:{names:['봉식머신 MK.5 [블루]','일렉트로봉','토끼공듀','드래곤 나이트 [라이트]','위치 봉순','흑염룡 마스터 봉'],
  grades:[[5,1,5,2,3,2],[4,1,4,1,5,3],[5,5,1,4,1,1],[3,3,4,3,3,1],[2,5,2,1,5,3],[1,4,3,2,3,3]],
  traits:['SUDDEN_START','SPEED_CONTROL','PHYSICAL_CONTROL','HIGH_SPEED','DISRUPTER','COPPYCAT'],bank:2750,stakes:[0,1000,0,0,1000,0]},
 neutral:{names:Array.from({length:6},(_,i)=>`${i+1}번 캐릭터`),grades:Array.from({length:6},()=>[3,3,3,3,3,3]),traits:Array(6).fill('NONE'),bank:100,stakes:Array(6).fill(0)}
};
let last=null,candidates=[],worker=null,requestId=0,busy=false,dirty=true,recommended=null,activeRunner=0;
const traitReviews=new Map();
function showStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function chooseTab(tab){
 if(!['calculator','guide','goal','history'].includes(tab))tab='calculator';
 document.querySelectorAll('.tab-panel').forEach(el=>el.hidden=el.id!==tab);
 document.querySelectorAll('[data-tab]').forEach(el=>{el.classList.toggle('active',el.dataset.tab===tab);el.setAttribute('aria-current',el.dataset.tab===tab?'page':'false');});
 if(tab==='history')renderHistory($('historyContent'));
}
document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{location.hash=el.dataset.tab;}));
document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>chooseTab(el.dataset.open)));
window.addEventListener('hashchange',()=>chooseTab(location.hash.slice(1)));chooseTab(location.hash.slice(1));
function renderRunners(s) {
 const statNames=['스피드','스테미너','파워','근성','지능','컨디션'];
 $('runners').innerHTML=s.names.map((name,i)=>`<article class="runner" data-lane="${i}"><div class="runner-head"><span class="lane">${i+1}</span><input data-name="${i}" aria-label="${i+1}번 이름" maxlength="60" value="${esc(name)}"></div><div class="stats-grid">${statNames.map((label,j)=>`<label>${label}<select data-grade="${i},${j}" aria-label="${i+1}번 ${label}">${LABELS[j].map((text,g)=>`<option value="${g+1}" ${s.grades[i][j]===g+1?'selected':''}>${g+1} · ${esc(text)}</option>`).join('')}</select></label>`).join('')}<label style="grid-column:1/-1">성향<select data-trait="${i}" aria-label="${i+1}번 성향">${Object.entries(TRAITS).map(([key,label])=>`<option value="${key}" ${key===s.traits[i]?'selected':''}>${esc(label)}</option>`).join('')}</select></label></div><div class="runner-bottom"><label>투자할 코인<input data-stake="${i}" aria-label="${i+1}번 투자액" value="${amountInput(s.stakes[i])}" inputmode="decimal" autocomplete="off"></label><div class="quick"><button data-share="${i},0">0</button><button data-share="${i},.1">10%</button><button data-share="${i},.25">25%</button><button data-share="${i},.5">50%</button></div></div></article>`).join('');
}
function getInput(allowMissing=false){
 const names=[],grades=[],traits=[],stakes=[];
 for(let i=0;i<6;i++){
  names.push(document.querySelector(`[data-name="${i}"]`).value.trim()||`${i+1}번`);
  grades.push(Array.from({length:6},(_,j)=>{const value=document.querySelector(`[data-grade="${i},${j}"]`).value;return value===''?null:Number(value);}));
  traits.push(document.querySelector(`[data-trait="${i}"]`).value);
  stakes.push(parseAmount(document.querySelector(`[data-stake="${i}"]`).value));
 }
 if(!allowMissing){requireCompleteInputs(grades,traits);requireTraitReviews([...traitReviews.values()]);}
 const bank=parseAmount($('bank').value),cutoff=parseAmount($('cutoff').value),double=$('double').checked;
 if(!(bank>0))throw new Error('현재 보유 코인을 0보다 크게 입력하세요.');
 if(stakes.reduce((a,b)=>a+b,0)>bank*(1+1e-12))throw new Error('투자 합계가 현재 보유 코인을 초과했어요.');
 return {names,grades,traits,stakes,bank,cutoff,double,traitReviews:[...traitReviews.values()],roster:missingInputs(grades,traits).length?null:grades.map((g,i)=>gradesToRow(g,traits[i]))};
}
function budget(){
 try{
  const s=getInput(true),invested=s.stakes.reduce((a,b)=>a+b,0),p=pressureTarget(s.stakes);
  $('budgetStatus').textContent=`투자 ${fmt(invested)} / 보유 ${fmt(s.bank)} · 미투자 ${fmt(Math.max(0,s.bank-invested))}`;
  $('budgetStatus').classList.remove('negative');
  $('walletSummary').textContent=`현재 보유 ${fmt(s.bank)} · 입력값 기준`;
  $('recommendLossAmount').textContent=`선택한 한도의 금액: ${fmt(s.bank*Number($('recommendLimit').value)/100)}`;
  $('pressureStatus').textContent=p?`단독 최고 투자: ${p}번 → 컨디션 −0.5 (적용 성향이 압박 면역이면 제외)`:'단독 최고 투자 패널티 없음 · 동률이어도 탈락 시 코인 손실 가능';
  try{localStorage.setItem('umabong-input-v1',JSON.stringify(s));}catch{}
 }catch(e){$('budgetStatus').textContent=e.message;$('budgetStatus').classList.add('negative');$('pressureStatus').textContent='금액을 수정한 뒤 계산하세요.';}
}
function markIncomplete(){
 const missing=[];
 document.querySelectorAll('[data-grade],[data-trait]').forEach(select=>{
  const empty=select.value==='',label=select.closest('label');label.classList.toggle('input-missing',empty);select.setAttribute('aria-invalid',String(empty));
  let note=label.querySelector('.field-error');
  if(empty){if(!note){note=document.createElement('small');note.className='field-error';label.append(note);}note.textContent='미적용 · 이 칸에서 직접 선택하세요';missing.push(select);}
  else note?.remove();
 });
 const issue=$('inputIssues');issue.hidden=!missing.length;issue.textContent=missing.length?`사진에서 미적용된 항목 ${missing.length}개가 있습니다. 빨간 칸에서 사진에 적힌 값을 선택하면 계산할 수 있어요.`:'';
 return missing;
}
function changed(){dirty=true;$('staleNote').hidden=!last;$('recommendStale').hidden=!last;$('applyRecommendation').disabled=!!last;$('dashboardStale').hidden=!last;$('saveForecast').disabled=true;document.querySelectorAll('#decisionDashboard button').forEach(b=>b.disabled=true);markIncomplete();budget();updateRunnerTabs();}
function renderTraitReviews(){
 document.querySelectorAll('.runner .trait-verification').forEach(el=>el.remove());
 for(const review of traitReviews.values()){
  const runner=document.querySelector(`[data-lane="${review.lane-1}"]`);
  if(runner)runner.insertAdjacentHTML('beforeend',traitReviewMarkup(review));
  document.querySelector(`[data-trait="${review.lane-1}"]`)?.closest('label').classList.toggle('trait-unconfirmed',!review.confirmed);
 }
}
function runnerChanged(e){
 const el=e.target;
 if(el.dataset.trait!==undefined){const review=traitReviews.get(Number(el.dataset.trait)+1);if(review){review.confirmed=!!el.value;review.automatic=false;renderTraitReviews();}}
 if(el.dataset.confirmTrait!==undefined){const review=traitReviews.get(Number(el.dataset.confirmTrait));if(review){review.confirmed=el.checked;review.automatic=false;renderTraitReviews();}}
 changed();
}
$('runners').addEventListener('input',runnerChanged);
$('runners').addEventListener('change',runnerChanged);
for(const id of ['bank','cutoff','double'])$(id).addEventListener('input',()=>{if(id==='bank')$('bankSource').textContent='직접 입력한 보유 코인입니다.';changed();});
$('runners').addEventListener('click',e=>{
 const el=e.target.closest('[data-share]');if(!el)return;
 try{const [i,f]=el.dataset.share.split(',').map(Number);document.querySelector(`[data-stake="${i}"]`).value=amountInput(parseAmount($('bank').value)*f);changed();}catch(err){showStatus(err.message,true);}
});
function load(s){$('bankSource').textContent='사진 적용 시 자동 입력 · 직접 수정할 수 있어요.';renderRunners(s);traitReviews.clear();for(const raw of s.traitReviews||[]){const review=normalizeTraitReview(raw);if(review)traitReviews.set(review.lane,review);}for(let i=0;i<6;i++){for(let j=0;j<6;j++)if(s.grades[i][j]===null)setMissingSelection(document.querySelector(`[data-grade="${i},${j}"]`),document);if(!s.traits[i])setMissingSelection(document.querySelector(`[data-trait="${i}"]`),document);}renderTraitReviews();$('bank').value=amountInput(s.bank);$('cutoff').value=amountInput(s.cutoff||0);$('double').checked=s.double!==false;changed();}
$('loadPreset').addEventListener('click',()=>{load(PRESETS[$('preset').value]);showStatus('지난 경기 예시를 불러왔어요. 현재 경기와 구분해 주세요.');});
$('clearStakes').addEventListener('click',()=>{document.querySelectorAll('[data-stake]').forEach(el=>el.value='0');changed();});
function metric(label,value,note,highlight=false,negative=false){return `<div class="metric ${highlight?'highlight':''}"><p>${esc(label)}</p><strong class="${negative?'negative':''}">${esc(value)}</strong><small>${esc(note)}</small></div>`;}
function renderResult(data,s){
 const r=data.result,d=data.distribution;last={...data,input:s,calculated_at:new Date().toISOString()};dirty=false;
 $('resultSection').hidden=false;$('staleNote').hidden=true;
 $('resultPressure').textContent=r.pressure?`${r.pressure}번 단독 최고 투자 패널티 반영`:'동률 또는 투자 없음 · 패널티 없음';
 $('metrics').innerHTML=metric('기대 순이익',(r.expected_gain>=0?'+':'')+fmt(r.expected_gain),'확률 가중 평균 · 확정 수익 아님',true,r.expected_gain<0)+metric('원금 손실 확률',pct(r.loss_probability),'경기 후 총 잔액 < 경기 전 보유액')+metric('최악의 코인 손실',fmt(Math.max(0,r.max_loss)),`보유액의 ${pct(Math.max(0,r.max_loss)/s.bank)}`,false,r.max_loss>0)+metric('최소 잔액 미달 확률',s.cutoff>0?pct(r.below_cutoff_probability):'미설정',s.cutoff>0?`기준 ${fmt(s.cutoff)} 미만으로 끝날 확률`:'위 입력에서 지킬 금액을 설정하세요');
 const maxp=Math.max(...r.payout_bins.map(x=>x.probability));
 $('payouts').innerHTML=r.payout_bins.map(x=>`<div class="payout ${x.multiple<1-1e-12?'loss':''}"><span class="value">${esc(fmt(x.multiple*s.bank))}</span><div class="payout-track"><span style="width:${x.probability/maxp*100}%"></span></div><span>${pct(x.probability)}</span></div>`).join('');
 const details=[['기대 경기 후 잔액',fmt(r.expected_final)],['미투자 코인',fmt(r.held)],['전체 판 기준 평균 손실액',fmt(r.expected_shortfall)],['손실이 났을 때 평균 손실',r.loss_probability>0?fmt(r.conditional_loss):'손실 경우 없음'],['보유액 절반 이상 손실 확률',pct(r.half_bank_loss_probability)],['선택 캐릭터 모두 입상',pct(r.all_selected_podium_probability)],['선택 캐릭터 모두 탈락',pct(r.all_selected_outside_probability)],['최고 투자 캐릭터 우승',pct(r.highest_investment_win_probability)],['단일 전액 투자 우승',pct(r.all_in_win_probability)],['가능한 최저 잔액',fmt(r.minimum)],['로그 성장 기준 배율',r.geometric_factor.toFixed(3)+'배']];
 $('details').innerHTML=details.map(([a,b])=>`<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('');
 $('rankRows').innerHTML=d.rank_probabilities.map((rp,i)=>`<tr><td><span class="lane">${i+1}</span>${esc(s.names[i])}${s.stakes[i]>0?`<span class="sub">투자 ${esc(fmt(s.stakes[i]))}</span>`:''}</td><td>${pct(rp[0])}</td><td>${pct(rp[1])}</td><td>${pct(rp[2])}</td><td>${pct(rp.slice(3).reduce((a,b)=>a+b,0))}</td><td>${pct(d.boost_probabilities[i])}</td><td>${esc(TRAITS[d.effective_traits[i]]||'적용 없음')}<span class="sub">입력: ${esc(TRAITS[s.traits[i]])}</span></td></tr>`).join('');
 if(data.candidates.length){candidates=data.candidates;renderComparison();}
 else if(candidates.length){candidates=[];renderComparison();}
 renderRecommendation();
 renderDecision();$('saveForecast').disabled=false;
 showStatus(`계산 완료 · 실제 난수값을 사용하지 않은 전수 확률 · ${new Date().toLocaleTimeString('ko-KR')}`);
}
function setBusy(value){busy=value;$('calculate').disabled=value;$('compare').disabled=value;}
function calculate(compare=true){
 if(busy)return;
 let s;try{s=getInput();}catch(e){showStatus(e.message,true);const missing=markIncomplete(),unconfirmed=document.querySelector('.trait-verification.pending');const target=missing[0]||unconfirmed;if(target){activateRunner(Number(target.closest('[data-lane]').dataset.lane));target.scrollIntoView({behavior:'smooth',block:'center'});if(missing[0])missing[0].focus({preventScroll:true});}return;}
 if(!worker){
  try{worker=new Worker(new URL('./worker.mjs?v=github-2',import.meta.url),{type:'module'});}catch(e){showStatus('계산 엔진을 열지 못했어요. 브라우저에서 사이트 링크로 접속해 주세요.',true);return;}
 }
 const id=++requestId;setBusy(true);showStatus('계산을 시작합니다. 입력한 능력치의 모든 부스터 조합을 확인해요.');
 worker.onmessage=({data})=>{
  if(data.id!==requestId)return;
  if(data.type==='progress'){showStatus(data.message);return;}
  setBusy(false);
  if(data.type==='error'){showStatus(data.message,true);return;}
  renderResult(data,s);
  $('decisionDashboard').scrollIntoView({behavior:'smooth',block:'start'});
  // Edits made during a long computation must not be mislabeled as current.
  try{if(JSON.stringify(getInput())!==JSON.stringify(s))changed();}catch{changed();}
 };
 worker.onerror=()=>{setBusy(false);showStatus('계산 엔진 오류가 발생했어요. 페이지를 새로 열고 다시 시도해 주세요.',true);worker.terminate();worker=null;};
 worker.postMessage({...s,id,compare,limit:Number($('limit').value)});
}
$('calculate').addEventListener('click',()=>calculate(true));$('compare').addEventListener('click',()=>calculate(true));
function renderRecommendation(){
 if(!last||!candidates.length){$('recommendation').hidden=true;return;}
 const s=last.input,selection=chooseRecommendation(candidates,{bank:s.bank,mode:$('recommendMode').value,maxLossPercent:Number($('recommendLimit').value),cutoff:s.cutoff});
 recommended=selection.choice;$('recommendation').hidden=false;$('recommendStale').hidden=!dirty;$('applyRecommendation').disabled=dirty||!recommended;
 $('recommendTitle').textContent=`${fmt(s.bank)} 기준 · ${selection.mode_label}`;
 $('recommendBasis').textContent=`${selection.total_candidates}개 후보 중 최악 손실 ${selection.max_loss_percent}% (${fmt(selection.max_loss_amount)}) 이하 ${selection.eligible_count}개를 비교했습니다.`;
 if(!recommended){$('recommendAmounts').textContent='조건에 맞는 배분이 없습니다.';$('recommendMetrics').innerHTML='';return;}
 const selected=recommended.stakes.map((amount,i)=>({amount,i})).filter(x=>x.amount>0);
 $('recommendAmounts').innerHTML=(selected.length?selected.map(x=>`<div class="recommend-amount"><span>${x.i+1}번 · ${esc(s.names[x.i])}</span><strong>${esc(fmt(x.amount))}</strong><span>보유액의 ${pct(x.amount/s.bank)}</span></div>`).join(''):'<div class="recommend-amount"><strong>투자 보류</strong></div>')+`<div class="recommend-amount reserve"><span>남길 코인</span><strong>${esc(fmt(recommended.held))}</strong><span>총 투자 ${esc(fmt(recommended.invested))}</span></div>`;
 $('recommendMetrics').innerHTML=metric('기대 순이익',(recommended.expected_gain>=0?'+':'')+fmt(recommended.expected_gain),'추천 배분 기준',false,recommended.expected_gain<0)+metric('원금 손실 확률',pct(recommended.loss_probability),'수익 보장 아님')+metric('최악 손실',fmt(Math.max(0,recommended.max_loss)),`최저 잔액 ${fmt(recommended.minimum)}`)+metric('최소 잔액 미달',s.cutoff>0?pct(recommended.below_cutoff_probability):'미설정',s.cutoff>0?`기준 ${fmt(s.cutoff)}`:'위에서 최소 잔액을 설정하세요.');
 $('recommendReason').textContent=selection.explanation+` ${recommended.pressure?recommended.pressure+'번 단독 최고 투자 패널티를 반영했습니다.':'동률 배분으로 단독 최고 투자 패널티는 없습니다.'}`;
}
function setRecommendationLimit(value){
 $('recommendLimit').value=String(value);$('limit').value=String(value);$('recommendLimitLabel').textContent=value+'% · 직접 조정 가능';$('limitLabel').textContent=value+'%';budget();renderComparison();renderRecommendation();if(!dirty)renderDecision();saveRecommendationSettings();
}
function saveRecommendationSettings(){try{localStorage.setItem('umabong-recommend-settings-v2',JSON.stringify({mode:$('recommendMode').value,limit:Number($('recommendLimit').value)}));}catch{}}
$('recommendMode').addEventListener('change',()=>{renderRecommendation();if(!dirty)renderDecision();saveRecommendationSettings();});
$('recommendLimit').addEventListener('input',()=>setRecommendationLimit(Number($('recommendLimit').value)));
$('applyRecommendation').addEventListener('click',()=>{if(dirty||!recommended){showStatus('현재 입력으로 다시 계산한 뒤 추천을 적용하세요.',true);return;}recommended.stakes.forEach((amount,i)=>document.querySelector(`[data-stake="${i}"]`).value=amountInput(amount));changed();calculate(true);});
function renderComparison(){
 const limit=Number($('limit').value)/100,key=$('sort').value,ascending=['loss_probability','below_cutoff_probability'].includes(key);
 const list=candidates.filter(x=>x.max_loss<=x.bank*limit+x.bank*1e-12).sort((a,b)=>((ascending?1:-1)*(a[key]-b[key]))||a.max_loss-b.max_loss);
 $('compareNote').textContent=candidates.length?`${candidates.length}개 후보 중 최악 손실 ${Math.round(limit*100)}% 이하 ${list.length}개 · 상위 15개 표시. 입력한 후보 범위의 비교이며 전체 투자 비율의 최적해를 보장하지 않습니다.`:'배분 후보 계산을 눌러 비교하세요.';
 $('compareRows').innerHTML=list.slice(0,15).map(x=>`<tr><td>${esc(x.label)}<span class="sub">미투자 ${esc(fmt(x.held))}</span></td><td class="${x.expected_gain<0?'negative':'positive'}">${x.expected_gain>=0?'+':''}${esc(fmt(x.expected_gain))}</td><td>${pct(x.loss_probability)}</td><td>${esc(fmt(Math.max(0,x.max_loss)))}</td><td>${last?.input.cutoff>0?pct(x.below_cutoff_probability):'미설정'}</td><td><button class="secondary apply" data-apply="${esc(JSON.stringify(x.stakes))}">적용</button></td></tr>`).join('')||'<tr><td colspan="6">조건에 맞는 후보가 없습니다. 후보 계산 또는 손실 한도를 확인하세요.</td></tr>';
}
$('limit').addEventListener('input',()=>setRecommendationLimit(Number($('limit').value)));$('sort').addEventListener('change',renderComparison);
$('compareRows').addEventListener('click',e=>{const el=e.target.closest('[data-apply]');if(!el)return;if(dirty){showStatus('입력이 변경됐어요. 배분 후보 계산을 다시 눌러 주세요.',true);return;}JSON.parse(el.dataset.apply).forEach((v,i)=>document.querySelector(`[data-stake="${i}"]`).value=amountInput(v));changed();calculate(true);});
function download(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('saveInput').addEventListener('click',()=>{try{download({schema:'umabong-calculator-v1',model_version:MODEL_VERSION,input:getInput()},'umabong-input.json');}catch(e){showStatus(e.message,true);}});
$('export').addEventListener('click',()=>{if(!last)return;download({schema:'umabong-calculator-v1',model_version:MODEL_VERSION,input:last.input,calculated_at:last.calculated_at,result:last.result,distribution:last.distribution,not_a_future_seed_read:true,inputs_changed_since_calculation:dirty},'umabong-calculation.json');});
function validateImport(s,allowMissing=false){
 if(!s||!Array.isArray(s.names)||s.names.length!==6||!Array.isArray(s.grades)||s.grades.length!==6||!Array.isArray(s.traits)||s.traits.length!==6||!Array.isArray(s.stakes)||s.stakes.length!==6)throw new Error('6명 입력이 있는 계산기 JSON 파일을 선택하세요.');
 if(s.names.some(x=>typeof x!=='string'||x.length>60)||s.grades.some(g=>!Array.isArray(g)||g.length!==6||g.some(v=>!(allowMissing&&v===null)&&(!Number.isInteger(v)||v<1||v>5)))||s.traits.some(t=>!(allowMissing&&t==='')&&!Object.hasOwn(TRAITS,t))||s.stakes.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(s.bank)||s.bank<=0||s.stakes.reduce((a,b)=>a+b,0)>s.bank*(1+1e-12)||!Number.isFinite(s.cutoff||0)||s.cutoff<0||typeof s.double!=='boolean')throw new Error('입력 파일의 능력치·금액·광고 설정을 확인하세요.');
 return s;
}
$('import').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>2e6)throw new Error('입력 JSON은 2MB 이하 파일을 선택하세요.');const data=JSON.parse(await f.text());load(validateImport(data.input));showStatus('입력을 불러왔어요. 계산 버튼으로 다시 확인하세요.');}catch(error){showStatus(error.message,true);}finally{e.target.value='';}});
function updateGoal(){
 try{
  const bank=parseAmount($('goalBank').value),target=parseAmount($('goalTarget').value)*Number($('goalMultiplier').value),n=Number($('goalRounds').value);
  if(n>1000)throw new Error('경기 수는 1~1000으로 입력하세요.');
  const r=goalMath(bank,target,n);
  $('goalResult').innerHTML=`<div class="metric-grid">${metric('가정한 마감 목표',fmt(target),'현재 목표 × 선택한 상승 가정')}${metric('필요한 경기당 성장',r.required_factor.toFixed(3)+'배','손실까지 포함한 잔액의 기하평균')}${metric('전액 1등·4배 최소 횟수',r.perfect_wins+'경기','한 번도 손실 없이 4배가 될 때')}</div><p class="notice">${r.required_factor>4?'입력한 경기 수로는 매번 전액 1등·광고 4배를 받아도 목표에 못 미칩니다.':r.required_factor>2.75?'입력한 횟수 동안 전 재산을 동률 2분할하고 매번 1·2등을 맞혀도 목표에 못 미칩니다.':'이론적인 배율 상한 안에 있습니다. 목표에 도달할 성공 확률을 계산한 결과는 아닙니다.'}</p><p class="muted">전액 단일 1등·4배를 모두 성공했을 때의 이론 상한: ${esc(fmt(r.maximum))}. 미래 경기 능력치·실제 부스터·마감 커트라인은 반영되지 않았습니다.</p>`;
 }catch(e){$('goalResult').textContent=e.message;}
}
$('goalCalculate').addEventListener('click',updateGoal);
const missions=[['최고 투자 캐릭터 1등',0,30],['최고 투자 캐릭터 1등',0,50],['단일 캐릭터 전액 투자 후 1등',0,10],['티켓 사용',0,70],['광고 시청',0,70]];
$('missionRows').innerHTML=missions.map(([label,current,target],i)=>`<tr><td>${esc(label)}</td><td><input class="mission-input" data-mission="${i}" type="number" min="0" max="999999" value="${current}" aria-label="${esc(label)} 현재 횟수"></td><td>${target}회</td><td id="mission-${i}">${Math.max(0,target-current)}회</td></tr>`).join('');
$('missionRows').addEventListener('input',e=>{if(e.target.dataset.mission===undefined)return;const i=Number(e.target.dataset.mission),v=Number(e.target.value);$(`mission-${i}`).textContent=Number.isInteger(v)&&v>=0?Math.max(0,missions[i][2]-v)+'회':'횟수 확인';});
PRESETS.neutral.grades=Array.from({length:6},()=>Array(6).fill(null));PRESETS.neutral.traits=Array(6).fill('');PRESETS.neutral.double=false;PRESETS.neutral.bank=100;
let initial=PRESETS.neutral;
try{const saved=JSON.parse(localStorage.getItem('umabong-input-v1'));if(saved)initial=validateImport(saved,true);}catch{}
load(initial);updateGoal();
try{const settings=JSON.parse(localStorage.getItem('umabong-recommend-settings-v2'));if(settings&&['growth','gain','protect'].includes(settings.mode)&&Number.isFinite(settings.limit)&&settings.limit>=0&&settings.limit<=100){$('recommendMode').value=settings.mode;setRecommendationLimit(settings.limit);}}catch{}
window.addEventListener('umabong:photo-apply',event=>{
 try{
  applyPhotoFields(event.detail,document);
  applyPhotoBalance(event.detail.balance,$('bank'),$('bankSource'));
  for(const record of event.detail){const review=normalizeTraitReview({lane:record.lane,preview:record.traitPreview,raw:record.traitRaw,confirmed:record.traitConfirmed===true,automatic:record.traitAutomatic===true});if(review)traitReviews.set(review.lane,review);}
  renderTraitReviews();changed();
  const missing=markIncomplete();
  const pending=[...traitReviews.values()].filter(r=>!r.confirmed).length;
  showStatus(missing.length?`읽힌 값은 적용됐어요. 미적용 ${missing.length}개를 빨간 칸에서 선택하세요.`:pending?`성향 ${pending}개를 확대 사진과 비교해 확인하거나 직접 수정한 뒤 계산하세요.`:'사진에서 확인한 능력치를 적용했어요. 현재 코인·투자액을 확인하고 계산하세요.',missing.length>0||pending>0);
  const target=missing[0]||document.querySelector('.trait-verification.pending')||document.querySelector(`[data-lane="${event.detail[0]?.lane-1||0}"]`);if(target){activateRunner(Number(target.closest('[data-lane]').dataset.lane));target.scrollIntoView({behavior:'smooth',block:'center'});}
 }catch(error){event.preventDefault();showStatus(error.message,true);}
});
import('./photo-ui.mjs?v=photo-bank-7').catch(()=>{document.getElementById('photoStatus').textContent='사진 입력 모듈을 열지 못했어요. 새로고침 후 다시 시도해 주세요.';});
fetch('./validation.json').then(r=>r.ok?r.json():Promise.reject()).then(v=>{$('validationStatus').textContent=`웹 회귀 검증 ${v.distribution_cases}개 확률 분포 · ${v.trace_cases}개 전체 주행 통과`}).catch(()=>{$('validationStatus').textContent='모델 기준 2026-10-18';});
function renderDecision(){
 if(!last?.strategies)return;
 $('dashboardStale').hidden=true;
 renderDashboard($('decisionDashboard'),{...last,recommended,recommendationMode:$('recommendMode').value},m=>{
  if(dirty){showStatus('입력이 바뀌었습니다. 다시 계산해 주세요.',true);return;}
  m.stakes.forEach((v,i)=>document.querySelector(`[data-stake="${i}"]`).value=amountInput(v));changed();calculate(true);
 });
}
function activateRunner(i){activeRunner=i;document.querySelectorAll('.runner').forEach((r,n)=>r.classList.toggle('runner-active',n===i));document.querySelectorAll('[data-runner-tab]').forEach((b,n)=>{b.classList.toggle('active',n===i);b.setAttribute('aria-selected',String(n===i));});}
function updateRunnerTabs(){if(!$('runnerTabs'))return;$('runnerTabs').innerHTML=Array.from({length:6},(_,i)=>{const empty=[...document.querySelectorAll(`[data-lane="${i}"] [data-grade],[data-lane="${i}"] [data-trait]`)].some(x=>x.value==='');return `<button type="button" role="tab" data-runner-tab="${i}" aria-selected="${i===activeRunner}" class="${i===activeRunner?'active':''}">${i+1}번<span>${empty?'입력 필요':'입력 완료'}</span></button>`;}).join('');activateRunner(activeRunner);}
$('runnerTabs').addEventListener('click',e=>{const b=e.target.closest('[data-runner-tab]');if(b)activateRunner(Number(b.dataset.runnerTab));});
$('saveForecast').addEventListener('click',()=>{try{if(dirty||!last)throw new Error('현재 입력으로 먼저 계산하세요.');const row=saveForecast(last);$('forecastSaveStatus').textContent=`경기 전 예측 저장 완료 · ${new Date(row.created_at).toLocaleTimeString('ko-KR')}`;renderHistory($('historyContent'));}catch(e){$('forecastSaveStatus').textContent=e.message;}});
$('newRace').addEventListener('click',()=>{let bank=100;try{bank=parseAmount($('bank').value)||100;}catch{}if(worker){worker.terminate();worker=null;}requestId++;setBusy(false);last=null;candidates=[];recommended=null;load({...PRESETS.neutral,bank});$('decisionDashboard').hidden=true;$('resultSection').hidden=true;$('dashboardStale').hidden=true;$('forecastSaveStatus').textContent='';$('photoClear').click();activateRunner(0);showStatus('새 경기입니다. 사진을 올리고 더블 적용 여부를 확인하세요.');window.scrollTo({top:0,behavior:'smooth'});});
updateRunnerTabs();
renderHistory($('historyContent'));
