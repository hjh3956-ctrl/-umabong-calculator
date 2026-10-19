// Small bitmap currency glyphs. Uncertain matches are rejected, not corrected by guessing a unit.
const FONT={
 0:'01110/10001/10011/10101/11001/10001/01110',1:'00100/01100/00100/00100/00100/00100/01110',2:'01110/10001/00001/00010/00100/01000/11111',3:'11110/00001/00001/01110/00001/00001/11110',4:'00010/00110/01010/10010/11111/00010/00010',5:'11111/10000/10000/11110/00001/00001/11110',6:'01110/10000/10000/11110/10001/10001/01110',7:'11111/00001/00001/00001/00001/00001/00001',8:'01110/10001/10001/01110/10001/10001/01110',9:'01110/10001/10001/01111/00001/00001/01110',
 A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',D:'11110/10001/10001/10001/10001/10001/11110',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',G:'01111/10000/10000/10111/10001/10001/01111',H:'10001/10001/10001/11111/10001/10001/10001',I:'11111/00100/00100/00100/00100/00100/11111',J:'00111/00010/00010/00010/10010/10010/01100',K:'10001/10010/10100/11000/10100/10010/10001',L:'10000/10000/10000/10000/10000/10000/11111',M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/10101/10011/10001/10001/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',Q:'01110/10001/10001/10001/10101/10010/01101',R:'11110/10001/10001/11110/10100/10010/10001',S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',U:'10001/10001/10001/10001/10001/10001/01110',V:'10001/10001/10001/10001/10001/01010/00100',W:'10001/10001/10001/10101/10101/10101/01010',X:'10001/10001/01010/00100/01010/10001/10001',Y:'10001/10001/01010/00100/00100/00100/00100',Z:'11111/00001/00010/00100/01000/10000/11111'
};
const variants=[...Object.entries(FONT),['5','11111/11000/11000/11111/01111/01111/11111'],['B','11110/11111/10001/11111/11111/11111/11110']].map(([char,rows])=>({char,mask:rows.replaceAll('/','').split('').map(Number)}));
export function readCoinGlyphs(crop){
 const {width:w,height:h,data}=crop,dark=(x,y)=>data[(y*w+x)*4]<128;
 const glyphs=[];let start=-1;
 for(let x=0;x<=w;x++){
  let ink=false;if(x<w)for(let y=0;y<h;y++)if(dark(x,y)){ink=true;break;}
  if(ink&&start<0)start=x;
  if(!ink&&start>=0){let top=h,bottom=0,count=0;for(let y=0;y<h;y++)for(let k=start;k<x;k++)if(dark(k,y)){top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}if(count>=15)glyphs.push({left:start,right:x,top,bottom:bottom+1});start=-1;}
 }
 if(!glyphs.length||glyphs.length>14)return null;
 const fullHeight=Math.max(...glyphs.map(g=>g.bottom-g.top));let text='',minimumMargin=1,maximumError=0;
 for(let i=0;i<glyphs.length;i++){
  const g=glyphs[i],gw=g.right-g.left,gh=g.bottom-g.top;
  if(gh<fullHeight*.4&&g.top>glyphs[0].top+fullHeight*.55){text+='.';continue;}
  if(gh<fullHeight*.65)return null;
  const mask=Array.from({length:35},(_,n)=>{
   const gx=n%5,gy=Math.floor(n/5);let ink=0,total=0;
   for(let y=Math.floor(g.top+gh*gy/7);y<g.top+gh*(gy+1)/7;y++)for(let x=Math.floor(g.left+gw*gx/5);x<g.left+gw*(gx+1)/5;x++){total++;if(dark(x,y))ink++;}
   return ink/total>.5?1:0;
  });
  const best=new Map();for(const v of variants){if(i!==glyphs.length-1&&!/\d/.test(v.char))continue;const error=v.mask.reduce((s,b,j)=>s+(b!==mask[j]?1:0),0)/35;best.set(v.char,Math.min(error,best.get(v.char)??1));}
  const ranked=[...best].sort((a,b)=>a[1]-b[1]),margin=ranked[1][1]-ranked[0][1];
  maximumError=Math.max(maximumError,ranked[0][1]);minimumMargin=Math.min(minimumMargin,margin);text+=ranked[0][0];
 }
 if(maximumError>.085||minimumMargin<.055||!/^\d+(?:\.\d+)?[A-Z]?$/.test(text))return null;
 return {text,error:maximumError,margin:minimumMargin};
}
