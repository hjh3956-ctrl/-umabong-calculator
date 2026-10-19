import {screenshotGeometry} from './photo-parser.mjs';
export const GRADE_COLORS=['','빨강','주황','흰색','노랑','초록'];
// Grade text uses a five-color palette. Classify saturated core pixels, not
// surrounding labels, shadows or the selected lane's border.
function pixelGrade(r,g,b){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
 if(max<110)return 0;
 if(delta/max<.23&&min>130)return 3;
 if(delta/max<.42)return 0;
 let hue=max===r?60*((g-b)/delta%6):max===g?60*((b-r)/delta+2):60*((r-g)/delta+4);
 if(hue<0)hue+=360;
 if(hue<14||hue>346)return 1;
 if(hue>=14&&hue<43)return 2;
 if(hue>=43&&hue<78)return 4;
 if(hue>=78&&hue<165)return 5;
 return 0;
}
export function readGradeColors(data,width,height,geometry=screenshotGeometry(data,width,height)){
 if(!geometry.wholeGame||!geometry.lane)return Array(6).fill(null);
 return [.145,.208,.271,.334,.398,.535].map(offset=>{
  const center=geometry.contentTop+width*offset;
  const y0=Math.max(0,Math.round(center-width*.021)),y1=Math.min(height,Math.round(center+width*.021));
  const x0=Math.round(width*.645),x1=Math.round(width*.965),counts=Array(6).fill(0);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const k=(y*width+x)*4,grade=pixelGrade(data[k],data[k+1],data[k+2]);if(grade)counts[grade]++;
  }
  const colored=[1,2,4,5].reduce((sum,i)=>sum+counts[i],0),minimum=Math.max(12,width*width*.000055);
  const pool=colored>=minimum?[1,2,4,5]:[3];
  const ranked=pool.map(grade=>({grade,count:counts[grade]})).sort((a,b)=>b.count-a.count),best=ranked[0],total=pool.reduce((s,g)=>s+counts[g],0);
  if(best.count<minimum||best.count/Math.max(1,total)<.72)return null;
  return {value:best.grade,quality:'review',source:'color',raw:`글자색 ${GRADE_COLORS[best.grade]}`,color: GRADE_COLORS[best.grade],pixels:best.count,dominance:best.count/total};
 });
}
