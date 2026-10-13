'use strict';
// Mathematical classification: 0 unknown, 1 feasible, 2 proved infeasible.
// Feasibility is distinct from having a bounded, executable move sequence.
function eligibilityStatus(result,a,b){
 if(!result||!Number.isInteger(result.degree)||!Number.isInteger(a)||a<0||a>=result.degree)return 0;
 if(b===undefined){const value=result.firstStatus?.[a];return value===1||value===2?value:0;}
 if(!Number.isInteger(b)||b<0||b>=result.degree)return 0;
 const index=a*result.degree+b,byte=index>>>3,mask=1<<(index&7);
 if(!result.knownPairs||!(result.knownPairs[byte]&mask))return 0;
 return result.feasiblePairs?.[byte]&mask?1:2;
}
function eligibilityReady(result,a,b){
 if(!result||!Number.isInteger(result.degree)||!Number.isInteger(a)||a<0||a>=result.degree)return false;
 if(b===undefined)return result.readyFirstStatus?.[a]===1;
 if(!Number.isInteger(b)||b<0||b>=result.degree||a===b)return false;
 const index=a*result.degree+b;
 return !!(result.readyPairs?.[index>>>3]&(1<<(index&7)));
}
function eligibilityWitness(result,a,b){
 if(!eligibilityReady(result,a,b))return null;
 for(const entry of result.readyWitnesses??[]){
  if(!Array.isArray(entry.word)||!entry.word.length||entry.word.length>5000||!Array.isArray(entry.pairs))continue;
  for(let i=0;i<entry.pairs.length;i+=2){const x=entry.pairs[i],y=entry.pairs[i+1];if((a===x&&b===y)||(a===y&&b===x))return entry.word.slice();}
 }
 return null;
}
module.exports={eligibilityStatus,eligibilityReady,eligibilityWitness};
