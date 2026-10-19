import {TRAITS} from './engine.mjs';
export const FIELD_NAMES=['스피드','스테미너','파워','근성','지능','컨디션'];
export function missingInputs(grades,traits){
 const missing=[];
 for(let i=0;i<6;i++){
  for(let j=0;j<6;j++)if(!Number.isInteger(grades[i]?.[j])||grades[i][j]<1||grades[i][j]>5)missing.push({lane:i+1,index:j,label:FIELD_NAMES[j],selector:`[data-grade="${i},${j}"]`});
  if(!Object.hasOwn(TRAITS,traits[i]))missing.push({lane:i+1,index:6,label:'성향',selector:`[data-trait="${i}"]`});
 }
 return missing;
}
export function requireCompleteInputs(grades,traits){
 const missing=missingInputs(grades,traits);
 if(missing.length)throw new Error(`미입력 ${missing.length}개: ${missing.map(m=>`${m.lane}번 ${m.label}`).join(', ')}. 빨간 칸에서 값을 선택하세요.`);
}
export function setMissingSelection(select,document){
 if(![...select.options].some(o=>o.value==='')){
  const option=document.createElement('option');option.value='';option.textContent='미적용 · 직접 선택';select.prepend(option);
 }
 select.value='';
}
export function applyPhotoFields(records,document){
 for(const r of records){
  if(!Number.isInteger(r.lane)||r.lane<1||r.lane>6||r.grades.length!==6||r.grades.some(v=>v!==null&&(!Number.isInteger(v)||v<1||v>5))||(r.trait!==null&&!Object.hasOwn(TRAITS,r.trait)))throw new Error('사진 입력값을 확인하세요.');
 }
 for(const r of records){
  const i=r.lane-1;
  r.grades.forEach((v,j)=>{const select=document.querySelector(`[data-grade="${i},${j}"]`);if(v===null)setMissingSelection(select,document);else select.value=String(v);});
  const trait=document.querySelector(`[data-trait="${i}"]`);if(r.trait===null)setMissingSelection(trait,document);else trait.value=r.trait;
  document.querySelector(`[data-name="${i}"]`).value=r.name||`${i+1}번 (사진)`;
 }
}
