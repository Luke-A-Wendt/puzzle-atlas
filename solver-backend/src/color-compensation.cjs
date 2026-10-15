'use strict';

// A small additional exact family: swap the selected identities and, if
// necessary, exchange ONE disjoint pair of equal-colored stickers. Every
// other identity is fixed. Failure in this family is NOT general impossibility.
const {PermutationMembership,transposition,Limit}=require('./permutation-membership.cjs');
const {verify}=require('./index.cjs');
class ColorCompensationSearch {
 constructor(model,request,cache,{maxOutputMoves=5000}={}){
  this.model=model;this.request=request;this.maxOutputMoves=maxOutputMoves;
  this.membership=new PermutationMembership(model,cache);this.a=0;this.b=1;
  this.tests=0;this.done=false;this.result=null;this.triedSingle=false;
  this.occupied=request.occupiedNodes??Array.from({length:model.degree},(_,i)=>i);
 }
 advance({maxMs=100}={}){
  const deadline=performance.now()+maxMs,d=this.model.degree,req=this.request;
  while(!this.done&&performance.now()<deadline){
   let pair=null;
   if(!this.triedSingle)this.triedSingle=true;
   else{
    while(this.a<this.occupied.length-1){
     const a=this.occupied[this.a],b=this.occupied[this.b++];
     if(this.b===this.occupied.length){this.a++;this.b=this.a+1;}
     if(req.swap.includes(a)||req.swap.includes(b)||req.colorByNode[a]!==req.colorByNode[b])continue;
     pair=[a,b];break;
    }
    if(!pair){this.done=true;break;}
   }
   const p=transposition(d,...req.swap);if(pair){p[pair[0]]=pair[1];p[pair[1]]=pair[0];}
   this.tests++;const factor=this.membership.factor(p);if(!factor.member)continue;
   try{
    const word=this.membership.expand(factor.parts,{maxMs:Math.max(1,Math.ceil(deadline-performance.now())),maxOutputMoves:this.maxOutputMoves});
    if(!verify(this.model,req,word))throw Error('Compensated swap verification failed');
    this.result={status:'solved',moveIndices:word,optimal:false,verified:true,method:'same_color_compensated_transposition',compensatingPair:pair};this.done=true;
   }catch(error){if(!(error instanceof Limit))throw error;this.limited=true;}
  }
  return {result:this.result,done:this.done,tests:this.tests,limited:!!this.limited};
 }
}
module.exports={ColorCompensationSearch};
