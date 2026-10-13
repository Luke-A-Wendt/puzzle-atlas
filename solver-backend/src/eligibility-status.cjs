'use strict';
// 0 unknown, 1 feasible, 2 proved infeasible. Unknown must stay selectable.
function eligibilityStatus(result,a,b){
 if(!result||!Number.isInteger(result.degree)||!Number.isInteger(a)||a<0||a>=result.degree)return 0;
 if(b===undefined){const value=result.firstStatus?.[a];return value===1||value===2?value:0;}
 if(!Number.isInteger(b)||b<0||b>=result.degree)return 0;
 const index=a*result.degree+b,byte=index>>>3,mask=1<<(index&7);
 if(!result.knownPairs||!(result.knownPairs[byte]&mask))return 0;
 return result.feasiblePairs?.[byte]&mask?1:2;
}
module.exports={eligibilityStatus};
