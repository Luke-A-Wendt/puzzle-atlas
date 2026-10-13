/* Minimal connected rotation atlas for tetrahedral mechanisms.
 * Edge stickers are the exact intersections of two main axis circles.
 * Vertex stickers complete each axis's three 120-degree cycles. Pyraminx
 * tips have companion circles; Jing's face centers meet three center loops.
 * The abstract geometry respects every physical sticker permutation while
 * opening equal-color regions for a readable map. No colors are averaged.
 */
(function(root){
'use strict';
const TAU=Math.PI*2,MAIN=.50,TIP=.92,EPS=1e-7;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,k)=>a.map(x=>x*k),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=p=>mul(p,1/Math.hypot(...p));
function rotate(p,n,a){const c=Math.cos(a),s=Math.sin(a);return add(add(mul(p,c),mul(cross(n,p),s)),mul(n,dot(n,p)*(1-c)));}
function supports(model){return model.type==='jing'||!!(model.homePieces&&model.vertices&&model.slotSelected);}
function create(model){
 if(!supports(model))throw Error('Tetra ring specialization needs a Tetraminx, Pyraminx, or Jing model');
 const fixed=!!model.makeSolved,slots=model.slots,configs=(Array.isArray(model.configs)?model.configs:Object.values(model.configs)).map(c=>({...c,id:c.id||c.face,face:c.id||c.face,angle:c.angle||-TAU/3})),byId=Object.fromEntries(configs.map(c=>[c.id,c])),main=configs.filter(c=>!c.tip),type=model.type||(configs.some(c=>c.tip)?'pyraminx':'tetraminx'),mainCut=type==='jing'?.56:type==='pyraminx'?.536:MAIN,phase=type==='jing'?.325:0,alpha=type==='pyraminx'?.6:type==='jing'?.55:.5;
 const slotOf=s=>typeof s==='number'?slots[s]:s&&typeof s.slot==='number'?slots[s.slot]:s;
 function affected(s,id){s=slotOf(s);const c=typeof id==='string'?byId[id]:id;if(fixed)return model.slotSelected(s,c);return dot(model.polyhedron.pieces[s.piece].home,c.anchor)>EPS;}
 function info(s){
  if(fixed)return{kind:s.kind==='center'?'vertex':s.kind,axes:s.axes.map(id=>byId[id]),normal:s.normal};
  const p=model.polyhedron.pieces[s.piece];return{kind:p.kind==='corner'?'vertex':p.kind,axes:main.filter(c=>dot(p.home,c.anchor)>EPS),normal:s.normal};
 }
 // Each vertex triple may be phased around its own fixed axis: this commutes
 // with all legal turns. Jing uses that freedom to separate its face centers.
 // The tips get their own latitude so no two single-color nodes overlap.
 const positions=slots.map(s=>{const item=info(s),normal=item.normal;
  if(item.kind==='center')return unit(normal);
  if(item.kind==='edge'){
   const a=item.axes[0].normal,b=item.axes[1].normal,base=mul(add(a,b),mainCut/(1+dot(a,b))),offset=mul(unit(cross(a,b)),Math.sqrt(Math.max(0,1-dot(base,base)))),p=add(base,offset),q=sub(base,offset);return dot(p,normal)>dot(q,normal)?p:q;
  }
  const n=item.axes[0].normal,k=item.kind==='tip'?TIP:mainCut,tangent=unit(sub(normal,mul(n,dot(normal,n))));return rotate(add(mul(n,k),mul(tangent,Math.sqrt(1-k*k))),n,phase);
 });
 const rings=[],allByFace={};
 for(const c of main){
  const primary={face:c.id,name:c.id,key:c.id,normal:c.normal,cut:mainCut,main:true,vertex:c.vertex||c.id,tip:false,label:c.label||c.id,slots:slots.filter(s=>affected(s,c.id)&&info(s).kind!=='tip'&&info(s).kind!=='center').map(s=>s.id)};
  rings.push(primary);allByFace[c.id]=[primary];
  if(model.type==='jing'){const centers={face:c.id,name:c.id,key:c.id+':centers',normal:c.normal,cut:1/3,main:false,companion:true,centerLoop:true,label:c.id+' centers',slots:slots.filter(s=>affected(s,c.id)&&info(s).kind==='center').map(s=>s.id)};rings.push(centers);allByFace[c.id].push(centers);}
 }
 for(const c of configs.filter(c=>c.tip)){const tip={face:c.id,name:c.id,key:c.id,normal:c.normal,cut:TIP,main:true,vertex:c.vertex,companion:true,tip:true,label:c.label||c.id,slots:slots.filter(s=>affected(s,c.id)).map(s=>s.id)};rings.push(tip);allByFace[c.id]=[tip];const parent=main.find(m=>m.vertex===c.vertex);if(parent)allByFace[parent.id].push(tip);}
 function position(s){return positions[slotOf(s).id];}
 function interpolate(s,move,t){const slot=slotOf(s),m=typeof move==='string'?model.normalizeMove(move):move;if(t<=0||!affected(slot,m.face))return position(slot);const c=byId[m.face];return rotate(position(slot),c.normal,c.angle*(m.dir===undefined?1:m.dir)*(m.turns||1)*Math.min(1,t));}
 const pole=main.at(-1).normal.slice();
 return{type,positions,rings,allByFace,position,interpolate,affected,mainCut,tipCut:TIP,suggestedProjection:{pole,alpha},slots,configs,configById:byId,rotate};
}
root.ConnectedTetraRings=Object.freeze({create,supports,MAIN,TIP});if(typeof module!=='undefined'&&module.exports)module.exports=root.ConnectedTetraRings;
})(typeof globalThis!=='undefined'?globalThis:this);
