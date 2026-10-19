import {preparePixels,prepareFieldPixels,parsePhotoText,parseFieldText,STAT_NAMES} from './photo-parser.mjs?v=color-4';
import {readGradeColors} from './photo-color.mjs';
import {recognizePhotoBalance} from './photo-balance.mjs';
export async function recognizeGamePhoto(image,worker,encode,onProgress=()=>{},balanceWorker=null){
 const prepared=preparePixels(image.data,image.width,image.height);
 await worker.setParameters({tessedit_pageseg_mode:'6'});
 const {data}=await worker.recognize(encode(prepared));
 const parsed=parsePhotoText(data.text),fields=parsed.fields;let trait=parsed.trait;
 const colors=readGradeColors(image.data,image.width,image.height,prepared.geometry);
 colors.forEach((color,j)=>{
  if(!color)return;
  const text=fields[j],conflict=text.value!==null&&text.value!==color.value;
  fields[j]={...color,quality:conflict?'review':color.dominance>=.9?'exact':'review',source:'color',raw:color.raw+(conflict?` · 문자 판정 ${text.value}단계와 달라 확인 필요`:'')};
 });
 if(prepared.geometry.wholeGame&&(prepared.geometry.lane||parsed.recognized>=2)){
  await worker.setParameters({tessedit_pageseg_mode:'7'});
  for(let j=0;j<7;j++){
   if(j<6&&colors[j])continue;
   onProgress(j<6?STAT_NAMES[j]:'성향');
   const row=prepareFieldPixels(image.data,image.width,image.height,j),{data:rowData}=await worker.recognize(encode(row));
   const f=parseFieldText(rowData.text,j),old=j<6?fields[j]:trait;
   if(f.value!==null){if(old.value!==null&&old.value!==f.value)f.quality='review';if(j<6)fields[j]=f;else trait=f;}
  }
 }
 let balance={text:'',value:null,quality:'missing',raw:''};
 onProgress('보유 코인');try{balance=await recognizePhotoBalance(image,balanceWorker,encode,prepared.geometry);}catch{}
 return {lane:prepared.geometry.lane,name:parsed.name,fields,trait,balance,raw:data.text,geometry:prepared.geometry};
}
export function photoApplication(records,{allowPartial=false}={}){
 const seen=new Set();
 return records.map(r=>{
  if(!Number.isInteger(r.lane)||r.lane<1||r.lane>6)throw new Error(`${r.fileName||'사진'}: 입력할 번호를 선택하세요.`);
  if(seen.has(r.lane))throw new Error(`${r.lane}번에 사진이 중복돼 있어요. 각 사진의 번호를 확인하세요.`);seen.add(r.lane);
  const missing=r.fields.map((f,i)=>!Number.isInteger(f.value)||f.value<1||f.value>5?STAT_NAMES[i]:null).filter(Boolean);
  if(!r.trait.value)missing.push('성향');
  if(r.fields.length!==6||(!allowPartial&&missing.length))throw new Error(`${r.lane}번: ${missing.join('·')||'능력치'}을(를) 선택하세요. 노란 입력칸에서 사진에 적힌 값을 고르면 됩니다.`);
  return {lane:r.lane,name:r.name,grades:r.fields.map(f=>f.value),trait:r.trait.value,traitPreview:r.traitPreview||'',traitRaw:r.trait.raw||'',traitConfirmed:r.traitConfirmed===true,traitAutomatic:r.traitAutomatic===true};
 });
}
