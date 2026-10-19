// Pure screenshot preprocessing and conservative Korean OCR parsing.
import {TRAITS} from './engine.mjs';
export const STAT_NAMES=['스피드','스테미너','파워','근성','지능','컨디션'];
export const VALUE_WORDS=[
 [['느림'],['조금 느림'],['보통'],['빠름'],['매우 빠름']],
 [['서있기 힘듦','서 있기 힘듦'],['조금 약함'],['보통'],['강함'],['매우 강함']],
 [['매우 허약함'],['허약함'],['보통'],['조금 강함'],['힘이 넘침']],
 [['포기했음'],['포기가 빠름'],['보통'],['포기가 늦음'],['포기를 모름']],
 [['예능 적합','예능 적임'],['머리는 좋으나 노력하지 않음'],['보통'],['영리함'],['매우 영리함']],
 [['매우 나쁨'],['나쁨'],['보통'],['좋음'],['매우 좋음']]
];
const norm=s=>String(s).normalize('NFC').replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
export function editDistance(a,b){
 const row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){let old=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const prev=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,old+(a[i-1]===b[j-1]?0:1));old=prev;}}
 return row[b.length];
}
function matchValue(text,options){
 const n=norm(text);if(!n)return {value:null,quality:'missing',raw:text};
 const scored=options.map(o=>({...o,score:Math.max(...o.words.map(w=>{const v=norm(w);return 1-editDistance(n,v)/Math.max(n.length,v.length);}))})).sort((a,b)=>b.score-a.score);
 const best=scored[0],margin=best.score-(scored[1]?.score??0);
 if(best.score<.52||margin<.07)return {value:null,quality:'missing',raw:text};
 return {value:best.value,quality:best.score===1?'exact':'review',raw:text,score:best.score};
}
export function parseFieldText(text,index){
 const raw=String(text).trim();
 if(index===6)return matchValue(raw,Object.entries(TRAITS).filter(([k])=>k!=='PRESSURE_IMMUNITY').map(([value,label])=>({value,words:[label]})));
 return matchValue(raw,VALUE_WORDS[index].map((words,g)=>({value:g+1,words})).filter(x=>x.words.length));
}
const ANCHORS=[['스피드','스피드'],['스테미너','스테미너'],['파워','파워'],['근성','근성'],['지능','지능'],['컨디션','컨디션'],['성향','성향']];
export function parsePhotoText(text){
 const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean),rows=new Map();let firstAnchor=lines.length;
 for(let l=0;l<lines.length;l++){
  const compact=norm(lines[l]);
  for(let i=0;i<ANCHORS.length;i++){
   const anchor=norm(ANCHORS[i][0]);let at=compact.indexOf(anchor),length=anchor.length;
   // Labels can lose a character. Only accept a near match at the line start.
   if(at<0&&anchor.length>=3){for(const size of [anchor.length,anchor.length-1,anchor.length+1]){if(editDistance(compact.slice(0,size),anchor)===1){at=0;length=size;break;}}}
   if(at<0)continue;
   const tail=compact.slice(at+length);
   let value=tail;
   if(!value&&l+1<lines.length&&!ANCHORS.some(([a])=>norm(lines[l+1]).includes(norm(a))))value=lines[l+1];
   if(!rows.has(i)||value.length)rows.set(i,value);
   firstAnchor=Math.min(firstAnchor,l);break;
  }
 }
 const fields=VALUE_WORDS.map((words,i)=>matchValue(rows.get(i)||'',words.map((w,g)=>({value:g+1,words:w})).filter(o=>o.words.length)));
 const trait=matchValue(rows.get(6)||'',Object.entries(TRAITS).filter(([k])=>k!=='PRESSURE_IMMUNITY').map(([value,label])=>({value,words:[label]})));
 const names=lines.slice(0,firstAnchor).filter(x=>!/(히든|게임|스탯|스텟|START|확정|스피드|스테미너)/i.test(x)&&/[가-힣]/.test(x)&&norm(x).length>=2&&norm(x).length<40);
 return {fields,trait,name:names.at(-1)||'',recognized:fields.filter(x=>x.value!==null).length+(trait.value!==null?1:0),raw:text};
}
function isGreen(data,k){const r=data[k],g=data[k+1],b=data[k+2];return g>115&&g>r*1.45&&g>b*1.17;}
export function screenshotGeometry(data,width,height){
 let bestStart=0,bestEnd=height,currentStart=-1,lastGood=-1,bestLength=0;
 const step=Math.max(1,Math.floor(width/90));
 for(let y=0;y<height;y+=2){
  let lit=0,total=0;
  for(let x=Math.floor(width*.12);x<width*.95;x+=step){const k=(y*width+x)*4;if(Math.max(data[k],data[k+1],data[k+2])>24)lit++;total++;}
  const good=lit/total>.63;
  if(good){if(currentStart<0)currentStart=y;lastGood=y;}
  if(currentStart>=0&&(!good&&y-lastGood>width*.035||y+2>=height)){
   if(lastGood-currentStart>bestLength){bestStart=currentStart;bestEnd=lastGood;bestLength=lastGood-currentStart;}
   currentStart=-1;
  }
 }
 const wholeGame=bestLength>width*.9&&height>width*1.4;
 const contentTop=wholeGame?bestStart:0;
 let lane=null,laneScore=0,laneMargin=0;
 if(wholeGame){
  const scores=Array.from({length:6},(_,i)=>{
   let score=0;
   const top=Math.round(contentTop+width*(.012+i*.188)),bottom=Math.min(height,Math.round(top+width*.173));
   for(let y=Math.max(0,top);y<bottom;y+=2)for(let x=Math.round(width*.004);x<width*.18;x+=2){if(isGreen(data,(y*width+x)*4))score++;}
   return {lane:i+1,score};
  }).sort((a,b)=>b.score-a.score);
  laneScore=scores[0].score;laneMargin=laneScore-scores[1].score;
  if(laneScore>width*.12&&laneMargin>Math.max(20,laneScore*.3))lane=scores[0].lane;
 }
 const crop=wholeGame?{left:Math.round(width*.435),top:Math.round(contentTop+width*.01),width:Math.round(width*.545),height:Math.round(width*.64)}:{left:0,top:0,width,height};
 crop.top=Math.max(0,Math.min(height-1,crop.top));crop.height=Math.min(crop.height,height-crop.top);crop.width=Math.min(crop.width,width-crop.left);
 return {wholeGame,contentTop,contentBottom:bestEnd,lane,laneScore,laneMargin,crop};
}
export function preparePixels(data,width,height,{full=false}={}){
 const geometry=screenshotGeometry(data,width,height),crop=full?{left:0,top:0,width,height}:geometry.crop;
 const scale=Math.min(3,Math.max(1,1100/crop.width)),w=Math.round(crop.width*scale),h=Math.round(crop.height*scale);
 const output=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=crop.left+Math.min(crop.width-1,Math.floor(x/scale)),sy=crop.top+Math.min(crop.height-1,Math.floor(y/scale)),p=(sy*width+sx)*4;
  // Red/yellow/green/white glyphs all become dark ink on white paper.
  const r=data[p],g=data[p+1],b=data[p+2],max=Math.max(r,g,b);
  const value=255-Math.max(0,Math.min(255,(max-80)*255/150)),k=(y*w+x)*4;output[k]=output[k+1]=output[k+2]=value;output[k+3]=255;
 }
 return {width:w,height:h,data:output,geometry};
}
export function prepareFieldPixels(data,width,height,index){
 const geometry=screenshotGeometry(data,width,height);
 if(!geometry.wholeGame)return null;
 const center=geometry.contentTop+width*[.145,.208,.271,.334,.398,.535,.598][index];
 const top=Math.max(0,Math.round(center-width*.022)),bottom=Math.min(height,Math.round(center+width*.022));
 let left=Math.round(width*.565);const right=Math.round(width*.973);
 const columns=[];
 for(let x=left;x<right;x++){
  let ink=0;for(let y=top;y<bottom;y++){const k=(y*width+x)*4;if(Math.max(data[k],data[k+1],data[k+2])>125)ink++;}
  columns.push(ink>1);
 }
 // Remove a fragment of a label when a large gap separates it from the value.
 let gapStart=-1,bestGap=null;
 for(let i=0;i<=columns.length;i++){
  if(i<columns.length&&!columns[i]){if(gapStart<0)gapStart=i;}
  else if(gapStart>=0){if(gapStart>0&&i-gapStart>width*.04&&columns.slice(i).some(Boolean))bestGap=[gapStart,i];gapStart=-1;}
 }
 if(bestGap)left+=bestGap[1];
 const cropWidth=right-left,cropHeight=bottom-top,scale=3,w=Math.round(cropWidth*scale)+36,h=Math.round(cropHeight*scale)+30;
 const output=new Uint8ClampedArray(w*h*4);output.fill(255);
 for(let y=0;y<h-30;y++)for(let x=0;x<w-36;x++){
  const sx=left+Math.floor(x/scale),sy=top+Math.floor(y/scale),p=(sy*width+sx)*4;
  const max=Math.max(data[p],data[p+1],data[p+2]),value=255-Math.max(0,Math.min(255,(max-80)*255/150)),k=((y+15)*w+x+18)*4;
  output[k]=output[k+1]=output[k+2]=value;
 }
 return {width:w,height:h,data:output,geometry};
}
