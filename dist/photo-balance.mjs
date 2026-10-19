import {parseAmount} from './engine.mjs';
import {screenshotGeometry} from './photo-parser.mjs';
import {readCoinGlyphs} from './coin-glyphs.mjs';

export function parseBalanceText(raw){
 const text=String(raw||'').normalize('NFKC').replace(/\s/g,'').toUpperCase();
 if(!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[A-Z]?$/.test(text))return {text:'',value:null,quality:'missing',raw:String(raw||'')};
 try{const value=parseAmount(text);return {text,value,quality:/[A-Z]$/.test(text)?'exact':'review',raw:String(raw||'')};}catch{return {text:'',value:null,quality:'missing',raw:String(raw||'')};}
}

// Only the purple amount at the upper-right header; exclude the ticket and coin icon.
export function prepareBalancePixels(data,width,height,geometry=screenshotGeometry(data,width,height),threshold=1.45){
 if(!geometry.wholeGame)return null;
 const left=Math.round(width*.829),right=Math.min(width,Math.round(width*.995));
 const top=Math.round(geometry.contentTop-width*.074),bottom=Math.round(geometry.contentTop-width*.012);
 if(top<0||bottom>height||bottom<=top)return null;
 const scale=5,pad=18,w=(right-left)*scale+pad*2,h=(bottom-top)*scale+pad*2,output=new Uint8ClampedArray(w*h*4);output.fill(255);
 let ink=0;
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const k=(y*width+x)*4,r=data[k],g=data[k+1],b=data[k+2];
  if(r>80&&b>90&&r>g*threshold&&b>g*threshold){ink++;for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
   const o=(((y-top)*scale+pad+dy)*w+(x-left)*scale+pad+dx)*4;output[o]=output[o+1]=output[o+2]=0;
  }}
 }
 if(ink<10)return null;
 return {width:w,height:h,data:output,geometry};
}

export async function recognizePhotoBalance(image,worker,encode,geometry){
 const crop=prepareBalancePixels(image.data,image.width,image.height,geometry);
 if(!crop)return {text:'',value:null,quality:'missing',raw:''};
 const glyphs=readCoinGlyphs(crop);
 if(glyphs)return {...parseBalanceText(glyphs.text),source:'bitmap',glyph_error:glyphs.error};
 if(!worker)return {text:'',value:null,quality:'missing',raw:''};
 await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789.,ABCDEFGHIJKLMNOPQRSTUVWXYZ'});
 try{
  const {data}=await worker.recognize(encode(crop));
  const parsed=parseBalanceText(data.text);
  return {...parsed,quality:parsed.value!==null?'review':'missing'};
 }finally{await worker.setParameters({tessedit_char_whitelist:''});}
}

export function balanceConsensus(records){
 const read=records.map(r=>r.balance).filter(b=>b&&Number.isFinite(b.value));
 if(!read.length)return {state:'missing',text:'',value:null};
 const values=[...new Set(read.map(b=>b.value))];
 if(values.length!==1)return {state:'conflict',text:'',value:null};
 const first=read[0];return {state:read.some(b=>b.quality==='exact')?'same':'review',text:first.text,value:first.value};
}

export function selectedPhotoBalance(records,override=null){
 if(override!==null){if(!override.trim())return null;const b=parseBalanceText(override);if(b.value===null)throw new Error('보유 코인을 7.5B 또는 7500000처럼 입력하세요.');return {...b,source:'manual'};}
 const c=balanceConsensus(records);
 return c.state==='same'?{text:c.text,value:c.value,source:'photo'}:null;
}

export function applyPhotoBalance(selection,input,note){
 if(!selection)return false;
 if(!Number.isFinite(selection.value)||parseAmount(selection.text)!==selection.value)throw new Error('사진의 보유 코인을 다시 확인하세요.');
 input.value=selection.text;
 if(note)note.textContent=`사진 표시 ${selection.text} 적용 · 축약 표시이므로 실제 잔액과 차이 가능 · 직접 수정할 수 있어요.`;
 return true;
}
