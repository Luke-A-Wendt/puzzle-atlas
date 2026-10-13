'use strict';
// Diagnostic audit of the actual native Canvas output. Transport and reference
// paths are counted alike, but duplicate strokes do not masquerade as two
// rings. Physical mobility is derived separately from the engines.
const assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const {recorder,stickerMarks,visiblePaths,segmentDistance}=require('./connected-map-recorder.cjs');
const families={ultimate:'SkewbEngine',diamond:'SkewbEngine',skewb:'SkewbEngine',masterskewb:'SkewbEngine',jing:'SkewbEngine',fto:'FTOEngine',helicopter:'HelicopterEngine',crystal:'CrystalEngine',diamondstyle:'ShapeEngine',diamondcube:'ShapeEngine',rhombic:'ShapeEngine',flatdiamond:'ShapeEngine',cornerocta:'ShapeEngine',trajber:'ShapeEngine',jewel:'ShapeEngine',pyramorphix:'ShapeEngine',mastermorphix:'ShapeEngine',dino:'DinoEngine',rainbow:'DinoEngine',pyraminx:'TetraEngine',tetraminx:'TetraEngine',megaminx:'MegaEngine',cube2:'CubeEngine',cube3:'CubeEngine',cube4:'CubeEngine',cube5:'CubeEngine',cube6:'CubeEngine',cube7:'CubeEngine',cube8:'CubeEngine',mirror:'MirrorEngine',homer:'CubeEngine'};
const cubePalette=new Set(['#eeeef6','#f4ce48','#39bd8b','#4c90ef','#ee596e','#f29a4b']);
const clone=x=>JSON.parse(JSON.stringify(x)),distance3=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
function nearestSegment(point,stroke){
 let distance=Infinity,tangent=null;
 for(const sub of stroke.path)for(let i=1;i<sub.points.length;i++){
  const a=sub.points[i-1],b=sub.points[i],d=segmentDistance(point,a,b),length=Math.hypot(b.x-a.x,b.y-a.y);
  if(d<distance&&length>1e-8){distance=d;tangent=[(b.x-a.x)/length,(b.y-a.y)/length];}
 }
 return{distance,tangent};
}
function incidence(point,paths){
 const hits=paths.map((p,index)=>({index,...nearestSegment(point,p)})).filter(p=>p.distance<.35);
 // A shallow/tangent meeting is still an intersection. Keep its angle as a
 // readability diagnostic, without imposing an arbitrary new acceptance gate.
 const crossing=hits.some((a,i)=>hits.slice(i+1).some(b=>Math.abs(a.tangent[0]*b.tangent[1]-a.tangent[1]*b.tangent[0])>Math.sin(Math.PI/36)));
 return{paths:hits.length,crossing};
}
function distinctPaths(capture){
 const unique=[];
 for(const stroke of visiblePaths(capture)){
  const points=stroke.path.flatMap(p=>p.points),bounds=['x','y'].flatMap(k=>[Math.min(...points.map(p=>p[k])),Math.max(...points.map(p=>p[k]))]);
  // Equal projected circles can arise from different axis descriptors. Check
  // the captured geometry, not descriptor identity or drawing order.
  const duplicate=unique.some(u=>bounds.every((v,i)=>Math.abs(v-u.bounds[i])<.1)&&points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/16))===0).every(p=>nearestSegment(p,u.stroke).distance<.1));
  if(!duplicate)unique.push({stroke,bounds});
 }
 return unique.map(u=>u.stroke);
}
function physicalAxes(model,state,kind){
 const configs=Array.isArray(model.configs)?model.configs:Object.entries(model.configs).map(([id,c])=>({...c,id}));
 const result=new Map(state.map(s=>[s.id,[]]));
 for(const cfg of configs){
  const face=cfg.id||cfg.face,move={face,dir:1,turns:1};
  let after;
  if(kind==='solid'){model.applyMove(move);after=clone(model.stickerState);model.applyMove({...move,dir:-1});}
  else after=model.applyMove(state,move);
  const byId=new Map(after.map(s=>[s.id,s]));
  for(const s of state){
   const a=byId.get(s.id);let changed;
   if(kind==='fixed')changed=s.slot!==a.slot;
   else if(kind==='cube')changed=distance3(s.p,a.p)>1e-7||distance3(s.n,a.n)>1e-7;
   else{const p=s.normal?s:model.slots[s.slot],q=a.normal?a:model.slots[a.slot];changed=distance3(p.center||p.p,q.center||q.p)>1e-7||distance3(p.normal,q.normal)>1e-7;}
   if(changed)result.get(s.id).push(face);
  }
 }
 return result;
}
function auditPage(name){
 const capture=recorder(),app=createHarness({htmlPath:path.resolve(__dirname,'../dist/games',name+'.html'),bundled:true,canvasContexts:{rings:capture.context},dimensions:{rings:{width:600,height:600}},speed:5,search:'?color=1'});
 const kind=['pyraminx','tetraminx','megaminx'].includes(name)?'fixed':/^(cube[2-8]|mirror|homer)$/.test(name)?'cube':'solid';
 const E=app.context[families[name]],model=kind==='solid'?E.create(name):E;
 const palette=kind==='cube'?cubePalette:new Set((kind==='fixed'?model.makeSolved():model.slots).map(s=>s.color)),results=[];
 const mix=model.scramble('intersection-audit-'+name,9);
 for(const mixed of [false,true]){
  if(mixed){app.context.PUZZLE_API.runMoves(mix);app.complete();if(kind==='solid')mix.forEach(m=>model.applyMove(m));}
  const state=kind==='solid'?clone(model.stickerState):mixed?mix.reduce((s,m)=>model.applyMove(s,m),model.makeSolved()):model.makeSolved();
  const dots=stickerMarks(capture,palette),paths=distinctPaths(capture);
  assert.equal(dots.length,state.length,name+' exactly one rendered node per sticker');
  const mobility=physicalAxes(model,state,kind);
  const records=dots.map((p,i)=>{assert(!p.invalid,name+' every sticker is one full circle');if(kind!=='cube')assert.equal(p.color,state[i].color,name+' exact physical sticker color');return{id:state[i].id,kind:p.kind,...incidence(p,paths),axes:mobility.get(state[i].id),radius:p.r,outline:p.outlineColor};});
  const shapeFailures=records.filter(r=>r.kind!=='circle').map(r=>({id:r.id,kind:r.kind,axes:r.axes}));
  const failed=records.filter(r=>r.kind==='circle'&&r.axes.length&&r.paths<2),categories={fixed:[],singleAxis:[],multipleAxes:[]};
  for(const r of failed)categories[r.axes.length===0?'fixed':r.axes.length===1?'singleAxis':'multipleAxes'].push({id:r.id,paths:r.paths,axes:r.axes});
  const movable=records.filter(r=>r.axes.length),references=records.filter(r=>!r.axes.length);
  assert(records.every(r=>Math.abs(r.radius-records[0].radius)<1e-7),name+' all nodes share the same circular radius');
  assert(references.every(r=>r.outline!=='#ffffff'),name+' stationary references never have the moving outline');
  const summary={name,state:mixed?'mixed':'solved',quietMode:app.elements.get('ringFocus')?.attributes['aria-pressed']==='true',nodes:dots.length,movableNodes:movable.length,references:references.length,rings:paths.length,intersections:movable.length-failed.length,shallowIntersections:movable.filter(r=>r.paths>=2&&!r.crossing).length,minimumRadius:Math.min(...movable.map(r=>r.radius)),failures:categories,shapeFailures};
  results.push(summary);
 }
 return results;
}
if(require.main===module){
 const names=process.argv.slice(2).filter(s=>!s.startsWith('--')),results=(names.length?names:Object.keys(families)).flatMap(auditPage);
 if(process.argv.includes('--json'))console.log(JSON.stringify(results,null,2));
 else for(const r of results){const summary=Object.entries(r.failures).filter(([,a])=>a.length).map(([k,a])=>k+': '+a.length).join(', ');console.log(r.name+' '+r.state+': '+r.intersections+'/'+r.movableNodes+' intersection nodes; '+r.references+' fixed references; '+r.rings+' visible rings; minimum radius '+r.minimumRadius.toFixed(2)+(summary?' — '+summary:'')+(r.shapeFailures.length?' — incorrect marker shapes: '+r.shapeFailures.length:''));if(summary)console.log('  '+JSON.stringify(r.failures));}
 if(process.argv.includes('--assert'))assert(results.every(r=>!r.shapeFailures.length&&Object.values(r.failures).every(a=>!a.length)),'All movable circular nodes intersect distinct visible paths; fixed references remain circles without moving highlights');
}
module.exports={families,auditPage,incidence,physicalAxes,distinctPaths};
