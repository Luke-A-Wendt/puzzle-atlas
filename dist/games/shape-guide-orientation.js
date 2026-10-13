/* Orientation descriptions share the exact signed-matrix frame used by ShapeEngine. */
(function(root){
'use strict';
const eq=(a,b)=>a.every((v,i)=>v===b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const transform=(m,v)=>m.map(r=>dot(r,v));
function inspect(piece){
 if(!piece||!piece.orientation||!piece.home||!piece.pos)return{placed:false,aligned:false,text:'Select a piece to inspect its orientation.'};
 const placed=eq(piece.home,piece.pos);if(!placed)return{placed:false,aligned:false,text:'Move this piece to its home slot before correcting its orientation.'};
 const aligned=piece.orientation.every((r,i)=>r.every((v,j)=>v===Number(i===j)));
 if(aligned)return{placed:true,aligned:true,turnsClockwise:0,angle:0,text:'Aligned'};
 if(piece.kind==='edge')return{placed:true,aligned:false,turnsClockwise:1,angle:180,text:'Flipped'};
 const normal=piece.home,reference=Math.abs(normal[0])&&normal[1]===0&&normal[2]===0?[0,1,0]:[1,0,0];
 const sine=dot(normal,cross(reference,transform(piece.orientation,reference))),corner=piece.kind==='corner';
 const angle=corner?120:sine===0?180:90;
 const clockwise=sine<0;
 return{placed:true,aligned:false,turnsClockwise:corner?(clockwise?1:2):sine===0?2:clockwise?1:3,angle,text:angle+'°'+(angle===180?'':clockwise?' clockwise':' counterclockwise')};
}
const api={inspect,describe:p=>inspect(p).text};
root.ShapeGuideOrientation=Object.freeze(api);if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
