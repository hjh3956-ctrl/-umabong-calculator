import {TRAITS} from './engine.mjs?v=color-4';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function canAutoAcceptTrait(trait){
 return !!trait&&Object.hasOwn(TRAITS,trait.value)&&trait.quality==='exact';
}
export function traitReviewTitle(review){
 return !review.confirmed?'성향 확인 필요':review.automatic?'성향 자동 입력 완료':'성향 입력 완료';
}
export function normalizeTraitReview(raw){
 if(!raw||!Number.isInteger(raw.lane)||raw.lane<1||raw.lane>6)return null;
 const preview=typeof raw.preview==='string'&&raw.preview.length<500000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw.preview)?raw.preview:'';
 return {lane:raw.lane,confirmed:raw.confirmed===true,automatic:raw.confirmed===true&&raw.automatic===true,preview,raw:typeof raw.raw==='string'?raw.raw.slice(0,200):''};
}
export function requireTraitReviews(reviews){
 const pending=reviews.filter(r=>!r.confirmed);
 if(pending.length)throw new Error(`성향 확인 필요: ${pending.map(r=>r.lane+'번').join(', ')}. 확대 사진과 비교해 체크하거나 성향을 직접 수정하세요.`);
}
export function traitReviewMarkup(raw,photoIndex=null){
 const review=normalizeTraitReview(raw);if(!review)return '';
 const attr=photoIndex===null?`data-confirm-trait="${review.lane}"`:`data-photo-confirm="${photoIndex}"`;
 const evidence=`${review.preview?`<img class="trait-preview" src="${review.preview}" alt="${review.lane}번 사진의 성향 글자 확대">`:'<p class="muted">확대 이미지가 없습니다. 업로드한 원본 사진에서 성향을 확인하세요.</p>'}<small>문자 인식: ${esc(review.raw||'읽지 못함')}</small><label class="check"><input type="checkbox" ${attr} ${review.confirmed?'checked':''}>이 성향을 계산에 사용</label>`;
 return `<div class="trait-verification ${review.confirmed?'confirmed':'pending'}"><strong>${traitReviewTitle(review)}</strong>${review.automatic?`<p>성향 이름이 정확히 일치해 자동 입력했어요. 별도 확인 없이 계산할 수 있고, 선택값은 수정할 수 있어요.</p><details><summary>인식한 사진과 값 보기</summary>${evidence}</details>`:`<p>${review.confirmed?'선택한 성향으로 계산합니다. 필요하면 직접 수정하세요.':'성향을 확실히 읽지 못했어요. 확대 사진과 선택값을 비교해 체크하거나, 성향을 직접 수정하세요.'}</p>${evidence}`}</div>`;
}
