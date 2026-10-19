import {LABELS,TRAITS} from './engine.mjs?v=color-4';
import {recognizeGamePhoto,photoApplication} from './photo-recognizer.mjs?v=photo-bank-7';
import {STAT_NAMES} from './photo-parser.mjs';
import {prepareFieldPixels} from './photo-parser.mjs';
import {traitReviewMarkup,canAutoAcceptTrait} from './trait-review.mjs?v=auto-trait-6';
import {balanceConsensus,selectedPhotoBalance,prepareBalancePixels} from './photo-balance.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ocr=null,initializing=null,running=false,records=[],balanceOverride=null;
const urls=[];
function status(message,error=false){$('photoStatus').textContent=message;$('photoStatus').classList.toggle('error',error);}
function busy(value){running=value;$('photoFiles').disabled=value;$('photoApply').disabled=value||!records.length;$('photoClear').disabled=value;}
async function getOcr(){
 if(ocr)return ocr;
 if(initializing)return initializing;
 initializing=(async()=>{
  status('한글 인식 엔진 준비 중 · 첫 실행에는 약 6MB를 내려받습니다.');
  const {default:Tesseract}=await import('./ocr/tesseract.esm.min.js');
  const base=new URL('./ocr/',import.meta.url);
  ocr=await Tesseract.createWorker('kor',1,{workerPath:new URL('worker.min.js',base).href,corePath:new URL('core/',base).href,langPath:new URL('lang',base).href,workerBlobURL:false,
   logger:m=>{if(m.status?.includes('loading')||m.status?.includes('initializing'))status('한글 인식 엔진 준비 중'+(Number.isFinite(m.progress)?` · ${Math.round(m.progress*100)}%`:''));}});
  await ocr.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'150'});
  return ocr;
 })();
 try{return await initializing;}finally{initializing=null;}
}
function asCanvas(pixels){const canvas=document.createElement('canvas');canvas.width=pixels.width;canvas.height=pixels.height;canvas.getContext('2d').putImageData(new ImageData(pixels.data,pixels.width,pixels.height),0,0);return canvas;}
async function readImage(file){
 const url=URL.createObjectURL(file);urls.push(url);const image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('사진을 열지 못했어요. JPG·PNG 스크린샷으로 선택해 주세요.'));image.src=url;});
 if(image.naturalWidth*image.naturalHeight>32000000)throw new Error('사진이 너무 커요. 휴대폰 스크린샷을 선택해 주세요.');
 const scale=Math.min(1,1100/image.naturalWidth,2500/image.naturalHeight),canvas=document.createElement('canvas');
 canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
 return {url,width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};
}
function cleanName(raw){return raw.replace(/^[^가-힣]+/,'').replace(/^[가-힣]{1,2}[,，)]\s*/,'').replace(/\s*[xX×]\s*$/,'').trim().slice(0,60);}
function render(){
 $('photoReview').hidden=!records.length;$('photoApply').disabled=running||!records.length;
 renderBalanceReview();
 $('photoCards').innerHTML=photoCardsMarkup(records);
 [...$('photoCards').querySelectorAll('.photo-card')].forEach((card,i)=>{
  const r=records[i];
  card.querySelector('.photo-fields').insertAdjacentHTML('afterend',traitReviewMarkup({lane:r.lane||i+1,preview:r.traitPreview,raw:r.trait.raw,confirmed:r.traitConfirmed===true,automatic:r.traitAutomatic===true},i));
 });
}
function renderBalanceReview(){
 const c=balanceConsensus(records),input=$('photoBank');
 input.value=balanceOverride??(c.state==='same'?c.text:'');
 $('photoBankStatus').textContent=balanceOverride!==null?'직접 확인한 금액을 적용합니다. 비워두면 기존 보유 코인을 유지합니다.':c.state==='same'?`사진에서 ${c.text}를 읽었어요. 적용 버튼을 누르면 보유 코인도 채워집니다.`:c.state==='conflict'?'사진마다 보유 코인이 달라요. 사용할 금액을 선택하거나 직접 입력하세요. 비워두면 기존 코인을 유지합니다.':'보유 코인을 확실히 읽지 못했어요. 아래 사진 영역을 확인해 입력하세요. 비워두면 기존 코인을 유지합니다.';
 const unique=[...new Map(records.filter(r=>Number.isFinite(r.balance?.value)).map((r,i)=>[r.balance.value,{r,index:records.indexOf(r)}])).values()];
 $('photoBankChoices').innerHTML=c.state==='conflict'?unique.map(({r,index})=>`<button type="button" class="secondary" data-photo-bank-choice="${index}">${esc(r.balance.text)} · ${esc(r.fileName)}</button>`).join(''):'';
 const preview=records.find(r=>r.balancePreview);
 $('photoBankPreview').innerHTML=preview?`<img src="${esc(preview.balancePreview)}" alt="첫 사진 오른쪽 위의 보유 코인 영역"><small>${esc(preview.fileName)}의 보유 코인 영역</small>`:'';
}
export function photoCardsMarkup(items){
 return items.map((r,index)=>{
  const fields=[...r.fields,r.trait],missing=fields.filter(f=>f.value===null).length,review=fields.some(f=>f.quality!=='exact');
  return `<article class="photo-card"><div class="photo-heading"><img src="${esc(r.url)}" alt="${esc(r.fileName)} 미리보기"><div><strong>${esc(r.fileName)}</strong><p class="${missing?'negative':''}">${missing?`미인식 ${missing}개 · 직접 선택 필요`:review?'추정한 값이 있어요 · 확인 후 적용':'7개 값 인식 완료 · 적용할 수 있어요'}</p><label>입력할 번호<select data-photo-lane="${index}"><option value="">번호 선택</option>${Array.from({length:6},(_,i)=>`<option value="${i+1}" ${r.lane===i+1?'selected':''}>${i+1}번</option>`).join('')}</select></label></div></div><label class="photo-name">캐릭터 이름 · 메모용<input data-photo-name="${index}" value="${esc(r.name)}" maxlength="60" placeholder="인식되지 않으면 비워도 됩니다"></label><div class="photo-fields">${fields.map((f,j)=>`<label class="${f.quality!=='exact'?'needs-review':''}">${j<6?STAT_NAMES[j]:'성향'} <span>${f.quality==='exact'?'읽음':f.value===null?'미인식':'확인 필요'}</span><select data-photo-field="${index},${j}"><option value="">직접 선택하세요</option>${j<6?LABELS[j].map((label,k)=>`<option value="${k+1}" ${f.value===k+1?'selected':''}>${k+1} · ${esc(label)}</option>`).join(''):Object.entries(TRAITS).map(([key,label])=>`<option value="${esc(key)}" ${f.value===key?'selected':''}>${esc(label)}</option>`).join('')}</select><small>인식: ${esc(f.raw||'—')}</small></label>`).join('')}</div><details><summary>인식한 원문 보기</summary><pre>${esc(r.raw)}</pre></details></article>`;
 }).join('');
}
async function analyzeFiles(files){
 if(running)return;
 const list=[...files];if(!list.length)return;
 if(list.length+records.length>6){status('같은 경기의 능력치 사진을 최대 6장까지 선택해 주세요. 기존 목록은 비우고 다시 올릴 수 있어요.',true);return;}
 if(list.some(f=>f.size>20000000)){status('사진 한 장은 20MB 이하로 선택해 주세요.',true);return;}
 busy(true);
 try{
  const worker=await getOcr();
  for(let number=0;number<list.length;number++){
   const file=list[number];status(`${number+1}/${list.length} · ${file.name} 사진 읽는 중`);
   try{
    const image=await readImage(file),parsed=await recognizeGamePhoto(image,worker,asCanvas,label=>status(`${number+1}/${list.length} · ${file.name} · ${label} 읽는 중`));
    const crop=prepareFieldPixels(image.data,image.width,image.height,6),traitPreview=crop?asCanvas(crop).toDataURL('image/png'):'';
    const accepted=canAutoAcceptTrait(parsed.trait);
    const bankCrop=prepareBalancePixels(image.data,image.width,image.height,parsed.geometry),balancePreview=bankCrop?asCanvas(bankCrop).toDataURL('image/png'):'';
    records.push({...parsed,fileName:file.name,url:image.url,name:cleanName(parsed.name),traitPreview,balancePreview,traitConfirmed:accepted,traitAutomatic:accepted});render();
   }catch(error){status(`${file.name}: ${error.message}`,true);}
  }
  const missing=records.reduce((n,r)=>n+r.fields.filter(f=>f.value===null).length+(r.trait.value===null?1:0),0);
  status(records.length?`${records.length}장 인식 완료. ‘입력칸에 적용’을 누르면 읽힌 값은 채워지고${missing?`, 미인식 ${missing}개는 아래 계산기에서 빨간색으로 표시됩니다.`:' 계산기에서 확인할 수 있습니다.'}`:'사진을 인식하지 못했어요. 캐릭터 능력치 창이 열린 스크린샷을 선택해 주세요.',!records.length);
 }catch(error){status('인식 엔진을 준비하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',true);if(ocr){try{await ocr.terminate();}catch{}ocr=null;}}
 finally{busy(false);$('photoFiles').value='';}
}
$('photoFiles').addEventListener('change',e=>analyzeFiles(e.target.files));
function syncPhotoConfirmation(index){
 const check=document.querySelector(`[data-photo-confirm="${index}"]`);if(!check)return;
 const confirmed=records[index].traitConfirmed===true;check.checked=confirmed;
 render();
}
$('photoCards').addEventListener('change',e=>{
 const el=e.target;
 if(el.dataset.photoLane!==undefined)records[Number(el.dataset.photoLane)].lane=Number(el.value)||null;
 if(el.dataset.photoField!==undefined){const [i,j]=el.dataset.photoField.split(',').map(Number),f=j<6?records[i].fields[j]:records[i].trait;f.value=el.value?(j<6?Number(el.value):el.value):null;f.quality='review';if(j===6){records[i].traitConfirmed=!!el.value;records[i].traitAutomatic=false;syncPhotoConfirmation(i);}}
 if(el.dataset.photoConfirm!==undefined){const i=Number(el.dataset.photoConfirm);records[i].traitConfirmed=el.checked;records[i].traitAutomatic=false;syncPhotoConfirmation(i);}
});
$('photoCards').addEventListener('input',e=>{if(e.target.dataset.photoName!==undefined)records[Number(e.target.dataset.photoName)].name=e.target.value;});
$('photoBank').addEventListener('input',e=>{balanceOverride=e.target.value;$('photoBankStatus').textContent=balanceOverride.trim()?'직접 확인한 보유 코인을 적용합니다.':'보유 코인은 자동 적용하지 않고 기존 값을 유지합니다.';});
$('photoBankChoices').addEventListener('click',e=>{const b=e.target.closest('[data-photo-bank-choice]');if(!b)return;balanceOverride=records[Number(b.dataset.photoBankChoice)].balance.text;renderBalanceReview();});
$('photoClear').addEventListener('click',()=>{if(running)return;records=[];balanceOverride=null;urls.splice(0).forEach(u=>URL.revokeObjectURL(u));render();status('사진 목록을 비웠어요. 다음 경기 사진을 선택하세요.');});
$('photoApply').addEventListener('click',()=>{
 if(running)return;
 let detail;try{detail=photoApplication(records,{allowPartial:true});detail.balance=selectedPhotoBalance(records,balanceOverride);}catch(error){
  status(error.message,true);
  if(error.message.includes('보유 코인')){$('photoBank').focus();return;}
  document.querySelector('.photo-details').open=true;
  const index=records.findIndex(r=>!r.lane||r.fields.some(f=>f.value===null)||r.trait.value===null);
  if(index>=0){const r=records[index],field=r.fields.findIndex(f=>f.value===null);const target=!r.lane?document.querySelector(`[data-photo-lane="${index}"]`):document.querySelector(`[data-photo-field="${index},${field>=0?field:6}"]`);target?.scrollIntoView({behavior:'smooth',block:'center'});target?.focus({preventScroll:true});}
  return;
 }
 const event=new CustomEvent('umabong:photo-apply',{cancelable:true,detail});
 if(window.dispatchEvent(event)){
  const missing=detail.reduce((n,r)=>n+r.grades.filter(v=>v===null).length+(r.trait===null?1:0),0);
  status((missing?`읽힌 값을 적용했어요. 미적용 ${missing}개는 아래 계산기의 빨간 칸에서 선택하세요.`:`${records.length}명의 능력치를 적용했어요.`)+(detail.balance?` 보유 코인 ${detail.balance.text}도 적용했어요. 더블 적용 여부를 확인하세요.`:' 보유 코인은 기존 값을 유지했어요. 금액을 직접 확인하세요.'),missing>0);
 }
});
window.addEventListener('beforeunload',()=>{urls.forEach(u=>URL.revokeObjectURL(u));ocr?.terminate();});
status('스탯·컨디션은 글자색으로 우선 판정하고, 성향은 문자를 읽습니다. 사진 한 장에 캐릭터 한 명의 능력치 창을 담아주세요.');
