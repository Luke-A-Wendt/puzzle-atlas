'use strict';
// Bounded algebraic word shortening. Preserves the entire permutation, not only
// requested nodes. The dictionary never exceeds a small quadratic move table.
function shorten(model,sequence,options={}){
 const deadline=performance.now()+(options.maxMs??100),n=model.degree,m=model.moves.length,identity=Array.from({length:n},(_,i)=>i),key=p=>p.join(','),compose=(a,b)=>a.map(x=>b[x]);
 const dict=new Map([[key(identity),[]]]);let bytes=key(identity).length*2,limit=options.maxBytes??8*1024*1024;
 for(let i=0;i<m;i++){const k=key(model.moves[i].perm);if(!dict.has(k)){dict.set(k,[i]);bytes+=k.length*2+80;}}
 for(let i=0;i<m;i++)for(let j=0;j<m;j++){
  if(performance.now()>deadline||bytes>limit)return {moveIndices:sequence,shortenedBy:0,dictionaryBytes:bytes,limited:true};
  const k=key(compose(model.moves[i].perm,model.moves[j].perm));if(!dict.has(k)){dict.set(k,[i,j]);bytes+=k.length*2+88;}
 }
 let out=sequence.slice(),changes=0;
 for(let pass=0;pass<2;pass++){
  let any=false;
  for(let start=0;start<out.length;start++){
   if(performance.now()>deadline)return {moveIndices:out,shortenedBy:sequence.length-out.length,dictionaryBytes:bytes,limited:true};
   let p=identity,best=null;
   for(let len=1;len<=6&&start+len<=out.length;len++){
    p=compose(p,model.moves[out[start+len-1]].perm);const match=dict.get(key(p));if(match&&match.length<len)best={len,match};
   }
   if(best){out.splice(start,best.len,...best.match);any=true;changes++;start=Math.max(-1,start-3);}
  }
  if(!any)break;
 }
 return {moveIndices:out,shortenedBy:sequence.length-out.length,changes,dictionaryBytes:bytes,limited:false};
}
module.exports={shorten};
